# Six daily video runs — design (short)

**Intent:** grow the channel faster by publishing 6 videos a day instead of 3. Learning which topics/slots work is done manually for now (YouTube Studio / TikTok); a weekly Buffer-metrics report to Slack (+ a `kategori` field) was discussed and parked, not dropped.

**Goals:** 6 runs/day posting at ~08:00, 10:00, 12:00, 13:00, 17:00, 20:00 WIB.
**Non-goals:** metrics report, topic categories, any workflow/pipeline change.
**Anti-goal:** breaking the existing pipeline or the one-run-at-a-time queue.

**Approaches:** only one sensible way — change the Cloudflare cron triggers; the workflow already queues runs (`concurrency: video-run`) and a successful run takes ~18–26 min on free hosted runners.

**Decided:**
- `ops/cloudflare-cron/wrangler.toml` crons → `["30 0,2,4,5,9,12 * * *"]` (UTC) = 07:30, 09:30, 11:30, 12:30, 16:30, 19:30 WIB. *Claude's call:* fire 30 min before each slot so the post lands near the named time.
- Update the times in the `worker.js` header comment, `ops/README.md`, `docs/AUTOPILOT.md`.
- Deploy is done by the operator: `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`.

**Accepted risks:** double load on opencode free model + Gemini TTS quota; duplicate gate saturates faster; failures surface in Slack #social as today.
