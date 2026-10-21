import { it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_PARAMS,
  type Card,
  type Caption,
  type Photo,
  type Parameters,
} from "../shared/types";
vi.mock("../src/lib/storage", () => ({
  readRecent: async () => [],
  writeRecent: async () => {},
}));
vi.mock("../src/lib/supply", () => ({
  RemoteSupply: class {
    photos = [];
    take() {
      return undefined;
    }
    async replenish() {}
    stop() {}
  },
}));
vi.mock("../src/lib/composition", () => ({
  compose: vi.fn(
    async (caption: Caption, photo: Photo, params: Parameters) =>
      ({
        id: crypto.randomUUID(),
        caption,
        photo,
        params,
        blob: new Blob(["png"]),
        layout: {},
        createdAt: Date.now(),
      }) as Card,
  ),
}));
import { compose } from "../src/lib/composition";
import { CardQueue } from "../src/lib/queue";
import { localCaptions } from "../src/data/captions";
afterEach(() => vi.restoreAllMocks());
it("uses a random AI caption's actual mood, intensity and photo style when composing", async () => {
  vi.stubGlobal("navigator", {});
  const queue = new CardQueue({ ...DEFAULT_PARAMS, random: true });
  queue.supply = () => ({
    ...localCaptions[0],
    source: "llm",
    mood: "wholesome",
    topic: "Technology",
    intensity: 1,
    visualAesthetic: "Urban",
  });
  await queue.start();
  expect(queue.cards[0].params).toMatchObject({
    mood: "wholesome",
    topic: "Technology",
    intensity: 1,
    aesthetic: "Urban",
    random: true,
  });
  queue.stop();
});
it("bounds the composed queue and preserves the current card on filter changes", async () => {
  vi.stubGlobal("navigator", {});
  const queue = new CardQueue(DEFAULT_PARAMS);
  await queue.start();
  expect(queue.cards).toHaveLength(4);
  const first = queue.cards[0];
  queue.setParams({ ...DEFAULT_PARAMS, mood: "wholesome" });
  await vi.waitFor(() => expect(queue.cards).toHaveLength(4));
  expect(queue.cards[0]).toBe(first);
  expect(queue.cards.slice(1).every((c) => c.params.mood === "wholesome")).toBe(
    true,
  );
  queue.stop();
});
it("discards in-flight cards for old settings and prevents publishing after disposal", async () => {
  vi.stubGlobal("navigator", {});
  let finish: (card: Card) => void = () => {};
  const original = vi.mocked(compose).getMockImplementation()!;
  vi.mocked(compose).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const queue = new CardQueue(DEFAULT_PARAMS);
  const started = queue.start();
  await vi.waitFor(() => expect(vi.mocked(compose)).toHaveBeenCalled());
  queue.setParams({ ...DEFAULT_PARAMS, mood: "funny" });
  finish(await original({} as Caption, {} as Photo, DEFAULT_PARAMS));
  await started;
  expect(queue.cards.every((c) => c.params.mood === "funny")).toBe(true);
  queue.stop();
  const count = queue.cards.length;
  await queue.fill();
  expect(queue.cards).toHaveLength(count);
});
it("bounds retired export URLs during rapid saves and releases them on shutdown", async () => {
  vi.stubGlobal("navigator", {});
  const queue = new CardQueue(DEFAULT_PARAMS);
  await queue.start();
  for (let i = 0; i < 10; i++) {
    queue.advance(true);
    await vi.waitFor(() => expect(queue.cards).toHaveLength(4));
    expect(queue.retired.length).toBeLessThanOrEqual(3);
  }
  queue.stop();
  expect(queue.retired).toHaveLength(0);
});
