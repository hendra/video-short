# CI Video Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development if the free-tier limit allows). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloudflare cron → GitHub Actions self-hosted runner → full free pipeline (research → naskah → 3D scenes → VO → render → publish YouTube+TikTok → ledger → Slack) with zero paid services.

**Architecture:** Cloudflare Worker (weker saja) POSTs `repository_dispatch` to the repo. A `video.yml` workflow on a **self-hosted** runner (i7-9700K + RTX 2060 SUPER, `--gl=vulkan`) checks out, npm ci, runs the `opencode` agent headless per `ops/ci-prompt.md` (which points at `AGENTS.md` + `docs/AUTOPILOT.md`), enforces deterministic gates (lint, test, bundle, still-per-shot), renders, publishes via `scripts/publish.mts`, appends the ledger row, commits+pushes to `main`, and reports to Slack via `scripts/report.mts`. Failures anywhere → Slack report with step + error; nothing half-published.

**Tech Stack:** GitHub Actions (self-hosted runner), Cloudflare Workers + `wrangler`, Node ≥ 20.19 scripts (tsx), Remotion 4, Gemini AI Studio free tier (TTS), opencode free model (agent), Buffer GraphQL + Cloudinary signed upload (already codified in `docs/PUBLISHING.md`).

**Spec:** `docs/superpowers/specs/2026-11-11-cloudflare-cron-github-actions-design.md` — read it before this plan; conflicts resolve against the spec.

## Global Constraints

- **Zero cost**: no paid API keys anywhere; agent stays on `opencode/inkling-2-small-free` (configurable via one line in the workflow); render `--gl=vulkan` with `--gl=swangle` fallback.
- **Fail loud**: any failure → `scripts/report.mts` posts step + error snippet to Slack; job fails; no partial publish.
- **Idempotency**: `scripts/publish.mts` checks `docs/ledger.md` for the slug before any API call — re-runs after partial failure must not double-post.
- **Secrets**: only in GitHub repo secrets (`GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BUFFER_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SOCIAL_CHANNEL_ID`); `.env` written with `umask 077`; keys never printed.
- **Ledger** rides the commit (same rules as today); `out/` never committed.
- `npm test` and `npm run lint` stay green throughout.

## Review Focus

1. **Secret handling in `video.yml`** — nothing echoes keys; `.env` write umask-safe; `GITHUB_TOKEN` has `contents: write` only for the final commit job.
2. **Agent step produces nothing (quota/failure)** — workflow must detect missing artifacts (`timeline.json`, `out/<slug>-final.mp4`) and report `agent: produced no usable video` instead of rendering garbage.
3. **Buffer/YouTube inconsistency after partial failure** — ledger-first check in publish.mts prevents duplicate YouTube/TikTok posts.
4. **YAML validity/self-hosted runner label mismatch** — workflow must run on `[self-hosted, linux, x64]`; validate YAML parses; runner install script must create a *persistent* systemd-style service (not a session-bound process).
5. **Cloudflare Worker env vars missing on cron fire** — Worker posts `dispatches` + on 401/5xx posts Slack warning (already implemented in `ops/cloudflare-cron/worker.js`; test the failure path manually once).

## File Structure

- `.github/workflows/video.yml` — trigger + steps (the orchestration)
- `ops/ci-prompt.md` — the agent prompt (CI-specific)
- `ops/runner-install.sh` — self-hosted runner install (executed with sudo)
- `ops/cloudflare-cron/worker.js` — deployed weker (already live)
- `scripts/publish.mts` — Cloudinary → Buffer YT+TikTok → ledger row (idempotent)
- `scripts/report.mts` — Slack report (success/failure)
- `scripts/publish.test.mts` — node:test for the pure parts
- `package.json` — `publish`, `report` scripts
- Docs: `docs/AUTOPILOT.md` (pointer to workflow), `AGENTS.md` (CI bullet), `docs/PUBLISHING.md` (§Step 2 note about GraphQL only — already consistent)

---

### Task 0: Branch + commit scaffolding and spec

- [ ] Create branch `ci/video-automation` from main
- [ ] `git add ops/ docs/superpowers/specs/2026-11-11-cloudflare-cron-github-actions-design.md .env.example`
- [ ] Commit `"docs+ops(ci): design spec, cloudflare cron worker source, env example for CF keys"` and push
- [ ] Verify: `git log --oneline -1`

### Task 1: `scripts/publish.mts` + `package.json` script + tests

**Interfaces produced:** `npm run publish -- <slug>` exits 0 on success, non-zero with a clear step+error otherwise. Idempotent via ledger presence check.

