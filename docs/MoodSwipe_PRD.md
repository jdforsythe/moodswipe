# MoodSwipe — PRD and Codex Implementation Specification

Version 1.0 | Platforms: Android + iOS PWA | Target: free-tier hosting, zero end-user setup

## Codex mission

Implement a working, mobile-first PWA called **MoodSwipe**. It presents a swipeable feed of AI-written memes: a real stock photograph with readable, mood-appropriate caption **overlaid directly on the image**. Swipe **left = Dismiss**, **right = Save**, **up = Share**. Three translucent overlay buttons, each with only one word: **Dismiss**, **Share**, **Save**. Provide a Rejected feed, random generation mode, resilient AI fallback, local-only user history, and no login or cloud gallery. Deliver complete source, tests, README, deployment instructions, and an operator-only configuration guide. Do not stop at mockups.

## 1. Product principles

- Image-first: no caption panel below photograph; export image and text as one composition, excluding UI controls.
- Fast: next card is prefetched, swipes never wait for a live model call.
- Originality: primary captions from a real LLM, not a small combinatorial template generator.
- Free for users: no accounts, keys, subscriptions or configuration. Operator may configure service credentials once.
- Ephemeral: user saves only to phone; no PWA Saved gallery or cloud image sync. Rejected feed is temporary local history.
- Honest platform behavior: PWAs cannot guarantee silent camera-roll writes on either OS; implement and explain supported save/export paths.

## 2. User experience and screen specification

### Main feed

Full-bleed vertical photograph, approximately 4:5 or 9:16, filling available screen without clipping caption or controls. Caption overlays photo. Use safe-area insets for iPhone notch/home indicator and Android navigation. Compact controls for Settings, Rejected, and Random Mode. Bottom row overlays image with three semi-transparent, legible buttons labeled exactly `Dismiss`, `Share`, `Save` (no icons, subtitles, or gesture descriptions). A subtle status indicator may show offline/fallback mode, not distract from the image.

### Gesture/action matrix

| Gesture/control      | Main feed                                                                                                                         | Rejected feed                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Swipe left / Dismiss | Add card to local rejected history, show next                                                                                     | Advance to next rejected card; do not duplicate |
| Swipe right / Save   | Export current composed image to device using OS-supported flow; advance only when export is initiated/confirmed with truthful UI | Same                                            |
| Swipe up / Share     | Open native share sheet for composed image; **do not advance**                                                                    | Same                                            |

Implement drag thresholds, axis locking, velocity, animated drag feedback, cancel/spring-back, reduced-motion mode, keyboard/button accessibility, and suppression of accidental gestures from controls. Prevent double invocation and touch-scroll conflicts. Sharing canceled or completed leaves card visible. Save failure leaves card visible with retry. Do not claim OS gallery save was verified if browser only initiated a download.

### Save and share details

Render a Blob/File (`image/png` preferred) from the same composition shown. For Share, use `navigator.canShare({files})` and `navigator.share({files,title,text})` from direct user interaction; pre-render file to preserve transient user activation. Native share sheet may include Instagram, Snapchat, Messages, Save Image, etc. depending on OS/apps; do **not** promise direct Instagram Story/Snapchat API posting. Fallback to browser download or opening the image with explicit save instructions. For Save, use browser-supported download on Android and appropriate image/share-sheet save flow on iOS. Silent direct Photos insertion is **not guaranteed in a PWA**. No internal saved gallery.

### Rejected feed

Accessible from main view. Holds memes user dismissed, not AI candidates rejected during generation. Same visual viewer and actions. Maintain separate feed positions. IndexedDB locally stores caption, photo provenance/reference, render blob if feasible, parameters, layout, timestamp. Bounded by age, count and byte quota (suggest 100 cards / 100MB with oldest-first eviction). Add `Clear Rejected` with confirmation. No server sync. Saving/sharing rejected memes does not remove them.

### Filters

Mood: Motivational, Sarcastic, Funny, Absurd, Dark Humor, Wholesome. Topic: Everyday, Work/Burnout, Relationships, Existential, Self-Improvement, Social, Technology, Surprise Me. Intensity: 1–5. Photo aesthetic: Cinematic, Nature, Urban, Abstract, Minimal, Surreal-looking photography. Default values chosen for immediate first-use. Settings persist locally. Fixed mode retains params; Random Mode picks fresh parameters for **each new card** with diversity weighting, without changing current/rejected cards. Parameter changes must invalidate incompatible queued cards.

## 3. Composition and typography

- Image caption must be rendered **inside** photograph bounds, not separate DOM caption for final export.
- Mood-dependent typefaces: motivational readable serif; sarcastic bold/condensed sans; funny friendly heavy sans; absurd experimental but legible; dark restrained stark typography; wholesome warm humanist sans. Bundle properly licensed web fonts and fallbacks.
- Dynamically choose font size, line wrapping, placement, alignment, line spacing, shadow/outline, and subtle gradient/scrim. Detect candidate region contrast/luminance and avoid faces/subjects when metadata allows. Reserve bottom overlay control exclusion zone. Never clip or truncate caption; reject/rewrite overly long lines.
- Compose via canvas, using legally reusable CORS-safe images. Preview and exported 1080px-or-better image must match visually; exclude buttons/chrome. Handle cross-origin canvas taint safely.
- Provide photo source/credit/license metadata as required by actual image provider terms. Do not place intrusive attribution on image unless legally required.

