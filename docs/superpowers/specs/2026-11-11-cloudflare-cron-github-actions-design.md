# Design: Automated video generator — Cloudflare cron → self-hosted GitHub runner (free-total)

**Date:** 2026-11-11
**Status:** Approved 2026-11-11 (user) — with cadence and runner decisions below

## Intent / why

The channel's autopilot runs on an external scheduled task today. The user wants the **video generator run automatically on a schedule via GitHub Actions**, with **zero cost at all**, replacing or complementing the current manual/scheduled trigger. The chain already exists as a free stack: Cloudflare (free tier) as an exact cron "clock", GitHub Actions (private repo → 2,000 free min/month) as the machine, Gemini AI Studio (free) as the LLM agent, and the existing repo scripts (all free/local) for the rest.

## Decisions (made in conversation)

- **Trigger:** Cloudflare Worker cron → `POST /repos/hendra/video-short/dispatches` (`repository_dispatch`, `event_type: "video-run"`), using `VIDEO_SHORT_PAT` (fine-grained GitHub PAT, already in `.env`). Cloudflare Workers **cannot** render video — it is only the clock. Cadence: **every day at 08:00, 11:30, 16:30 WIB (01:00, 04:30, 09:30 UTC)** — user-approved. Also `workflow_dispatch` for manual runs.
- **Runner:** **self-hosted runner on the user's desktop** (Intel i7-9700K, 8 cores, RTX 2060 SUPER 8 GB VRAM, 16 GB RAM, Ubuntu 24, x86_64). Render with `--gl=vulkan` (verified working locally) → ~15–25 min per video; swangle as fallback if vulkan breaks. Self-hosted minutes do NOT consume the 2,000/month free quota → 3 runs/day is sustainable. **Repo must stay private while the self-hosted runner is in use** (self-hosted on a public repo lets any fork execute on this machine).
- **Quota math (user-approved):** Gemini TTS: 3 videos/day = 90/mo « ~10 req/day ✓; agent text: borderline vs flash free caps → occasional `skip, kuota` outcomes are designed behavior (report to Slack, stop); GitHub minutes: not applicable (self-hosted).
- **Agent:** **Full autopilot in CI**, free: `opencode run --auto --standalone --model opencode/inkling-2-small-free "<prompt>"` (the opencode free model running this very session; rate limits exist — on quota failure → **report "skip, kuota" to Slack and stop**, no retries). `GEMINI_API_KEY` is used for **TTS only**. If the free model underperforms, swap `--model` in the workflow (one-line change); a paid provider can be added later without restructuring.
- **Pipeline after agent:** `npm run lint` → `npm test` → `npx remotion bundle` → **1 still per shot** (fail the job if any still errors or is implausibly small) → render `--log=error` → `ffmpeg loudnorm=-14 LUFS` → Cloudinary signed upload → Buffer GraphQL `createPost` (YouTube + TikTok) → ledger row → commit+push video/`public/<id>/vo.mp3`/registry/ledger to `main` (same rules as today) → Slack #social report.
- **Secrets:** GitHub repo secrets: `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BUFFER_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SOCIAL_CHANNEL_ID` (all already exist in `.env`). Cloudflare Worker secret: `VIDEO_SHORT_PAT`. Workflow uses built-in `GITHUB_TOKEN` with `contents: write`.
- **Branch model:** push to `main`, same as the current scheduled task (gates + agent make up for not merging through a PR). Ledger rides the commit like today.

## Why not the alternatives (recorded honestly)

- **GitHub's own `on: schedule`** — possible and free, but officially best-effort with hour-level delays; Cloudflare cron is exact and independent of repo inactivity rules. (Note: GitHub cron is disabled after 60 days of repo inactivity; our daily commits keep both alive.)
- **Paid agent APIs** (Claude Code/OpenAI/anthropic opencode models) — rejected by user: zero cost requirement.
- **Deterministic-only CI (no agent)** — cheapest/most stable, but not "automatic video generator". Rejected by user.
- **Cloudflare does the work** — impossible: Workers have no browser/ffmpeg/long CPU time.

## Goals / non-goals

**Goals**
- Zero added cost per month (GitHub minutes ≤ 2,000, Cloudflare free tier, Gemini free tier).
- Cron run produces a complete, verified video → published on YouTube + TikTok → ledger row committed → Slack report — with no human-triggered steps.
- The failure modes are loud: any failure → Slack message with step + error snippet; nothing half-published.

**Non-goals**
- No paid API keys anywhere; no reliance on the shared opencode-free model pool.
- No change to local development flow or repo structure.
- No human review gate (channel policy comes from AUTOPILOT.md, which the agent follows verbatim).

## Design

