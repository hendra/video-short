# Hosted-runner render/publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the entire `video-run` GitHub Actions pipeline off Hendra's PC (self-hosted runner) onto GitHub-hosted `ubuntu-latest`, and add a manual dispatch to render+publish an existing committed video.

**Architecture:** One workflow (`.github/workflows/video.yml`), conditional on an optional `slug` input: empty → autopilot (opencode agent builds a brand-new video), set → skip agent and validate the pre-existing slug, then the same gates → render → loudnorm → publish → ledger → Slack. Repo must be public first (free hosted minutes). Self-hosted runner is retired.

**Tech Stack:** GitHub Actions (`ubuntu-latest`, no GPU), Remotion CLI (`--gl=swangle`), opencode v2 (`curl https://opencode.ai/v2/install`), ffmpeg, existing `scripts/publish.mts` / `scripts/report.mts`.

**Spec:** `docs/superpowers/specs/2026-11-14-hosted-runner-render-publish-design.md`

## Global Constraints

- Workflow file name/name stays `video-run` — Cloudflare Worker dispatches `repository_dispatch` type `video-run`.
- `runs-on: ubuntu-latest` everywhere; **never** `--gl=vulkan` (no GPU) — swangle only: `--gl=swangle`.
- `--concurrency=2` unchanged (Chrome tab memory; see ops/README OOM note).
- Agent step keeps `XDG_CONFIG_HOME="$RUNNER_TEMP/opencode-config"` + `OPENCODE_DISABLE_CLAUDE_CODE=1` and `/home/hendra/.opencode/bin` → in-workflow install path instead.
- Agent receives `GEMINI_API_KEY` only; publish secrets are written AFTER render, as today.
- Secrets live ONLY in GitHub secrets / gitignored `.env` — never in the tree (repo goes public).
- Manual path fails fast before upload if: slug charset fails, `src/videos/<slug>/` missing, `timeline.json` or `publish.json` missing, or slug already in `docs/ledger.md`.
- `git push` to main from the job keeps the `GITHUB_TOKEN` `contents: write` comment block and rebase-retry loop unchanged.
- Ledger/publish idempotency (publish.mts skips slugs already in the ledger) is unchanged.
- Content/pipeline standards unchanged: captions, SAFE areas, loudnorm `-af loudnorm=I=-14:TP=-1.5:LRA=11`, publish GraphQL.

## Review Focus

Five inputs/failure modes most likely to bite, most likely first:

1. **Manual slug already published** (in ledger) → precondition fails before render; job exits non-zero, nothing uploaded. Test: precondition step greps ledger, step listed before Render, asserts failure on hit.
2. **Manual slug malformed / path traversal** (`slug=../../etc`) → charset regex `^[a-z0-9][a-z0-9-]*$` rejects; nothing interpolated unquoted. Test: step uses the same regex as Discover-slug; rejects mismatch.
3. **opencode install failure on hosted runner** → agent step fails → Failure report fires, publish never runs. Test: install step verifies `opencode --version` exits 0 before agent runs.
4. **Slug discovery ambiguity on autopilot** (multiple new folders) → existing behavior kept: fail loudly. Test: Discover-slug step unchanged for autopilot path; still fails on 0 or >1 candidates.
5. **YAML syntax error after edit** → workflow silently broken. Test: parse `.github/workflows/video.yml` with `node -e` + `js-yaml`/`YAML` or `actionlint` if present; plus `gh workflow view video-run` after push.

---

### Task 1: Switch `video.yml` to hosted runner + swangle, install opencode in-workflow

**Files:**
- Modify: `.github/workflows/video.yml`

**Interfaces:**
- Produces: workflow with `runs-on: ubuntu-latest`; new step `Install opencode` (autopilot path only); render/stills use `--gl=swangle`; no reference to `/home/hendra/.opencode/bin` or user PATH.

- [ ] **Step 1: Edit `.github/workflows/video.yml` job header**

Replace:

```yaml
    runs-on: [self-hosted, linux, x64]
```

with:

```yaml
    runs-on: ubuntu-latest
```