## 4. AI generation, originality, and content supply

Primary engine: secure server-side LLM, generating JSON batches of ~8–20 candidates. Each candidate contains `id`, `caption`, `mood`, `topic`, `intensity`, `technique`, `visualKeywords`, `visualAesthetic`, optional `compositionHint`, and internal provenance. Validate schema, length, safety and suitability. Treat model output as untrusted strings, never executable markup.

Prompt for deliberately varied approaches: deadpan, irony, absurd specificity, juxtaposition, observation, inversion, anti-motivation, poetry, dark understatement, wholesome surprise. Vary structure, cadence, topic and point of view. Reject generic clichés, recycled catchphrases, repetitive openings, near-duplicates and bad image matches. Use normalized hashes, n-gram similarity, concept tags, recent history and cooling periods. Semantic embeddings optional only if free budget supports them. Track candidate rejection reasons (`unsafe`, `low_quality`, `duplicate`, `temporary_similarity`, `photo_mismatch`, `too_long`). **Never reuse unsafe/low-quality rejects.**

### Fallback order

1. Fresh LLM batches when provider/quota/network healthy.
2. Salvage pool: strong unused candidates rejected temporarily for repetition or photo mismatch, eligible after cooldown or with a better photo.
3. Remix pool: strong captions with different photos/compositions or deterministic light edits; mark provenance, avoid overuse.
4. Curated offline caption library with cached/bundled licensed photos. This must work with no network.

Server-side generic shared candidate pool may persist in Cloudflare storage within free limits; **never upload per-user Rejected feed, saved images or personal preference histories**. Local IndexedDB keeps recent fingerprints and rejected cards. Prefetch 3–5 fully composed cards and replenish when queue drops below threshold; adapt concurrency to mobile bandwidth, battery and rate limits. Show first card quickly using cached/fallback content, then blend in fresh AI results. Never leave feed empty because API quota is exhausted.

## 5. Stock photography

Select licensed free photography, including abstract and counterintuitive imagery. Start with curated, legally reusable, same-origin starter assets plus a provider adapter (e.g. Pexels/Unsplash if current API and licensing terms permit). **Verify actual API access, attribution, caching, hotlinking, redistribution, derivative-image and rate-limit rules before committing**; free stock does not automatically mean unrestricted API use or rehosting. Store source ID, creator, license provenance, URL, dimensions, focal point, categories and caching permissions. Avoid image repeats, broken images and inappropriate matches. Canvas must be CORS-safe; use allowed same-origin assets or compliant proxy only. Offline photos must be permitted to cache/bundle.

## 6. Architecture

Suggested frontend: React + TypeScript + Vite + CSS; PWA manifest, service worker via Workbox/Vite PWA plugin, IndexedDB via Dexie or idb. Hosting: Cloudflare Pages/Workers free tier. API: Cloudflare Worker (`/api/generate`, `/api/photos` optional, `/api/health`). No backend required for bundled fallback. Keep backend vendor-adapter interfaces for LLM and photo provider, rate limiter, batch validation, cache and shared salvage pool. Consider KV/D1 only if needed and within verified free quotas.

**Security:** Never ship provider keys in client code, source maps, PWA config, or repository. Store operator credentials as Worker secrets. Rate-limit anonymously by privacy-conscious short-lived identifiers/IP-derived throttling, enforce global daily budget, max batch size, input validation, timeout, retries with exponential backoff, and circuit breaker. Avoid exposing open AI proxy endpoints to arbitrary external sites: CORS origin allowlist, method checks, request constraints and abuse controls. CORS is not authentication; acknowledge that a publicly accessible free app can still exhaust its shared quota. No automatic paid API fallback.

**Provider selection:** Before implementing live AI, verify an actual current free-tier LLM service, model, quotas, terms for public shared apps and key issuance. Abstract provider config in environment variables. If no suitable free service exists, ship working fallback-first app and documented optional integration, without falsely claiming unlimited free AI.

### Data shapes (suggested)

```ts
type Mood =
  "motivational" | "sarcastic" | "funny" | "absurd" | "dark" | "wholesome";
type Parameters = {
  mood: Mood;
  topic: string;
  intensity: 1 | 2 | 3 | 4 | 5;
  aesthetic: string;
  random: boolean;
};
type Caption = {
  id: string;
  text: string;
  mood: Mood;
  topic: string;
  technique: string;
  visualKeywords: string[];
  source: "llm" | "salvage" | "remix" | "local";
  createdAt: number;
};
type Photo = {
  id: string;
  url: string;
  source: string;
  creator?: string;
  license: string;
  width: number;
  height: number;
  cacheAllowed: boolean;
  focalPoint?: { x: number; y: number };
};
type Card = {
  id: string;
  caption: Caption;
  photo: Photo;
  params: Parameters;
  layout: {
    font: string;
    fontSize: number;
    alignment: string;
    region: string;
    scrim: number;
  };
  createdAt: number;
};
```

