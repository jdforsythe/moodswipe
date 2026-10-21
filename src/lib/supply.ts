import type { Caption, Parameters, Photo } from "../../shared/types";
import { matches, validateCandidate } from "../../shared/quality";
import { paramKey } from "./parameters";
import { validRemotePhoto } from "./photos";
import { CLIENT_GENERATION_TIMEOUT_MS } from "../../shared/limits";
export type SupplyStatus =
  | "checking"
  | "disabled"
  | "generating"
  | "ready"
  | "waiting"
  | "unavailable"
  | "limited";
export class RemoteSupply {
  pool: Caption[] = [];
  photos: Photo[] = [];
  enabled = false;
  photoEnabled = false;
  checked = false;
  checkedAt = 0;
  stopped = false;
  pending = false;
  nextAttempt = 0;
  key = "";
  photoKey = "";
  photoPending = false;
  photoNextAttempt = 0;
  status: SupplyStatus = "checking";
  controller?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private params?: Parameters;
  private activeUntil = 0;
  constructor(
    private available: () => void,
    private changed: () => void = () => {},
  ) {}
  private setStatus(status: SupplyStatus) {
    if (this.stopped || this.status === status) return;
    this.status = status;
    this.changed();
  }
  private schedule() {
    clearTimeout(this.timer);
    const delay = Math.max(100, this.nextAttempt - Date.now());
    if (
      this.stopped ||
      document.hidden ||
      !navigator.onLine ||
      Date.now() + delay > this.activeUntil
    )
      return;
    this.timer = setTimeout(() => {
      if (this.params && Date.now() <= this.activeUntil)
        void this.run(this.params);
    }, delay);
  }
  suspend() {
    clearTimeout(this.timer);
  }
  async retry(params: Parameters) {
    if (this.pending) return;
    this.checked = false;
    this.nextAttempt = 0;
    await this.replenish(params);
  }
  async initialize() {
    if (!navigator.onLine) return false;
    this.setStatus("checking");
    try {
      const response = await fetch("/api/health", {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return false;
      const health = await response.json();
      if (this.stopped) return false;
      this.enabled = health.ai === "configured";
      this.photoEnabled = health.photos === "configured";
      this.checked = true;
      this.checkedAt = Date.now();
      return true;
    } catch {
      return false;
    }
  }
  take(params: Parameters, recent: string[]) {
    // Already displayed/rejected IDs must not make an unusable pool appear full.
    this.pool = this.pool.filter((c) => !recent.includes(c.id));
    const index = this.pool.findIndex(
      (c) => matches(c, params) && !recent.includes(c.id),
    );
    return index < 0 ? undefined : this.pool.splice(index, 1)[0];
  }
  async replenish(params: Parameters, activity = true) {
    this.params = { ...params };
    if (activity) this.activeUntil = Date.now() + 120000;
    await this.run(params);
  }
  private async run(params: Parameters) {
    if (this.stopped || !navigator.onLine || document.hidden || this.pending)
      return;
    if (Date.now() < this.nextAttempt) {
      this.schedule();
      return;
    }
    clearTimeout(this.timer);
    this.pending = true;
    let retry = false;
    try {
      if (!this.checked || Date.now() - this.checkedAt >= 30000) {
        if (!(await this.initialize())) throw new Error("health_unavailable");
      }
      if (this.stopped) return;
      void this.replenishPhotos(params);
      if (!this.enabled) {
        this.setStatus("disabled");
        this.nextAttempt = Date.now() + 30000;
        retry = true;
        return;
      }
      const key = params.random ? "random" : paramKey(params);
      if (
        this.key === key &&
        this.pool.filter((c) => matches(c, params)).length > 4
      )
        return;
      this.key = key;
      this.setStatus("generating");
      this.controller = new AbortController();
      const timeout = setTimeout(
        () => this.controller?.abort(),
        CLIENT_GENERATION_TIMEOUT_MS,
      );
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params }),
          signal: this.controller.signal,
        });
        const result = await response.json();
        if (response.status === 429) {
          this.nextAttempt =
            Date.now() +
            Math.max(
              1,
              Math.min(
                900,
                Number(response.headers.get("Retry-After")) ||
                  Number(result.retryAfter) ||
                  60,
              ),
            ) *
              1000;
          this.setStatus("waiting");
          retry = true;
          return;
        }
        if (!response.ok || !Array.isArray(result.captions))
          throw new Error("generation_unavailable");
        if (this.stopped) return;
        const captions = result.captions
          .slice(0, 20)
          .flatMap((raw: unknown) => {
            const validated = validateCandidate(raw).caption;
            if (!validated) return [];
            const source = (raw as Caption).source;
            return [
              {
                ...validated,
                source:
                  source === "salvage" || source === "remix" ? source : "llm",
              } as Caption,
            ];
          });
        this.pool = [...this.pool, ...captions]
          .filter((c, i, a) => a.findIndex((v) => v.id === c.id) === i)
          .slice(-100);
        this.nextAttempt =
          Date.now() +
          Math.max(1, Math.min(86400, Number(result.retryAfter) || 15)) * 1000;
        this.setStatus(
          captions.length
            ? "ready"
            : result.reason === "daily_budget"
              ? "limited"
              : result.reason === "provider_unavailable"
                ? "unavailable"
                : "waiting",
        );
        retry = !captions.length;
        if (captions.length) this.available();
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      this.nextAttempt = Date.now() + 30000;
      this.setStatus("unavailable");
      retry = true;
    } finally {
      this.pending = false;
      this.changed();
      if (retry) this.schedule();
    }
  }
  async replenishPhotos(params: Parameters) {
    if (
      !this.photoEnabled ||
      this.photoPending ||
      this.stopped ||
      Date.now() < this.photoNextAttempt
    )
      return;
    const keywords: Record<string, string> = {
      Nature: "forest",
      Cinematic: "mountain",
      Urban: "city",
      Abstract: "water",
      Minimal: "sand",
      "Surreal-looking photography": "architecture",
    };
    const keyword = keywords[params.aesthetic];
    const key = keyword + params.aesthetic;
    if (key === this.photoKey && this.photos.length > 4) return;
    this.photoKey = key;
    this.photoPending = true;
    this.photoNextAttempt = Date.now() + 60000;
    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, aesthetic: params.aesthetic }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("photos");
      const data = await response.json();
      if (Array.isArray(data.photos))
        this.photos = [...this.photos, ...data.photos.filter(validRemotePhoto)]
          .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
          .slice(-48);
    } catch {
      this.photoNextAttempt = Date.now() + 900000;
    } finally {
      this.photoPending = false;
    }
  }
  stop() {
    this.stopped = true;
    this.suspend();
    this.controller?.abort();
  }
}
