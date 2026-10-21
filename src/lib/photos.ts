import { AESTHETICS, type Photo } from "../../shared/types";
// Validate server-provided URLs before allowing them into image loading or link destinations.
export function validRemotePhoto(value: unknown): value is Photo {
  if (!value || typeof value !== "object") return false;
  const p = value as Photo;
  try {
    return (
      typeof p.id === "string" &&
      p.id.startsWith("pexels-") &&
      p.source === "Pexels" &&
      new URL(p.url).origin === "https://images.pexels.com" &&
      new URL(p.sourceUrl).origin === "https://www.pexels.com" &&
      p.licenseUrl === "https://www.pexels.com/license/" &&
      typeof p.creator === "string" &&
      p.creator.length <= 100 &&
      Array.isArray(p.categories) &&
      p.categories.every((c) => typeof c === "string" && c.length < 100) &&
      Array.isArray(p.aesthetics) &&
      p.aesthetics.every((a) => AESTHETICS.includes(a as never)) &&
      p.width > 0 &&
      p.height > 0 &&
      p.cacheAllowed === true
    );
  } catch {
    return false;
  }
}
