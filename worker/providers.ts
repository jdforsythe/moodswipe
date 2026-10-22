import { AESTHETICS, MOODS, TOPICS, type Parameters } from "../shared/types";
import type { Env } from "./env";
import { GENERATION_TIMEOUT_MS } from "../shared/limits";
export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Changing the editorial contract also expires older, otherwise valid pool items.
export const EDITORIAL_VERSION = 2;
export interface CaptionProvider {
  generate(
    params: Parameters,
    recent: string[],
    timeoutMs?: number,
  ): Promise<unknown[]>;
}
const schema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          caption: { type: "string" },
          mood: { type: "string", enum: MOODS },
          topic: { type: "string", enum: TOPICS },
          intensity: { type: "integer", minimum: 1, maximum: 5 },
          technique: { type: "string" },
          visualKeywords: { type: "array", items: { type: "string" } },
          visualAesthetic: { type: "string", enum: AESTHETICS },
          compositionHint: { type: "string", enum: ["top", "middle", "lower"] },
          conceptTags: { type: "array", items: { type: "string" } },
        },
        required: [
          "caption",
          "mood",
          "topic",
          "intensity",
          "technique",
          "visualKeywords",
          "visualAesthetic",
        ],
      },
    },
  },
  required: ["candidates"],
};
const voice: Record<Parameters["mood"], string> = {
  dark: "Gallows humor about ordinary life: mortality meeting admin, financial precarity, corporate disposability, aging, denial, family obligations. Give the narrator an uncomfortable, specific realization, then a sharp comic turn. Bleak AND funny, not gloomy poetry. Intensity 1 is wry; 5 is brutally candid. Never confuse 'dark' with saying void, abyss, existential dread or emptiness.",
  sarcastic:
    "Expose a recognizable contradiction: what people or institutions say versus what they actually do. Dry, precise, mildly ruthless. The second beat should puncture the first.",
  funny:
    "Specific everyday embarrassment or a tiny true observation with an unexpected payoff. The reader should recognize their own behavior and want to send it to a friend. No generic relatable-adulting slogans.",
  absurd:
    "Begin with a recognizable problem and take its logic one ridiculous but strangely coherent step further. Specificity beats randomly pairing nouns. A surreal premise still needs a payoff.",
  motivational:
    "A small, earned insight that changes how someone sees a concrete difficulty. Honest about the cost of trying. No commands to believe, hustle, follow dreams, or be your best self.",
  wholesome:
    "Specific evidence of affection or human kindness: the saved seat, remembered detail, quiet accommodation. Give the reader a moment of recognition, not an abstract affirmation.",
};
export function captionPrompt(params: Parameters, recent: string[]) {
  return `Write 8 original, shareable captions for a photographic meme feed. Each should read like a finished line someone would send to a friend: specific, conversational, economical. Usually 12-24 words, never over 160 characters. Output only the schema JSON.
${
  params.random
    ? `Include all six moods, plus two different extra moods. Vary topics and intensities. Voices:\n${Object.entries(
        voice,
      )
        .map(([mood, direction]) => `${mood}: ${direction}`)
        .join("\n")}`
    : `Mood: ${params.mood}. Topic: ${params.topic}. Intensity: ${params.intensity}/5. Visual aesthetic: ${params.aesthetic}. Surprise Me means varied topics.\n${voice[params.mood]}`
}
For comic moods, find a recognizable human truth, then turn it into a joke. A gloomy observation alone is not a joke. The last words should change how the reader understands the opening. Stop at that payoff; don't explain it. For warm moods, use a concrete detail that earns the feeling.
QUALITY BAR (illustrate craft; do not copy, paraphrase, or reuse these premises):
Dark: "The company says we're family. I've started asking to be in the will."
Dark: "My emergency contact and I are both hoping it doesn't come to that."
Sarcastic: "They asked for honest feedback. There was a character limit and a preferred answer."
Funny: "I put it somewhere safe. Apparently safe from me."
Wholesome: "You remembered how I take my tea. I noticed."
Choose eight DIFFERENT premises. Vary openings and point of view; don't start every caption with I/My. Mix short observations, confessions, dialogue, and reversals. No recycled joke-book lines, empty slogans, landscape descriptions, hashtags, or titles. No "back goes out more", "other shoe to drop", "retirement plan is to die young", or "charged for existing". "Coffee with a hint of existential dread" and "Ocean of uncertainty" are mood labels, not finished captions.
Write the caption FIRST. Then choose 2 background visualKeywords from forest, mountain, lake, ocean, desert, coffee, architecture, city, sky, water, trees, sand, building. Photos provide atmosphere or ironic contrast; don't build the joke around describing a photo. Vary backdrops and compositionHint (top/middle/lower). Include technique and 1-3 specific conceptTags. Honor the requested mood/topic/intensity/aesthetic in metadata.
Aim humor at ordinary behavior and institutions. No hate, slurs, targeted harassment, sexual content, graphic violence, encouragement of self-harm, identifiable real people or exploitation of real tragedies.
Do not repeat or lightly rewrite these recent captions: ${JSON.stringify(recent.slice(-8))}`;
}
export function parseBatch(response: unknown): unknown[] {
  const r = response as { response?: unknown };
  let value = r?.response ?? response;
  if (typeof value === "string") {
    if (value.length > 32000) throw new Error("oversize_model_output");
    value = JSON.parse(
      value.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""),
    );
  }
  const candidates = (value as { candidates?: unknown })?.candidates;
  if (
    !Array.isArray(candidates) ||
    candidates.length > 20 ||
    !candidates.length
  )
    throw new Error("malformed_model_output");
  return candidates;
}
export async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("provider_timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export class WorkersAIProvider implements CaptionProvider {
  constructor(private env: Env) {}
  async generate(
    params: Parameters,
    recent: string[],
    timeoutMs = GENERATION_TIMEOUT_MS,
  ) {
    if (!this.env.AI) throw new Error("provider_unconfigured");
    const prompt = captionPrompt(params, recent);
    const response = await withTimeout(
      this.env.AI.run(this.env.AI_MODEL || DEFAULT_MODEL, {
        messages: [
          {
            role: "system",
            content:
              "You write sharply observed, economical comedy people send to their friends. Every comic caption needs a human truth and an unexpected turn. Reject decorative word salad. Output only the requested JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: schema },
        max_tokens: 2200,
        temperature: 0.95,
      }),
      Math.max(1, Math.min(GENERATION_TIMEOUT_MS, timeoutMs)),
    );
    return parseBatch(response);
  }
}