Delete the `env: PATH: /home/hendra/.opencode/bin:...` block (hosted image PATH is fine) and update the comment block above `permissions:` — keep the `contents: write` trade-off comment, it still applies.

- [ ] **Step 2: Replace the opencode reference in Preflight + add install step**

Preflight step becomes:

```yaml
      - name: Preflight
        run: |
          node -v; npm -v
          which google-chrome ffmpeg
```

Add, BEFORE the "Agent builds the video" step:

```yaml
      # Autopilot-only: the agent needs the opencode CLI, which the hosted
      # runner doesn't have. Install latest v2 via the official installer.
      - name: Install opencode
        if: github.event.inputs.slug == ''
        run: |
          curl -fsSL https://opencode.ai/v2/install | bash
          echo "$HOME/.opencode/bin" >> "$GITHUB_PATH"
          "$HOME/.opencode/bin/opencode" --version
```

Change the agent step's command from `/home/hendra/.opencode/bin/opencode run ...` to `"$HOME/.opencode/bin/opencode" run ...`. (`v2/install` reported locally at v2.3.0; the installer always gets current.)

- [ ] **Step 3: vulkan → swangle**

- Stills step: `--gl=vulkan` → `--gl=swangle`.
- Render step: both attempts use `--gl=swangle`; collapse to a single render command (no vulkan attempt left, fallback would retry the identical thing):

```yaml
      - name: Render
        id: render
        run: npx remotion render /tmp/rbundle "$SLUG" "out/$SLUG.mp4" --gl=swangle --concurrency=2 --log=error
```

Keep `--concurrency=2`.

- [ ] **Step 4: Update comments referencing the PC/self-hosted runner**

Any comment mentioning the runner being local (e.g. the `PATH` note) is removed with the block. The Cloudflare-cron → runner chain comment stays valid.

- [ ] **Step 5: YAML sanity check**

Run: `node -e "const y=require('yaml');y.parse(require('fs').readFileSync('.github/workflows/video.yml','utf8'));console.log('ok')"` (install nothing: try `npx --yes js-yaml .github/workflows/video.yml >/dev/null && echo ok` if `yaml` isn't a dep; if both fail, `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/video.yml'));print('ok')"`).
Expected: prints `ok`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/video.yml
git commit -m "ci: move video-run to GitHub-hosted ubuntu-latest (swangle)"
```

---

### Task 2: Add optional `slug` input — manual render+publish path

**Files:**
- Modify: `.github/workflows/video.yml`

**Interfaces:**
- Consumes: workflow from Task 1 (swangle, hosted runner, opencode install conditional on `inputs.slug == ''`).
- Produces: `workflow_dispatch` input `slug` (optional string). When set, agent + slug-discovery are skipped; a new `Validate manual slug` step runs instead and exports `SLUG`/`slug` like discovery does. Everything from `Generate music bed` on is shared.

- [ ] **Step 1: Add the input to `on:`**

```yaml
on:
  repository_dispatch:
    types: [video-run]
  workflow_dispatch:
    inputs:
      slug:
        description: "Video slug to render+publish from the repo (skip the agent). Empty = autopilot builds a new video."
        required: false
        default: ''
        type: string
