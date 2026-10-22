import type { Caption, Card, Parameters, ReadyCard } from "../../shared/types";
import { pickLocal } from "../data/captions";
import { choosePhoto, photos } from "../data/photos";
import { compose, type Presentation } from "./composition";
import { randomize } from "./parameters";
import {
  readRecent,
  writeRecent,
  readPresentation,
  writePresentation,
} from "./storage";
import { RemoteSupply } from "./supply";
export function ready(card: Card): ReadyCard {
  return {
    ...card,
    url: URL.createObjectURL(card.blob),
    file: new File([card.blob], `moodswipe-${card.id.slice(0, 8)}.png`, {
      type: "image/png",
    }),
  };
}
export type CaptionSupply = (params: Parameters) => Caption | undefined;
export class CardQueue {
  cards: ReadyCard[] = [];
  recent: string[] = [];
  photoHistory: string[] = [];
  shownPhotos: string[] = [];
  shownLayouts: Presentation[] = [];
  paramHistory: Parameters[] = [];
  params: Parameters;
  revision = 0;
  busy = false;
  stopped = false;
  starting = true;
  error = "";
  onChange = () => {};
  retired: { url: string; timer: ReturnType<typeof setTimeout> }[] = [];
  target = 4;
  supply?: CaptionSupply;
  remote: RemoteSupply;
  constructor(params: Parameters) {
    this.params = params;
    this.remote = new RemoteSupply(
      () => {
        if (!this.stopped && !this.starting) this.setParams(this.params, false);
      },
      () => this.onChange(),
    );
    const n = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    if (n.connection?.saveData || (n.deviceMemory && n.deviceMemory <= 2))
      this.target = 3;
  }
  async start() {
    this.recent = await readRecent();
    const presentation = await readPresentation();
    this.shownPhotos = presentation.photos;
    this.shownLayouts = presentation.layouts;
    if (navigator.onLine) {
      let revision: number;
      do {
        revision = this.revision;
        await this.remote.replenish(this.params);
        if (revision !== this.revision) this.remote.nextAttempt = 0;
      } while (!this.stopped && revision !== this.revision);
    }
    if (this.stopped) return;
    this.starting = false;
    await this.fill();
  }
  setParams(params: Parameters, activity = true) {
    this.params = params;
    this.revision++;
    this.cards.splice(1).forEach((c) => URL.revokeObjectURL(c.url));
    this.onChange();
    if (this.starting) return;
    void this.fill();
    if (activity) void this.remote.replenish(this.params);
  }
  async fill() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      while (this.cards.length < this.target && !this.stopped) {
        const revision = this.revision;
        let params = this.params.random
          ? randomize(this.paramHistory.slice(-12))
          : { ...this.params };
        const caption =
          this.supply?.(params) ??
          this.remote.take(params, this.recent) ??
          pickLocal(params, this.recent.slice(-14));
        if (params.random && caption.source !== "local") {
          params = {
            ...params,
            mood: caption.mood,
            topic: caption.topic as Parameters["topic"],
            intensity: caption.intensity as Parameters["intensity"],
            aesthetic: caption.visualAesthetic as Parameters["aesthetic"],
          };
        }
        let photo = choosePhoto(
          caption.visualKeywords,
          params.aesthetic,
          [...this.shownPhotos, ...this.cards.slice(1).map((c) => c.photo.id)],
          [...photos, ...this.remote.photos],
          caption.text,
        );
        let card: Card;
        try {
          card = await compose(caption, photo, params, [
            ...this.shownLayouts,
            ...this.cards.slice(1).map((c) => c.layout),
          ]);
        } catch {
          photo = choosePhoto(
            caption.visualKeywords,
            params.aesthetic,
            [
              ...this.shownPhotos,
              ...this.cards.slice(1).map((c) => c.photo.id),
            ],
            photos.filter((p) => p.id !== photo.id),
            caption.text,
          );
          card = await compose(caption, photo, params, [
            ...this.shownLayouts,
            ...this.cards.slice(1).map((c) => c.layout),
          ]);
        }
        if (this.stopped || revision !== this.revision) continue;
        if (!this.cards.length) this.rememberShown(card);
        this.cards.push(ready(card));
        this.recent.push(caption.id);
        this.recent = this.recent.slice(-200);
        this.photoHistory.push(photo.id);
        this.photoHistory = this.photoHistory.slice(-12);
        this.paramHistory.push(params);
        this.paramHistory = this.paramHistory.slice(-12);
        void writeRecent(this.recent);
        this.error = "";
        this.onChange();
      }
    } catch {
      this.error =
        "Could not prepare a photo. Reconnect once to download the offline pack, then try again.";
      this.onChange();
    } finally {
      this.busy = false;
    }
  }
  advance(exported = false) {
    if (this.cards.length < 2) {
      void this.fill();
      void this.remote.replenish(this.params);
      return false;
    }
    const previous = this.cards.shift()!;
    this.rememberShown(this.cards[0]);
    const release = () => {
      URL.revokeObjectURL(previous.url);
      this.retired = this.retired.filter((r) => r.url !== previous.url);
    };
    this.retired.push({
      url: previous.url,
      timer: setTimeout(release, exported ? 30000 : 800),
    });
    while (this.retired.length > 3) {
      const old = this.retired.shift()!;
      clearTimeout(old.timer);
      URL.revokeObjectURL(old.url);
    }
    this.onChange();
    void this.fill();
    void this.remote.replenish(this.params);
    return true;
  }
  stop() {
    this.stopped = true;
    this.remote.stop();
    this.revision++;
    this.cards.forEach((c) => URL.revokeObjectURL(c.url));
    this.retired.forEach((r) => {
      clearTimeout(r.timer);
      URL.revokeObjectURL(r.url);
    });
    this.retired = [];
  }
  private rememberShown(card: Card) {
    this.shownPhotos = [...this.shownPhotos, card.photo.id].slice(-24);
    this.shownLayouts = [...this.shownLayouts, card.layout].slice(-6);
    void writePresentation(this.shownPhotos, this.shownLayouts);
  }
}
