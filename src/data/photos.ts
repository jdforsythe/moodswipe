import type { Photo } from "../../shared/types";
import entries from "./photo-manifest.json";

export const photos: Photo[] = entries.map(
  ({ id, sourceId, creator, page, categories, aesthetics }) => ({
    id,
    url: `/photos/${id}.webp`,
    source: "Unsplash (bundled)",
    sourceUrl: page
      ? `https://unsplash.com/photos/${page}`
      : `https://images.unsplash.com/${sourceId}`,
    creator: creator || undefined,
    license: "Unsplash License",
    licenseUrl: "https://unsplash.com/license",
    width: 1200,
    height: 1600,
    cacheAllowed: true,
    categories,
    aesthetics,
    focalPoint: { x: 0.5, y: 0.5 },
  }),
);
export const PHOTO_COOLDOWN = 12;
export function choosePhoto(
  keywords: string[],
  aesthetic: string,
  recent: string[] = [],
  pool = photos,
  captionText = "",
): Photo {
  if (!pool.length) throw new Error("No photographs available");
  const matches = (photo: Photo) =>
    photo.categories.filter((c) =>
      keywords.some((k) => k.toLowerCase().includes(c)),
    ).length;
  // Keywords suggest atmosphere. Only an actual visual reference in the
  // caption requires a subject match; 'burnout' can sit over many backdrops.
  const literal =
    captionText
      .toLowerCase()
      .match(
        /\b(forest|mountain|lake|ocean|desert|coffee|trees?|waves?|sand|building)\b/g,
      ) ?? [];
  const literalMatches = pool.filter((p) =>
    literal.some((term) =>
      p.categories.some((c) => c === term || `${c}s` === term),
    ),
  );
  const candidates = literalMatches.length ? literalMatches : pool;
  const unseen = candidates.filter(
    (p) => !recent.slice(-PHOTO_COOLDOWN).includes(p.id),
  );
  if (!unseen.length) {
    // A genuinely constrained subject may have fewer than 13 photographs.
    // Rotate through ALL of them before reusing the least recently seen one.
    return [...candidates].sort(
      (a, b) => recent.lastIndexOf(a.id) - recent.lastIndexOf(b.id),
    )[0];
  }
  return unseen
    .map((photo) => ({
      photo,
      score:
        Math.min(matches(photo), 2) * 2 +
        (photo.aesthetics.includes(aesthetic) ? 3 : 0) +
        Math.random() * 3,
    }))
    .sort((a, b) => b.score - a.score)[0].photo;
}
