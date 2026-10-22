import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS } from "../shared/types";
import {
  validateCandidate,
  classify,
  selectPool,
  salvageEligible,
  similarity,
  fingerprint,
  type PoolItem,
} from "../shared/quality";
const raw = {
  caption: "My calendar has quietly applied for a quieter job.",
  mood: "sarcastic",
  topic: "Everyday",
  intensity: 3,
  technique: "deadpan",
  visualKeywords: ["forest"],
  visualAesthetic: "Nature",
};
const valid = () => validateCandidate(raw).caption!;
describe("untrusted candidate validation", () => {
  it("accepts complete valid captions with server generated fingerprint IDs", () => {
    expect(valid().id).toMatch(/^ai-/);
  });
  it("rejects unsafe, generic, overlong and malformed candidates", () => {
    expect(
      validateCandidate({ ...raw, caption: "<script>alert(1)</script>" })
        .reason,
    ).toBe("unsafe");
    expect(
      validateCandidate({ ...raw, caption: "Just believe in yourself today." })
        .reason,
    ).toBe("low_quality");
    expect(validateCandidate({ ...raw, caption: "x".repeat(181) }).reason).toBe(
      "too_long",
    );
    expect(validateCandidate({ ...raw, mood: "bogus" }).reason).toBe(
      "low_quality",
    );
  });
  it("rejects the scenery fragments reported from the live dark-humor feed", () => {
    for (const caption of [
      "Abandoned architecture, nature's revenge",
      "Coffee with a hint of existential dread",
      "Desert landscapes, inner emptiness",
      "Lake of broken mirrors",
      "Forest of forgotten books",
      "Skydiving into the weekend",
      "Building bridges to nowhere",
      "Sandcastles of self-doubt",
      "Ocean of uncertainty",
      "Tree of knowledge, roots of ignorance",
      "Tree in the void",
    ])
      expect(validateCandidate({ ...raw, mood: "dark", caption }).reason).toBe(
        "low_quality",
      );
    expect(
      validateCandidate({
        ...raw,
        mood: "dark",
        caption: "I asked about job security. They sent me a password reset.",
      }).caption,
    ).toBeDefined();
  });
  it("normalizes fingerprints and measures near duplicates", () => {
    expect(fingerprint("Hello, world!")).toBe(fingerprint("hello world"));
    expect(similarity(raw.caption, raw.caption)).toBe(1);
    expect(classify(valid(), [valid()], ["forest"])).toBe("duplicate");
  });
  it("temporarily withholds repeated openings and mismatched photos", () => {
    const c = {
      ...valid(),
      text: "My calendar has eaten the entire afternoon again.",
    };
    expect(classify(c, [valid()], ["forest"])).toBe("temporary_similarity");
    expect(
      classify({ ...valid(), visualKeywords: ["penguin"] }, [], ["forest"]),
    ).toBe("photo_mismatch");
  });
  it("never salvages unsafe or low quality rejects, even after cooldown", () => {
    for (const reason of [
      "unsafe",
      "low_quality",
      "duplicate",
      "too_long",
    ] as const)
      expect(
        salvageEligible(
          { caption: valid(), reason, uses: 0, lastUsed: 0, eligibleAt: 0 },
          1000,
          ["forest"],
        ),
      ).toBe(false);
  });
  it("enforces cooldown and photo recovery eligibility", () => {
    const item: PoolItem = {
      caption: valid(),
      reason: "photo_mismatch",
      uses: 0,
      lastUsed: 0,
      eligibleAt: 100,
    };
    expect(salvageEligible(item, 99, ["forest"])).toBe(false);
    expect(salvageEligible(item, 101, ["city"])).toBe(false);
    expect(salvageEligible(item, 101, ["forest"])).toBe(true);
  });
  it("prioritizes fresh then salvage then limited remixes", () => {
    const pool: PoolItem[] = [
      { caption: valid(), uses: 1, lastUsed: 0, eligibleAt: 0 },
      {
        caption: valid(),
        reason: "temporary_similarity",
        uses: 0,
        lastUsed: 0,
        eligibleAt: 0,
      },
      { caption: valid(), uses: 0, lastUsed: 0, eligibleAt: 0 },
    ];
    expect(
      selectPool(pool, DEFAULT_PARAMS, ["forest"], 7200000).map(
        (c) => c.source,
      ),
    ).toEqual(["llm", "salvage", "remix"]);
    expect(selectPool(pool, DEFAULT_PARAMS, ["forest"], 7200001)).toEqual([]);
  });
});
