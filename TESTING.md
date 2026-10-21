# Testing and acceptance record

Implementation/verification date: **2026-10-21**, on the user's Apple Silicon MacBook. No physical Android or iPhone was connected to the test runner. Tests use real installed Chromium/WebKit engines with mobile emulation, not real Android/iOS operating systems.

## Phase gates

| Phase                | Completed implementation and automated evidence                                                                                                                                                                                          | Remaining verification                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1: Offline-first PWA | Completed before AI integration. 11 unit tests and 16 browser tests passed; screenshot and byte-identical PNG download; production offline reload, continued feed, local history, settings, gestures, sharing failure/cancel behavior.   | Physical installation and native share destinations           |
| 2: Backend / LLM     | Deployed Cloudflare Worker and SQLite Durable Object. Live inference, rendered AI provenance, exact PNG export, offline generated-card persistence, and disabled-provider fallback verified. Mocked quota/invalid-response contracts pass. | Ongoing live content/usage review |
| 3: Photos / quality  | Pexels adapter, metadata attribution/host validation, response cache, subject/keyword filtering, CORS-safe composition and bundled fallback. Six mood font compositions reviewed.                                                        | Pexels key and live-provider photo selection                  |
| 4: QA / deploy       | Production build, browser tests, accessibility, Worker dry run, deployment packages and operator docs.                                                                                                                                   | Actual Android/iOS browser + installed-device matrix below    |

## Commands and results

```sh
npm run test
npm run build
npm run test:e2e
npx wrangler deploy --dry-run --outdir artifacts/worker
npm audit --omit=dev
npm run package
```

- **44 unit/integration tests passed**: parameter diversity and invalid values; full curated-caption fitting; luminance scoring; gesture direction/velocity/slop; IndexedDB Blob roundtrip, deduplication and eviction; candidate schema/safety/clichés; normalized fingerprints, n-grams and concept/opening cooldowns; salvage exclusions and photo eligibility; fallback ordering and remix limits; queue bounds and invalidation of in-flight work; API input/origin/method validation; persistent request serialization, anonymous limiting and daily budget; invalid/quota model fallback and malformed JSON; Pexels host/provenance/people filtering and credential failure. Four rollout regressions cover 31-second inference, one deadline shared across retries, recovery after a provider configuration change without resetting the spending ledger, and subject matching taking priority over photo-repeat/aesthetic preferences.
- **35 browser tests passed; one intentionally skipped** in the current full suite. Chromium uses Pixel 7 dimensions/touch settings. WebKit uses iPhone 13 dimensions/touch settings. Both exercise button/pointer actions, settings, history, download, offline reload, AI arrival, backend failure, malicious response rejection, remote photo failure, landscape, and image-opening Share fallback. CDP touch injection runs only in Chromium; the corresponding WebKit test is explicitly skipped because that protocol is Chromium-specific.
- **Axe automated WCAG A/AA audits passed** on the feed and settings modal in both browser engines. This does not certify screen-reader usability or contrast within every generated photograph.
- **PNG export hash equality passed**: downloaded bytes and displayed composition have the same SHA-256 and 1080 × 1440 dimensions. Controls are separate DOM elements and therefore absent from the PNG.
- **Production offline checks passed**: wait for the installed service worker, reload, disconnect the browser network, reload again, compose/dismiss another card, and open local functionality.
- **Cloudflare runtime smoke check passed** with `npm run worker:dev` and `node scripts/verify-worker.mjs`: real local Durable Object allows six requests then returns 429; health/disabled-provider fallback, origin rejection, oversize rejection and static CSP headers passed. The script expects a fresh per-minute counter; wait a minute before repeating it on the same local database.
- **Cloudflare packaging dry run passed**, creating the Worker module and detecting `AI`, `POOL`, and `ASSETS` bindings. This proves packaging, not an authenticated production deployment.
- Production dependency audit: **zero reported vulnerabilities** at verification time.

Browser-native share is intercepted in automated tests to inspect actual PNG Files and simulate success/cancellation/failure. Native OS sheets, target apps, and Photos writes are **not** claimed to have been tested. Browser downloads are exercised through the browser's real download event.

## Initial production fallback verification — 2026-10-21

Verified **https://moodswipe.jdforsythe.workers.dev/** after the operator deployed it. The deployed JavaScript bundle matches the local production build byte for byte. No application code or production settings changed during this verification.

