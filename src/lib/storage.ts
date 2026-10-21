import { openDB, type DBSchema } from "idb";
import {
  DEFAULT_PARAMS,
  validParams,
  type Card,
  type Parameters,
} from "../../shared/types";
export const LIMITS = {
  count: 100,
  bytes: 100 * 1024 * 1024,
  age: 30 * 24 * 60 * 60 * 1000,
};
type StoredCard = Omit<Card, "blob"> & {
  blob?: Blob;
  imageBytes?: ArrayBuffer;
};
const restore = (c: StoredCard): Card => ({
  ...c,
  blob: c.blob ?? new Blob([c.imageBytes!], { type: "image/png" }),
});
interface MoodDB extends DBSchema {
  rejected: { key: string; value: StoredCard; indexes: { createdAt: number } };
  meta: { key: string; value: unknown };
}
let database: ReturnType<typeof openDB<MoodDB>> | undefined;
export const db = () =>
  (database ??= openDB<MoodDB>("moodswipe", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("rejected", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        db.createObjectStore("meta");
      } /* v2 writes PNG bytes for Safari; v1 Blob records remain readable. */
    },
  }));
export function evictionIds(
  cards: Card[],
  now = Date.now(),
  limits = LIMITS,
): string[] {
  const sorted = [...cards].sort((a, b) => b.createdAt - a.createdAt);
  let count = 0,
    bytes = 0;
  const ids = [];
  for (const card of sorted) {
    count++;
    bytes += card.blob.size;
    if (
      count > limits.count ||
      bytes > limits.bytes ||
      now - card.createdAt > limits.age
    )
      ids.push(card.id);
  }
  return ids;
}
export async function getRejected() {
  const database = await db();
  const cards = (await database.getAll("rejected")).map(restore);
  const ids = evictionIds(cards);
  if (ids.length) {
    const tx = database.transaction("rejected", "readwrite");
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
  return cards
    .filter((c) => !ids.includes(c.id))
    .sort((a, b) => b.createdAt - a.createdAt);
}
export async function addRejected(card: Card) {
  const database = await db();
  const stored: Card = {
    id: card.id,
    caption: card.caption,
    photo: card.photo,
    params: card.params,
    layout: card.layout,
    createdAt: Date.now(),
    blob: card.blob,
  };
  const all = (await database.getAll("rejected")).map(restore);
  const ids = evictionIds([...all.filter((c) => c.id !== card.id), stored]);
  if (ids.includes(card.id))
    throw new Error("This image is larger than local storage allows");
  const { blob, ...metadata } = stored;
  const record: StoredCard = {
    ...metadata,
    imageBytes: await blob.arrayBuffer(),
  };
  const save = async (extra: string[] = []) => {
    const tx = database.transaction("rejected", "readwrite");
    await Promise.all(
      [...new Set([...ids, ...extra])]
        .map((id) => tx.store.delete(id))
        .concat([tx.store.put(record).then(() => undefined), tx.done]),
    );
  };
  try {
    await save();
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      const oldest = all
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, Math.max(1, Math.ceil(all.length / 3)))
        .map((c) => c.id);
      await save(oldest);
    } else throw e;
  }
}
export async function clearRejected() {
  return (await db()).clear("rejected");
}
export function readParams(): Parameters {
  try {
    const p = JSON.parse(localStorage.getItem("moodswipe:params") ?? "null");
    return validParams(p) ? p : DEFAULT_PARAMS;
  } catch {
    return DEFAULT_PARAMS;
  }
}
export function writeParams(params: Parameters) {
  try {
    localStorage.setItem("moodswipe:params", JSON.stringify(params));
    return true;
  } catch {
    return false;
  }
}
export async function readRecent(): Promise<string[]> {
  try {
    return ((await (await db()).get("meta", "recent")) as string[]) ?? [];
  } catch {
    return [];
  }
}
export async function writeRecent(ids: string[]) {
  try {
    await (await db()).put("meta", ids.slice(-200), "recent");
  } catch {
    /* Recent-history persistence is optional; in-memory dedupe still applies. */
  }
}
