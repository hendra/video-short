# Disable On-Screen Captions on AI Labs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide burned-in `<Captions>` for `ai-labs` videos, expand `MotionStage` bottom clearance to `y = 1480` when captions are off, and enforce `captions: false` in CI via `account-gate.mts`.

**Architecture:** `BaseVideoDef` gains an optional `captions?: boolean` field (default `true`) so `src/engine/` stays decoupled from `src/accounts.ts`. `Overlays` skips `<Captions>` and `MotionStage` expands its bottom bound when `video.captions === false`, while `ops/accounts/ai-labs.md` and `scripts/account-core.mts` require `captions: false` for every `ai-labs` video.

**Tech Stack:** TypeScript, React, Remotion, `node:test` (`tsx --test`), ESLint.

**Spec:** `docs/superpowers/specs/2026-11-17-ai-labs-disable-captions-design.md`

## Global Constraints

- `src/engine/` remains video-agnostic and must not import `src/accounts.ts`.
- `kali-aja` and `cerpenek` videos (which omit `captions`) must render identically to today, including `CAPTION_SAFE_BOTTOM = 1230` and `<Captions>`.
- Caption visibility and stage bounds must remain pure functions (safe for parallel out-of-order shard rendering).
- Verification requires `npm run lint` (`eslint src && tsc && tsc -p scripts`), `npm test` (`tsx --test scripts/*.test.mts`), and `npx remotion bundle --out-dir /tmp/opencode/rbundle`.

## Review Focus

- Omitted `captions` (`undefined`) on existing 3D and motion videos must still show captions (`true`) and keep bottom clearance at `1230`.
- Explicit `captions: true` must behave identically to omitted `captions` (`1230` bottom clearance, captions shown).
- `aiLabsVideoProblems` must reject both missing `captions` and `captions: true`.
- `aiLabsVideoProblems` must not be fooled by a comment like `// captions: false` in `index.ts`, while still accepting both single-line (`{ mode: "motion", captions: false }`) and multi-line object properties.
- `ops/accounts/ai-labs.md` must state `captions: false` and `y = 1480` without contradicting itself with stale `y = 1230` / caption-chunk rules.

---

### Task 1: Engine `captions` Flag, `Overlays` Toggle, and `MotionStage` Bottom Bound

**Files:**
- Modify: `src/engine/types.ts:80-87`
- Modify: `src/engine/motion/math.ts:28-30`
- Modify: `src/engine/motion/MotionStage.tsx:1-12,87-98`
- Modify: `src/engine/overlays/Overlays.tsx:195-200,320-324`
- Test: `scripts/motion.test.mts:1-66`

**Interfaces:**
- Consumes: `BaseVideoDef`, `VideoDef`, `VideoDefMotion` from `src/engine/types.ts`.
- Produces:
  - `BaseVideoDef.captions?: boolean` (`src/engine/types.ts`)
  - `NO_CAPTION_SAFE_BOTTOM = 1480` and `safeStageBottom(captions?: boolean): number` (`src/engine/motion/math.ts`, re-exported via `src/engine/motion/index.ts`)
  - `shouldShowCaptions(captions?: boolean): boolean` (`src/engine/overlays/Overlays.tsx`)

- [ ] **Step 1: Write failing tests for `NO_CAPTION_SAFE_BOTTOM`, `safeStageBottom`, and `shouldShowCaptions`**

In `scripts/motion.test.mts`, import `NO_CAPTION_SAFE_BOTTOM` and `safeStageBottom` from `../src/engine/motion/math.ts` and `shouldShowCaptions` from `../src/engine/overlays/Overlays.tsx`, and add:

```ts
describe("captions toggle and safeStageBottom", () => {
  test("NO_CAPTION_SAFE_BOTTOM is 1480 and safeStageBottom switches on captions === false", () => {
    assert.equal(CAPTION_SAFE_BOTTOM, 1230);
    assert.equal(NO_CAPTION_SAFE_BOTTOM, 1480);
    assert.equal(safeStageBottom(undefined), 1230);
    assert.equal(safeStageBottom(true), 1230);
    assert.equal(safeStageBottom(false), 1480);
  });

  test("shouldShowCaptions defaults to true and returns false only when captions === false", () => {
    assert.equal(shouldShowCaptions(undefined), true);
    assert.equal(shouldShowCaptions(true), true);
    assert.equal(shouldShowCaptions(false), false);
  });
});
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx tsx --test scripts/motion.test.mts`
Expected: FAIL because `NO_CAPTION_SAFE_BOTTOM`, `safeStageBottom`, and `shouldShowCaptions` do not exist yet.

- [ ] **Step 3: Add `captions?: boolean` to `BaseVideoDef` in `src/engine/types.ts`**

Add optional `captions?: boolean;` (with doc comment noting default `true`) to `BaseVideoDef`.

- [ ] **Step 4: Add `NO_CAPTION_SAFE_BOTTOM` and `safeStageBottom` in `src/engine/motion/math.ts` and wire `MotionStage.tsx`**

- In `src/engine/motion/math.ts`, export `NO_CAPTION_SAFE_BOTTOM = 1480` and `safeStageBottom(captions?: boolean): number` returning `captions === false ? NO_CAPTION_SAFE_BOTTOM : CAPTION_SAFE_BOTTOM`.
- In `src/engine/motion/MotionStage.tsx`, replace `CAPTION_SAFE_BOTTOM` import/usage with `safeStageBottom(video.captions)` so `bottom: 1920 - safeStageBottom(video.captions)`.

