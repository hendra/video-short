# SASTRA MESIN Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th channel account `sastra-mesin` (everyday-object 3D explainers) with its own blueprint overlay theme, voice, format pool, brief, backlog, gate and wiring.

**Architecture:** One more entry in `src/accounts.ts`, routed through the existing CI pipeline like Cerpenek/AI Labs. Identity lives in a 3rd `OverlayTheme` (`"blueprint"`) in `src/engine/overlays/Overlays.tsx`, a `SASTRA_MESIN` format pool, and `ops/accounts/sastra-mesin.md`. A gate rule forces `theme: "blueprint"` + 3D.

**Tech Stack:** TypeScript, Remotion, React Three Fiber/Three.js, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-11-19-sastra-mesin-channel-design.md`

## Global Constraints

- Verification = `npm run lint` + `npm test`; no new dependencies.
- Existing videos must look unchanged: 3D default theme stays `cream`, motion default stays `dark-tech`.
- Caption position `CAPTION_TOP = 1270`, `line-height: 1.8`, ≤ 5 tokens per chunk — unchanged in the new theme.
- Palette: navy `#101820`, cyan `#20C9C3`, orange `#FF8A36`, steel `#81909C`, paper `#F4F5F6`.
- Voice `id-id-tutor-1`, style `ramah, jelas, penasaran; seperti teman pintar yang menjelaskan sesuatu yang seru; tempo sedang`.
- Buffer ids stay `TODO_SASTRA_MESIN_ORG`, `TODO_SASTRA_MESIN_YOUTUBE`, `TODO_SASTRA_MESIN_TIKTOK`.
- Music moods: `rakit`, `aliran`, `rahasia`; MP3s are supplied by the user (not in this plan).
- Never commit `src/videos/*`, `public/*/vo.mp3`, `.env`, or a non-empty `registry.ts`.

## Review Focus

1. A Kali Aja / Cerpenek 3D video (no `theme`) must still render the cream look — pinned by the Task 2 still check of a cream video and the `themeOf` test.
2. Gate must accept `theme: 'blueprint'` with single quotes and reject it when only present in a comment — Task 4 tests.
3. Blueprint callouts must not overlap the extra brand row — callout `top` shifted by `BP_HEADER_SHIFT` (Task 2, visible in still).
4. An unconfigured sastra-mesin run must stop before render (`--require-configured`) and must not be scheduled — Task 1 test `isConfigured === false`; Task 6 leaves `wrangler.toml` untouched.
5. `pickFormat("sastra-mesin")` must never return a Kali Aja format — Task 3 test.

---

### Task 1: Account entry

**Files:**
- Modify: `src/accounts.ts` (type, `ACCOUNT_IDS`, `ACCOUNTS`)
- Modify: `scripts/music.mts:18-22` (`MOODS_BY_ACCOUNT` gains `"sastra-mesin": ["rakit", "aliran", "rahasia"]` — required by the `Record<AccountId,…>` type)
- Test: `scripts/accounts.test.mts`, `scripts/music.test.mts`

**Interfaces:**
- Produces: `AccountId` includes `"sastra-mesin"`; `ACCOUNTS["sastra-mesin"]`; `MOODS_BY_ACCOUNT["sastra-mesin"]`.

- [ ] **Step 1: Failing tests** in `accounts.test.mts`: update the registry test to `["kali-aja", "ai-labs", "cerpenek", "sastra-mesin"]`; add

```ts
test("Sastra Mesin has its own identity and is not yet configured", () => {
  const s = ACCOUNTS["sastra-mesin"];
  assert.equal(s.label, "Sastra Mesin");
  assert.deepEqual(s.brand, { prefix: "Sastra ", accent: "Mesin" });
  assert.equal(s.youtubeCategoryId, "27");
  assert.equal(s.madeForKids, false);
  assert.equal(s.tts.voice, "id-id-tutor-1");
  assert.deepEqual(s.agent.files, ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/sastra-mesin.md", "ops/topics/sastra-mesin.md"]);
  assert.match(s.agent.prompt, /override ops\/ci-prompt\.md/);
  assert.match(s.agent.prompt, /docs\/AUTOPILOT\.md does NOT apply/);
  assert.equal(isConfigured(s), false);
  assert.deepEqual(missingConfigFields(s), ["buffer.orgId", "buffer.youtubeChannelId", "buffer.tiktokChannelId"]);
});
```
  The existing "every agent instruction file exists on disk" test will fail until Task 5 creates the brief and backlog — create both files as stubs with only their `# ` heading in this task so it passes; Task 5 fills them.
  In `music.test.mts` add `sastra-mesin` cases to "resolves each valid mood per account" following the existing pattern.

- [ ] **Step 2:** `npm test` → FAIL (unknown account).
- [ ] **Step 3: Implement** the account with the Global Constraints values; agent prompt copies Cerpenek's wording with `sastra-mesin` paths ("…they override ops/ci-prompt.md where they differ, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step."). Add moods to `music.mts`.
- [ ] **Step 4:** `npm run lint && npm test` → PASS. Fix any other exhaustive `Record<AccountId,…>` tsc errors (e.g. `FORMATS_BY_ACCOUNT` — add `"sastra-mesin": []` temporarily only if Task 3 is not yet done; Task 3 replaces it).
- [ ] **Step 5: Commit** `feat(sastra-mesin): add account (voice tutor-1, Buffer TODO)`.

