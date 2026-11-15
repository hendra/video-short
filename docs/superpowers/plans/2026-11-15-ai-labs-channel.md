# AI Labs Channel (YouTube + TikTok) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second channel pair ("AI Labs", AI tips & tricks) to the existing video pipeline, running the same schedule as "Kali Aja Tau" with its own YouTube/TikTok/Cloudinary/Gemini credentials and its own content rules — without changing Kali Aja's behaviour.

**Architecture:** One repo, one pipeline, one account-config module (`src/accounts.ts`) as the single source of truth for channel IDs, brand, credentials prefix and agent instruction files. A run is scoped to one account (cron dispatches once per account); `publish.json.account` decides which Buffer channel a video goes to, and the run account is a cross-check that refuses mismatches *before* anything is uploaded.

**Tech Stack:** TypeScript (tsx scripts, node:test), Remotion + React Three Fiber (unchanged), GitHub Actions, Cloudflare Worker cron, Cloudinary signed upload, Buffer GraphQL.

**Spec:** `docs/superpowers/specs/2026-11-15-ai-labs-channel-design.md` — read it before Task 1; it carries the decisions this plan does not repeat.

## Global Constraints

- **Kali Aja must not change behaviour.** Its channel IDs, brand (`Kali Aja `/`Tau`), `categoryId "27"`, Slack success text, cron times and secret names stay exactly as they are.
- Account IDs are exactly `"kali-aja"` and `"ai-labs"`. `DEFAULT_ACCOUNT = "kali-aja"`.
- AI Labs brand literals: prefix `"AI "`, accent `"Labs"` → the video source must contain `brand: { prefix: "AI ", accent: "Labs" }`.
- AI Labs Buffer org/channel IDs start as `TODO_…` placeholders until the user fills them in; **any** `TODO_` in a required field means "not configured" and must refuse to publish — never fall back to Kali Aja's channels.
- Secret naming: canonical name for Kali Aja (`GEMINI_API_KEY`), `AI_LABS_` + canonical name for AI Labs. Scripts keep reading canonical names; the workflow writes `.env` with canonical names.
- Do not use dynamic `secrets[...]` indexing in workflow expressions — list both secret names explicitly as step env.
- `npm run lint` = `eslint src && tsc && tsc -p scripts`; `npm test` = `tsx --test scripts/*.test.mts`. Both must stay green.
- No new runtime dependency. No `package.json` script changes except where a task states it.
- Video source, VO, and publish artifacts stay gitignored/uncommitted (unchanged rule).
- Scripts import `src/accounts.ts` as `"../src/accounts.ts"` (explicit extension — `scripts/tsconfig.json` sets `allowImportingTsExtensions`).

## Review Focus

Failure modes the spec implies that no task's happy path catches. Each line is pinned by a test in the task named.