- [ ] **Step 5: Add `shouldShowCaptions` in `src/engine/overlays/Overlays.tsx` and guard `<Captions>`**

- Export `shouldShowCaptions = (captions?: boolean): boolean => captions !== false`.
- In `Overlays`, render `<Captions tl={tl} t={t} theme={theme} />` only when `shouldShowCaptions(video.captions)` is `true`.

- [ ] **Step 6: Run tests and lint to verify Task 1 passes**

Run: `npx tsx --test scripts/motion.test.mts && npm run lint`
Expected: PASS on all `motion.test.mts` tests and `eslint src && tsc && tsc -p scripts` exits 0.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/engine/types.ts src/engine/motion/math.ts src/engine/motion/MotionStage.tsx src/engine/overlays/Overlays.tsx scripts/motion.test.mts
git commit -m "feat: support disabling burned-in captions per video"
```

---

### Task 2: Enforce `captions: false` in `ai-labs` CI Gate and Update Brief

**Files:**
- Modify: `scripts/account-core.mts:87-114`
- Modify: `ops/accounts/ai-labs.md:45-75`
- Test: `scripts/account-core.test.mts:95-192`
- Test: `scripts/topics.test.mts:35-41`

**Interfaces:**
- Consumes: `BaseVideoDef.captions?: boolean` convention (`captions: false` in `src/videos/<slug>/index.ts`).
- Produces: updated `aiLabsVideoProblems` rule in `scripts/account-core.mts` (used by `scripts/account-gate.mts`).

- [ ] **Step 1: Update existing valid `aiLabsVideoProblems` fixtures and add failing tests in `scripts/account-core.test.mts` and `scripts/topics.test.mts`**

In `scripts/account-core.test.mts`:
- Add `captions: false` to the valid `indexSource` fixtures in `describe("aiLabsVideoProblems")` (`lines 99, 134, 144, 179`).
- Add tests:

```ts
  test("rejects missing captions: false or captions: true in indexSource", () => {
    const missing = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { mode: "motion", cta: { text: "Follow!" } };',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: false,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(missing.some((p) => p.includes("captions: false")), missing.join("; "));

    const enabled = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { mode: "motion", captions: true };',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: false,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(enabled.some((p) => p.includes("captions: false")), enabled.join("; "));

    const commented = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = {\n  mode: "motion",\n  // captions: false,\n};',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: false,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(commented.some((p) => p.includes("captions: false")), commented.join("; "));
  });

  test("accepts multiline captions: false in indexSource", () => {
    assert.deepEqual(
      aiLabsVideoProblems({
        indexSource: 'export const VIDEO = {\n  mode: "motion",\n  captions: false,\n};',
        shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
        hasWorldFile: false,
        publishJson: { description: "Penjelasan AI CLI tools." },
        naskahText: "01  Line one",
      }),
      [],
    );
  });
```

In `scripts/topics.test.mts`, inside `describe("AI Labs brief")` (`states the exact brand line and motion/prompt rules`), add:

```ts
    assert.ok(text.includes("captions: false"), "brief must require captions: false");
    assert.ok(text.includes("1480"), "brief must document expanded y = 1480 stage bottom");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test scripts/account-core.test.mts scripts/topics.test.mts`
Expected: FAIL on missing `captions: false` rejection and brief assertions.

- [ ] **Step 3: Enforce `captions: false` in `aiLabsVideoProblems` (`scripts/account-core.mts`)**

In `aiLabsVideoProblems`, strip line/block comments from `opts.indexSource` (or match `(?:^|[{,\n])\s*captions\s*:\s*false\b` on comment-stripped text) and push `'ai-labs wajib pakai captions: false di index.ts'` when absent.

- [ ] **Step 4: Update `ops/accounts/ai-labs.md`**

In `## Visual: Motion Graphics (Dark Tech Studio)`:
- Update the `index.ts` instruction line to require `mode: "motion"` **and** `captions: false` (explaining that on-screen captions are turned off so motion cards stay uncluttered).
- Update `Kepadatan vertikal & zona aman` from `y = 1230` (`CAPTION_SAFE_BOTTOM`) to `y = 1480` (`NO_CAPTION_SAFE_BOTTOM`, without burned-in captions; keep bottom-right slightly clear of Shorts/TikTok buttons).
- Replace line 74's active karaoke caption rule with a note that burned-in captions are disabled for `ai-labs` (`captions: false`).

- [ ] **Step 5: Run full test suite, lint, and bundle smoke check**

Run: `npm run lint && npm test && npx remotion bundle --out-dir /tmp/opencode/rbundle`
Expected: `eslint src && tsc && tsc -p scripts` exits 0, all tests in `scripts/*.test.mts` pass, and Remotion bundle builds cleanly without errors.

- [ ] **Step 6: Commit Task 2**

```bash
git add ops/accounts/ai-labs.md scripts/account-core.mts scripts/account-core.test.mts scripts/topics.test.mts
git commit -m "feat(ai-labs): require captions: false and update safe bottom to 1480"
```