```

(`repository_dispatch` never carries inputs — `github.event.inputs.slug` is empty there, which is what the `if:` conditions test.)

- [ ] **Step 2: Make the agent step conditional**

Add to "Agent builds the video": `if: github.event.inputs.slug == ''`
Add to "Write agent .env from secrets": same `if:` (manual path doesn't need `GEMINI_API_KEY` before render; the publish `.env` later includes it anyway).
Keep "Mark start for slug discovery" unconditional (cheap, harmless) — or add the same `if:`; either is fine, prefer conditional for tidiness.

- [ ] **Step 3: Replace "Discover slug" with discovery-or-validation**

Two steps. First (autopilot only): the existing discovery script, unchanged, plus `if: github.event.inputs.slug == ''`.

Second (manual only): new step `Validate manual slug`, `if: github.event.inputs.slug != ''`:

```yaml
      - name: Validate manual slug
        id: manualslug
        if: github.event.inputs.slug != ''
        run: |
          set -e
          SLUG="${{ github.event.inputs.slug }}"
          [[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "slug fails charset check: $SLUG"; exit 1; }
          [ -d "src/videos/$SLUG" ] || { echo "src/videos/$SLUG does not exist"; exit 1; }
          [ -f "src/videos/$SLUG/timeline.json" ] || { echo "timeline.json missing for $SLUG"; exit 1; }
          [ -f "src/videos/$SLUG/publish.json" ] || { echo "publish.json missing for $SLUG"; exit 1; }
          [ -f "public/$SLUG/vo.mp3" ] || { echo "public/$SLUG/vo.mp3 missing"; exit 1; }
          grep -q "^| .*\`$SLUG\`" docs/ledger.md && { echo "$SLUG already in docs/ledger.md — refusing to republish"; exit 1; } || true
          echo "SLUG=$SLUG" >> "$GITHUB_ENV"
          echo "slug=$SLUG" >> "$GITHUB_OUTPUT"
```

Note on the ledger grep: check the actual separator format in `docs/ledger.md` first and adjust the pattern to match a row containing the slug as a whole field (open `docs/ledger.md`, match on the slug column, not a fixed `| \`<slug>\`` literal if the format differs — e.g. plain `| 2026-11-… | slug |`). The check must fail only on a real slug hit.

- [ ] **Step 4: Point downstream steps at the right SLUG source**

All steps after discovery already read `$SLUG` from `GITHUB_ENV`; both paths export the same variable name, so no further changes. The commit step computes `TITLE` from `publish.json` — valid on both paths.

Failure report: add `MANUALSLUG_O: ${{ steps.manualslug.outcome }}` and a pair entry `"manualslug:$MANUALSLUG_O"` to the `for` loop so a manual-path validation failure is reported as `manualslug`, not `ci`.

