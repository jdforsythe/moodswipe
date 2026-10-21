import type { Photo } from "../../shared/types";
const entries = [
  [
    "forest",
    "photo-1441974231531-c6227db76b6e",
    "Sebastian Unrau",
    "p0j-mE6mGo4",
    ["forest", "trees", "quiet", "growth", "nature"],
    ["Nature", "Cinematic"],
  ],
  [
    "lake",
    "photo-1470770841072-f978cf4d019e",
    "Luca Bravo",
    "zAjdgNXsMeg",
    ["lake", "mountain", "reflection", "quiet", "nature"],
    ["Nature", "Cinematic"],
  ],
  [
    "peaks",
    "photo-1464822759023-fed622ff2c3b",
    "",
    "",
    ["mountain", "sky", "climb", "space"],
    ["Nature", "Cinematic"],
  ],
  [
    "city",
    "photo-1519501025264-65ba15a82390",
    "",
    "",
    ["city", "work", "night", "technology", "social"],
    ["Urban", "Cinematic"],
  ],
  [
    "dunes",
    "photo-1509316785289-025f5b846b35",
    "",
    "",
    ["desert", "sand", "empty", "time"],
    ["Minimal", "Abstract", "Surreal-looking photography"],
  ],
  [
    "ocean",
    "photo-1518837695005-2083093ee35b",
    "",
    "",
    ["ocean", "water", "wave", "blue", "freedom"],
    ["Nature", "Abstract"],
  ],
  [
    "coffee",
    "photo-1495474472287-4d71bcdd2085",
    "",
    "",
    ["coffee", "work", "morning", "home", "everyday"],
    ["Minimal", "Cinematic"],
  ],
  [
    "stairs",
    "photo-1487958449943-2429e8be8625",
    "",
    "",
    ["building", "architecture", "lines", "city", "work"],
    ["Urban", "Abstract", "Minimal", "Surreal-looking photography"],
  ],
] as const;
export const photos: Photo[] = entries.map(
  ([id, sourceId, creator, page, categories, aesthetics]) => ({
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
    categories: [...categories],
    aesthetics: [...aesthetics],
    focalPoint: { x: 0.5, y: 0.5 },
  }),
);
export function choosePhoto(
  keywords: string[],
  aesthetic: string,
  recent: string[] = [],
  pool = photos,
): Photo {
  const matches = (photo: Photo) =>
    photo.categories.filter((c) =>
      keywords.some((k) => k.toLowerCase().includes(c)),
    ).length;
  // Keep the subject relevant before applying aesthetic or repeat preferences.
  // With a finite pack, reusing an ocean is better than depicting a mountain.
  const matching = pool.filter((photo) => matches(photo) > 0);
  const candidates = matching.length ? matching : pool;
  const unseen = candidates.filter(
    (photo) => !recent.slice(-2).includes(photo.id),
  );
  const ranked = (unseen.length ? unseen : candidates).map((photo) => ({
    photo,
    score:
      matches(photo) * 3 +
      (photo.aesthetics.includes(aesthetic) ? 5 : 0) -
      recent.filter((id) => id === photo.id).length * 6 +
      Math.random(),
  }));
  return ranked.sort((a, b) => b.score - a.score)[0].photo;
}
