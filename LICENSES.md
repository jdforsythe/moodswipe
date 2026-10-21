# Licenses and provenance

Reviewed 2026-10-21. The source application was created for this project; no blanket license for the owner's application code is asserted here. Third-party assets and dependencies retain their original licenses.

## Bundled photographs

These are individual free Unsplash photographs downloaded as 1200 × 1600 WebP derivatives. They are shipped from the app's own origin and included in the offline precache. This is a derivative meme application, not a stock-photo or wallpaper catalog. The [Unsplash License](https://unsplash.com/license) permits downloading, copying, modifying, distributing, and commercial use, with restrictions on unmodified sales and competing collections. This app does **not** use the Unsplash API; API hotlinking/download-tracking requirements should not be assumed interchangeable with manually licensed bundled assets.

| Local file                  | Original image identifier / source                                                                                                                       | Creator recorded                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `public/photos/forest.webp` | [photo-1441974231531-c6227db76b6e](https://images.unsplash.com/photo-1441974231531-c6227db76b6e) / [photo page](https://unsplash.com/photos/p0j-mE6mGo4) | Sebastian Unrau                  |
| `public/photos/lake.webp`   | [photo-1470770841072-f978cf4d019e](https://images.unsplash.com/photo-1470770841072-f978cf4d019e) / [photo page](https://unsplash.com/photos/zAjdgNXsMeg) | Luca Bravo                       |
| `public/photos/peaks.webp`  | [photo-1464822759023-fed622ff2c3b](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b)                                                         | Not recorded; source ID retained |
| `public/photos/city.webp`   | [photo-1519501025264-65ba15a82390](https://images.unsplash.com/photo-1519501025264-65ba15a82390)                                                         | Not recorded; source ID retained |
| `public/photos/dunes.webp`  | [photo-1509316785289-025f5b846b35](https://images.unsplash.com/photo-1509316785289-025f5b846b35)                                                         | Not recorded; source ID retained |
| `public/photos/ocean.webp`  | [photo-1518837695005-2083093ee35b](https://images.unsplash.com/photo-1518837695005-2083093ee35b)                                                         | Not recorded; source ID retained |
| `public/photos/coffee.webp` | [photo-1495474472287-4d71bcdd2085](https://images.unsplash.com/photo-1495474472287-4d71bcdd2085)                                                         | Not recorded; source ID retained |
| `public/photos/stairs.webp` | [photo-1487958449943-2429e8be8625](https://images.unsplash.com/photo-1487958449943-2429e8be8625)                                                         | Not recorded; source ID retained |

The photo info panel links source and license for every card. Creator names are optional when not verified; missing names are not fabricated. `src/data/photos.ts` records dimensions, categories, aesthetics, cache permissions, focal point, and provenance. `scripts/assets.mjs` is an optional acquisition script, not a build/runtime prerequisite.

## Optional Pexels photos

Pexels [content license](https://www.pexels.com/license/) permits modified image use, with restrictions involving identifiable people, endorsements, resale, and stock/wallpaper redistribution. Its [API guidelines](https://www.pexels.com/api/documentation/) separately require visible Pexels linking and photographer credits where possible. The application displays both outside the export image, retains source ID/creator/photo page/license metadata in each rejected record, and exports only the composed meme.

The adapter uses returned Pexels CDN URLs directly; there is no arbitrary image proxy or general stock-download endpoint. Search metadata is cached for 24 hours, consistent with [Pexels cache guidance](https://help.pexels.com/hc/en-us/articles/900006470063-What-steps-can-I-take-to-avoid-hitting-the-rate-limit). Composed rejected PNGs may be stored locally. No Pexels raw assets are included in the distributed offline pack. Results with metadata suggesting identifiable people are filtered, but metadata is imperfect. Operator review of actual matches remains advisable.

## Fonts

Fonts are bundled locally through Fontsource, with no runtime Google Fonts request. Every font below uses the SIL Open Font License 1.1; exact upstream copyright and reserved-name notices are preserved in `public/licenses/`.

| Font                  | Use                        | License file                                                 |
| --------------------- | -------------------------- | ------------------------------------------------------------ |
| DM Sans, 400/600      | UI and wholesome captions  | [dm-sans.txt](public/licenses/dm-sans.txt)                   |
| Lora, 600             | Motivational serif         | [lora.txt](public/licenses/lora.txt)                         |
| Oswald, 600           | Sarcastic condensed sans   | [oswald.txt](public/licenses/oswald.txt)                     |
| Nunito, 800           | Funny heavy sans           | [nunito.txt](public/licenses/nunito.txt)                     |
| Space Grotesk, 700    | Absurd geometric sans      | [space-grotesk.txt](public/licenses/space-grotesk.txt)       |
| Barlow Condensed, 500 | Dark restrained typography | [barlow-condensed.txt](public/licenses/barlow-condensed.txt) |

## Software and generated content

React / React DOM / scheduler use MIT; idb uses ISC; lucide-react uses ISC. Lucide provides the interface icons. Workbox uses MIT and generates the service worker. Vite, TypeScript, Vite PWA, Wrangler, Vitest, Playwright, Prettier, and axe are build/test tools with their own package license files in the installed dependencies. Runtime dependency license notices are also included in `public/licenses/` and the static distribution. The lockfile pins exact installed versions. The MoodSwipe app icon and curated captions were authored for this application.

**Built with Llama.** Optional generation uses Cloudflare-hosted Llama 3.3 under the [Meta Llama 3.3 Community License](https://github.com/meta-llama/llama-models/blob/main/models/llama3_3/LICENSE) and its acceptable-use policy, alongside [Cloudflare service terms](https://www.cloudflare.com/service-specific-terms-developer-platform/). A copy of the model license is included at [public/licenses/llama-3.3.txt](public/licenses/llama-3.3.txt); no model weights are distributed. The app's About panel includes the model attribution. The operator accepts applicable terms when enabling inference. AI output is labeled by provenance and is not guaranteed unique merely because it was generated.
