export type Bucket = { count: number; expires: number };
export function consumeBucket(
  buckets: Record<string, Bucket>,
  key: string,
  limit: number,
  now = Date.now(),
  window = 60000,
) {
  for (const [k, b] of Object.entries(buckets))
    if (b.expires <= now) delete buckets[k];
  if (!buckets[key]) {
    if (Object.keys(buckets).length >= 2000) return false;
    buckets[key] = { count: 0, expires: now + window };
  }
  if (buckets[key].count >= limit) return false;
  buckets[key].count++;
  return true;
}
export async function anonymousHash(ip: string, salt: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`),
  );
  return [...new Uint8Array(bytes)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function allowedOrigin(request: Request, allowlist = "") {
  const origin = request.headers.get("Origin");
  const own = new URL(request.url).origin;
  return (
    !!origin &&
    (origin === own ||
      allowlist
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .includes(origin))
  );
}
export async function boundedJson(
  request: Request,
  maxBytes = 2048,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new Error("body_too_large");
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
