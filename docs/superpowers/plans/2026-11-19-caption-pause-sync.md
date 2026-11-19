# Caption / Audio Sync Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anchor every real audio pause to a word boundary in `align-core.mts` and enforce sync with a `check-sync` gate so captions and highlights no longer lead speech on any channel.

**Architecture:** Extract `speechSegments` in `scripts/align-core.mts` and change `pairPhrases` so any word boundary may take a pause while penalising silences left inside a block and rewarding punctuation cuts. Add `scripts/check-sync.mts` using `speechSegments` + `timeline.json` and wire it into `package.json`, `.github/workflows/video.yml`, and `ops/ci-prompt.md`.

**Tech Stack:** TypeScript (`tsx`), `node:test`, FFmpeg (`silencedetect`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-19-caption-pause-sync-design.md`

## Global Constraints

- Offline aligner remains free, zero new dependencies, Node >= 20.19.
- `npm run lint` (`eslint src && tsc && tsc -p scripts`) and `npm test` must pass.
- OpenCode CI agent permissions and `GEMINI_API_KEY`-only boundary unchanged.
- Do not commit `karbon-norwegia` generated files or modify `src/videos/registry.ts` permanently.

## Review Focus

- Punctuation token with zero weight (`"—"`) followed by a real pause: cut must land after `"—"` so `"—"` takes zero time and the word after the pause starts at segment start.
- Unpunctuated line with a mid-phrase breath pause: DP must split at a word boundary rather than straddling the pause, when speech-rate balance is clear.
- More pauses than words or single-word line: must still partition all words and segments without infinite cost or crash.
- Short natural pause (< 0.15 s) inside a word/chunk: `check-sync` must allow tolerance <= 0.15 s without false positives.
- `check-sync` CLI on missing `vo.mp3` or `timeline.json`: exit non-zero with a clear message.

---

### Task 1: Anchor pauses at word boundaries in `scripts/align-core.mts`

**Files:**
- Modify: `scripts/align-core.mts`
- Test: `scripts/align-core.test.mts`

**Interfaces:**
- Produces:
  - `speechSegments(audioPath: string): { dur: number; segs: [number, number][] }`
  - `pairPhrases(ws: string[], segs: [number, number][]): [number, number, number, number][]`
  - `wordsFromSpans(lines: string[], spans: Span[]): TimedWord[]`
  - `analyzeAlignment(audioPath: string, lines: string[]): { words: TimedWord[]; spans: Span[] }`

- [ ] **Step 1: Update `scripts/align-core.test.mts` with failing tests for mid-phrase pauses and mis-pinned punctuation**

In `scripts/align-core.test.mts`, replace the old `"an unpunctuated line with an inner pause keeps one block"` assertion (which asserted the buggy single-block behavior) and add tests covering unpunctuated mid-phrase pauses, mis-pinned multi-comma pauses, and a lone dash followed by a pause:

```ts
test("an unpunctuated line with an inner pause splits at the pause instead of straddling it", () => {
  const words = wordsFromSpans(["satu dua tiga empat"], [span([[0, 1.0], [1.45, 2.45]])]);
  assert.ok(words[1].end <= 1.0 + 1e-6);
  assert.ok(words[2].start >= 1.45 - 1e-6);
});

test("mid-phrase pause wins over wrong comma when speech lengths show which half paused", () => {
  const ws = "Perjanjian karbon pertama, diteken di Antalya".split(" ");
  // Pause is after "Perjanjian" (1 word), while the comma is after 3 words.
  const segs: [number, number][] = [[0, 0.7], [1.2, 3.2]];
  const blocks = pairPhrases(ws, segs);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], [0, 1, 0, 1]);
  assert.deepEqual(blocks[1], [1, 6, 1, 2]);
});
```

- [ ] **Step 2: Run tests to verify the new cases fail against current `align-core.mts`**

Run: `npm test -- scripts/align-core.test.mts`
Expected: FAIL on the two new assertions (`words[2].start >= 1.45` and `blocks.length === 2`).

- [ ] **Step 3: Refactor `pairPhrases` and extract `speechSegments` in `scripts/align-core.mts`**

Implement:
- `speechSegments(audioPath: string): { dur: number; segs: [number, number][] }` by moving the `ffmpeg silencedetect` parsing out of `analyzeAlignment`, and call it from `analyzeAlignment`.
- In `pairPhrases(ws, segs)`:
  - Let `ends` be every word boundary `1..ws.length` (except keep zero-weight lone-dash tokens attached to the cut right after them by skipping cuts whose previous word is zero-weight? Wait: if `ws = ["bukan", "gas", "—", "tapi", "karbon"]`, `weight("—") === 0` and `endsPhrase("—") === true`, so cutting after `"—"` (`idx = 3`) puts `"—"` at the end of block 0 with 0 duration and starts `"tapi"` at segment 1. Skip candidate cuts right *before* a zero-weight token so `"—"` stays with its preceding phrase when a pause follows `"—"`).
  - Precompute `ssum` (cumulative speech time across `segs`) and `totDur[i]` = `segs[i-1][1]` so silence inside `[i0, i)` is `(segs[i - 1][1] - segs[i0][0]) - (ssum[i] - ssum[i0])`.
  - Block cost: `(speech - exp) ** 2 / exp + GAP_COST * innerSilence - (j0 > 0 && endsPhrase(ws[cuts[j0 - 1] - 1]) ? CUT_REWARD : 0)`, with `GAP_COST = 1`.
  - Wait: if `segs.length > candidateCuts.length`, fallback/guard? Actually a block `[j0, j, i0, i]` can consume multiple segments `i - i0 > 1` if needed — the DP already allows `i0 < i` for any `i - i0 >= 1`! So even when there are more segments than words (`M > P`), `best[P][M]` stays finite.

- [ ] **Step 4: Run tests and lint**

Run: `npm test && npm run lint`
Expected: PASS on all tests and zero lint/tsc errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/align-core.mts scripts/align-core.test.mts
git commit -m "fix: anchor inner-phrase pauses at word boundaries in aligner"
```

