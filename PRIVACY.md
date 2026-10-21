# MoodSwipe privacy

MoodSwipe requires no account and includes no analytics, advertising trackers, or cloud gallery.

**On your device:** your filter settings, recent caption IDs, and dismissed memes remain in browser storage. A rejected meme includes its rendered PNG, caption, photo credit, layout, settings, and timestamp. History is bounded to 100 cards, 100 MB, and 30 days. Clear Rejected removes that history; clearing this website’s storage also removes preferences and the offline cache. Browsers may evict storage independently. There is no cross-device sync or server backup.

**Exports:** Save and Share pass the composed image to your browser or operating system. A selected sharing application handles it under its own privacy policy. MoodSwipe does not learn which social app ultimately stored or published it. A completed browser download does not verify a camera-roll write.

**Optional AI:** the browser sends only the current filter parameters to the same-origin Worker to request a batch. It never uploads rejected memes, rendered images, or preference/history timelines. The server maintains a generic shared caption pool and recent generic output to avoid repetition. It sends the current generation request and recent generic captions to Cloudflare Workers AI. This information is not associated with an account or stored as an individual user profile. Model output is stored for up to seven days in the shared candidate cache, pruned during requests and scheduled maintenance.

**Abuse prevention:** Cloudflare receives the network connection and IP address. The Worker passes the IP transiently to its internal rate limiter, which stores a daily salted hash and short-lived counters, not a raw IP. The salt rotates daily, and counters expire or are pruned within a day. The application does not log request bodies or raw IPs. Cloudflare still processes hosting/security/billing metadata under its [privacy policy](https://www.cloudflare.com/privacypolicy/) and [Workers AI data policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

**Optional dynamic photography:** the Worker sends generic, allowlisted photo-search terms to Pexels. Your browser fetches selected images directly from `images.pexels.com`, exposing ordinary connection information to that service. No user photos are uploaded. Metadata is cached server-side for 24 hours; a composed image enters persistent local storage only when you dismiss it. See [Pexels privacy](https://www.pexels.com/privacy-policy/). Bundled starter photos require no runtime contact with Unsplash or Pexels.

**Operator controls:** AI and dynamic photography start disabled. Operators can turn either off in Cloudflare. If enabling platform logs, analytics, or another provider later, update this document and the app’s About panel to reflect the actual deployment. Optional third-party links open only when you select them.
