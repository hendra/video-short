# Six Daily Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger the video pipeline 6×/day so posts land at ~08:00, 10:00, 12:00, 13:00, 17:00, 20:00 WIB.

**Architecture:** Only the Cloudflare cron triggers change; the Worker already dispatches `repository_dispatch`, and `video.yml` already queues runs (`concurrency: video-run`). Docs that state the schedule are updated alongside.

**Tech Stack:** Cloudflare Workers cron (wrangler), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-14-six-daily-runs-design.md`

## Global Constraints

- Cron (UTC): `crons = ["30 0,2,4,5,9,12 * * *"]` = 07:30, 09:30, 11:30, 12:30, 16:30, 19:30 WIB (WIB = UTC+7), fired 30 min before each slot.
- No change to `.github/workflows/video.yml` or any pipeline script.
- Deploy (`npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`) is run by the operator, not the implementer.
- Docs are Indonesian; keep the existing wording style.

## Review Focus

- Timezone slip: every WIB time written in docs must equal the UTC cron + 7 h (checked in Task 1 Step 3).
- Stale schedule text left anywhere outside `.claude/worktrees/` and `docs/superpowers/` (checked in Task 1 Step 3).
- Invalid wrangler config after edit (checked in Task 1 Step 4 via dry-run).

---

### Task 1: Six cron triggers + schedule docs

**Files:**
- Modify: `ops/cloudflare-cron/wrangler.toml:6`
- Modify: `ops/cloudflare-cron/worker.js:3` (header comment)
- Modify: `ops/README.md:3` (Chain line)
- Modify: `docs/AUTOPILOT.md:5`

**Interfaces:** none.

- [ ] **Step 1: Edit `wrangler.toml`** — line 6 becomes `crons = ["30 0,2,4,5,9,12 * * *"]`.

- [ ] **Step 2: Edit the three docs**
  - `worker.js:3`: ` * Setiap 00:30, 02:30, 04:30, 05:30, 09:30, 12:30 UTC (= 07:30, 09:30, 11:30, 12:30, 16:30, 19:30 WIB; post tayang ±08/10/12/13/17/20 WIB) memicu`
  - `ops/README.md:3`: `(cron 08:00/11:30/16:30 WIB)` → `(cron 6×/hari 07:30/09:30/11:30/12:30/16:30/19:30 WIB → tayang ±08/10/12/13/17/20 WIB)`
  - `docs/AUTOPILOT.md:5`: `(cron harian ×3: 08:00/11:30/16:30 WIB, …` → `(cron harian ×6: 07:30/09:30/11:30/12:30/16:30/19:30 WIB, …` (rest of line unchanged).

- [ ] **Step 3: Verify no stale schedule text**

Run: `grep -rn "08:00/11:30\|×3\|01:00, 04:30" ops docs AGENTS.md README.md --include=*.md --include=*.js --include=*.toml | grep -v docs/superpowers`
Expected: no output.

- [ ] **Step 4: Validate config**

Run: `npx wrangler deploy --dry-run --config ops/cloudflare-cron/wrangler.toml`
Expected: exits 0 (no Cloudflare credentials needed for dry-run). If wrangler is unavailable offline, note it and skip.

- [ ] **Step 5: Commit** on a branch (not `main`; leave the unrelated `src/videos/registry.ts` change unstaged)

```bash
git switch -c ci/six-daily-runs
git add ops/cloudflare-cron/wrangler.toml ops/cloudflare-cron/worker.js ops/README.md docs/AUTOPILOT.md docs/superpowers/specs/2026-11-14-six-daily-runs-design.md docs/superpowers/plans/2026-11-14-six-daily-runs.md
git commit -m "ci: run video pipeline 6x/day"
```

**After merge (operator):** `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`.