---

### Task 2: Add `check-sync` gate, tests, and CI wiring

**Files:**
- Create: `scripts/sync-core.mts`
- Create: `scripts/sync-core.test.mts`
- Create: `scripts/check-sync.mts`
- Modify: `package.json`
- Modify: `.github/workflows/video.yml`
- Modify: `ops/ci-prompt.md`

**Interfaces:**
- Consumes: `speechSegments` from `./align-core.mts`; `Timeline` from `../src/engine/types`; `publicDir`, `videoDir`, `videoIdArg` from `./lib.mts`.
- Produces:
  - `checkTimelineSync(tl: Timeline, segs: [number, number][], dur: number, maxDriftSec?: number): string[]` (returns list of human-readable violation strings; empty array = pass).
  - CLI `npm run check-sync -- <id>` (exits 0 on pass, exits 1 with violations on stderr on fail).

- [ ] **Step 1: Write failing tests in `scripts/sync-core.test.mts`**

Cover:
1. Clean synchronized timeline passes (`[]`).
2. Chunk starting > 0.15 s inside silence fails (reports chunk index/text).
3. Word straddling > 0.15 s of silence fails.
4. Non-monotonic timestamps or timestamps past `dur + 0.05` fail.
5. Short natural breath (< 0.15 s) inside a chunk passes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scripts/sync-core.test.mts`
Expected: FAIL because `sync-core.mts` does not exist yet.

- [ ] **Step 3: Implement `scripts/sync-core.mts` and `scripts/check-sync.mts`**

- `checkTimelineSync(tl, segs, dur, maxTol = 0.15)`:
  - Build silence intervals `[a, b]` between `segs` (plus `[0, segs[0][0]]` if `segs.length && segs[0][0] > 0`).
  - Check all words in `tl.chunks.flatMap(c => c.words)`: monotonic (`w.s <= w.e`, `w.s >= prev.s - 1e-3`), `w.e <= dur + 0.05`, and no silence `[a, b]` overlaps `(w.s, w.e)` by `> maxTol` while `w.s < a` and `w.e > b`.
  - Check each `chunk` in `tl.chunks`: if any silence `[a, b]` satisfies `chunk.s >= a - 0.01 && chunk.s < b - maxTol`, record violation `"chunk starts in silence..."`.
- `scripts/check-sync.mts`: reads `public/<id>/vo.mp3` and `src/videos/<id>/timeline.json`, calls `speechSegments` + `checkTimelineSync`, prints summary or exits 1 on violations.
- Add `"check-sync": "tsx scripts/check-sync.mts"` to `package.json`, run `npm run check-sync -- "$SLUG"` in `.github/workflows/video.yml` inside `Gates`, and add `npm run check-sync -- <slug>` to `ops/ci-prompt.md` line 28.

- [ ] **Step 4: Run tests, lint, and verify against `karbon-norwegia`**

Run:
- `npm test && npm run lint`
- Re-run `npm run align:local -- karbon-norwegia public/karbon-norwegia/vo.mp3 && npm run timeline -- karbon-norwegia && npm run check-sync -- karbon-norwegia`
- Check `git status` so no temporary edits leak into tracked `karbon-norwegia` state (remember `karbon-norwegia` files are gitignored).
- Render and inspect stills for the previously broken moments in `karbon-norwegia` (8.9 s, 51.5 s, 87.1 s) by registering temporarily or via Remotion preview, then revert `registry.ts` cleanly.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-core.mts scripts/sync-core.test.mts scripts/check-sync.mts package.json .github/workflows/video.yml ops/ci-prompt.md
git commit -m "feat: add check-sync gate to catch early captions in CI"
```
