# Operator configuration

Only the operator configures services. Do not add credential fields, sign-in requirements, or setup screens to the end-user app.

## Current deployment

Verified 2026-10-22 at **https://moodswipe.jdforsythe.workers.dev/**. `AI_ENABLED=true` and `DAILY_AI_CALLS=500` are deployed and preserved across normal redeploys. Live Workers AI generation, composition, PNG download, and offline Rejected persistence passed. No additional AI API credential is required. Pexels is disabled; an existing `PEXELS_API_KEY` is needed only for external photo search. The bundled photographs work now. Production version at verification: `87c25286-c5b1-495a-b195-388348b257a6`.

To update from this Mac, run `npm run deploy`; the existing Cloudflare login is sufficient until it expires. `npx wrangler login` renews it if necessary. Source is published to `https://github.com/jdforsythe/moodswipe` on `master`. Automatic deployment is not configured; connect Workers Builds to that branch or configure the manual workflow secrets described in the README.

## Runtime configuration

Set values in Cloudflare → Workers & Pages → moodswipe → Settings → Variables and Secrets. Save/deploy changes, then reload the application. `wrangler.jsonc` preserves dashboard variables (`keep_vars: true`). Local development reads optional `.dev.vars` (ignored by Git); `.env.example` lists placeholder names only. Never use `VITE_` for credentials.

| Name                | Type       | Default when absent                        | Purpose                                                                                    |
| ------------------- | ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `AI_ENABLED`        | Variable   | `false`                                    | Set exactly `true` to permit inference                                                     |
| `AI_MODEL`          | Variable   | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Verified Workers AI JSON-capable model                                                     |
| `DAILY_AI_CALLS`    | Variable   | `500`                                      | Global daily inference attempts, including retries; `0` disables calls; hard maximum 10000 |
| `PHOTOS_ENABLED`    | Variable   | `false`                                    | Set exactly `true` to request Pexels metadata                                              |
| `PEXELS_API_KEY`    | **Secret** | None                                       | Optional Pexels account API key                                                            |
| `DAILY_PHOTO_CALLS` | Variable   | `120`                                      | Uncached Pexels searches/day; hard maximum 300                                             |
| `ALLOWED_ORIGINS`   | Variable   | Empty                                      | Optional exact comma-separated additional origins; same origin is automatic                |

AI uses the `AI` Worker binding. There is **no AI API token in the frontend or operator browser**. Cloudflare deploy authentication is separate: `wrangler login` for your Mac, or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub secrets if using the manual deployment workflow. Never commit those credentials.

