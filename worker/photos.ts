import { AESTHETICS, type Photo } from "../shared/types";
import type { Env } from "./env";
import { PHOTO_TERMS } from "./pool";
export interface PhotoProvider {
  search(keyword: string, aesthetic: string): Promise<Photo[]>;
}
export function safePhoto(
  value: unknown,
  keyword: string,
  aesthetic: string,
): Photo | null {
  const p = value as {
    id?: number;
    width?: number;
    height?: number;
    url?: string;
    photographer?: string;
    alt?: string;
    src?: { large2x?: string };
  };
  if (
    !p ||
    !Number.isInteger(p.id) ||
    !p.src?.large2x ||
    !p.url ||
    !p.width ||
    !p.height ||
    !p.photographer ||
    !p.alt
  )
    return null;
  if (
    /\b(man|men|woman|women|person|people|child|baby|boy|girl|portrait|face|logo|brand|nude|weapon)\b/i.test(
      p.alt,
    )
  )
    return null;
  try {
    const img = new URL(p.src.large2x),
      page = new URL(p.url);
    if (
      img.protocol !== "https:" ||
      img.hostname !== "images.pexels.com" ||
      !img.pathname.startsWith("/photos/") ||
      page.protocol !== "https:" ||
      !["pexels.com", "www.pexels.com"].includes(page.hostname)
    )
      return null;
    img.searchParams.set("w", "1200");
    img.searchParams.set("h", "1600");
    img.searchParams.set("fit", "crop");
    return {
      id: `pexels-${p.id}`,
      url: img.href,
      source: "Pexels",
      sourceUrl: page.href,
      creator: p.photographer.slice(0, 100),
      license: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      width: 1200,
      height: 1600,
      cacheAllowed: true,
      categories: [
        keyword,
        ...p.alt
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 2)
          .slice(0, 15),
      ],
      aesthetics: [aesthetic],
      focalPoint: { x: 0.5, y: 0.5 },
    };
  } catch {
    return null;
  }
}
export class PexelsProvider implements PhotoProvider {
  constructor(private key: string) {}
  async search(keyword: string, aesthetic: string) {
    const style: Record<string, string> = {
      Cinematic: "landscape",
      Nature: "nature",
      Urban: "architecture",
      Abstract: "texture",
      Minimal: "minimal",
      "Surreal-looking photography": "reflections",
    };
    const url = new URL("https://api.pexels.com/v1/search");
    url.search = new URLSearchParams({
      query: `${keyword} ${style[aesthetic] ?? "landscape"}`,
      orientation: "portrait",
      size: "large",
      per_page: "16",
    }).toString();
    const response = await fetch(url, {
      headers: { Authorization: this.key },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error("photo_provider_unavailable");
    const body = (await response.json()) as { photos?: unknown[] };
    if (!Array.isArray(body.photos)) throw new Error("invalid_photos");
    return body.photos
      .slice(0, 16)
      .map((p) => safePhoto(p, keyword, aesthetic))
      .filter((p): p is Photo => !!p);
  }
}
export function validPhotoRequest(
  value: unknown,
): value is { keyword: string; aesthetic: string } {
  if (!value || typeof value !== "object") return false;
  const v = value as { keyword: string; aesthetic: string };
  return (
    Object.keys(v).length === 2 &&
    PHOTO_TERMS.includes(v.keyword) &&
    AESTHETICS.includes(v.aesthetic as never)
  );
}
export async function getPhotos(
  body: { keyword: string; aesthetic: string },
  env: Env,
  request: Request,
) {
  if (env.PHOTOS_ENABLED !== "true" || !env.PEXELS_API_KEY)
    return { photos: [] };
  const key = new Request(
    `https://moodswipe.internal/photos/${encodeURIComponent(body.keyword)}/${encodeURIComponent(body.aesthetic)}`,
  );
  const cached = await caches.default.match(key);
  if (cached) return cached.json();
  const budget = await env.POOL.get(env.POOL.idFromName("global-v1")).fetch(
    new Request("https://pool/photo-budget", {
      method: "POST",
      headers: {
        "X-Client-IP": request.headers.get("CF-Connecting-IP") || "unknown",
      },
    }),
  );
  if (!budget.ok) return { photos: [] };
  try {
    const photos = await new PexelsProvider(env.PEXELS_API_KEY).search(
      body.keyword,
      body.aesthetic,
    );
    const response = Response.json(
      { photos },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
    await caches.default.put(key, response);
    return { photos };
  } catch {
    return { photos: [] };
  }
}
