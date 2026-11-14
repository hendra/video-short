# Design: Autopilot render/publish off the PC onto GitHub-hosted runners

Date: 2026-11-14 · Status: approved approach (option 1), doc pending sign-off

## Intent / why

The video autopilot pipeline (`.github/workflows/video.yml`) runs on a **self-hosted runner on Hendra's PC** (`video-short-desktop`). Render keeps failing there (OOM killer; see `ops/README.md`, run 2026-11-11). Goal: run the whole pipeline on **GitHub-hosted runners** (`ubuntu-latest`), freeing the PC and making renders reliable. Repo becomes **public** so Actions minutes are free/unlimited.

Also: videos Hendra builds by hand should be renderable + publishable by the same workflow, without the agent.

## Goals

- No step of the autopilot pipeline depends on the PC anymore.
- Manual render+publish of an existing committed video via a single dispatch.
- Same quality gates, same publish path (Buffer GraphQL), same ledger/Slack reporting.
- Self-hosted runner fully retired (service stopped, files removed, repo/docs updated).

## Non-goals

- No changes to TTS, publish mechanics (`scripts/publish.mts`, `docs/PUBLISHING.md`), caption rules, or content standards.
- No switch to vulkan on hosted runners (none available) — swangle only.
- No upload of local `out/*.mp4` artifacts — the workflow renders from the repo.

## Constraints

- Hosted runner: no GPU, no `--gl=vulkan`; ~0.8 s/frame swangle → ~35–45 min per video; 6 h job cap; `ffmpeg`, `google-chrome` preinstalled on `ubuntu-latest`; 4 vCPU / ~16 GB RAM.
- opencode binary (v2.3.0 today) not preinstalled — install in-workflow via official installer; keep `XDG_CONFIG_HOME` isolation + `OPENCODE_DISABLE_CLAUDE_CODE=1` (see commit history: agent once re-verified stale memory and produced nothing).
- GitHub secrets already configured (`GEMINI_API_KEY`, `CLOUDINARY_*`, `BUFFER_ACCESS_TOKEN`, `SLACK_*`) — reuse unchanged. `GITHUB_TOKEN` keeps `contents: write` (ledger + video push).
- Cloudflare Worker cron dispatches `repository_dispatch` type `video-run`; workflow name `video-run` must not change.
- Repo must go public **before** relying on free hosted minutes.

## Approach chosen: one workflow, conditional agent

`video.yml` gains an optional `slug` input on `workflow_dispatch`:

- `slug` empty (cron / `repository_dispatch` / bare `workflow_dispatch`) → autopilot unchanged in behavior: agent builds a brand-new video.
- `slug` set → skip agent entirely. Validate: slug charset (`^[a-z0-9][a-z0-9-]*$`), `src/videos/<slug>/` exists, `timeline.json` + `publish.json` present, slug not already in `docs/ledger.md`. Then run the same gates → render → loudnorm → publish → ledger → Slack.

Rejected: reusable workflow (3 files, extra indirection for ~150 lines) and two workflows with duplicated steps (flag drift).

Manual run: `gh workflow run video-run --ref main -f slug=<slug>` (or Actions UI "Run workflow").

## Changes

1. `.github/workflows/video.yml`
   - `runs-on: ubuntu-latest`; drop self-hosted `PATH` assumptions; `setup-node` stays.
   - Install opencode step (official installer → `~/.opencode/bin`), only on autopilot path.
   - `--gl=vulkan` → `--gl=swangle` everywhere (render + stills); keep `--concurrency=2` (safe for Chrome tab memory; raise is a later call).
   - `workflow_dispatch` input `slug` (optional, string). Agent + slug-discovery steps conditional on it; slug-discovery reads from input when set.
   - Manual-path precondition step: fail fast if slug invalid / missing files / already in ledger.
   - Failure-report step unchanged (guest steps report by outcome).
2. Self-hosted retirement
   - `systemctl --user stop video-runner.service`, `disable`, `config.sh remove` if a remove token is provided, else delete `~/actions-runner` and remove the runner in repo Settings (documented).
   - Delete `ops/runner-install.sh`.
   - Rewrite `ops/README.md`: chain diagram, setup, trigger docs, failure notes (OOM notes obsolete; hosted notes instead).
   - Update `AGENTS.md` + `docs/AUTOPILOT.md` references (`.github/workflows/video.yml`: vulkan→swangle, hosted runner).
3. Repo → public (user action, prerequisite; no secrets may live in the tree — verify `.env` gitignored, no keys in history).

## Verification

- `npm run lint && npm test` still green.
- Workflow YAML parses (`gh workflow` / node yaml parse).
- Dry-ish check: `gh workflow run video-run --ref main` is a real publish — do NOT fire casually; first real run is a live video. Before that, validate workflow syntax via `actionlint` if available, else push on a branch and use `workflow_dispatch` from the branch (dispatch requires workflow on default branch — so merge to main first, then either cron the next slot or dispatch manually and accept one live video).
- Runner retired: `systemctl --user status video-runner.service` shows inactive; repo Settings → Actions → Runners shows none.

## Risks

- Public repo = all code + docs public (ledger of published videos, ops runbook incl. channel IDs — acceptable per user's choice; keys are only in GitHub secrets / `.env`).
- Hosted render ~40 min ×3 cron slots: ~120 min/day, fine on free public minutes.
- opencode free model may rate-limit/refuse on hosted IP — same risk as today; failure path already reports to Slack.
- First hosted run is untested historically (vulkan→swangle switch is the only behavioral change; stills gate catches render breakage before upload).