As checked on **2026-10-21**, [Pexels reports that new API key issuance is paused](https://www.pexels.com/api/). If you already have a key, add it as an encrypted Worker secret and then enable photos. Otherwise, keep using the bundled licensed photographs; no photo key is required for the working app or live AI captions. Recheck Pexels availability before attempting a new account setup. Review its actual API/license terms and keep prominent photo/provider attribution.

CLI secret setup, if preferred:

```sh
npx wrangler secret put PEXELS_API_KEY
```

Paste the key into the interactive prompt. Do not pass it on a command line, put it in `wrangler.jsonc`, or build it into JavaScript. Confirm `/api/health` reveals only `configured`/`disabled`, never values. Frontend files have no provider-secret references; use browser DevTools Network to confirm only filter parameters and photo keywords are sent. Full source remains in this repository for inspection.

## Initial rollout

1. Deploy disabled/default mode. Test the complete offline loop on your actual Android phone.
2. Enable AI on the **Free** plan and inspect Workers AI usage in the Cloudflare dashboard. The current testing budget is 500 attempts/day; it is not a promise of 500 free batches. Lower `DAILY_AI_CALLS` after testing if desired. The application uses a shared pool, so other visitors may see the same generic captions, with device-local repeat suppression.
3. Open the app online. Check `/api/health`; it confirms configuration, not successful inference. A successful generated card has “Freshly imagined” and AI provenance in the info panel. Lack of that label can mean filtering, a mismatch with current filters, provider failure, or a spent budget.
4. Optionally enable Pexels and verify the visible Pexels/photographer credit, actual export, and broken-image fallback.
5. Test installed Android/iOS behavior using [TESTING.md](TESTING.md). No automated test can certify a device’s Photos app or third-party share destination.

`node scripts/verify-live-ai.mjs https://moodswipe.jdforsythe.workers.dev --dark` manually tests the deployed AI path, byte-identical PNG export, and offline Rejected persistence. It makes a real generation request and can consume shared quota; it is intentionally excluded from CI. Wait at least 15 seconds between attempts; provider requests typically take longer than that. A depleted quota, open circuit, or lack of fresh candidates makes this strict live check fail even though the application continues serving local content.

## Budget and recovery

- The default model is available in the current catalog and supports structured JSON. Some older Llama model URLs redirected to “unavailable” during implementation; do not assume historical model names still work. Recheck the [model catalog](https://developers.cloudflare.com/workers-ai/models/) before changing `AI_MODEL`.
- The global daily limit is reserved durably before each inference, including retries. The application does not know the total AI usage of other projects in your Cloudflare account. Monitor the account’s neuron usage.
- Quota/auth errors or timeout open the circuit for 15 minutes. Three transient failures also open it. A single transient retry is attempted with delay. The provider might continue computing after a client-side timeout, which is why the reserved attempt is never refunded.
- Generation attempts share a 45-second deadline; the browser allows 50 seconds for the background request. Online startup waits behind a spinner; subsequent generation runs behind the usable feed. Offline and failed requests use the curated fallback. Changing `AI_MODEL` or deploying a changed generation deadline clears a stale provider circuit without resetting daily usage or pacing.
- Setting `AI_ENABLED=false` stops new inference. Already queued/shared strong captions may still display. To force local-only supply on the browser immediately, disable AI and reload the app; `/api/health` prevents new batch requests.
- A 429 response means wait. Avoid increasing budgets until you have checked whether the issue is shared traffic, an exhausted account allowance, or an abusive client. The offline feed is the expected degraded mode.
- For photo errors, confirm the Worker secret and Pexels usage dashboard. Photo responses are cached for 24 hours. Failed CORS or load/encoding automatically switches to a bundled photo. The PNG remains exportable.
- Cloudflare → Deployments lets you roll back code. `wrangler` migrations create the SQLite namespace once; do not delete the Durable Object binding casually, since it holds the global quota ledger. A code rollback does not roll back schema/data.
- Cloudflare → Settings → Domains & Routes can add an optional custom domain. Keep one canonical origin; browser-local settings/history do not transfer between domains.

## Known operating limits

This is an anonymous public application, not a guaranteed unlimited AI service. CORS/origin validation prevents casual browser cross-site use but is not authentication. The global budget limits provider spending, but a malicious visitor can consume shared supply first. Add an operator-selected abuse challenge only if real traffic requires it; do not silently remove the offline experience.

Prompt rules, schema/length checks, a safety phrase filter, cliché checks, and text-similarity heuristics reduce unsuitable content. They do not replace a semantic moderation service or human editorial review. There is no automatic paid moderation/LLM fallback. Captions and themes should be reviewed on the live provider before a broad public launch.

Shared pool metadata is available only through the Cloudflare operator tools; there is no public debug/admin endpoint. The default application does not emit full prompts, model responses, keys, raw IPs, or user histories into logs. If you enable diagnostics, keep logs short-lived and update privacy disclosures accordingly.

## Request recovery

Health configuration is rechecked after 30 seconds when supply is needed. Short pacing waits use the server’s actual retry interval rather than a blanket 15-minute delay. One-shot retries run only while online, visible, and within two minutes of browsing activity. Returning to the tab or using **Try fresh captions** resumes demand. Random Mode consumes valid captions across moods/topics and composes with their actual metadata. Already-seen IDs are removed locally so they cannot make an unusable remote pool look full.

## Caption and composition rollout — 2026-10-22

Version `87c25286-c5b1-495a-b195-388348b257a6` expands the bundled pack from 8 to 32 photographs, adds persistent photo/type rotation, and uses image-aware text color and optional gradients. The caption brief and phrase filters are updated, eight candidates are requested per call, and pre-update generic pool items are invalidated while retaining the 500-attempt daily ledger. Llama 3.3 remains the production model; Qwen 3 and GPT-OSS trials were faster but did not produce consistently better writing. No additional credentials are required.

The actual deployed Dark Humor check returned five accepted captions in 19.7 seconds. Spinner-before-first-card, AI provenance, byte-identical 1080 × 1440 PNG export, Share retaining the card, and offline restoration in Rejected passed with no uncaught browser errors. Results and the complete accepted batch are recorded in `artifacts/live-ai-result.json`; the live screenshot is `artifacts/live-ai-android-chromium.png`. Some accepted lines were still plain observations: automated acceptance does not mean editorial approval. The fallback Dark Humor collection was rewritten independently.

Existing installations should reload and accept **A new version is ready. Update** to install the new photo/font pack. Rejected images keep their original rendered bytes. Code rollback is available in Cloudflare Deployments; it does not restore discarded obsolete pool captions or reset usage limits.
