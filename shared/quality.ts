import {
  AESTHETICS,
  MOODS,
  TOPICS,
  type Caption,
  type Parameters,
} from "./types";
export type RejectionReason =
  | "unsafe"
  | "low_quality"
  | "duplicate"
  | "temporary_similarity"
  | "photo_mismatch"
  | "too_long";
export type PoolItem = {
  caption: Caption;
  reason?: RejectionReason;
  eligibleAt: number;
  uses: number;
  lastUsed: number;
};
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
export function fingerprint(text: string) {
  let hash = 2166136261;
  for (const c of normalize(text)) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
export function similarity(a: string, b: string) {
  const grams = (s: string) => {
    const words = normalize(s).split(" ");
    return new Set(words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`));
  };
  const aa = grams(a),
    bb = grams(b);
  const common = [...aa].filter((x) => bb.has(x)).length;
  return common / Math.max(1, aa.size + bb.size - common);
}
export function validateCandidate(value: unknown): {
  caption?: Caption;
  reason?: RejectionReason;
} {
  if (!value || typeof value !== "object") return { reason: "low_quality" };
  const c = value as Record<string, unknown>;
  const text =
    typeof c.caption === "string"
      ? c.caption
      : typeof c.text === "string"
        ? c.text
        : "";
  if (
    /[<>\u0000-\u001f]|https?:|www\./i.test(text) ||
    /\b(kill yourself|suicide|self.harm|rape|porn|nazi|racial|slur|genocide|terrorist)\b/i.test(
      text,
    )
  )
    return { reason: "unsafe" };
  if (text.length > 180 || text.split(/\s+/).some((w) => w.length > 24))
    return { reason: "too_long" };
  if (
    text.length < 12 ||
    /\b(live laugh love|keep calm and|good vibes only|just be yourself|everything happens for a reason|follow your dreams|believe in yourself)\b/i.test(
      text,
    )
  )
    return { reason: "low_quality" };
  if (
    !MOODS.includes(c.mood as never) ||
    !TOPICS.includes(c.topic as never) ||
    !Number.isInteger(c.intensity) ||
    Number(c.intensity) < 1 ||
    Number(c.intensity) > 5 ||
    typeof c.technique !== "string" ||
    c.technique.length < 3 ||
    c.technique.length > 60 ||
    !AESTHETICS.includes(c.visualAesthetic as never) ||
    !Array.isArray(c.visualKeywords) ||
    c.visualKeywords.length < 1 ||
    c.visualKeywords.length > 6 ||
    c.visualKeywords.some(
      (k) => typeof k !== "string" || !/^[a-zA-Z -]{2,35}$/.test(k),
    )
  )
    return { reason: "low_quality" };
  const hint = ["top", "middle", "lower"].includes(String(c.compositionHint))
    ? (c.compositionHint as Caption["compositionHint"])
    : undefined;
  return {
    caption: {
      id: `ai-${fingerprint(text)}`,
      text: text.trim(),
      mood: c.mood as Caption["mood"],
      topic: c.topic as string,
      intensity: c.intensity as number,
      technique: c.technique,
      visualKeywords: c.visualKeywords as string[],
      visualAesthetic: c.visualAesthetic as string,
      compositionHint: hint,
      source: "llm",
      createdAt: Date.now(),
      conceptTags: Array.isArray(c.conceptTags)
        ? c.conceptTags
            .filter(
              (v): v is string =>
                typeof v === "string" && /^[a-z -]{2,30}$/i.test(v),
            )
            .slice(0, 3)
        : [],
    },
  };
}
export function classify(
  c: Caption,
  recent: Caption[],
  photoTerms: string[],
): RejectionReason | undefined {
  if (
    recent.some(
      (r) =>
        fingerprint(r.text) === fingerprint(c.text) ||
        similarity(r.text, c.text) > 0.72,
    )
  )
    return "duplicate";
  const opening = normalize(c.text).split(" ").slice(0, 3).join(" ");
  if (
    recent
      .slice(-12)
      .some(
        (r) =>
          normalize(r.text).split(" ").slice(0, 3).join(" ") === opening ||
          similarity(r.text, c.text) > 0.34 ||
          (c.conceptTags?.length &&
            c.conceptTags.some((t) => r.conceptTags?.includes(t))),
      )
  )
    return "temporary_similarity";
  if (
    !c.visualKeywords.some((k) =>
      photoTerms.some((t) => k.toLowerCase().includes(t)),
    )
  )
    return "photo_mismatch";
}
export function salvageEligible(
  item: PoolItem,
  now: number,
  photoTerms: string[],
) {
  return (
    item.uses === 0 &&
    now >= item.eligibleAt &&
    (item.reason === "temporary_similarity" ||
      (item.reason === "photo_mismatch" &&
        item.caption.visualKeywords.some((k) =>
          photoTerms.some((t) => k.toLowerCase().includes(t)),
        )))
  );
}
export function matches(c: Caption, p: Parameters) {
  return (
    p.random ||
    (c.mood === p.mood &&
      (p.topic === "Surprise Me" || c.topic === p.topic) &&
      Math.abs(c.intensity - p.intensity) <= 1)
  );
}
export function selectPool(
  pool: PoolItem[],
  params: Parameters,
  terms: string[],
  now = Date.now(),
  limit = 12,
): Caption[] {
  const eligible = pool
    .filter((i) => matches(i.caption, params))
    .map((i) => ({
      i,
      priority:
        !i.reason && i.uses === 0
          ? 0
          : salvageEligible(i, now, terms)
            ? 1
            : !i.reason &&
                i.uses > 0 &&
                i.uses < 3 &&
                now - i.lastUsed > 3600000
              ? 2
              : 99,
    }))
    .filter((i) => i.priority < 99)
    .sort((a, b) => a.priority - b.priority || a.i.lastUsed - b.i.lastUsed);
  return eligible.slice(0, limit).map(({ i, priority }) => {
    i.uses++;
    i.lastUsed = now;
    return {
      ...i.caption,
      source: priority === 0 ? "llm" : priority === 1 ? "salvage" : "remix",
    };
  });
}