- [ ] **Step 5: YAML sanity check (same as Task 1 Step 5)** and `gh workflow lint video-run` if `gh` supports it (`gh workflow view` at minimum after merge).
Expected: parses.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/video.yml docs/ledger.md
git commit -m "ci: add manual slug dispatch to video-run (render+publish existing video)"
```

---

### Task 3: Docs — ops/README rewrite, AGENTS.md & AUTOPILOT.md references, drop runner installer

**Files:**
- Modify: `ops/README.md` (rewrite)
- Delete: `ops/runner-install.sh`
- Modify: `AGENTS.md` (CI line only)
- Modify: `docs/AUTOPILOT.md` (§1 render line + CI mention)

- [ ] **Step 1: Rewrite `ops/README.md`** — same structure, hosted reality:
  - Chain: Cloudflare Worker (cron 08:00/11:30/16:30 WIB) → `repository_dispatch` → **GitHub-hosted `ubuntu-latest`** → `.github/workflows/video.yml` → agent → gates → render (`--gl=swangle`) → loudnorm → publish → ledger push → Slack.
  - Components table: drop "Runner | ops/runner-install.sh" row; add "Runs on: GitHub-hosted `ubuntu-latest` (swangle-only, ~35–45 min/video)"; `publish.mts` row unchanged.
  - Setup: keep secrets list; drop runner registration entirely; note repo must be **public** for free minutes; note first hosted run is live (no dry-run).
  - Add "Manual render+publish" section: `gh workflow run video-run --ref main -f slug=<slug>` — prerequisites (video committed+pushed to main, `publish.json`, `timeline.json`, `vo.mp3`, slug not in ledger), what it runs, that it publishes for real.
  - Failure notes: drop OOM/self-host notes; add agent install failure and free-model rate-limit note (unchanged meaning); keep ledger-push/rebase note (still applies on hosted).
  - Regenerate table: drop "Runner registration token" row.

- [ ] **Step 2: Delete `ops/runner-install.sh`** — `git rm ops/runner-install.sh`.

- [ ] **Step 3: `AGENTS.md`** — change the CI line: "CI (`.github/workflows/video.yml`) uses `--gl=vulkan` with swangle fallback (verified on the self-hosted runner)" → "(`.github/workflows/video.yml`) runs on GitHub-hosted `ubuntu-latest` with `--gl=swangle`".

- [ ] **Step 4: `docs/AUTOPILOT.md`** — §1 line about `Render di workspace: --browser-executable … swangle` stays (local runs); update the parenthetical in the intro ("(Ada juga varian otomatis penuh via GitHub Actions — 3×/hari — lihat `ops/README.md`…)" stays valid; it no longer implies self-host). No other edits.

- [ ] **Step 5: Commit**

```bash
git add ops/README.md AGENTS.md docs/AUTOPILOT.md
git commit -m "docs: CI runs on GitHub-hosted runners; retire runner installer"
```

---

### Task 4: Retire the self-hosted runner on this machine

**Files:** none (local system state)

- [ ] **Step 1: Stop and disable the service**

```bash
systemctl --user stop video-runner.service
systemctl --user disable video-runner.service
rm -f "$HOME/.config/systemd/user/video-runner.service"
systemctl --user daemon-reload
```

Verify: `systemctl --user status video-runner.service` → "could not be found" or inactive-dead.

- [ ] **Step 2: Unregister from GitHub**

```bash
cd ~/actions-runner && ./config.sh remove --token <REMOVE_TOKEN>
```

The remove token comes from repo Settings → Actions → Runners → `video-short-desktop` → Remove. If Hendra can't supply it, instead: delete `~/actions-runner` locally (stops the agent) and tell Hendra to click **Remove** in repo Settings — the stale runner entry disappears and can never pick up jobs once the workflow no longer targets `self-hosted` labels.

- [ ] **Step 3: Remove runner files** — `rm -rf ~/actions-runner` (includes old tarball and `_work` leftovers, e.g. half-built video folders). Verify agent dir gone: `ls ~/actions-runner` → No such file.

- [ ] **Step 4: Confirm no workflow references self-hosted anymore** — `grep -rn "self-hosted" .github ops docs AGENTS.md` → zero hits (run-time docs may mention the word historically in this file only; adjust if needed).

---

### Task 5: Repo public prerequisite + branch, PR, merge

**Files:** none new (spec + plan docs already in tree)

- [ ] **Step 1: Secret hygiene check before flipping visibility**

```bash
git ls-files | grep -E '(^|/)\.env($|\.)|\.key$|secret|service-account' || echo "clean"
git log --oneline --all -- .env | head
```

Expected: `clean`, empty log. Also confirm `.gitignore` contains `.env`. If anything matches, STOP and report to Hendra — do not make the repo public with secrets in history.

- [ ] **Step 2: Branch + commit docs** — `git switch -c ci/hosted-render-publish`; commit the spec and this plan (`git add docs/superpowers`). Push branch; open PR (`gh pr create --fill`).

- [ ] **Step 3: Merge PR to main**

```bash
gh pr merge --squash
```

- [ ] **Step 4: Hendra flips repo public** (user action): GitHub repo → Settings → Danger Zone → Change visibility → Public. Or `gh repo edit hendra/video-short --visibility public` if Hendra explicitly authorizes running it here. Do NOT flip without explicit authorization.

- [ ] **Step 5: Post-merge sanity**

```bash
gh workflow view video-run   # parses, shows both triggers + slug input
```

Expected: workflow listed with `repository_dispatch` + `workflow_dispatch`, run history intact. Do **not** trigger a run just to test — either path publishes a real video. The next cron slot is the real test; watch it and report.

---

## Self-Review

- **Spec coverage:** hosted runner (T1), opencode in-workflow + XDG isolation kept (T1, incl. `OPENCODE_DISABLE_CLAUDE_CODE` — note: kept in agent step, unchanged), slug manual path + validation (T2), retire self-host + docs + runner-install.sh deletion (T3, T4), repo-public gate + secret hygiene (T5), `video-run` name unchanged (global), swangle-only (global), Slack/ledger/publish untouched (global). ✔
- **Review Focus tests placed:** 1 → T2 Step 3 grep check; 2 → T2 Step 3 charset regex; 3 → T1 Step 2 `--version` assertion; 4 → T2 Step 3 keeps discovery for autopilot; 5 → T1 Step 5 / T2 Step 5 YAML parse + T5 Step 5 `gh workflow view`. ✔