- [ ] **Step 1:** Write `scripts/publish.mts`:
  - `loadDotenv()`; arg `<slug>`; verify `out/<slug>-final.mp4` exists (else `No final mp4 at …` exit 1)
  - **Ledger-first idempotency**: if `docs/ledger.md` contains `| <slug> |` → print `already published, skipping` and exit 0
  - Read `videoId` config: slug from arg; read width/duration not needed — use `docs/ledger.md` mount: title/description copy lives in the script (copy constants from the video-specific naskah? No — title/description are **content choices the agent commits** as `src/videos/<slug>/publish.json` — if absent, **fail loud** with `missing src/videos/<slug>/publish.json`).
  - Cloudinary upload: `POST https://api.cloudinary.com/v1_1/$CLOUDINARY_CLOUD_NAME/video/upload` with `public_id=shorts/<YYYY-MM-DD>/<slug>`, `timestamp`, `api_key`, `signature = sha1("public_id=…&timestamp=…" + CLOUDINARY_API_SECRET)` (alphabetical, `&`-joined); verify `bytes == statSync(file).size`
  - Buffer GraphQL `createPost` for YouTube: channel `6aedb753e29c69a171803f6e`, `mode=shareNow`, `schedulingType=automatic`, `needsApproval=false`, `metadata.youtube`: `title` from publish.json, `categoryId "27"`, `privacy "public"`, `madeForKids false`, `isAiGenerated true`, `notifySubscribers true`; `assets: [{ video: { url: cloudinaryUrl } }]`
  - Buffer GraphQL `createPost` for TikTok: channel `6aedb7fee29c69a171804662`; `metadata.tiktok: { isAiGenerated: true, title: publish.json.tiktokTitle }`; same assets; `text` from publish.json.tiktokCaption
  - Poll `post(input: { id })` every 20 s up to 5 min until both `status == sent` or `error`; on error exit 1 with message (no retries)
  - On success: append row to `docs/ledger.md`: `| YYYY-MM-DD | <slug> | <chars> | (Gemini, gratis) | <yt> | <tt> | <catatan> |`
  - Print `publish: youtube <yt>`, `publish: tiktok <tt>`
- [ ] **Step 2:** Add `publish` + `report` scripts to package.json (`tsx scripts/publish.mts`, `tsx scripts/report.mts`)
- [ ] **Step 3:** Write `scripts/publish.test.mts` with node:test covering the pure parts:
  - `rowsLedger(test-dir)` helper in publish.mts checks presence of slug row → returns boolean (unit test with temp dir fixture)
  - `sha1sig(public_id, timestamp, secret)` equals `sha1("public_id=…&timestamp=…"+secret)`
  - Buffer error union message extractor: given `{errors:[{message}]}` and GraphQL `PostActionPayload` unions, returns readable string
  - Validate `publish.json` schema minimally (title, description, tiktokTitle, tiktokCaption present)
- [ ] **Step 4:** `npm test` — all pass; `npm run lint` — clean
- [ ] **Step 5:** Commit `feat(scripts): publish.mts — cloudinary + buffer GraphQL + ledger, idempotent`

### Task 2: `scripts/report.mts`

- [ ] **Step 1:** `npm run report -- <slug> [--step <name>] [--error <msg>] [--links yt,tt]` posts to Slack via `https://slack.com/api/chat.postMessage` with `{ channel: SLACK_SOCIAL_CHANNEL_ID, text, unfurl_links: false }`; throws on non-`ok:true`; always uses `SLACK_BOT_TOKEN`
- [ ] **Step 2:** Unit-test payload construction with node:test (mock fetch; assert channel + text contain slug + links; assert on missing `--links` the message mentions the slug)
- [ ] **Step 3:** `npm test && npm run lint` — green
- [ ] **Step 4:** Commit `feat(scripts): report.mts — Slack #social reporting from CI`

### Task 3: `.github/workflows/video.yml`