- **31 browser tests passed; one intentionally skipped**, against the actual HTTPS deployment in Chromium and WebKit with mobile emulation. This includes swipes, composition/export byte equality, settings, Rejected persistence, share success/cancellation/failure contracts, download and image-opening fallbacks, offline reload, continued offline swiping, viewport checks and automated accessibility audits.
- The manifest is served as JSON with standalone display, correct start URL, and working 192px, 512px and maskable icons. The service worker is served as JavaScript and successfully caches the application for offline use.
- Static responses include the expected CSP and `nosniff` headers.
- At this initial checkpoint, `/api/health` reported `ai: "disabled"`, `photos: "disabled"`, and `fallback: "bundled"`. One actual same-origin `/api/generate` request returned HTTP 200, an empty caption batch, `mode: "local"`, and a 900-second retry interval. No live AI or Pexels calls were made at this checkpoint.
- Provider arrival/failure scenarios in the browser suite use intercepted fixture responses; they verify deployed client behavior, not live provider availability. Native OS sharing and physical-device installation remain pending below.

To repeat this baseline check while AI and external photos are disabled:

```sh
PLAYWRIGHT_BASE_URL=https://moodswipe.jdforsythe.workers.dev npm run test:e2e -- --workers=4
```

The environment variable directs the suite to the deployed site without starting a local server. Each test uses an isolated browser context. Screenshots are saved as `artifacts/production-android-chromium.png` and `artifacts/production-iphone-webkit.png`; the original Phase 1 evidence is preserved. If providers are enabled later, ordinary page visits in this suite can request content and consume the shared quota.

## Initial live AI rollout verification — 2026-10-21

Deployed version `79922f14-2e01-47c1-bbbb-9efe589eed72` with `AI_ENABLED=true` and `DAILY_AI_CALLS=12`. `/api/health` reports AI configured, photos disabled, and bundled fallback available. The deployed frontend matches the local production build byte for byte. The updated build and all 36 unit/integration tests and 31 browser checks passed before deployment.

`node scripts/verify-live-ai.mjs` passed against the actual HTTPS deployment without intercepting provider responses. The final live endpoint check returned four accepted fresh captions; the current local card remained unchanged until Dismiss, then an AI card appeared with matching response text and provenance. Its exported PNG was 1080 × 1440 and matched the displayed bytes by SHA-256. Share through the browser download fallback retained the card. Dismiss stored the generated card, and an offline reload restored its exact ID and AI provenance from Rejected. No uncaught browser errors were observed. Screenshot: `artifacts/live-ai-android-chromium.png`.

The initial live attempt exposed an 18-second timeout that was too short: a direct diagnostic call received a valid Cloudflare response after 31.3 seconds. The fix allows 45 seconds shared across attempts and 50 seconds at the client, with the first local card still immediate. Regression tests proved the old timeout failed and the new handling succeeds. One direct diagnostic inference was made in addition to the application's budgeted attempts; it was not an application request. No persistent diagnostics or public administrative endpoint were added.

