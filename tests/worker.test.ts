import { describe, it, expect, vi } from "vitest";
import worker from "../worker/index";
import { CandidatePool } from "../worker/pool";
import { parseBatch, WorkersAIProvider } from "../worker/providers";
import {
  consumeBucket,
  allowedOrigin,
  boundedJson,
  anonymousHash,
} from "../worker/security";
import { DEFAULT_PARAMS } from "../shared/types";
import type { Env } from "../worker/env";
function mockState() {
  const map = new Map<string, unknown>();
  let alarm: number | null = null;
  return {
    storage: {
      get: async (k: string) => map.get(k),
      put: async (k: string, v: unknown) => {
        map.set(k, structuredClone(v));
      },
      getAlarm: async () => alarm,
      setAlarm: async (n: number) => {
        alarm = n;
      },
    },
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
  } as unknown as DurableObjectState;
}
const req = () =>
  new Request("https://pool/generate", {
    method: "POST",
    headers: { "X-Client-IP": "1.2.3.4" },
    body: JSON.stringify({ params: DEFAULT_PARAMS }),
  });
describe("Worker boundary", () => {
  it("expires pre-update editorial batches without resetting the daily attempt ledger", async () => {
    const pool = new CandidatePool(mockState(), { AI_ENABLED: "false" } as Env);
    await pool.initialized;
    pool.state.editorialVersion = 1;
    pool.state.aiCalls = 123;
    pool.state.pool = [
      { caption: { text: "Lake of broken mirrors" }, uses: 0 },
    ] as typeof pool.state.pool;
    const body = await (await pool.fetch(req())).json();
    expect(body).toMatchObject({ captions: [], mode: "local" });
    expect(pool.state.pool).toEqual([]);
    expect(pool.state.aiCalls).toBe(123);
  });
  it("returns a short retry for pacing instead of a fifteen-minute fallback", async () => {
    const ai = { run: vi.fn() };
    const pool = new CandidatePool(mockState(), {
      AI: ai,
      AI_ENABLED: "true",
    } as unknown as Env);
    await pool.initialized;
    pool.state.lastGeneration = Date.now();
    const body = (await (await pool.fetch(req())).json()) as {
      reason: string;
      retryAfter: number;
    };
    expect(ai.run).not.toHaveBeenCalled();
    expect(body.reason).toBe("paced");
    expect(body.retryAfter).toBeLessThanOrEqual(15);
  });
  it("honors a 500-attempt operator budget beyond the old hard ceiling", async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error("429 quota")) };
    const pool = new CandidatePool(mockState(), {
      AI: ai,
      AI_ENABLED: "true",
      DAILY_AI_CALLS: "500",
    } as unknown as Env);
    await pool.initialized;
    pool.state.aiCalls = 120;
    await pool.fetch(req());
    expect(ai.run).toHaveBeenCalledTimes(1);
    expect(pool.state.aiCalls).toBe(121);
  });
  it("accepts a live-like 31-second inference while keeping a bounded timeout", async () => {
    vi.useFakeTimers();
    try {
      const raw = {
        candidates: [{ caption: "A slow but valid provider response." }],
      };
      const ai = {
        run: vi.fn(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ response: raw }), 31000),
            ),
        ),
      };
      const provider = new WorkersAIProvider({ AI: ai } as unknown as Env);
      const outcome = provider.generate(DEFAULT_PARAMS, []).then(
        (value) => ({ value }),
        (error: Error) => ({ error: error.message }),
      );
      await vi.advanceTimersByTimeAsync(31000);
      expect(await outcome).toEqual({ value: raw.candidates });
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets a stale provider circuit after a configuration change without resetting the daily budget", async () => {
    const pool = new CandidatePool(mockState(), {
      AI: { run: vi.fn() },
      AI_ENABLED: "true",
      DAILY_AI_CALLS: "1",
    } as unknown as Env);
    await pool.initialized;
    Object.assign(pool.state, {
      aiCalls: 1,
      failures: 3,
      openUntil: Date.now() + 900000,
      providerConfig: "old-model:18000",
    });
    await pool.fetch(req());
    expect(pool.state.aiCalls).toBe(1);
    expect(pool.state.failures).toBe(0);
    expect(pool.state.openUntil).toBe(0);
  });

  it("shares the generation deadline across a slow transient failure and its retry", async () => {
    vi.useFakeTimers();
    try {
      const ai = {
        run: vi
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("upstream unavailable")),
                  30000,
                ),
              ),
          )
          .mockImplementationOnce(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () => resolve({ response: { candidates: [] } }),
                  30000,
                ),
              ),
          ),
      };
      const pool = new CandidatePool(mockState(), {
        AI: ai,
        AI_ENABLED: "true",
      } as unknown as Env);
      let result: unknown;
      const pending = pool.fetch(req()).then(async (r) => {
        result = await r.json();
      });
      await vi.waitFor(() => expect(ai.run).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(46000);
      expect(result).toMatchObject({ mode: "local", captions: [] });
      expect(ai.run).toHaveBeenCalledTimes(2);
      expect(pool.state.openUntil).toBeGreaterThan(Date.now());
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("denies cross-site origins and unbounded bodies", async () => {
    expect(
      allowedOrigin(
        new Request("https://app/api", { headers: { Origin: "https://evil" } }),
      ),
    ).toBe(false);
    await expect(
      boundedJson(
        new Request("https://app", { method: "POST", body: "x".repeat(3000) }),
      ),
    ).rejects.toThrow();
  });
  it("returns safe health, method checks and parameter validation without provider calls", async () => {
    const env = {} as Env;
    expect(
      (await worker.fetch(new Request("https://app/api/health"), env)).status,
    ).toBe(200);
    expect(
      (await worker.fetch(new Request("https://app/api/generate"), env)).status,
    ).toBe(403);
    expect(
      (
        await worker.fetch(
          new Request("https://app/api/generate", {
            headers: { Origin: "https://app" },
          }),
          env,
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await worker.fetch(
          new Request("https://app/api/generate", {
            method: "POST",
            headers: {
              Origin: "https://app",
              "Content-Type": "application/json",
            },
            body: '{"params":{}}',
          }),
          env,
        )
      ).status,
    ).toBe(400);
  });
  it("caps short-lived buckets and rotates IP-derived hashes", async () => {
    const buckets = {};
    expect(consumeBucket(buckets, "x", 1, 10)).toBe(true);
    expect(consumeBucket(buckets, "x", 1, 11)).toBe(false);
    expect(consumeBucket(buckets, "x", 1, 60011)).toBe(true);
    expect(await anonymousHash("1", "a")).not.toBe(
      await anonymousHash("1", "b"),
    );
  });
  it("limits concurrent requests durably and does not call a disabled provider", async () => {
    const ai = { run: vi.fn() };
    const pool = new CandidatePool(mockState(), { AI: ai } as unknown as Env);
    const responses = await Promise.all(
      Array.from({ length: 7 }, () => pool.fetch(req())),
    );
    expect(responses.map((r) => r.status)).toEqual([
      200, 200, 200, 200, 200, 200, 429,
    ]);
    expect(ai.run).not.toHaveBeenCalled();
  });
  it("fails over on invalid/quota-exhausted provider, opens circuit, and respects daily cap", async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error("429 quota")) };
    const pool = new CandidatePool(mockState(), {
      AI: ai,
      AI_ENABLED: "true",
      DAILY_AI_CALLS: "1",
    } as unknown as Env);
    expect(await (await pool.fetch(req())).json()).toMatchObject({
      mode: "local",
      captions: [],
    });
    await pool.fetch(req());
    expect(ai.run).toHaveBeenCalledTimes(1);
    expect(pool.state.openUntil).toBeGreaterThan(Date.now());
    expect(pool.state.aiCalls).toBe(1);
  });
  it("converts valid model output into real llm provenance and never accepts markup", async () => {
    const ai = {
      run: vi.fn().mockResolvedValue({
        response: {
          candidates: [
            {
              caption:
                "The forest has declined my request for a progress update.",
              mood: "sarcastic",
              topic: "Everyday",
              intensity: 3,
              technique: "deadpan",
              visualKeywords: ["forest"],
              visualAesthetic: "Nature",
            },
            { caption: "<script>alert(1)</script>" },
          ],
        },
      }),
    };
    const pool = new CandidatePool(mockState(), {
      AI: ai,
      AI_ENABLED: "true",
    } as unknown as Env);
    const body = (await (await pool.fetch(req())).json()) as {
      captions: { source: string }[];
    };
    expect(body.captions).toHaveLength(1);
    expect(body.captions[0].source).toBe("llm");
    expect(pool.state.rejected.unsafe).toBe(1);
  });
  it("rejects malformed provider JSON and oversized batches", async () => {
    expect(() => parseBatch({ response: "invalid" })).toThrow();
    expect(() =>
      parseBatch({ response: { candidates: Array(21).fill({}) } }),
    ).toThrow();
    await expect(
      new WorkersAIProvider({} as Env).generate(DEFAULT_PARAMS, []),
    ).rejects.toThrow("unconfigured");
  });
});
import { safePhoto, validPhotoRequest, PexelsProvider } from "../worker/photos";
describe("Pexels contract", () => {
  const raw = {
    id: 1,
    width: 1200,
    height: 1600,
    url: "https://www.pexels.com/photo/forest-1/",
    photographer: "Sample Photographer",
    alt: "Green forest with morning mist",
    src: { large2x: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg" },
  };
  it("preserves creator/license and accepts only known photo hosts", () => {
    expect(safePhoto(raw, "forest", "Nature")).toMatchObject({
      source: "Pexels",
      creator: raw.photographer,
      cacheAllowed: true,
    });
    expect(
      safePhoto(
        { ...raw, src: { large2x: "https://evil.test/a.jpg" } },
        "forest",
        "Nature",
      ),
    ).toBe(null);
  });
  it("rejects identifiable people and arbitrary photo query inputs", () => {
    expect(
      safePhoto({ ...raw, alt: "A woman in the forest" }, "forest", "Nature"),
    ).toBe(null);
    expect(
      validPhotoRequest({ keyword: "https://evil.test", aesthetic: "Nature" }),
    ).toBe(false);
  });
  it("fails safely when photo credentials are invalid", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 401 }));
    await expect(
      new PexelsProvider("test-only").search("forest", "Nature"),
    ).rejects.toThrow("unavailable");
    mock.mockRestore();
  });
});
it("stops immediately when a transient failure trips the circuit", async () => {
  const ai = {
    run: vi.fn().mockRejectedValue(new Error("upstream unavailable")),
  };
  const pool = new CandidatePool(mockState(), {
    AI: ai,
    AI_ENABLED: "true",
  } as unknown as Env);
  await pool.initialized;
  pool.state.failures = 2;
  await pool.fetch(req());
  expect(ai.run).toHaveBeenCalledTimes(1);
  expect(pool.state.openUntil).toBeGreaterThan(Date.now());
});
