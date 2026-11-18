# Caption Card Layout & Number-Run Splitting — Design

**Date:** 2026-11-19
**Scope:** Small change — fix overlapping multi-line captions across all channels (`cream`, `dark-tech`, `blueprint`) and cap number-containing chunks to at most 2 lines.

## Intent & Why

Captions currently overlap vertically on multi-line phrases across every channel (`kali-aja`, `cerpenek`, `sastra-mesin`) because `lineHeight: 1.8` in `src/engine/overlays/Overlays.tsx` was placed before the `font` shorthand (which resets `line-height` to `normal`) on a `display: inline` `boxDecorationBreak: "clone"` span. In addition, `scripts/build-timeline.mts` counts a whole spelled-out number as 1 token, allowing 10-word / 3-line chunks (e.g. `"Russell Hobbs K1 tahun seribu sembilan ratus lima puluh lima."`).

## Goals, Non-Goals & Anti-Goals

- **Goals:**
  - Switch `Captions` in `src/engine/overlays/Overlays.tsx` across all themes (`blueprint`, `dark-tech`, `cream`) to a single `display: "inline-block"` card (`padding: "14px 26px"`, `lineHeight: 1.32`, `borderRadius: 8` on `blueprint` and `14` on `cream`/`dark-tech`) so lines inside a chunk never overlap and the active-word underline is never occluded.
  - Extract `chunksOf` from `scripts/build-timeline.mts` into a testable helper (or pure module `scripts/timeline-core.mts`) that keeps spelled-out number runs intact while splitting long phrases on token boundaries (before/after a multi-word number token) so chunks stay within 2 lines.
- **Non-Goals:**
  - Changing `CAPTION_TOP` (`1270`), font size (`60px`), or caption colours.
  - Fixing unrelated screenshot details (`chip` vertical label padding or 3D pot lighting).
- **Anti-Goals:**
  - Leaving `display: inline` + `boxDecorationBreak: "clone"` anywhere in `Captions`.
  - Splitting inside a spelled-out number run (e.g. splitting `"seribu sembilan"` from `"ratus"`).

## Approaches

1. **Single `inline-block` card (Option 1, picked by user) + token-boundary split before long number runs** — eliminates overlapping per-line boxes on every theme and guarantees ≤ 2 lines per chunk.
2. Keep `boxDecorationBreak: "clone"` with `font: 800 60px/1.8` (Option 2) — leaves wider gaps between lines and was not picked by the user.

## Design

- **`src/engine/overlays/Overlays.tsx`**: both `blueprint` and standard (`cream` / `dark-tech`) branches of `Captions` use `display: "inline-block"`, `padding: "14px 26px"`, `font: \`800 60px ${FONT.ui}\``, and `lineHeight: 1.32` (after `font`, removing `boxDecorationBreak: "clone"`).
- **`scripts/timeline-core.mts` + `scripts/build-timeline.mts`**: move `chunksOf` into `timeline-core.mts` so it can be unit-tested cleanly without running the CLI. When a phrase `p` has `> 5` words or `> 46` characters and contains a multi-word number token, pack tokens sequentially into chunks keeping each chunk `<= 5` tokens and `(words <= 6 && chars <= 46)` whenever adding another token would exceed that budget (while never splitting a single multi-word number token internally). Phrases with ≤ 5 words / ≤ 46 chars keep the existing balanced `Math.ceil(p.length / 5)` split.
- **`AGENTS.md`**: update the caption rule from `keep line-height: 1.8 in Overlays.tsx` to `inline-block` card + `line-height: 1.32`.
- **Verification**: unit tests in `scripts/timeline-core.test.mts` + visual still check of `opt1-cream` and `opt1-bp` (already rendered as `/tmp/opencode/cap-compare/opt1-*.jpg`; re-render after splitting if needed) + `npm run lint && npm test`.

## Left to the Builder

Exact signature of `chunksOf` in `scripts/timeline-core.mts` and minor phrasing in `AGENTS.md`.
