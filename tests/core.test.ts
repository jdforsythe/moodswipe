import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { DEFAULT_PARAMS, MOODS, validParams, type Card } from "../shared/types";
import { randomize } from "../src/lib/parameters";
import { gestureAction, lockAxis } from "../src/lib/gestures";
import {
  fitText,
  wrapText,
  luminance,
  contrastScore,
} from "../src/lib/composition";
import {
  evictionIds,
  addRejected,
  getRejected,
  clearRejected,
} from "../src/lib/storage";
import { localCaptions, pickLocal } from "../src/data/captions";
import { photos, choosePhoto } from "../src/data/photos";
describe("offline content and parameters", () => {
  it("covers every mood and never mutates fixed settings", () => {
    const original = { ...DEFAULT_PARAMS };
    const result = randomize([original], () => 0.99);
    expect(validParams(result)).toBe(true);
    expect(original).toEqual(DEFAULT_PARAMS);
    MOODS.forEach((m) =>
      expect(
        localCaptions.filter((c) => c.mood === m).length,
      ).toBeGreaterThanOrEqual(16),
    );
  });
  it("avoids recent curated captions", () => {
    const first = pickLocal(DEFAULT_PARAMS, []);
    expect(pickLocal(DEFAULT_PARAMS, [first.id]).id).not.toBe(first.id);
  });
  it("prefers matching photos and penalizes repeats", () => {
    expect(
      choosePhoto(
        ["forest"],
        "Nature",
        [],
        photos.filter((p) => ["forest", "city"].includes(p.id)),
      ).id,
    ).toBe("forest");
  });
  it("keeps a matching subject even when its photo is recent or another aesthetic is preferred", () => {
    expect(choosePhoto(["ocean"], "Nature", ["ocean"]).id).toBe("ocean");
    expect(choosePhoto(["ocean"], "Urban", ["ocean"]).id).toBe("ocean");
  });
  it("rejects corrupted settings", () => {
    expect(validParams({ ...DEFAULT_PARAMS, intensity: 99 })).toBe(false);
  });
});
describe("gesture contract", () => {
  it("locks axis after slop", () => {
    expect(lockAxis(5, 3)).toBe(null);
    expect(lockAxis(35, 20)).toBe("x");
    expect(lockAxis(10, -50)).toBe("y");
  });
  it("implements left/right/up and springback", () => {
    expect(gestureAction(-100, 3, 0, "x", 390)).toBe("dismiss");
    expect(gestureAction(100, 3, 0, "x", 390)).toBe("save");
    expect(gestureAction(3, -100, 0, "y", 390)).toBe("share");
    expect(gestureAction(3, 100, 0, "y", 390)).toBe(null);
    expect(gestureAction(10, 0, 3, "x", 390)).toBe(null);
    expect(gestureAction(50, 0, 1, "x", 390)).toBe("save");
  });
});
describe("composition fitting", () => {
  it("fits every offline caption without truncation", () => {
    for (const c of localCaptions) {
      const fitted = fitText(c.text, (s, n) => s.length * n * 0.6);
      expect(fitted.lines.join(" ")).toBe(c.text);
      expect(fitted.lines.length * fitted.lineHeight).toBeLessThanOrEqual(490);
    }
  });
  it("rejects unbreakable text rather than clipping", () => {
    expect(wrapText("a".repeat(50), 20, (s) => s.length)).toBe(null);
  });
  it("scores flat dark regions ahead of bright/noisy regions", () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 255, 255)).toBe(1);
    expect(contrastScore([0, 0])).toBeLessThan(contrastScore([0, 1]));
  });
});
describe("bounded local rejected history", () => {
  const card = (id: string, date: number, size = 10) =>
    ({ id, createdAt: date, blob: new Blob(["x".repeat(size)]) }) as Card;
  it("evicts by age, count, and byte quota oldest first", () => {
    const now = 100000;
    const all = [card("old", 1), card("middle", 99998), card("new", 99999)];
    expect(evictionIds(all, now, { age: 10, count: 1, bytes: 100 })).toEqual([
      "middle",
      "old",
    ]);
    expect(
      evictionIds(all, now, { age: 200000, count: 100, bytes: 10 }),
    ).toEqual(["middle", "old"]);
  });
  it("stores blobs, dedupes IDs, and clears history", async () => {
    await clearRejected();
    const c = {
      ...card("one", Date.now()),
      caption: localCaptions[0],
      photo: photos[0],
      params: DEFAULT_PARAMS,
      layout: {},
    } as Card;
    await addRejected(c);
    await addRejected(c);
    const all = await getRejected();
    expect(all.length).toBe(1);
    expect(all[0].blob.size).toBe(10);
    await clearRejected();
    expect(await getRejected()).toEqual([]);
  });
});