### 1. Cloudflare Worker (new, tiny — lives outside this repo; deploy via `wrangler`)
- `crons = ["0 1 * * *", "30 4 * * *", "30 9 * * *"]`  (01:00, 04:30, 09:30 UTC = 08:00, 11:30, 16:30 WIB, every day)
- Handler: POST `https://api.github.com/repos/hendra/video-short/dispatches` with headers `Authorization: Bearer <VIDEO_SHORT_PAT>`, `Accept: application/vnd.github+json`, body `{ event_type: "video-run", client_payload: { source: "cloudflare-cron" } }`.
- On non-2xx from GitHub: POST `https://slack.com/api/chat.postMessage` to `SLACK_SOCIAL_CHANNEL_ID` with `slack_send_message`-equivalent text; needs `SLACK_BOT_TOKEN` + `SLACK_SOCIAL_CHANNEL_ID` as Worker env (same values as .env).
- The Worker itself has no video logic; it is a ~30-line trigger.

### 2. GitHub workflow `.github/workflows/video.yml`
- Triggers: `repository_dispatch: [video-run]`, `workflow_dispatch`.
- Permissions: `contents: write`.
- Steps:
  1. `actions/checkout@v4` (token: built-in `GITHUB_TOKEN`, fetch-depth 1)
  2. `actions/setup-node@v4` node 22, npm cache
  3. `npm ci`
  4. Write `.env` from secrets (umask 077); **DEBUG never prints keys**
  5. `opencode run --auto --standalone --model opencode/inkling-2-small-free --file AGENTS.md --file docs/AUTOPILOT.md "You are in CI..."` (prompt committed at `ops/ci-prompt.md`; the agent researches today's topic and produces src/videos/<slug>/ per the runbook).
  6. Gates: `npm run lint && npm test && npx remotion bundle --out-dir /tmp/rbundle`
  7. Still check: one still per shot id from `timeline.json` (`npx remotion still ... --frame=$(f)`), expect each output file > 10 KB; else fail job.
  8. `npx remotion render /tmp/rbundle <slug> out/<slug>.mp4 --gl=vulkan --log=error` (GPU on self-hosted runner; fallback `--gl=swangle` if vulkan is broken on a new machine profile)
  9. `ffmpeg ... loudnorm=I=-14:TP=-1.5:LRA=11 ... -movflags +faststart out/<slug>-final.mp4`
  10. `npm run publish -- <slug>` (new script implementing docs/PUBLISHING.md: Cloudinary signed upload → verify bytes → Buffer GraphQL `createPost` YouTube + TikTok → poll → ledger row → print links) — idempotency: if `docs/ledger.md` already has the slug row (e.g. previous partial run), skip publish step and report "already published".
  11. Commit (`src/videos/<slug>/*`, `public/<slug>/vo.mp3`, registry, `docs/ledger.md`) and push to `main` (`git -c user.email=... push origin HEAD:main`). If the default `GITHUB_TOKEN` push is rejected by a branch-protection rule, fall back to `VIDEO_SHORT_PAT`-authenticated push (or open and auto-merge a PR) — decide at implementation time after trying the plain push.
  12. Slack report via `npm run report -- <slug>` (status + links + provider used + error if failed) — or `curl` POST as fallback.
  13. Final step: on any failure, `if: failure()` → POST Slack with failing step + log tail.

### 3. New scripts (implementation, small)
- `scripts/publish.mts` — full PUBLISHING.md flow, idempotent by ledger presence.
- `scripts/report.mts` — Slack `chat.postMessage` with `{ok,ts}` check; prints the Slack ts for the ledger row.

### 4. Docs
- `docs/AUTOPILOT.md` — unchanged in content; add a line: "Scheduling: also runnable via GitHub Actions (`video.yml`) triggered by Cloudflare Worker — see PUBLISHING.md §Step 3.5 for Slack and `.github/workflows/video.yml` for the exact steps." (Or a new `docs/CI.md`.)
- `AGENTS.md` — one bullet: scheduled CI exists; link to workflow + PUBLISHING.md.
- `.env.example` — unchanged (same keys).

## Risks / tradeoffs

- **Free-tier limits**: Gemini AI Studio free quota is limited (e.g. ~10 req/day for flash TTS; the agent text+generation will share requests too). Expect occasional `skip, report` outcomes — that is the designed behavior, not breakage.
- **GitHub private Actions minutes** (2,000/mo): ~3 videos × ~70 min render ≈ 210 min/week ≈ 900/mo — fine; watch usage in Settings → Billing.
- **Agent quality in CI**: the same free-quality constraints as local; the still-per-shot gate + lint/test catch the most common failure classes before publish.
- **CI is not a sandbox**: `contents: write` needed for pushes; secrets exposed only to this workflow; `.env` written with `umask 077`; nothing prints keys.
- **Duplicate runs**: if a run partially publishes then fails before ledger commit, the next run republishes — mitigate by ledger-driven idempotency check before Cloudinary/Buffer steps.
- **GitHub disables cron on inactive repos** — irrelevant while weekly videos commit; keeps us in scope.

## Open items for the user (before implementation)

1. Approve this design (the gate).
2. Confirm the exact cron (Mon/Wed/Fri 01:00 UTC vs different time).
3. Cloudflare account access — Worker will be created + deployed in your account via `wrangler` (or you paste the Worker code and create the Cron Trigger yourself; the doc covers both).