Pexels requests remain unverified because no secret is configured and [new key issuance is currently paused](https://www.pexels.com/api/). Native OS share sheets and installed physical-device checks remain pending; the live browser check verifies a real download, not a camera-roll write.

## Visual evidence

- `artifacts/phase1-android-chromium.png`: Android-sized feed screenshot.
- `artifacts/phase1-iphone-webkit.png`: iPhone-sized feed screenshot.
- `artifacts/typography-grid.png`: six real PNG compositions, one for each mood.
- `artifacts/live-ai-android-chromium.png`: production composition from an actual Workers AI caption.
- `docs/PHASE1.md`: checkpoint recorded before AI integration.

Optional `node scripts/visual-qa.mjs` regenerates the typography grid while the production preview runs at port 4173. It uses the app UI and reads the exact displayed PNG, rather than manufacturing a separate mockup.

## Bugs found and fixed during implementation

1. Worker-global TypeScript declarations conflicted with DOM types. Frontend and Worker now compile with separate type environments.
2. WebKit failed to store canvas PNG Blobs in IndexedDB (`UnknownError: Error preparing Blob/File data`). Schema v2 stores PNG ArrayBuffer bytes and restores a Blob on read; v1 Blob records remain readable. Both browser suites now pass dismissal and offline persistence.
3. Image-opening fallback originally shared the Save confirmation path. It now tracks the initiating action so Share never advances the card.
4. Landscape controls could fall below the viewport while the image consumes touch input. Compact landscape mode places the heading beside a fully visible composition; button bounds are tested.
5. Recently exported URLs initially depended only on a delay. A bounded three-URL retirement queue now prevents rapid swiping from retaining unbounded Blob data, while briefly preserving initiated downloads.
6. Live structured generation took longer than the original 18-second timeout. Generation now shares a 45-second deadline across retries and the browser permits 50 seconds in the background. Provider configuration changes reset a stale circuit without resetting daily usage or pacing.
7. Repeat avoidance could exclude the only matching photo and show an ocean caption over mountains. Matching keywords now constrain the candidate pool before aesthetic and repeat preferences. The finite pack may reuse a matching subject when no alternative exists.

## Physical-device checklist — pending operator execution

Deploy over HTTPS, then test every row. Keep the result/date/OS version beside each entry; do not mark it passed based on emulation.

| Device/browser mode           | Portrait + landscape | Left/right/up + buttons | Save destination + share cancellation | Offline relaunch | Safe areas + assistive technology |
| ----------------------------- | -------------------- | ----------------------- | ------------------------------------- | ---------------- | --------------------------------- |
| Android Chrome, browser       | Pending              | Pending                 | Pending                               | Pending          | TalkBack pending                  |
| Android Chrome, installed PWA | Pending              | Pending                 | Pending                               | Pending          | Navigation/gesture bar pending    |
| iPhone Safari, browser        | Pending              | Pending                 | Pending                               | Pending          | VoiceOver pending                 |
| iPhone, home-screen app       | Pending              | Pending                 | Pending                               | Pending          | Notch/home indicator pending      |

1. Open once online and wait for About → “The offline pack is ready.” Install using the OS/browser flow, close, enable airplane mode, reopen, and dismiss at least five memes. Verify all six fonts/photos still render.
2. Drag less than the threshold and release: spring back. Swipe left, right, and up. Touch a button while moving slightly: do not invoke a second gesture. Try a second finger and rapid repeated actions. Scroll the settings modal independently. Enable reduced motion.
3. Share, then cancel: same card. Share successfully: same card. On Android Save, inspect Downloads and confirm the PNG contains photo/caption only. On iPhone, choose Save Image/Files when available; confirm the actual destination manually. Do not confuse the app's export confirmation with a verified Photos write.
4. Exercise a browser without file sharing. Confirm download or long-press instructions. Share fallback must return to the same card; Save fallback advances only on “I saved it.”
5. Dismiss several cards, reopen Rejected, rotate the phone, save/share, return to the main feed, and confirm separate positions. Reload and reopen Rejected to check persistence. Clear confirmation must allow cancel.
6. Change every filter, then Random Mode. Existing cards retain their original settings; subsequent cards use the new choice. Offline topics/intensities are weighted within the curated library, not an unlimited exact-match generator.
7. Simulate slow bandwidth. The first local photo should appear without waiting on AI. Exhaust/disable AI and Pexels separately; the feed must continue. Verify actual live AI and photo provenance after enabling credentials.
8. With low device storage or blocked IndexedDB, Dismiss reports failure and retains the card; sharing remains available. Exercise age/count/byte eviction through the automated test fixture rather than filling a personal phone unnecessarily.

## Known limitations

- Deployment and live AI are verified. Live external photo searches and physical OS flows remain unverified. Pexels currently pauses new key issuance; an existing key can enable its optional adapter.
- PWA installation, persistence, share APIs and available destinations vary by browser/OS. No silent camera-roll insertion or direct Story/Snapchat posting is implemented or promised.
- Source photo metadata does not contain reliable face boxes. Subject avoidance uses optional metadata; Pexels results are filtered by text metadata, not a face detector.
- The finite offline library deliberately repeats after recent-history cooling. Topic/intensity are preferences for that library. Exact filter-compatible live candidates may be scarce, especially in Random Mode.
- Heuristic safety and originality checks do not prove semantic originality or catch every unsuitable model output. Review live output before broad publication.
- Static ZIP hosting has no live backend. Full AI deployment uses the Worker configuration or GitHub-connected deployment.
- A fresh visit with no prior online cache cannot work without a network. Browser storage eviction can remove the offline pack and Rejected history.

## AI startup and replenishment update — 2026-10-21

The operator requested online startup to wait for AI and a 500-attempt daily testing cap. Online startup now shows a reduced-motion-aware spinner and progress text until the first response; successful generation supplies the first card. Offline startup remains immediate, and failed/empty/exhausted requests provide a labeled curated fallback. A separate status area exposes generation/retry/limit state and **Try fresh captions**.

Regression tests reproduce and cover stale disabled-health caching, unscheduled short-cooldown retries, Random Mode discarding compatible AI, recent IDs making a pool look full, accurate random-card metadata, 15-second global pacing, and a configured budget above the former 100-call hard ceiling. Browser tests check spinner-to-first-AI, recovery after depletion without refreshing, preservation of the visible card, and manual recovery from a budget fallback.

Final local validation: 44 unit/integration tests and 35 browser tests, with one expected WebKit CDP skip. Production smoke results and deployment version are recorded in OPERATOR.md. The 500-attempt cap does not expand Cloudflare’s free allowance.

Live verification of version `30e7bb6d-9327-44e0-a52a-b7adad2758b0` passed: the spinner appeared before any card, the actual API returned 11 accepted captions, and the first displayed card was AI-generated. PNG export matched its preview and that generated card survived an offline reload in Rejected. Cloudflare version bindings confirm `AI_ENABLED=true` and `DAILY_AI_CALLS=500`. Evidence: `artifacts/live-ai-loading.png` and `artifacts/live-ai-android-chromium.png`.
