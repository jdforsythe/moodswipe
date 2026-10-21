# MoodSwipe

A working, offline-first photo-meme PWA for Android, iPhone, and desktop. Captions are composed into the photograph, and every export uses the exact PNG displayed in the feed. No login, end-user API key, or saved gallery.

**Start without credentials.** The bundled collection includes 96 complete captions, eight licensed photographs, six caption typefaces, gestures, sharing/downloads, settings, Random Mode, and local Rejected history. Optional Cloudflare Workers AI and Pexels adapters add fresh content without making the app depend on them.

## Run on this MacBook

Requires Node 22 or newer and npm. All assets are already included; no asset-download command is required.

```sh
npm ci
npm run dev
```

Open the printed localhost URL. For the production PWA and local Worker:

```sh
npm run build
npm run worker:dev
```

Open `http://localhost:8787`. AI and dynamic photos are disabled by default. Wrangler may warn that its AI binding is remote; the disabled application never calls it. `npm run preview` serves the static build at `http://localhost:4173` and is also fully functional without a backend. A physical phone visiting a plain-HTTP LAN IP does not get secure-context PWA/share APIs: use an HTTPS deployment for device QA.

## What the actions do

| Action         | Main feed                            | Rejected feed                       |
| -------------- | ------------------------------------ | ----------------------------------- |
| Left / Dismiss | Store locally, then advance          | Advance without duplicating history |
| Right / Save   | Initiate device export, then advance | Same; retain the stored meme        |
| Up / Share     | Share the composed image; stay here  | Same                                |

Buttons and arrow keys offer the same actions. Canceled sharing and failed saves keep the card visible. Android Save starts a browser download; check Downloads. iPhone uses file sharing when supported, otherwise an image you can touch and hold. Browser success is **not proof of a Photos/camera-roll write**. Sharing targets are supplied by the OS and installed apps; there is no Instagram Story or Snapchat posting API.

Rejected history lives only in IndexedDB: at most 100 cards / 100 MB / 30 days. Browser storage clearing or eviction can erase it. Settings affect subsequent cards, preserving the current card. Random Mode varies parameters per newly composed card. The finite offline library matches the selected mood and favors topic/intensity; it cannot supply an exact unlimited combination of every setting.

## Deploy the complete app to Cloudflare

The recommended deployment is **one Worker with static assets**, its AI binding, and one SQLite Durable Object. This keeps the frontend and API on one origin and gives the operator one project to manage. No manually provisioned database ID or AI API key is required.

1. Create or sign in to a Cloudflare account. Stay on Workers Free if you want a hard platform ceiling rather than paid overages.
2. From this directory, run:

   ```sh
   npx wrangler login
   npm run test
   npm run build
   npx wrangler deploy
   ```