1. **A `publish.json` without `account`** (old format, e.g. a hand-made local video) — must be rejected with a named error, never silently routed to Kali Aja. → Task 5.
2. **Video account ≠ run account** (stale slug, wrong trigger) — must refuse *before* the Cloudinary upload, so nothing half-published exists. → Task 5.
3. **Unconfigured account (`TODO_` placeholders)** — must refuse before upload, and the error must name the missing fields. → Task 3 + Task 5.
4. **Catalog fetched with the wrong Buffer token/org** — an empty or foreign catalog silently turns the duplicate gate into a no-op. → Task 5 (assert the Buffer query filters on the account's own org + channel IDs).
5. **Unknown or empty `--account` value** — must fail with the list of valid ids, not silently default. → Task 2/3.

## File Structure

| File | Responsibility |
|---|---|
| `src/accounts.ts` | **New.** Account config (label, brand, Buffer ids, categoryId, secretPrefix, agent files/prompt) + pure helpers `accountById`, `isAccountId`, `missingConfigFields`, `isConfigured`. No node imports (it lives under `src/`). |
| `scripts/account-core.mts` | **New.** Pure helpers: `secretNameFor`, `brandProblems`, `accountProblems`, `envLines`. No I/O. |
| `scripts/account-env.mts` | **New.** CLI: prints `KEY=value` lines for the workflow resolve step; `--require-configured` fails fast. |
| `scripts/account-gate.mts` | **New.** CLI: gate that a generated video belongs to the run account and carries the right brand. |
| `scripts/accounts.test.mts` | **New.** Invariants of the config (all-or-nothing configuration, files exist, ids valid). |
| `scripts/account-core.test.mts` | **New.** Unit tests for the pure helpers. |
| `scripts/topics.test.mts` | **New.** Validates the AI Labs brief + backlog format. |
| `ops/accounts/ai-labs.md` | **New.** Channel brief read by the AI Labs agent (niche, format rule, claim limits, copy rules). |
| `ops/topics/ai-labs.md` | **New.** Topic backlog (~40 verified topics with official source URLs). |
| `scripts/pick-format.mts` | Modified: per-account format pools + `--account`. |
| `scripts/publish.mts`, `scripts/publish-lib.mts` | Modified: account-driven channel ids, categoryId, cross-check, fail-fast. |
| `scripts/fetch-published-videos.mts` | Modified: per-account org/channel filter + `--account` + per-account default path. |
| `scripts/check-duplicates.mts`, `scripts/duplicate-core.mts` | Modified: per-account default catalog path; new stop-word. |
| `scripts/report.mts`, `scripts/report-lib.mts` | Modified: account label in the Slack text. |
| `scripts/lib.mts` | Modified: `publishedVideosPath(accountId)`. |
| `.github/workflows/video.yml` | Modified: `account` input, resolve step, fail-fast, per-account secrets, gates, per-account concurrency. |
| `ops/cloudflare-cron/worker.js` | Modified: dispatch once per account. |
| `AGENTS.md`, `ops/ci-prompt.md`, `docs/AUTOPILOT.md`, `docs/PUBLISHING.md`, `ops/README.md`, `.env.example` | Modified: neutralise account-specific constants, document the second account. |

---

### Task 1: AI Labs content assets (brief + topic backlog)

**Files:**
- Create: `ops/accounts/ai-labs.md`
- Create: `ops/topics/ai-labs.md`
- Create: `scripts/topics.test.mts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: two files that `src/accounts.ts` (Task 2) will reference in `agent.files` and that Task 7's agent step passes to `opencode --file`.

- [ ] **Step 1: Write the failing test** — `scripts/topics.test.mts` asserts:
  - `ops/accounts/ai-labs.md` exists and contains the headings `## Brand`, `## Format`, `## Topik`, `## Naskah`, `## Scene 3D`, `## publish.json`, `## Batas klaim`, `## Refill backlog`;
  - `ops/topics/ai-labs.md` exists, has **≥ 40** topic entries, every entry matches `^- <slug>: <title> — <source-url> (<tool>)` (one line per topic, URL is `https://…`), and the slugs are unique;
  - the brief contains the exact line `brand: { prefix: "AI ", accent: "Labs" }`.
  Run: `npx tsx --test scripts/topics.test.mts` → Expected: FAIL (files missing).

- [ ] **Step 2: Author `ops/topics/ai-labs.md`** — ≥ 40 lines, one per topic, format:
  `- <slug>: <judul ide> — <https://url sumber resmi> (<Claude|ChatGPT|Gemini>)`
  Sources must be official documentation pages (e.g. `docs.claude.com`, `docs.anthropic.com`, `platform.openai.com/docs`, `ai.google.dev/gemini-api/docs`, `opencode.ai/docs`) — one verified URL per topic, topic slugs unique, and the set must span: photo/video editing with AI, coding & debugging, Claude Code / plugin workflows (incl. skills like superpowers), prompt techniques, and settings most people don't know. No duplicate slugs, no invented features.

- [ ] **Step 3: Author `ops/accounts/ai-labs.md`** — the brief the agent reads. Must state:
  - `## Brand` → write exactly `brand: { prefix: "AI ", accent: "Labs" }` in `src/videos/<slug>/index.ts`;
  - `## Format` → run `npx tsx scripts/pick-format.mts --account ai-labs`, use the format verbatim, record it as `catatan: "format: <id>; …"`; **forbidden** framework: "masalah → 3 langkah → kesalahan umum"; vary hook syntax (question / claim / before-after / demo / rant);
  - `## Topik` → pick one topic from `ops/topics/ai-labs.md` whose title has not been published (check the channel catalog path given in the prompt); **if fewer than 3 unused topics remain → stop and report** (never invent a topic);
  - `## Naskah` → 13–16 lines `NN  text`, 1.100–1.400 characters, Indonesian santai-profesional, numbers written as words;
  - `## Scene 3D` → build with `Kit` (panel chat/terminal/file-tree/gear plugin/photo before-after cards); no real UI screenshots (CI cannot log in anywhere); schematic diagrams get `tag: "ILUSTRASI"`;
  - `## publish.json` → must contain `account: "ai-labs"` plus `title` (≤100), `description`, `tiktokTitle` (≤90), `tiktokCaption`, `catatan`;
  - `## Batas klaim` → only features present in the cited source; no invented benchmark numbers; no medical/financial advice; no competitor bashing;
  - `## Refill backlog` → one paragraph: when the backlog runs low, the operator asks for a refill (manual, on demand); until then the agent stops rather than inventing topics.

- [ ] **Step 4: Run the test** — `npx tsx --test scripts/topics.test.mts` → Expected: PASS.

- [ ] **Step 5: Commit** — `git add ops/accounts/ai-labs.md ops/topics/ai-labs.md scripts/topics.test.mts && git commit -m "feat(content): brief + backlog topik channel AI Labs"`

---

### Task 2: Account config module

**Files:**
- Create: `src/accounts.ts`
- Create: `scripts/accounts.test.mts`

**Interfaces:**
- Consumes: the two files from Task 1 (their paths are asserted to exist).
- Produces: `src/accounts.ts` exporting
  ```ts
  export type AccountId = "kali-aja" | "ai-labs";
  export type Account = { id: AccountId; label: string; brand: { prefix: string; accent: string };
    buffer: { orgId: string; youtubeChannelId: string; tiktokChannelId: string };
    youtubeCategoryId: string; secretPrefix: string;
    agent: { model: string; prompt: string; files: string[] }; };
  export const ACCOUNT_IDS: readonly AccountId[];
  export const DEFAULT_ACCOUNT: AccountId;              // "kali-aja"
  export const ACCOUNTS: Record<AccountId, Account>;
  export const isAccountId = (v: unknown): v is AccountId;
  export const accountById = (id?: string | null): Account;   // throws Error listing ACCOUNT_IDS
  export const missingConfigFields = (a: Account): string[];  // e.g. ["buffer.orgId"]
  export const isConfigured = (a: Account): boolean;          // missingConfigFields(a).length === 0
  ```
  Every later task imports these.

- [ ] **Step 1: Write the failing test** — `scripts/accounts.test.mts` asserts:
  - `ACCOUNT_IDS` has exactly `["kali-aja", "ai-labs"]` and `DEFAULT_ACCOUNT === "kali-aja"`;
  - Kali Aja values are unchanged: label `"Kali Aja Tau"`, brand `{prefix:"Kali Aja ", accent:"Tau"}`, `youtubeCategoryId "27"`, `secretPrefix ""`, buffer ids `6aed53e7ec5c7c6d73f3e437` / `6aedb753e29c69a171803f6e` / `6aedb7fee29c69a171804662`, `agent.files` contains `AGENTS.md`, `docs/AUTOPILOT.md`, `ops/ci-prompt.md`;
  - AI Labs values: label `"AI Labs"`, brand `{prefix:"AI ", accent:"Labs"}`, `youtubeCategoryId "30"`, `secretPrefix "AI_LABS_"`, `agent.files` = `["AGENTS.md","ops/ci-prompt.md","ops/accounts/ai-labs.md","ops/topics/ai-labs.md"]`;
  - **all-or-nothing**: for each account, either every buffer id is a `TODO_` placeholder or none is (mixed = failure) — do **not** assert that AI Labs is unconfigured, or the test would break the day the user fills in the real ids;
  - every `agent.files` entry exists on disk;
  - `accountById("nope")` throws an Error whose message contains both valid ids; `accountById(undefined)` returns the Kali Aja account;
  - `missingConfigFields` lists the three AI Labs buffer fields when they are still `TODO_`, and is empty for a fully configured account.
  Run: `npx tsx --test scripts/accounts.test.mts` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement `src/accounts.ts`** — pure data + the helpers above. No `node:` imports. Kali Aja's `agent.prompt` = the current workflow prompt text ("You are in CI. Follow AGENTS.md and docs/AUTOPILOT.md. Follow ops/ci-prompt.md exactly. Stop before any publish/upload/render step."); AI Labs' = the equivalent that names `ops/accounts/ai-labs.md` and `ops/topics/ai-labs.md` and omits `docs/AUTOPILOT.md`.

- [ ] **Step 3: Run the test** — `npx tsx --test scripts/accounts.test.mts` → Expected: PASS.

- [ ] **Step 4: Lint** — `npm run lint` → Expected: PASS (root `tsc` now covers `src/accounts.ts`).

- [ ] **Step 5: Commit** — `git add src/accounts.ts scripts/accounts.test.mts && git commit -m "feat(config): config akun tunggal (kali-aja, ai-labs)"`

---

### Task 3: Account helpers, CI env step, and account gate

**Files:**
- Create: `scripts/account-core.mts`
- Create: `scripts/account-core.test.mts`
- Create: `scripts/account-env.mts`
- Create: `scripts/account-gate.mts`
- Modify: `scripts/lib.mts` (add `publishedVideosPath`)

**Interfaces:**
- Consumes: `src/accounts.ts` (Task 2).
- Produces:
  ```ts
  // scripts/account-core.mts
  export const secretNameFor = (account: Account, canonicalKey: string): string;   // "" -> KEY, "AI_LABS_" -> AI_LABS_KEY
  export const envLines = (account: Account, opts?: { catalogPath?: string }): string[];  // KEY=value lines
  export const brandProblems = (source: string, account: Account, all: readonly Account[]): string[];
  export const accountProblems = (publishJson: unknown, accountId: AccountId): string[];
  // scripts/lib.mts
  export const publishedVideosPath = (accountId: AccountId): string;   // path.join(os.tmpdir(), `published-videos-${accountId}.json`)
  ```
  CLI contracts:
  - `npx tsx scripts/account-env.mts --account <id> [--require-configured]` → prints `KEY=value` lines (`ACCOUNT`, `ACCOUNT_LABEL`, `BRAND_LINE`, `YOUTUBE_CATEGORY_ID`, `AGENT_MODEL`, `AGENT_FILES` space-joined, `AGENT_PROMPT`, `CATALOG_PATH`); with `--require-configured` it validates *first* and exits 1 naming the missing fields; unknown id → exit 1 listing valid ids.
  - `npx tsx scripts/account-gate.mts --account <id> --slug <slug>` → exits 0 when `src/videos/<slug>/publish.json` has `account === <id>` **and** `src/videos/<slug>/index.ts` carries the account's brand literals and no other account's brand; otherwise exits 1 printing each problem.

- [ ] **Step 1: Write the failing tests** — `scripts/account-core.test.mts` asserts:
  - `secretNameFor(kaliAja, "GEMINI_API_KEY") === "GEMINI_API_KEY"` and `secretNameFor(aiLabs, "GEMINI_API_KEY") === "AI_LABS_GEMINI_API_KEY"`;
  - `brandProblems('brand: { prefix: "AI ", accent: "Labs" }', aiLabs, ACCOUNTS)` → `[]`;
  - `brandProblems('brand: { prefix: "Kali Aja ", accent: "Tau" }', aiLabs, ACCOUNTS)` → mentions both "prefix" and "akun lain";
  - `brandProblems('brand: { prefix: "AI", accent: "Labs" }', aiLabs, ACCOUNTS)` → mentions the missing trailing space (exact literal match required);
  - `accountProblems({ account: "kali-aja" }, "ai-labs")` → mentions "ai-labs"; `accountProblems({}, "ai-labs")` → mentions "account"; `accountProblems({ account: "bogus" }, "ai-labs")` → mentions "bogus".
  Run: `npx tsx --test scripts/account-core.test.mts` → Expected: FAIL.

- [ ] **Step 2: Implement `scripts/account-core.mts`** — pure functions above. Brand literals are matched with `JSON.stringify` so `"AI "` (trailing space) is matched exactly.

- [ ] **Step 3: Run the test** — Expected: PASS.

- [ ] **Step 4: Implement `scripts/lib.mts:publishedVideosPath`** — `path.join(os.tmpdir(), `published-videos-${accountId}.json`)`.

- [ ] **Step 5: Implement `scripts/account-env.mts`** — the CLI contract above. `AGENT_PROMPT` is the account's `agent.prompt` with the runtime context appended in one line: channel label, the exact brand line, the catalog path, the YouTube categoryId, and "Stop before any publish/upload/render step."

- [ ] **Step 6: Implement `scripts/account-gate.mts`** — reads `src/videos/<slug>/publish.json` and `src/videos/<slug>/index.ts`, uses `accountProblems` + `brandProblems`, prints every problem, exits 1 if any.

- [ ] **Step 7: Verify the CLIs by hand**
  - `npx tsx scripts/account-env.mts --account ai-labs` → prints the eight `KEY=value` lines including `CATALOG_PATH=/tmp/published-videos-ai-labs.json`.
  - `npx tsx scripts/account-env.mts --account ai-labs --require-configured` → exits 1 and names `buffer.orgId`, `buffer.youtubeChannelId`, `buffer.tiktokChannelId` (expected until the user fills them in).
  - `npx tsx scripts/account-env.mts --account bogus` → exits 1 listing `kali-aja`, `ai-labs`.
  - `npx tsx scripts/account-gate.mts --account ai-labs --slug karbon-norwegia` → exits 1 mentioning that `publish.json` has no `account` (the local video predates the field) — expected.

- [ ] **Step 8: Lint + test** — `npm run lint && npm test` → Expected: PASS.

- [ ] **Step 9: Commit** — `git add scripts/account-core.mts scripts/account-core.test.mts scripts/account-env.mts scripts/account-gate.mts scripts/lib.mts && git commit -m "feat(accounts): helper murni, env CI, dan gate akun"`

---

### Task 4: Per-account narrative format pool

**Files:**
- Modify: `scripts/pick-format.mts`
- Modify: `scripts/pick-format.test.mts`

**Interfaces:**
- Consumes: `src/accounts.ts` (Task 2) for `ACCOUNT_IDS`/`DEFAULT_ACCOUNT`.
- Produces:
  ```ts
  export type Format = { id: string; weight: number; name: string; instruction: string };
  export const FORMATS_BY_ACCOUNT: Record<AccountId, Format[]>;
  export const formatsFor = (accountId: AccountId): Format[];
  export const pickFormat = (accountId?: AccountId, roll?: number): Format;
  ```
  CLI: `npx tsx scripts/pick-format.mts [--account <id>]` prints the chosen format as JSON (default account = Kali Aja, so the existing command keeps working).

- [ ] **Step 1: Update the test** — `scripts/pick-format.test.mts`:
  - keep the existing pool assertions but against `formatsFor("kali-aja")` (≥ 7 formats, weights > 0, instruction length > 20, unique ids, roll boundaries select first/last bucket);
  - add: `formatsFor("ai-labs")` has ≥ 8 formats, unique ids, weights > 0, and no id equals `"how-to-tutorial"` (the forbidden "3 langkah" framework must not be in the AI pool);
  - add: `pickFormat("ai-labs", 0)` returns the first AI format and `pickFormat("ai-labs", 0.999999)` the last;
  - add: `pickFormat()` with no arguments returns a Kali Aja format (back-compat).
  Run: `npx tsx --test scripts/pick-format.test.mts` → Expected: FAIL.

- [ ] **Step 2: Restructure `scripts/pick-format.mts`** — move the existing 11 formats into `FORMATS_BY_ACCOUNT["kali-aja"]` unchanged (ids, weights, instructions identical), and add the AI Labs pool: `prompt-recipe`, `tool-compare`, `edit-photo-before-after`, `debug-postmortem`, `plugin-teardown`, `workflow-speedrun`, `pitfall-callout`, `feature-drop`, `screen-rebuild`, `one-liner` — each with a weight and a one-sentence Indonesian `instruction` in the same voice as the existing pool.

- [ ] **Step 3: Update the CLI** — parse `--account <id>`; unknown id → error listing valid ids and exit 1.

- [ ] **Step 4: Run the test** — Expected: PASS.

- [ ] **Step 5: Commit** — `git add scripts/pick-format.mts scripts/pick-format.test.mts && git commit -m "feat(format): pool format naratif per akun"`

---

### Task 5: Publishing pipeline becomes account-driven

**Files:**
- Modify: `scripts/publish-lib.mts`, `scripts/publish.mts`
- Modify: `scripts/fetch-published-videos.mts`, `scripts/check-duplicates.mts`, `scripts/duplicate-core.mts`
- Modify: `scripts/publish.test.mts`

**Interfaces:**
- Consumes: `src/accounts.ts` (Task 2), `scripts/account-core.mts` (Task 3), `publishedVideosPath` (Task 3).
- Produces:
  - `validatePublishJson` now also requires `account` to be a known account id.
  - `fetchPublishedVideos(token?: string, accountId?: AccountId)` filters on that account's org + channel ids.
  - `npm run publish -- <slug> [--account <id>]` — `--account` is optional; when present it must equal `publish.json.account`.
  - `npm run publish` refuses (before any upload) when: `publish.json.account` is missing/unknown; the run account differs from the video account; the account is not configured.

- [ ] **Step 1: Update `scripts/publish.test.mts`** — the `ok` fixture gains `account: "kali-aja"`; add assertions: `validatePublishJson({...ok, account: "bogus"})` → problem mentions "bogus"; `validatePublishJson({...ok, account: ""})` → problem mentions "account"; `validatePublishJson({...ok})` (no account) → problem mentions "account".

- [ ] **Step 2: Implement the `validatePublishJson` change** — add `account` to the required-key loop and check membership in `ACCOUNT_IDS`.

- [ ] **Step 3: Make `fetchPublishedVideos` account-aware** — signature `fetchPublishedVideos(token = process.env.BUFFER_ACCESS_TOKEN, accountId: AccountId = DEFAULT_ACCOUNT)`; use `ACCOUNTS[accountId].buffer.orgId` and its two channel ids in the `filter`. CLI: `--account <id>` (default Kali Aja) and `--out` (default `publishedVideosPath(accountId)` from `scripts/lib.mts`); drop the old `PUBLISHED_VIDEOS_PATH` export (its only consumer is `check-duplicates.mts`, updated in the next step).

- [ ] **Step 4: Make `check-duplicates.mts` account-aware** — read `src/videos/<slug>/publish.json` first to get `account`, resolve the default catalog path from it; an explicit `--db` still wins. Keep the existing error messages for a missing/unreadable publish.json.

- [ ] **Step 5: Add the stop-word** — append `"labs"` to the `STOP` set in `scripts/duplicate-core.mts`.

- [ ] **Step 6: Rework `scripts/publish.mts`** — in this order, all before the Cloudinary upload:
  1. parse optional `--account`;
  2. read `publish.json`, `validatePublishJson` (now requires `account`);
  3. `const account = accountById(PUB.account)`;
  4. if `--account` was given and differs from `PUB.account` → fail: "publish refused: video account <a> != run account <b>";
  5. if `!isConfigured(account)` → fail: "publish refused: akun <id> belum dikonfigurasi (missing: <fields>)";
  6. only then: upload, then `createPost` with `channelId` = `account.buffer.youtubeChannelId` / `account.buffer.tiktokChannelId`, `metadata.youtube.categoryId` = `account.youtubeCategoryId`, and `fetchPublishedVideos(BUFFER, account.id)` for the final duplicate check.
  Remove the hardcoded `const YT = "6aedb…", TT = "6aedb…"`.

- [ ] **Step 7: Verify the refusals by hand** — with the local `karbon-norwegia` video (whose `publish.json` has no `account`): `npm run publish -- karbon-norwegia` → exits 1 mentioning `account`, and **no** Cloudinary request is made (the message appears before any upload log line).

- [ ] **Step 8: Run the tests** — `npm test` → Expected: PASS.

- [ ] **Step 9: Commit** — `git add scripts/publish-lib.mts scripts/publish.mts scripts/publish.test.mts scripts/fetch-published-videos.mts scripts/check-duplicates.mts scripts/duplicate-core.mts && git commit -m "feat(publish): channel, kredensial, dan gate publish per akun"`

---

### Task 6: Slack report carries the channel label

**Files:**
- Modify: `scripts/report-lib.mts`, `scripts/report.mts`, `scripts/report.test.mts`

**Interfaces:**
- Consumes: `src/accounts.ts` (Task 2).
- Produces: `buildReportText({ slug, links?, step?, error?, account? })`; `npm run report -- <slug> [--account <id>] [--links …] [--step …] [--error …]`.

- [ ] **Step 1: Update `scripts/report.test.mts`** — add: with `account: "kali-aja"` the success text contains `[Kali Aja Tau]` (unchanged from today); with `account: "ai-labs"` it contains `[AI Labs]`; without `account` it contains `[video-short CI]`; the error text keeps `run gagal di *<step>*` and appends ` — AI Labs` when the account is known.

- [ ] **Step 2: Implement `buildReportText`** — label = `account ? ACCOUNTS[account].label : "video-short CI"`; success message becomes `:rocket: *[<label>] Video baru live*` (Kali Aja renders byte-identical to the current text); error message appends ` — <label>` only when an account is given.

- [ ] **Step 3: Wire `scripts/report.mts`** — parse `--account <id>`; if absent, fall back to the `account` field in `/tmp/publish-result.json` (written by `publish.mts`) when present; unknown id → error listing valid ids.

- [ ] **Step 4: Run the tests** — `npm test` → Expected: PASS.

- [ ] **Step 5: Commit** — `git add scripts/report-lib.mts scripts/report.mts scripts/report.test.mts && git commit -m "feat(report): label akun di laporan Slack"`

---

### Task 7: CI workflow becomes account-aware

**Files:**
- Modify: `.github/workflows/video.yml`

**Interfaces:**
- Consumes: `scripts/account-env.mts` + `scripts/account-gate.mts` (Task 3), `fetchPublishedVideos --account` (Task 5), `publish --account` (Task 5), `report --account` (Task 6).
- Produces: `workflow_dispatch` input `account` (default `kali-aja`); `repository_dispatch` reads `client_payload.account`; a run is scoped to exactly one account.

- [ ] **Step 1: Add the `account` input** to `workflow_dispatch`:
  ```yaml
  account:
    description: "Channel account to run (empty = Kali Aja)."
    required: false
    default: "kali-aja"
    type: string
  ```

- [ ] **Step 2: Make the concurrency group per account** — `group: video-run-${{ github.event.client_payload.account || inputs.account || 'kali-aja' }}` (today it is a global `video-run`, which would make the two channels queue behind each other).

- [ ] **Step 3: Add a "Resolve account" step in the `build` job** — immediately after "Dependencies" (tsx must be installed):
  ```yaml
  - name: Resolve account
    id: acct
    env:
      ACCOUNT: ${{ inputs.account || github.event.client_payload.account || 'kali-aja' }}
    run: |
      npx tsx scripts/account-env.mts --account "$ACCOUNT" --require-configured >> "$GITHUB_ENV"
      echo "account=$ACCOUNT" >> "$GITHUB_OUTPUT"
  ```
  `--require-configured` makes an unconfigured account fail here — before the agent, before the 4 render shards. Leave `.env` untouched in this step.

- [ ] **Step 4: Point the catalog step at the account's token** — replace the current "Fetch published-video catalog from Buffer" step with:
  ```yaml
  - name: Fetch published-video catalog from Buffer
    id: catalog
    env:
      BUFFER_ACCESS_TOKEN: ${{ secrets.BUFFER_ACCESS_TOKEN }}
      AI_LABS_BUFFER_ACCESS_TOKEN: ${{ secrets.AI_LABS_BUFFER_ACCESS_TOKEN }}
    run: |
      if [ "$ACCOUNT" = "ai-labs" ]; then export BUFFER_ACCESS_TOKEN="$AI_LABS_BUFFER_ACCESS_TOKEN"; fi
      npx tsx scripts/fetch-published-videos.mts --account "$ACCOUNT" --out "$CATALOG_PATH"
  ```
  The token only exists in that step's process — the agent step still sees no publish secret.

- [ ] **Step 5: Make the agent step use the account's files, model and prompt** — replace the hardcoded `--file` list and `--model` with:
  ```bash
  mapfile -t FILES <<< "$AGENT_FILES"
  ARGS=(); for f in "${FILES[@]}"; do ARGS+=(--file "$f"); done
  "$HOME/.opencode/bin/opencode" run --auto --standalone --model "$AGENT_MODEL" "${ARGS[@]}" "$AGENT_PROMPT"
  ```
  Keep the existing `set +e` / warning / `exit 0` behaviour exactly as-is.

- [ ] **Step 6: Add the account gate after slug discovery** — right after the "Discover slug" step:
  ```yaml
  - name: Account gate
    run: npx tsx scripts/account-gate.mts --account "$ACCOUNT" --slug "$SLUG"
  ```

- [ ] **Step 7: Point the duplicate gate at the account's catalog** — `npx tsx scripts/check-duplicates.mts "$SLUG" --db "$CATALOG_PATH"`.

- [ ] **Step 8: Publish job — per-account credentials** — replace the step-env secret block with a step that writes `.env` with canonical names, then publish with the account:
  ```yaml
  - name: Publish (Cloudinary → Buffer YT + TikTok)
    id: publish
    if: ${{ !inputs.dry_run }}
    env:
      CLOUDINARY_CLOUD_NAME: ${{ secrets.CLOUDINARY_CLOUD_NAME }}
      AI_LABS_CLOUDINARY_CLOUD_NAME: ${{ secrets.AI_LABS_CLOUDINARY_CLOUD_NAME }}
      CLOUDINARY_API_KEY: ${{ secrets.CLOUDINARY_API_KEY }}
      AI_LABS_CLOUDINARY_API_KEY: ${{ secrets.AI_LABS_CLOUDINARY_API_KEY }}
      CLOUDINARY_API_SECRET: ${{ secrets.CLOUDINARY_API_SECRET }}
      AI_LABS_CLOUDINARY_API_SECRET: ${{ secrets.AI_LABS_CLOUDINARY_API_SECRET }}
      BUFFER_ACCESS_TOKEN: ${{ secrets.BUFFER_ACCESS_TOKEN }}
      AI_LABS_BUFFER_ACCESS_TOKEN: ${{ secrets.AI_LABS_BUFFER_ACCESS_TOKEN }}
    run: |
      umask 077; : > .env
      for key in CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET BUFFER_ACCESS_TOKEN; do
        src="$key"; [ "$ACCOUNT" = "ai-labs" ] && src="AI_LABS_$key"
        printf '%s=%s\n' "$key" "${!src:-}" >> .env
      done
      npm run publish -- "$SLUG" --account "$ACCOUNT"
  ```
  `loadDotenv()` in `publish.mts` reads the canonical names — the script is unchanged in that respect.

- [ ] **Step 9: Pass the account to the reports** — success report: `npm run report -- "$SLUG" --account "$ACCOUNT"`; failure report job: resolve the account the same way (`inputs.account || github.event.client_payload.account || 'kali-aja'`) and pass `--account "$ACCOUNT"` to `npm run report`.

- [ ] **Step 10: Validate the workflow** — `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/video.yml'))"` → parses; and re-read the file to confirm no hardcoded channel id, no leftover `6aedb…` literal, and that the `render` job is untouched.

- [ ] **Step 11: Commit** — `git add .github/workflows/video.yml && git commit -m "ci: jalankan pipeline per akun (Kali Aja / AI Labs)"`

---

### Task 8: Cron dispatches once per account

**Files:**
- Modify: `ops/cloudflare-cron/worker.js`

**Interfaces:**
- Consumes: nothing from the workflow; produces `repository_dispatch` payloads of shape `client_payload: { account: "<id>" }` (plus the existing `source`/`at` fields).
- Env: `ACCOUNTS` — comma-separated account ids, default `kali-aja,ai-labs`.

- [ ] **Step 1: Change the handler** — read `env.ACCOUNTS`, split/trim/filter, and dispatch once per account inside a `Promise.all`, with `body.client_payload.account = account`. Keep the same GitHub endpoint, PAT header and `event_type: "video-run"`.

- [ ] **Step 2: Make failures attributable** — collect the failed accounts and post **one** Slack warning per failed account whose text contains the account id and the HTTP status. Keep the existing `ctx.waitUntil` + `SLACK_BOT_TOKEN`/`SLACK_SOCIAL_CHANNEL_ID` mechanism, and never print tokens.

- [ ] **Step 3: Verify the handler by hand** — `node --check ops/cloudflare-cron/worker.js` → parses; and grep that `ACCOUNTS` is the only new env dependency.

- [ ] **Step 4: Document the env var** — add `ACCOUNTS` to the Worker's env table in `ops/README.md` (Task 9 edits the same file; fold this line in there).

- [ ] **Step 5: Commit** — `git add ops/cloudflare-cron/worker.js && git commit -m "ci(cron): dispatch pipeline untuk tiap akun"`

---

### Task 9: Documentation and env template

**Files:**
- Modify: `AGENTS.md`, `ops/ci-prompt.md`, `docs/AUTOPILOT.md`, `docs/PUBLISHING.md`, `ops/README.md`, `README.md`, `.env.example`

**Interfaces:**
- Consumes: the finished behaviour of Tasks 2–8.
- Produces: no code interfaces; these files are what the next operator (and the CI agent) reads.

- [ ] **Step 1: `AGENTS.md`** — replace the brand line ("Channel brand: prefix `Kali Aja `, accent `Tau`") with an account-neutral statement ("brand per video; nilai per akun ada di `src/accounts.ts`"), and add one line pointing at `src/accounts.ts` as the single source of truth for channel ids/brand.

- [ ] **Step 2: `ops/ci-prompt.md`** — make it account-neutral and require the new field:
  - `publish.json` must contain `account` (the account id of this run) alongside title/description/tiktokTitle/tiktokCaption/catatan;
  - the published-video catalog path is the one given in the run prompt (not a hardcoded `/tmp/published-videos.json`);
  - the format command is `npx tsx scripts/pick-format.mts --account <id>`;
  - keep every existing rule (no WebSearch, brand-before-after rules, no publish/upload/render by the agent, run the checks).

- [ ] **Step 3: `docs/AUTOPILOT.md`** — add a "Multi-akun" section: the two accounts and their ids, that `src/accounts.ts` holds the ids, that this document is the Kali Aja runbook while `ops/accounts/ai-labs.md` is the AI Labs brief, and that AI Labs runs through CI only.

- [ ] **Step 4: `docs/PUBLISHING.md`** — replace the single channel-id table with a per-account table (Kali Aja ids unchanged; AI Labs ids = `TODO_…` until the user fills them) and document the secret convention (`AI_LABS_` + canonical name) plus the `.env` writing rule.

- [ ] **Step 5: `ops/README.md`** — add the `AI_LABS_*` secrets to the setup list, document the worker's `ACCOUNTS` env var, and note that the concurrency group is now per account.

- [ ] **Step 6: `README.md`** — the overview still describes a single-channel pipeline and the old flat catalog path: update the pipeline sentence to say one run = one account, and change `/tmp/published-videos.json` to `/tmp/published-videos-<account>.json` (and the manual command example accordingly).

- [ ] **Step 7: `.env.example`** — add the AI Labs placeholders (`AI_LABS_GEMINI_API_KEY`, `AI_LABS_CLOUDINARY_CLOUD_NAME`, `AI_LABS_CLOUDINARY_API_KEY`, `AI_LABS_CLOUDINARY_API_SECRET`, `AI_LABS_BUFFER_ACCESS_TOKEN`) with empty values and a one-line comment.

- [ ] **Step 8: Check** — `grep -rn "6aedb753e29c69a171803f6e" docs/ ops/ AGENTS.md README.md` shows the Kali Aja ids only in the places that are supposed to name that channel; no document still claims a single-account pipeline and none still references the old flat catalog path without the account placeholder. `npm run lint && npm test` → PASS.

- [ ] **Step 9: Commit** — `git add AGENTS.md ops/ci-prompt.md docs/AUTOPILOT.md docs/PUBLISHING.md ops/README.md README.md .env.example && git commit -m "docs: multi-akun (konfigurasi, brief, kredensial, cron)"`

---

### Task 10: End-to-end verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above.
- Produces: confidence that Kali Aja is unchanged and AI Labs is wired but safely inert.

- [ ] **Step 1: Static checks** — `npm run lint && npm test` → Expected: PASS (all suites, including the four new/updated ones).

- [ ] **Step 2: Bundle still builds** — `npx remotion bundle --out-dir /tmp/rbundle` → Expected: exit 0 (the new `src/accounts.ts` must not break the bundle).

- [ ] **Step 3: Exercise the new CLIs**
  - `npx tsx scripts/pick-format.mts --account ai-labs` → JSON of one AI format;
  - `npx tsx scripts/account-env.mts --account ai-labs` → eight `KEY=value` lines;
  - `npx tsx scripts/account-env.mts --account ai-labs --require-configured` → exit 1 naming the three missing Buffer ids (expected while the placeholders are in place);
  - `npx tsx scripts/account-env.mts --account kali-aja --require-configured` → exit 0 (Kali Aja is fully configured).

- [ ] **Step 4: Confirm the Kali Aja path is untouched** — `git diff main~ --stat` shows no change to `src/engine/**`, `scripts/tts.mts`, `scripts/build-timeline.mts`, `scripts/music.mts`, `scripts/align*.mts`; and the Kali Aja values in `src/accounts.ts` equal the ids used before this change.

- [ ] **Step 5: Dry run in CI (requires the user's AI Labs secrets)** — `gh workflow run video-run --ref main -f account=ai-labs -f dry_run=true`, then check the run log for: "Resolve account" succeeded, the agent read `ops/accounts/ai-labs.md` + `ops/topics/ai-labs.md`, the produced `publish.json` contains `account: "ai-labs"` and `catatan: "format: …"`, the Account gate passed, and the final MP4 landed in the `final-video` artifact. **Until the AI Labs secrets exist in GitHub, the run must fail fast at "Resolve account" with the missing-field message — that is the expected safe behaviour, not a bug.**

- [ ] **Step 6: Report the result** to the user: what is wired, which credentials are still missing (`src/accounts.ts` TODO ids + the five `AI_LABS_*` GitHub secrets), and that AI Labs is inert until they are supplied.