- [ ] **Step 1:** Write `.github/workflows/video.yml`:
  - Triggers: `repository_dispatch: [video-run]`, `workflow_dispatch`
  - `concurrency: { group: video-run, cancel-in-progress: false }` (one video at a time)
  - `permissions: contents: write`
  - Single job `produce` on `runs-on: [self-hosted, linux, x64]` with `timeout-minutes: 240`
  - Steps: checkout (ref `main`, fetch-depth 1) → setup-node 22 with npm cache → `npm ci` → write `.env` from secrets (umask 077, never echo) → **agent step** (`opencode run --auto --standalone --model opencode/inkling-2-small-free --file ops/ci-prompt.md --file AGENTS.md --file docs/AUTOPILOT.md "You are in CI. Follow AGENTS.md and docs/AUTOPILOT.md exactly. Research today's topic; produce the video; stop at the final publish step — do not upload, do not post, do not touch the ledger. On ambiguity, follow the runbook. If quota blocks the agent, stop and let the gates fail."`) → detect slug via `find src/videos -newer HEAD -name config.json -exec dirname {} \; | head -1` (fallback: empty → fail) → `npm run lint && npm test` → `npx remotion bundle --out-dir /tmp/rbundle` → still-per-shot loop (frame from each shot span start; expect >10 KB each) → `npx remotion render /tmp/rbundle <slug> out/<slug>.mp4 --gl=vulkan --log=error` (fallback swangle on vulkan failure) → `ffmpeg -i out/<slug>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k -movflags +faststart out/<slug>-final.mp4` → `npm run publish -- <slug>` → `npm run report -- <slug> --links …` (on failure: `if: failure()` → `npm run report -- <slug> --step <failing-step> --error "see logs"`)
  - Final commit step (only on success): `git config user.email "ci@video-short.local"`, `git config user.name "video-short-ci"`, `git add src/videos/<slug> public/<slug>/vo.mp3 src/videos/registry.ts docs/ledger.md`, commit `"<slug>: <title>"`, `git push origin HEAD:main`
- [ ] **Step 2:** Write `ops/ci-prompt.md` (the agent's rules: research topic, naskah 13–16 lines, no render, no upload, no ledger; stop at `npm run timeline` + scene files + registration)
- [ ] **Step 3:** Validate YAML parses: `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" .github/workflows/video.yml`
- [ ] **Step 4:** Commit `ci: video.yml (self-hosted), ci-prompt.md`

### Task 4: Runner install script + wrangler docs

- [ ] **Step 1:** Write `ops/runner-install.sh`:
  - `set -euo pipefail`
  - Pre-flight: checks `curl`, `tar`, `java`/`dotnet` (bundled with runner), `unzip`
  - Downloads latest linux-x64 runner tarball to `~/actions-runner/` (idempotent: skip if exists)
  - `./config.sh --url https://github.com/hendra/video-short --token "$RUNNER_REGISTRATION_TOKEN" --name video-short-desktop --labels self-hosted,linux,x64 --unattended --replace`
  - Creates a systemd user service `video-runner.service` (`ExecStart=%h/actions-runner/run.sh --once` loop or restart=always), `systemctl --user enable --now`, `loginctl enable-linger "$USER"`
  - Prints: runner status (`./run.sh --once` probe), next steps
- [ ] **Step 2:** Add `ops/README.md` with the full runbook: how the whole chain works (Cloudflare cron → dispatch → this runner → publish → Slack), PAT regeneration checklist (Contents:write), runner token regeneration (repo Settings → Actions → Runners), manual `workflow_dispatch` trigger, and recovery procedures
- [ ] **Step 3:** Update `docs/AUTOPILOT.md` — add "Dijadwalkan juga lewat GitHub Actions (`.github/workflows/video.yml`); lihat `ops/README.md`"; update `AGENTS.md` — one bullet pointing at `.github/workflows/video.yml` + `ops/README.md`
- [ ] **Step 4:** Commit `ops: runner install script + ops/README.md`

### Task 5: PR

- [ ] Push branch, open PR titled "CI: Cloudflare cron → self-hosted runner → full free video pipeline"
- [ ] PR body: architecture diagram, cost table (Cloudflare free, 0 Actions minutes private [self-hosted], Gemini free), runner prerequisite (token in `RUNNER_REGISTRATION_TOKEN` or run install once manually), workflow_dispatch for manual test, renders `--gl=vulkan`
- [ ] Note in PR: needs `gh run list` / first manual dispatch to verify; agent model `inkling-2-small-free` is rate-limit prone → swap `--model` on failure

## Self-Review notes

- Spec coverage: cron cadence ✓ (workflow triggers), staging order ✓ (agent → gates → render → publish), fail-loud ✓ (if: failure() → report.mts), idempotency ✓ (publish.mts ledger check), secrets ✓, ledger ride-along ✓, vulkan ✓.
- Spec corrected first: agent model is `opencode/free` (not Gemini — provider missing); TTS stays Gemini ✓.
- No placeholders: exact channels, paths, copy shape, poll cadence, runner labels are all pinned.
- Risk noted in PR: agent rate limits → may produce no video → gates fail → Slack report, rerun later (`workflow_dispatch`).
