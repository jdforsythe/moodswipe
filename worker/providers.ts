import { AESTHETICS, MOODS, TOPICS, type Parameters } from "../shared/types";
import type { Env } from "./env";
import { GENERATION_TIMEOUT_MS } from "../shared/limits";
export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
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
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
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
          "id",
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
    const prompt = `Write 12 original short photographic meme captions, not templates. Return JSON matching the schema. Each caption 12-160 characters, at most 26 words. ${params.random ? "Use every mood twice and vary all topics, intensities and aesthetics." : `Mood ${params.mood}, topic ${params.topic}, intensity ${params.intensity}/5, visual aesthetic ${params.aesthetic}. Surprise Me means varied topics.`}
Use varied deadpan, irony, absurd specificity, juxtaposition, observation, inversion, anti-motivation, poetry, dark understatement and wholesome surprise. Vary openings, cadence and point of view. Avoid cliches, slogans, famous quotations, catchphrases and repeated concepts. Dark means existential wit, never cruelty. All captions must be non-sexual, non-violent, non-hateful and suitable for a general audience; no real people, brands, tragedies, protected groups, slurs, self-harm, illegal instructions or personal data. Target everyday situations and the narrator. Choose 1-3 concrete visualKeywords that match landscape, forest, mountain, lake, ocean, desert, coffee, architecture, city, sky, work, water, trees, sand, building. No identifiable people. Include technique and 1-3 conceptTags. Do not repeat these recent generic captions: ${JSON.stringify(recent.slice(-10))}`;
    const response = await withTimeout(
      this.env.AI.run(this.env.AI_MODEL || DEFAULT_MODEL, {
        messages: [
          {
            role: "system",
            content:
              "You are a careful, original comedy writer. Output only the requested JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: schema },
        max_tokens: 2600,
        temperature: 1.05,
      }),
      Math.max(1, Math.min(GENERATION_TIMEOUT_MS, timeoutMs)),
    );
    return parseBatch(response);
  }
}