3. Complete Cloudflare’s login/consent in your browser. If you have several accounts, select the intended one. The project name is `moodswipe` in `wrangler.jsonc`; change it if necessary.
4. Open the returned `https://moodswipe.<your-subdomain>.workers.dev` URL. The offline app works immediately. `/api/health` should report `ok: true`, AI/photos `disabled`, and fallback `bundled`.
5. In **Cloudflare → Workers & Pages → moodswipe → Settings → Variables and Secrets**, add the ordinary variable `AI_ENABLED` with value `true`, save, and deploy the settings change. The `AI` binding and `POOL` Durable Object binding are declared in the checked-in configuration. Review the model terms linked in [LICENSES.md](LICENSES.md) before enabling AI.
6. Reload the app online. The first online card waits for generation behind a spinner, then appears as “Freshly imagined” when a valid caption arrives. Open its info button to inspect provenance. Failed or quota-exhausted generation leaves the local feed working.
7. Dynamic photos are optional. [Pexels currently reports that new key issuance is paused](https://www.pexels.com/api/) (checked 2026-10-21). If you have an existing key, add `PEXELS_API_KEY` as an **encrypted Worker secret** and add the ordinary variable `PHOTOS_ENABLED=true`. Otherwise the bundled licensed photos work with both local and AI captions. Keep attribution enabled.

The app is deployed at **[moodswipe.jdforsythe.workers.dev](https://moodswipe.jdforsythe.workers.dev/)** with **live AI enabled and verified** on **2026-10-21**. No additional AI API key is needed: the existing Cloudflare binding handles it. The application caps inference at 500 attempts per UTC day for testing, including retries. The live check received fresh captions, rendered an AI card, downloaded a byte-identical 1080 × 1440 PNG, and restored the generated card from Rejected after an offline reload. External photo search remains disabled pending an existing Pexels key; bundled photos are fully usable with AI captions. The final build passes 44 unit/integration tests and 35 browser checks, with one expected WebKit skip. See [TESTING.md](TESTING.md) for evidence and remaining physical-device checks.

After an update, reload and accept the app's update prompt if shown. Online startup shows a spinner while waiting for the first AI batch (typically about 30–45 seconds). Offline startup uses the bundled collection immediately. Failed or exhausted generation falls back with a visible status and **Try fresh captions** action. Short cooldowns retry automatically during active browsing; later swipes consume prefetched cards, so a network request is not expected on every Dismiss. To repeat the live check manually (consumes shared provider quota):

```sh
node scripts/verify-live-ai.mjs
```

## GitHub-connected deployment and phone management

The source repository is [jdforsythe/moodswipe](https://github.com/jdforsythe/moodswipe), branch `master`. To configure automatic deployment, [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) can build and deploy it without a local terminal:

1. Cloudflare dashboard → Workers & Pages → Create application → connect/import a Git repository; choose this repository and your production branch.
2. Set project/Worker name to `moodswipe` (matching `wrangler.jsonc`), root directory to the repository root, build command to `npm run build`, and deploy command to `npx wrangler deploy`. Cloudflare installs npm dependencies. Choose Node 22 or newer if the build settings expose that option.
3. Deploy, then configure runtime variables/secrets as above. Runtime secrets belong to the Worker, **not** frontend build environment variables.
4. Future commits trigger a deployment. Use the Cloudflare dashboard from Android to inspect deployments, roll back, enable/disable AI/photos, edit budgets, and manage secrets. `keep_vars` preserves dashboard-managed variables; this repository deliberately does not redeclare their values.

Alternatively, the included manual **Deploy to Cloudflare** GitHub Action can be launched from GitHub’s mobile website. Create repository/environment secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (a Cloudflare _Edit Cloudflare Workers_ token restricted to your target account), then Actions → Deploy to Cloudflare → Run workflow. Do not configure both deployment methods for automatic use. The check workflow also produces a static download artifact.

## Android-browser-only static ZIP deployment

`artifacts/moodswipe-static.zip` contains the prebuilt standalone PWA, with `index.html` at its root. It needs no Worker or API key.

1. Download that ZIP to your Android phone.
2. In Chrome, visit the Cloudflare dashboard. Use **Desktop site** if the mobile page hides controls.
3. Workers & Pages → Create application → Pages → upload assets / drag and drop. Tap the file picker and select the ZIP, enter a project name, then deploy.
4. Open the resulting HTTPS `pages.dev` URL, wait for the offline pack to finish (About → “The offline pack is ready”), and use Chrome’s menu → Install app / Add to Home screen.
5. For updates, upload a new static ZIP as a new deployment. The app offers an update button when a new service worker is waiting.

Cloudflare supports a ZIP in the dashboard upload flow; the ZIP is static-only and does not install this app’s Durable Object/API backend. For full AI deployment from a browser, use the GitHub-connected Worker path above. A Pages Direct Upload project cannot later be switched to Git integration; create a separate Worker project for the full deployment. See [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

On iPhone, open the HTTPS URL in Safari, then Share → Add to Home Screen. Install from the same origin you will keep using: browser storage does not move between origins.

## Verify, package, and operate

```sh
npm run test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npx wrangler deploy --dry-run
npm run package
```

Packaging produces a static ZIP and a source ZIP in `artifacts/`. Build and automated test details, screenshots, physical-device steps, and limitations are in [TESTING.md](TESTING.md). The Phase 1 checkpoint was completed before adding the backend: [docs/PHASE1.md](docs/PHASE1.md).

- [OPERATOR.md](OPERATOR.md): runtime configuration, credentials, budgets, monitoring, recovery.
- [ARCHITECTURE.md](ARCHITECTURE.md): data flow, provider contracts, storage, and fallback.
- [PRIVACY.md](PRIVACY.md): local data and provider processing.
- [LICENSES.md](LICENSES.md): photo/font rights and AI terms.

## Free-tier limits and costs

Verified against provider documentation on **2026-10-21**; check again before deployment. Workers AI includes **10,000 neurons/day**. The configured model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`; the app defaults to a global **500 inference attempts/day**, counting retries, and caps each attempt at 2,600 output tokens. This is the operator-selected testing cap, not an included free allocation. The model can exhaust Cloudflare’s free allowance before 500 attempts; on a paid account, excess usage is billable. Lower `DAILY_AI_CALLS` in the Worker dashboard after testing. Other apps share the account allowance. See [AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and the [model card](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/).

On Workers Free, excess AI usage fails instead of automatically purchasing a paid fallback. Enabling Workers Paid allows usage-based charges above included allocations. Static asset requests are free; Worker invocations and Durable Object operations have their own limits. SQLite Durable Objects are available on Free with **100,000 requests/day** and **13,000 GB-s/day**, plus storage limits. See [static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) and [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Pexels documents **200 API requests/hour and 20,000/month** by default. This app caches generic photo-search responses for 24 hours and caps uncached requests at 120/day by default. A public anonymous service can still exhaust its shared quota: an origin allowlist is not authentication. There is no automatic paid-provider fallback. Read [Pexels API documentation](https://www.pexels.com/api/documentation/).

## Troubleshooting

- **Only curated cards:** check the generation status below the card. It distinguishes generation, waiting, unavailable service, and exhausted AI budget. **Try fresh captions** rechecks configuration and requests another batch; server limits still apply. Background retries stop in hidden tabs and after two minutes without browsing activity. The `blob:` image request is the already-composed card; the LLM request appears as `POST /api/generate`.
- **No install button:** HTTPS is required (localhost is a development exception). Browser install menus vary. Wait for the service worker, use the browser menu, and verify the manifest is served as JSON rather than an HTML fallback.
- **Share unavailable:** the device/browser lacks file sharing. Use the offered download or open-image path. Test OS sharing on an actual device.
- **Dismiss cannot store:** free some device storage or clear Rejected. The current card stays visible. Restrictive private-browsing modes may disable persistent storage.
- **External photo fails:** composition switches to a bundled photograph. Broken or tainted images are never exported.
- **After update:** tap the update banner. This reloads the app; rejected records and preferences remain unless the browser cleared storage.
- **API 403/429:** same-origin requests are expected; external origins must be explicitly listed. Wait for the anonymous rate limit. Never disable quotas to conceal an exhausted provider.