### Task 2: Blueprint overlay theme

**Files:**
- Modify: `src/engine/types.ts` (`OverlayTheme` adds `"blueprint"`; move `theme?: OverlayTheme` from `VideoDefMotion` to `BaseVideoDef`)
- Modify: `src/engine/Explainer.tsx` (3D: background + `theme` passed to `Overlays`)
- Modify: `src/engine/overlays/Overlays.tsx`
- Test: `scripts/motion.test.mts` (or a new `scripts/overlays.test.mts` if motion tests don't import Overlays)

**Interfaces:**
- Produces: `export const themeOf = (video: VideoDef): OverlayTheme` in `Overlays.tsx` (returns `video.theme ?? (video.mode === "motion" ? "dark-tech" : "cream")`); `export const BLUEPRINT_BG: React.CSSProperties`.

- [ ] **Step 1: Failing test**

```ts
test("themeOf keeps existing defaults and honours blueprint", () => {
  assert.equal(themeOf({ ...base3d }), "cream");
  assert.equal(themeOf({ ...baseMotion }), "dark-tech");
  assert.equal(themeOf({ ...base3d, theme: "blueprint" }), "blueprint");
});
```
  (`base3d`/`baseMotion` = minimal `VideoDef` literals cast via `as VideoDef`.)
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement.** Port `/tmp/opencode/sm-blueprint-spike.diff` (apply with `git apply`, then clean up): `BlueprintOverlays` component, blueprint branches in `Callouts` (numbered ①②③, dashed leader, coloured left bar) and `Captions` (white box, navy 3px frame, active word cyan underline), `BLUEPRINT_BG` grid, cyan scan line 0.45 s after each cut, callout top = `safeStageTop(...) + BP_HEADER_SHIFT` (64). Both Explainers use `themeOf(video)` instead of their inline defaults.
- [ ] **Step 4:** `npm run lint && npm test` → PASS. Then visual check: recreate the throwaway `src/videos/sm-demo/index.ts` from `/tmp/opencode/sm-demo-index.ts`, `public/sm-demo/vo.mp3` from `/tmp/opencode/sm-voice/id-id-tutor-1.mp3`, register it temporarily, `npx remotion bundle --out-dir /tmp/opencode/rb` and `npx remotion still /tmp/opencode/rb sm-demo /tmp/opencode/t2.jpg --frame=150 --gl=swangle` plus `--frame=2` of a second shot (add one) to see the scan line. Also render a frame with `theme` removed and confirm the cream look. Restore `registry.ts` (`git checkout src/videos/registry.ts`) and delete `src/videos/sm-demo`, `public/sm-demo`.
- [ ] **Step 5: Commit** `feat(engine): blueprint overlay theme`.

### Task 3: Format pool

**Files:** Modify `scripts/pick-format.mts`; Test `scripts/pick-format.test.mts`

**Interfaces:** Produces `FORMATS_BY_ACCOUNT["sastra-mesin"]`; `pickFormat("sastra-mesin", roll)`.

- [ ] **Step 1: Failing test**

```ts
describe("Sastra Mesin pool", () => {
  test("has its own formats, none shared with Kali Aja", () => {
    const ids = formatsFor("sastra-mesin").map((f) => f.id);
    assert.deepEqual(ids, ["bongkar-pasang", "satu-komponen", "ikuti-alirannya", "mitos-benda", "dulu-vs-sekarang", "kenapa-bunyi"]);
    const kali = new Set(formatsFor("kali-aja").map((f) => f.id));
    assert.ok(ids.every((id) => !kali.has(id)));
  });
  test("weights 3,3,2,2,1,1", () =>
    assert.deepEqual(formatsFor("sastra-mesin").map((f) => f.weight), [3, 3, 2, 2, 1, 1]));
});
```
- [ ] **Step 2:** FAIL. **Step 3:** add `SASTRA_MESIN: Format[]` with instructions from the spec's Format pool section (each opens with a 2–3 s hook and ends with a CTA). **Step 4:** `npm run lint && npm test` PASS.
- [ ] **Step 5: Commit** `feat(sastra-mesin): own narrative format pool`.

### Task 4: Account gate

**Files:** Modify `scripts/account-core.mts`, `scripts/account-gate.mts`; Test `scripts/account-core.test.mts`

**Interfaces:** Produces `export const sastraMesinVideoProblems = (opts: { indexSource: string; hasWorldFile: boolean }): string[]`.

- [ ] **Step 1: Failing tests**

```ts
describe("sastraMesinVideoProblems", () => {
  const ok = `export const video = { theme: "blueprint", fov: 40 };`;
  test("accepts a 3D blueprint video (either quote style)", () => {
    assert.deepEqual(sastraMesinVideoProblems({ indexSource: ok, hasWorldFile: true }), []);
    assert.deepEqual(sastraMesinVideoProblems({ indexSource: ok.replace(/"/g, "'"), hasWorldFile: true }), []);
  });
  test("rejects a missing theme, a commented-out theme, motion mode, and no world.ts", () => {
    assert.equal(sastraMesinVideoProblems({ indexSource: `const v = {};`, hasWorldFile: true }).length, 1);
    assert.equal(sastraMesinVideoProblems({ indexSource: `// theme: "blueprint"`, hasWorldFile: true }).length, 1);
    assert.ok(sastraMesinVideoProblems({ indexSource: `${ok} mode: "motion"`, hasWorldFile: true }).length >= 1);
    assert.equal(sastraMesinVideoProblems({ indexSource: ok, hasWorldFile: false }).length, 1);
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3:** implement with the same comment-stripping as `aiLabsVideoProblems`; messages in Indonesian (`sastra-mesin wajib pakai theme: "blueprint" di index.ts`, `sastra-mesin wajib 3D (world.ts), bukan mode: "motion"`). Call it in `account-gate.mts` when `account.id === "sastra-mesin"`. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(sastra-mesin): gate enforces blueprint 3D look`.

### Task 5: Channel brief + topic backlog

**Files:** Create/fill `ops/accounts/sastra-mesin.md`, `ops/topics/sastra-mesin.md`; Test `scripts/topics.test.mts`

- [ ] **Step 1: Failing tests** (pattern of the Cerpenek block):
  - brief has sections `## Brand`, `## Suara`, `## Format`, `## Topik`, `## Riset`, `## Naskah`, `## Scene 3D`, `## Batas isi`, `## Musik latar`, `## publish.json`, `## Refill backlog`;
  - brief contains `brand: { prefix: "Sastra ", accent: "Mesin" },`, `theme: "blueprint"`, `"account": "sastra-mesin"`, `npm run tts -- <slug> --account sastra-mesin`, `pick-format.mts --account sastra-mesin`, and each mood `rakit`, `aliran`, `rahasia`;
  - backlog: entry regex `/^- [a-z0-9]+(?:-[a-z0-9]+)*: .+ — https:\/\/\S+ \((Rumah Tangga|Dapur|Pribadi|Elektronik|Utilitas|Transportasi)\)$/`, ≥ 30 entries, every dash line valid, unique slugs, all six categories present.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Write the brief** from the spec (niche A–F, exclusions, research rules, script rules incl. term → explanation → analogy, 60–90 s and char target measured from the tutor sample: 9.7 s for 146 chars ≈ 15 chars/s → 900–1,300 chars; 3D rules: `theme: "blueprint"`, palette semantics, cutaway/exploded view, linked motion, `tag: "ILUSTRASI"` for simplified internals, max 3 callouts with `orange` = heat/moving part; publish.json shape copied from Cerpenek with `"account": "sastra-mesin"`, description with `Sumber:` line, `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, `#shorts` + hashtags like `#caraKerja #sastramesin`). **Write the backlog**: ≥ 30 objects across all six categories; each URL must be fetched once (WebFetch) and return the mechanism — drop any that doesn't.
- [ ] **Step 4:** `npm test` PASS. **Step 5: Commit** `feat(sastra-mesin): channel brief and topic backlog`.

### Task 6: Wiring + docs

**Files:** `.github/workflows/video.yml:18` (input description), `scripts/duplicate-core.mts:29` (add `"sastra","mesin"` stopwords), `ops/ci-prompt.md:11,16` (per-account file list; add `sastra-mesin` to the 3D channels list), `AGENTS.md`, `README.md`, `ops/README.md`, `docs/PUBLISHING.md` (mention 4th account, voice tutor-1, Buffer ids pending, GitHub Environment `sastra-mesin` needed).

- [ ] **Step 1:** Do NOT add `sastra-mesin` to `ops/cloudflare-cron/wrangler.toml` `ACCOUNTS` yet: with TODO Buffer ids, `account-env.mts --require-configured` would fail all 6 daily runs. Document in `ops/README.md` that it is added (and the worker redeployed) once the ids are filled. The worker reads `ACCOUNTS` generically (`ops/cloudflare-cron/worker.js:40`), no code change.
- [ ] **Step 2:** Make the edits. **Step 3:** `npm run lint && npm test` PASS; `grep -rn "three accounts\|tiga akun" --exclude-dir=node_modules .` returns nothing stale.
- [ ] **Step 4: Commit** `feat(sastra-mesin): wire cron, CI prompt and docs`.

**Operator steps after merge (report, not code):** create YouTube + TikTok channels in a Buffer org and fill the 3 ids; add GitHub Environment `sastra-mesin` with `BUFFER_ACCESS_TOKEN`; commit `public/sastra-mesin/music/{rakit,aliran,rahasia}.mp3`; then add `sastra-mesin` to `ACCOUNTS` in `wrangler.toml` and redeploy the worker (6×/day, user decision). Test first with `gh workflow run video.yml -f account=sastra-mesin -f dry_run=true`.
