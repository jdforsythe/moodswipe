import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RemoteSupply } from "../src/lib/supply";
import { DEFAULT_PARAMS } from "../shared/types";
const candidate = {
  text: "The mountain has declined my request for a progress update.",
  mood: "wholesome",
  topic: "Technology",
  intensity: 1,
  technique: "deadpan",
  visualKeywords: ["mountain"],
  visualAesthetic: "Nature",
  source: "llm",
};
let supplies: RemoteSupply[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("document", { hidden: false });
  supplies = [];
});
afterEach(() => {
  supplies.forEach((s) => s.stop());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function supply() {
  const s = new RemoteSupply(vi.fn());
  supplies.push(s);
  return s;
}
it("rechecks a cached disabled configuration during continued browsing", async () => {
  let configured = false;
  let generations = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/health")
        return Response.json({ ai: configured ? "configured" : "disabled" });
      generations++;
      return Response.json({ captions: [candidate], retryAfter: 15 });
    }),
  );
  const s = supply();
  await s.replenish(DEFAULT_PARAMS);
  configured = true;
  await vi.advanceTimersByTimeAsync(31000);
  await s.replenish(DEFAULT_PARAMS);
  expect(generations).toBeGreaterThan(0);
});
it("retries a short server cooldown without another swipe", async () => {
  let generations = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/health") return Response.json({ ai: "configured" });
      generations++;
      return Response.json(
        generations === 1
          ? { captions: [], reason: "paced", retryAfter: 2 }
          : {
              captions: [
                {
                  ...candidate,
                  ...{ mood: "sarcastic", topic: "Everyday", intensity: 3 },
                },
              ],
              retryAfter: 15,
            },
      );
    }),
  );
  const s = supply();
  await s.replenish(DEFAULT_PARAMS);
  await vi.advanceTimersByTimeAsync(2100);
  expect(generations).toBe(2);
  expect(s.pool).toHaveLength(1);
});
it("accepts any valid mood/topic in Random Mode", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/health"
          ? { ai: "configured" }
          : { captions: [candidate], retryAfter: 15 },
      ),
    ),
  );
  const s = supply();
  await s.replenish({ ...DEFAULT_PARAMS, random: true });
  expect(s.take({ ...DEFAULT_PARAMS, random: true }, [])?.text).toBe(
    candidate.text,
  );
});
it("removes recent captions so repeats cannot block replenishment", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/health"
          ? { ai: "configured" }
          : { captions: [candidate], retryAfter: 15 },
      ),
    ),
  );
  const s = supply();
  await s.replenish({ ...DEFAULT_PARAMS, random: true });
  expect(
    s.take({ ...DEFAULT_PARAMS, random: true }, [s.pool[0].id]),
  ).toBeUndefined();
  expect(s.pool).toHaveLength(0);
});
it("does not keep retrying after the tab is hidden or supply is disposed", async () => {
  let generations = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/health") return Response.json({ ai: "configured" });
      generations++;
      return Response.json({ captions: [], reason: "paced", retryAfter: 2 });
    }),
  );
  const s = supply();
  await s.replenish(DEFAULT_PARAMS);
  Object.assign(document, { hidden: true });
  await vi.advanceTimersByTimeAsync(10000);
  expect(generations).toBe(1);
  s.stop();
  Object.assign(document, { hidden: false });
  await vi.advanceTimersByTimeAsync(120000);
  expect(generations).toBe(1);
});
