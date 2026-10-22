import { validParams, type Caption, type Parameters } from "../shared/types";
import {
  classify,
  matches,
  selectPool,
  validateCandidate,
  type PoolItem,
  type RejectionReason,
} from "../shared/quality";
import {
  DEFAULT_MODEL,
  EDITORIAL_VERSION,
  WorkersAIProvider,
} from "./providers";
import {
  GENERATION_TIMEOUT_MS,
  GENERATION_INTERVAL_MS,
  DEFAULT_DAILY_AI_CALLS,
  MAX_DAILY_AI_CALLS,
} from "../shared/limits";
import { anonymousHash, consumeBucket, type Bucket } from "./security";
import type { Env } from "./env";
export const PHOTO_TERMS = [
  "landscape",
  "forest",
  "mountain",
  "lake",
  "ocean",
  "desert",
  "coffee",
  "architecture",
  "city",
  "sky",
  "work",
  "water",
  "trees",
  "sand",
  "building",
  "nature",
  "quiet",
  "space",
];
type State = {
  day: string;
  salt: string;
  aiCalls: number;
  photoCalls: number;
  buckets: Record<string, Bucket>;
  pool: PoolItem[];
  recent: Caption[];
  rejected: Partial<Record<RejectionReason, number>>;
  failures: number;
  openUntil: number;
  lastGeneration: number;
  providerConfig?: string;
  editorialVersion?: number;
};
const empty = (providerConfig: string): State => ({
  day: new Date().toISOString().slice(0, 10),
  salt: crypto.randomUUID(),
  aiCalls: 0,
  photoCalls: 0,
  buckets: {},
  pool: [],
  recent: [],
  rejected: {},
  failures: 0,
  openUntil: 0,
  lastGeneration: 0,
  providerConfig,
  editorialVersion: EDITORIAL_VERSION,
});
export class CandidatePool {
  state!: State;
  initialized: Promise<void>;
  gate: Promise<unknown> = Promise.resolve();
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    this.initialized = ctx.blockConcurrencyWhile(async () => {
      this.state =
        (await ctx.storage.get<State>("state")) ??
        empty(`${env.AI_MODEL || DEFAULT_MODEL}:${GENERATION_TIMEOUT_MS}`);
    });
  }
  fetch(request: Request): Promise<Response> {
    const task = this.gate.then(() => this.handle(request));
    this.gate = task.catch(() => {});
    return task;
  }
  private async persist() {
    await this.ctx.storage.put("state", this.state);
    if (!(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 24 * 3600000);
  }
  async alarm() {
    this.state.buckets = {};
    this.state.salt = crypto.randomUUID();
    this.state.pool = this.state.pool.filter(
      (i) => Date.now() - i.caption.createdAt < 7 * 86400000,
    );
    this.state.recent = this.state.recent.slice(-100);
    await this.ctx.storage.put("state", this.state);
  }
  async handle(request: Request) {
    await this.initialized;
    const now = Date.now(),
      day = new Date(now).toISOString().slice(0, 10);
    if (this.state.day !== day) {
      this.state = {
        ...this.state,
        day,
        salt: crypto.randomUUID(),
        aiCalls: 0,
        photoCalls: 0,
        buckets: {},
      };
    }
    const id = await anonymousHash(
      request.headers.get("X-Client-IP") || "unknown",
      this.state.salt,
    );
    if (
      !consumeBucket(this.state.buckets, "global", 60, now) ||
      !consumeBucket(this.state.buckets, id, 6, now)
    ) {
      await this.persist();
      return Response.json(
        { error: "rate_limited", retryAfter: 60 },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    const path = new URL(request.url).pathname;
    if (path === "/photo-budget") {
      const allowed =
        this.state.photoCalls <
        Math.min(300, Number(this.env.DAILY_PHOTO_CALLS) || 120);
      if (allowed) this.state.photoCalls++;
      await this.persist();
      return Response.json({ allowed }, { status: allowed ? 200 : 429 });
    }
    const body = (await request.json()) as { params?: Parameters };
    if (!validParams(body.params))
      return Response.json({ error: "invalid_parameters" }, { status: 400 });
    const params = body.params;
    if (this.state.editorialVersion !== EDITORIAL_VERSION) {
      // Old generic batches must not leak back through salvage/remix after an
      // editorial update. Preserve quota, pacing, and abuse counters.
      this.state.pool = [];
      this.state.recent = [];
      this.state.editorialVersion = EDITORIAL_VERSION;
    }
    // An operator's model/configuration fix may recover an open circuit. Keep
    // the durable spending ledger and generation pacing intact across changes.
    const providerConfig = `${this.env.AI_MODEL || DEFAULT_MODEL}:${GENERATION_TIMEOUT_MS}`;
    if (
      this.env.AI_ENABLED === "true" &&
      this.state.providerConfig !== providerConfig
    ) {
      this.state.providerConfig = providerConfig;
      this.state.failures = 0;
      this.state.openUntil = 0;
    }
    this.state.pool = this.state.pool
      .filter((i) => now - i.caption.createdAt < 7 * 86400000)
      .slice(-180);
    // Serve strong unused items first; generation is globally paced and shared.
    const hasFresh =
      this.state.pool.filter(
        (i) => !i.reason && !i.uses && matches(i.caption, params),
      ).length >= 4;
    const budget = Math.max(
      0,
      Math.min(
        MAX_DAILY_AI_CALLS,
        Math.floor(Number(this.env.DAILY_AI_CALLS ?? DEFAULT_DAILY_AI_CALLS)) ||
          0,
      ),
    );
    if (
      !hasFresh &&
      this.env.AI_ENABLED === "true" &&
      this.env.AI &&
      this.state.aiCalls < budget &&
      now >= this.state.openUntil &&
      now - this.state.lastGeneration >= GENERATION_INTERVAL_MS
    ) {
      const provider = new WorkersAIProvider(this.env);
      const deadline = Date.now() + GENERATION_TIMEOUT_MS;
      for (
        let attempt = 0;
        attempt < 2 && this.state.aiCalls < budget;
        attempt++
      ) {
        if (Date.now() >= deadline) break;
        this.state.aiCalls++;
        this.state.lastGeneration = Date.now();
        await this.persist(); // Reserve before I/O: restarts and retries cannot overspend the application cap.
        try {
          const raw = await provider.generate(
            params,
            this.state.recent.map((c) => c.text),
            deadline - Date.now(),
          );
          let accepted = 0;
          for (const value of raw) {
            const result = validateCandidate(value);
            const c = result.caption;
            const reason =
              result.reason ??
              (c ? classify(c, this.state.recent, PHOTO_TERMS) : "low_quality");
            if (reason)
              this.state.rejected[reason] =
                (this.state.rejected[reason] ?? 0) + 1;
            if (
              !c ||
              (reason &&
                reason !== "temporary_similarity" &&
                reason !== "photo_mismatch")
            )
              continue;
            this.state.pool.push({
              caption: c,
              reason,
              eligibleAt: reason ? Date.now() + 30 * 60000 : 0,
              uses: 0,
              lastUsed: 0,
            });
            this.state.recent.push(c);
            accepted++;
          }
          this.state.recent = this.state.recent.slice(-150);
          if (!accepted) throw new Error("no_valid_candidates");
          this.state.failures = 0;
          break;
        } catch (error) {
          this.state.failures++;
          const message = String(error);
          const permanent =
            /401|403|429|quota|unauthor|timeout|unconfigured/i.test(message);
          if (permanent || this.state.failures >= 3)
            this.state.openUntil = Date.now() + 15 * 60000;
          if (permanent || this.state.failures >= 3 || attempt === 1) break;
          await new Promise((resolve) =>
            setTimeout(resolve, 400 * 2 ** attempt + Math.random() * 200),
          );
        }
      }
    }
    const captions = selectPool(this.state.pool, params, PHOTO_TERMS, now, 12);
    const current = Date.now();
    const pacedFor = Math.max(
      1,
      Math.ceil(
        (this.state.lastGeneration + GENERATION_INTERVAL_MS - current) / 1000,
      ),
    );
    let reason: string | undefined;
    let retryAfter = pacedFor;
    if (!captions.length) {
      if (this.env.AI_ENABLED !== "true" || !this.env.AI) {
        reason = "disabled";
        retryAfter = 30;
      } else if (this.state.aiCalls >= budget) {
        reason = "daily_budget";
        retryAfter = Math.max(
          1,
          Math.ceil(
            (Date.parse(`${day}T00:00:00Z`) + 86400000 - current) / 1000,
          ),
        );
      } else if (this.state.openUntil > current || this.state.failures > 0) {
        reason = "provider_unavailable";
        retryAfter = Math.max(
          30,
          Math.ceil((this.state.openUntil - current) / 1000),
        );
      } else if (current < this.state.lastGeneration + GENERATION_INTERVAL_MS) {
        reason = "paced";
      } else {
        reason = "filtered";
        retryAfter = 15;
      }
    }
    await this.persist();
    return Response.json({
      captions,
      mode: captions[0]?.source ?? "local",
      reason,
      retryAfter,
    });
  }
}