Separate ephemeral in-memory ready queue, local IndexedDB rejected history, local settings/recent fingerprints, and server-side generic candidate cache. Cache image blobs only when license permits. Use schema versioning/migrations and resilient quota-exceeded behavior.

## 7. Offline, performance and accessibility

- Installable PWA: HTTPS, manifest with icons, standalone display, service worker and offline shell. iOS users install via Safari Share → Add to Home Screen; Android uses browser install flow when supported.
- First meaningful card quickly on typical phone connection; never make initial use depend on API availability. Optimize assets, compress photographs, lazy load, cap memory, release object URLs, respect low-memory devices.
- Support 320px+ widths, safe-area insets, screen rotations gracefully, dark UI chrome, WCAG-oriented button contrast/focus labels, accessible settings, reduced motion, voiceover/talkback, and touch targets at least ~44px.
- Do not rely on swipe-only interactions. Avoid rapid flicker, unbounded animation, or background polling.
- No trackers by default. Explain local data, operator-side request handling and third-party AI/photo provider involvement in a concise privacy page.

## 8. Implementation phases and acceptance gates

### Phase 1 — Offline-first interactive PWA

Create full responsive UI, gestures, settings/random mode, adaptive overlay composition, local sample captions/photos with verified rights, native share/download fallbacks, rejected feed, IndexedDB, installable manifest/service worker, offline operation. **Acceptance:** works end-to-end without any API key.

### Phase 2 — Backend and LLM

Add Cloudflare Worker, secrets, provider adapter, JSON batch generator, filtering/dedupe, salvage/remix pool, quotas, abuse controls, circuit breaker and provider-failure fallback. **Acceptance:** valid provider key yields diverse new captions; invalid/exhausted key preserves functional feed.

### Phase 3 — Dynamic photos and quality

Add compliant photo-provider adapter, visual keyword matching, licensing records, contrast/layout improvements, source/photo diversity and reliable CORS-safe export. **Acceptance:** captions readable over varied backgrounds; exported image matches preview.

### Phase 4 — Mobile QA and deploy

Test real Android Chrome installed PWA and iOS Safari + installed home-screen PWA; verify swipe direction, touch conflict, sharing, save fallback, permissions, safe areas, offline, quotas, storage eviction, and rate limiting. Produce deployment README with phone-browser-only Cloudflare steps and secrets setup. **Acceptance:** no hidden requirement for local desktop, terminal, or end-user configuration.

## 9. Test plan

Unit tests: parameter randomization, dedupe/cooldowns, salvage eligibility, fallback priority, candidate schema, card queue, IndexedDB eviction, layout fitting, contrast scoring. Integration tests: Worker rate limit and malformed response, unavailable provider, photo CORS failures, local fallback, PWA offline. E2E browser tests: main swipe left/right/up, button parity, Rejected feed, settings changes, Random Mode, share cancellation, save failure and retry, no gallery. Manual device matrix: Android Chrome browser/installed; iPhone Safari/browser and home-screen app; portrait/landscape; online/offline; low bandwidth; no share-file support; Photos save flow. Record limitations honestly in README.

## 10. Deployment and operator guide requirements

Provide a `README.md` with exact Cloudflare deployment instructions usable from an Android browser, including ZIP/direct upload path for static frontend and a workable Worker deployment path for backend; if browser-only Worker setup is impractical, document a phone-friendly GitHub-connected Cloudflare deployment alternative. Explain where operator enters secrets and how to confirm they are not exposed. Include free-tier quota and potential cost caveats, photo licensing, source attribution, custom-domain optionality, and provider-specific setup. Supply `.env.example` with **placeholder names only** and never commit actual keys.

## 11. Explicit decisions and guardrails

- No PWA Saved gallery; Save means OS-mediated export to device.
- Rejected feed is local temporary history, not cloud sync.
- Share does not dismiss or advance.
- Captions and controls overlay photo; controls excluded from exported file.
- All three buttons are single-word labels without icons or instructions.
- Random Mode re-randomizes per new card; fixed mode retains settings.
- High-quality unused AI candidates are recyclable; unsafe/poor ones are not.
- No API secrets in frontend. No guaranteed unlimited free AI or photo API use.
- No promise of silent camera-roll write or direct social-app posting from a PWA.

## 12. Final Codex deliverables

1. Working repository with frontend, optional Worker backend, assets and tests.
2. Operator setup/deployment README, phone-only instructions and troubleshooting.
3. `ARCHITECTURE.md` with storage/data flow and provider contracts.
4. `PRIVACY.md` describing local data, external generation and retention.
5. `LICENSES.md` recording all font/photo/source licensing and attribution.
6. `TESTING.md` with tested device/browser matrix, known limitations and manual steps.
7. Final summary: features implemented, tests run, actual provider chosen, free-tier constraints, and any remaining manual operator setup.

**Codex instruction:** Work in phases, run tests/build after each phase, fix failures, and report concrete limitations instead of substituting mock behavior for promised functionality. Prefer a reliable, genuinely functional fallback-first app over fragile dependence on a nominally free external API.
