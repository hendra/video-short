# Caption Card Layout & Number-Run Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix overlapping multi-line captions across all overlay themes (`cream`, `dark-tech`, `blueprint`) by switching to a single `inline-block` card, and split phrases around long spelled-out number runs so chunks stay at most 2 lines.

**Architecture:** Extract `captionBoxStyle(theme)` in `src/engine/overlays/Overlays.tsx` so all themes share `display: "inline-block"` and `lineHeight: 1.32` cleanly, and extract `chunksOf(ws)` into `scripts/timeline-core.mts` with a word/character budget around multi-word number tokens.

**Tech Stack:** TypeScript, React, Remotion, Node `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-19-caption-card-layout-design.md`

## Global Constraints

- Verification = `npm run lint` + `npm test` + visual still verification on both `cream` and `blueprint`; no new dependencies.
- `CAPTION_TOP = 1270` and `60px` font size remain unchanged.
- Never split inside a spelled-out number run (e.g. `"seribu sembilan ratus lima puluh lima."`).
- Never leave `display: "inline"` or `boxDecorationBreak: "clone"` in `Captions`.

## Review Focus

1. Every theme (`cream`, `dark-tech`, `blueprint`) uses `display: "inline-block"`, `lineHeight: 1.32`, and omits `boxDecorationBreak` — pinned by Task 1 test on `captionBoxStyle`.
2. `"Russell Hobbs K1 tahun seribu sembilan ratus lima puluh lima."` splits cleanly BEFORE `"seribu"` into `"Russell Hobbs K1 tahun"` + `"seribu sembilan ratus lima puluh lima."` without breaking the number run — pinned by Task 2 test.
3. Short phrases with a number that already fit in ≤ 2 lines (e.g. `"Hanya dua puluh delapan meter."`) are NOT split into a 1-word orphan chunk — pinned by Task 2 test.
4. Non-number phrases (> 5 words) keep the existing balanced `Math.ceil(p.length / 5)` split — pinned by Task 2 test.
5. Trailing punctuation on the final word of a number run (e.g. `"lima."`) still stays attached to the number run and terminates the phrase — pinned by Task 2 test.

---

### Task 1: Single-card `Captions` across all themes

**Files:**
- Modify: `src/engine/overlays/Overlays.tsx:240-294`
- Modify: `AGENTS.md:45`
- Test: `scripts/overlays.test.mts`

**Interfaces:**
- Produces: `export const captionBoxStyle = (theme: OverlayTheme): React.CSSProperties` in `src/engine/overlays/Overlays.tsx`.

- [ ] **Step 1: Write failing tests** in `scripts/overlays.test.mts`:
```ts
import { captionBoxStyle } from "../src/engine/overlays/Overlays.tsx";

describe("captionBoxStyle", () => {
  test("every theme uses a single inline-block card with lineHeight 1.32 and no boxDecorationBreak", () => {
    for (const theme of ["cream", "dark-tech", "blueprint"] as const) {
      const s = captionBoxStyle(theme);
      assert.equal(s.display, "inline-block", theme);
      assert.equal(s.lineHeight, 1.32, theme);
      assert.equal(s.padding, "14px 26px", theme);
      assert.equal("boxDecorationBreak" in s, false, theme);
    }
  });
});
```

- [ ] **Step 2:** Run `npx tsx --test scripts/overlays.test.mts` → Expected: FAIL (`captionBoxStyle` not exported).

- [ ] **Step 3: Implement** `captionBoxStyle(theme)` in `src/engine/overlays/Overlays.tsx` and use it in both the `"blueprint"` and standard branches of `Captions` (`padding: "14px 26px"`, `font: \`800 60px ${FONT.ui}\``, `lineHeight: 1.32`, `borderRadius: 8` on `blueprint` and `14` on `cream`/`dark-tech`, no `boxDecorationBreak`). Update `AGENTS.md:45` to replace `keep line-height: 1.8 in Overlays.tsx` with `use an inline-block card with line-height: 1.32 in Overlays.tsx`.

- [ ] **Step 4:** Run `npm run lint && npm test` → Expected: 0 lint errors, all tests pass.

- [ ] **Step 5: Commit** `fix(overlays): use single inline-block caption card across all themes`.

---

### Task 2: Split phrases around long number runs (`scripts/timeline-core.mts`)

**Files:**
- Create: `scripts/timeline-core.mts`
- Modify: `scripts/build-timeline.mts:16,51-86`
- Create: `scripts/timeline-core.test.mts`

**Interfaces:**
- Produces in `scripts/timeline-core.mts`:
  - `export const normWord = (s: string): string`
  - `export const chunksOf = (ws: Word[]): Word[][]`

- [ ] **Step 1: Write failing tests** in `scripts/timeline-core.test.mts`:
```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chunksOf } from "./timeline-core.mts";

const words = (s: string) => s.split(/\s+/).map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.35 }));
const joinChunks = (cs: ReturnType<typeof chunksOf>) => cs.map((c) => c.map((w) => w.w).join(" "));

describe("chunksOf", () => {
  test("splits before a long spelled-out number so each chunk stays within 2 lines and keeps the number intact", () => {
    const res = joinChunks(chunksOf(words("Russell Hobbs K1 tahun seribu sembilan ratus lima puluh lima.")));
    assert.deepEqual(res, ["Russell Hobbs K1 tahun", "seribu sembilan ratus lima puluh lima."]);
  });

  test("keeps short number phrases together without creating a 1-word orphan chunk", () => {
    const res = joinChunks(chunksOf(words("Hanya dua puluh delapan meter.")));
    assert.deepEqual(res, ["Hanya dua puluh delapan meter."]);
  });

  test("splits long non-number phrases into balanced chunks of at most 5 tokens", () => {
    const res = joinChunks(chunksOf(words("Air panas mengalir ke atas melewati pipa kecil itu.")));
    assert.deepEqual(res, ["Air panas mengalir ke atas", "melewati pipa kecil itu."]);
  });
});
```

- [ ] **Step 2:** Run `npx tsx --test scripts/timeline-core.test.mts` → Expected: FAIL (`timeline-core.mts` missing).

- [ ] **Step 3: Implement** `scripts/timeline-core.mts` (`normWord` + `chunksOf`) and import them in `scripts/build-timeline.mts`. Packing rule inside `chunksOf` when a merged phrase `p` contains any multi-word token (`p.some((t) => t.length > 1)`) and exceeds `MAXW` (5) total words or `46` characters: flush the current chunk before adding token `tok` whenever `cur.length > 0 && (curTokens + 1 > MAXW || curWords + tok.length > 6 || curChars + 1 + tokChars > 46)`. Otherwise keep the existing `Math.ceil(p.length / MAXW)` balanced split.

- [ ] **Step 4:** Run `npm run lint && npm test` → Expected: 0 lint errors, all tests pass. Also run a quick Remotion still verification on a 2-line caption (including the full `"Russell Hobbs K1 tahun"` + `"seribu sembilan ratus lima puluh lima."` split) for both `cream` and `blueprint`, inspect the stills, and clean up temporary demo files.

- [ ] **Step 5: Commit** `fix(timeline): split phrases around long spelled-out numbers`.
