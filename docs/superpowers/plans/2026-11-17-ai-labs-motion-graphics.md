# AI Labs Motion Graphics ("Dark Tech Studio") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3D dioramas on the `ai-labs` channel with a native 2D Dark Tech Studio motion-graphics engine, composable animated blocks/icons/transitions, and hard CI gates while leaving `kali-aja` and `cerpenek` 3D pipelines untouched.

**Architecture:** `VideoDef` becomes a discriminated union on `mode` (`"3d"` default vs `"motion"`), allowing `Explainer.tsx` to skip `<ThreeCanvas>` for `"motion"` videos and render `<MotionStage>` + dark-tech themed `<Overlays>`. A new `src/engine/motion/` module provides deterministic `t`-driven transitions, safe-zone stage layout, vector icons, and reusable infographic/UI blocks; `account-core.mts`/`account-gate.mts` enforce `mode: "motion"`, no `world.ts`, and the prompt-in-description rule for `ai-labs`.

**Tech Stack:** TypeScript, React 19, Remotion 4 (`AbsoluteFill`, `useCurrentFrame`, `useVideoConfig`), Node `node:test`, ESLint (`@remotion/eslint-config-flat`), `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-17-ai-labs-motion-graphics-design.md`

## Global Constraints

- Canvas is `1080×1920`, `30 fps`, `durationInFrames = Math.ceil(timeline.dur * 30)`.
- Everything visible must be a pure function of `t` (no `Math.random()`, `Date.now()`, CSS `@keyframes`, CSS `transition`, or cross-frame state).
- Safe zones: header sits at `top: 178`, captions sit at `CAPTION_TOP = 1270` (`line-height: 1.8`, `≤ 5` tokens per chunk); stage content must stay below header/chip/CTA and above `y = 1230`.
- Fonts: bundled offline OFL fonts (`Inter`, `Inter Display`, `DejaVu Sans Mono` via `src/engine/fonts.ts`) only; zero external network assets or live screenshots.
- Existing 3D channels (`kali-aja`, `cerpenek`) and `src/videos/karbon-norwegia/` must keep identical behavior and visuals (`mode` defaults to `"3d"`, `theme` defaults to `"cream"`).
- Verification gates: `npm run lint` (`eslint src && tsc && tsc -p scripts`), `npm test` (`tsx --test scripts/*.test.mts`), `npx remotion bundle`, and `npx remotion still` inspection.

## Review Focus

- **Short or zero-duration shots (`dur <= 0.36` or `dur === 0`):** `transitionState` and `MotionStage` must never divide by zero, produce `NaN`, or clip outgoing/incoming opacity when a shot is shorter than the `0.36s` transition window.
- **First-shot and end-of-timeline boundaries (`t === 0`, `shotIdx === 0`, `t >= dur`):** Shot 0 renders at `opacity = 1, scale = 1` with no incoming transition from a nonexistent prior shot; `t >= dur` stays clamped on the last shot.
- **Out-of-order / pre-trigger frames (`t < at`):** `stagger`, `typewriter`, and `countValue` must return clean initial states (`0`, `""`, `from`) and never negative lengths or negative counts when Remotion visits frames out of order.
- **Multi-line headers with Chip or CTA active:** `safeStageTop` must adjust cleanly for 1-line vs 2-line titles plus Chip or CTA so stage blocks stay strictly inside `[safeStageTop, 1230]`.
- **Hard CI gate precision for `ai-labs`:** Videos without `<PromptCard` must pass without needing a prompt block in `description`; videos with `<PromptCard` must fail unless `publish.json.description` contains `Prompt siap copy:` and either `cta.text` or the last 3 lines of `naskah.txt` mention `deskripsi`.

---

### Task 1: Motion Timing, Safe-Zone, and Transition Math (`src/engine/motion/math.ts`)

**Files:**
- Create: `src/engine/motion/math.ts`
- Test: `scripts/motion.test.mts`

**Interfaces:**
- Consumes: `clamp`, `lerp`, `smooth`, `ramp`, `spring`, `sway` from `src/engine/math.ts` (note: keep `src/engine/motion/math.ts` free of `three` imports by either duplicating tiny pure scalar math or extracting pure math — importing `../math` pulls `three` only if `three` is installed, which it is, or better: `src/engine/motion/math.ts` imports `{ clamp, lerp, ramp, smooth, spring, sway }` from `../math` if tree-shaken, or directly computes pure scalar math without `three` so Node tests stay instant).
- Produces:
  - `TransitionKind = "zoom-cross" | "slide-up" | "slide-left" | "wipe" | "scale-fade"`
  - `TRANSITION_DUR = 0.36`
  - `CAPTION_SAFE_BOTTOM = 1230`
  - `stagger(t: number, start: number, index: number, gap?: number, dur?: number): number`
  - `typewriter(text: string, t: number, start: number, cps?: number): string`
  - `countValue(from: number, to: number, t: number, start: number, dur?: number): number`
  - `safeStageTop(title: string, under: "chip" | "cta" | null): number`
  - `transitionLayers(shots: readonly ShotSpan[], t: number): { activeIdx: number; prevIdx: number | null; progress: number }`
  - `transitionStyles(kind: TransitionKind, progress: number): { incoming: TransitionTransform; outgoing: TransitionTransform }`

- [ ] **Step 1: Write the failing unit tests in `scripts/motion.test.mts`**

Test `stagger`, `typewriter`, `countValue`, `safeStageTop`, `transitionLayers`, and `transitionStyles`, including all Review Focus boundary cases:
- `stagger` returns `0` when `t < start + index * gap` and approaches/hits `1` after `dur` (with `spring` overshoot clamped sensibly or exact `spring` curve).
- `typewriter("hello", 0, 1.0, 20)` returns `""`; at `t = 1.1` returns `"he"`; at `t = 5` returns `"hello"`.
- `countValue(0, 100, t, 2, 1)` returns `0` for `t <= 2`, `100` for `t >= 3`, and intermediate value at `t = 2.5`.
- `safeStageTop("Satu baris", null) < safeStageTop("Baris satu\nBaris dua", "chip")` and stays well above `CAPTION_SAFE_BOTTOM` (`1230`).
- `transitionLayers` on shot 0 at `t = 0` returns `{ activeIdx: 0, prevIdx: null, progress: 1 }`.
- `transitionLayers` at `shot[1].s + 0.18` returns `{ activeIdx: 1, prevIdx: 0, progress: 0.5 }`.
- `transitionLayers` when `shot[1]` has `dur = 0.2` (`< 0.36`) at `shot[1].s + 0.1` clamps transition duration cleanly without `NaN` and reaches `progress = 1` at `shot[1].e`.
- `transitionLayers` when `t >= lastShot.e` clamps to `{ activeIdx: lastIdx, prevIdx: null, progress: 1 }`.
- `transitionStyles` for all 5 `TransitionKind` values returns finite opacity in `[0, 1]` and valid transform/clip values at `progress = 0`, `0.5`, `1`.

- [ ] **Step 2: Run `npm test` to verify tests fail**

Run: `npx tsx --test scripts/motion.test.mts`
Expected: FAIL (`Cannot find module '../src/engine/motion/math.ts'`)

- [ ] **Step 3: Implement `src/engine/motion/math.ts`**

Implement the exact exported types and pure functions above using `clamp`, `lerp`, `smooth`, `ramp`, `spring` (without any `three`, `Math.random`, or DOM dependencies).
- `safeStageTop(title, under)`: matches `Overlays.tsx` header math (`178 + 40 + 69 * title.split("\n").length + 22` + `chip: 126 | cta: 88 | null: 0` + `24`).
- `transitionLayers(shots, t)`: finds active shot index (`shots.findIndex((s) => t >= s.s && t < s.e)`, defaulting to `shots.length - 1` when `t >= last.e`, `0` when `t < shots[0].s`); if `activeIdx > 0`, computes `win = Math.min(TRANSITION_DUR, Math.max(1e-4, shots[activeIdx].e - shots[activeIdx].s))` and `raw = (t - shots[activeIdx].s) / win`; if `raw < 1`, returns `{ activeIdx, prevIdx: activeIdx - 1, progress: smooth(raw) }`, else `{ activeIdx, prevIdx: null, progress: 1 }`.
- `transitionStyles(kind, progress)`: computes `{ incoming, outgoing }` CSS-ready transforms (`opacity`, `translateX`, `translateY`, `scale`, `clipInsetRight`, `wipeGlowOpacity`).

- [ ] **Step 4: Run `scripts/motion.test.mts` to verify it passes**

Run: `npx tsx --test scripts/motion.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/motion/math.ts scripts/motion.test.mts
git commit -m "feat(motion): add deterministic timing, safe-zone, and transition math"
```

---

### Task 2: Engine Types, Theme-Aware Overlays, and Dual-Mode `Explainer.tsx`

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/overlays/Overlays.tsx`
- Modify: `src/engine/Explainer.tsx`
- Create: `src/engine/motion/MotionStage.tsx` (initial shell with Backdrop + Transition compositor; blocks added in Task 4)

**Interfaces:**
- Consumes: `TransitionKind`, `transitionLayers`, `transitionStyles`, `safeStageTop`, `CAPTION_SAFE_BOTTOM` from `src/engine/motion/math.ts`
- Produces:
  - Updated `src/engine/types.ts`:
    - `OverlayTheme = "cream" | "dark-tech"`
    - `MotionFrameCtx = { t: number; local: number; dur: number; progress: number }`
    - `MotionShotDef = { label: string; title: string; tag?: string; transition?: TransitionKind; chip?: (t: number) => ChipState | null; render: (frame: MotionFrameCtx) => React.ReactNode }`
    - `VideoDef3D` (`mode?: "3d"`, existing fields) & `VideoDefMotion` (`mode: "motion"`, `theme?: OverlayTheme`, `shots: (ctx: Ctx) => Record<string, MotionShotDef>`)
    - `VideoDef = VideoDef3D | VideoDefMotion`
  - Updated `Overlays` props: `{ video: VideoDef; shot: Pick<ShotDef, "label" | "title" | "tag" | "chip" | "callouts">; shotStart: number; t: number; pose?: CamPose; theme?: OverlayTheme }`
  - `MotionStage` component in `src/engine/motion/MotionStage.tsx`: `{ video: VideoDefMotion; ctx: Ctx; t: number }`

- [ ] **Step 1: Update `src/engine/types.ts` with `MotionShotDef`, `OverlayTheme`, and `VideoDef` union**

Keep all existing exports (`Vec3`, `Word`, `Chunk`, `Line`, `ShotSpan`, `Timeline`, `Ctx`, `CamPose`, `CalloutDef`, `ChipState`, `ShotDef`, `WorldApi`, `VideoDef`) intact so `karbon-norwegia` and `scripts/build-timeline.mts` require zero changes.

- [ ] **Step 2: Update `src/engine/overlays/Overlays.tsx` to support `theme?: OverlayTheme` (default `"cream"`)**

- When `theme === "cream"` (default): render identical colors, gradient, callouts, chip, CTA, captions, and cream cut flash as today.
- When `theme === "dark-tech"`:
  - Top gradient fade uses `#0b0f17` (`rgba(11,15,23,0.96)` -> `0`).
  - Header label color `#7fe3c4`, title color `#f8fafc`, `*highlight*` color `#7fe3c4`.
  - Brand pill: dark glass (`background: "#111a2b"`, `border: "1px solid rgba(127, 227, 196, 0.35)"`, text `#ffffff` + `#7fe3c4`).
  - Tag pill: `rgba(15, 23, 42, 0.85)`, border `1px solid rgba(56, 189, 248, 0.3)`, color `#bae6fd`.
  - Chip: dark glass (`background: "rgba(15, 23, 42, 0.9)"`, border `#38bdf8` or `#f87171` when `red`), key tab `#0b0f17`.
  - CTA pill: dark glass (`background: "rgba(15, 23, 42, 0.92)"`, `border: "2px solid rgba(127, 227, 196, 0.55)"`, color `#f8fafc`, icon stroke `#7fe3c4`).
  - Captions: `background: "rgba(11, 15, 23, 0.92)"`, `border: "1px solid rgba(56, 189, 248, 0.3)"`, keep `CAPTION_TOP = 1270` and `lineHeight: 1.8`.
  - Cut flash: disabled (`0`) in `"dark-tech"` mode.
  - Only render `<Callouts>` when `pose` is provided and `shot.callouts?.length`.

- [ ] **Step 3: Create `src/engine/motion/MotionStage.tsx`**

- Renders `<AbsoluteFill>` with Dark Tech Studio radial navy gradient (`#0b0f17` → `#132238`), subtle `48px` cyan technical grid (`rgba(56, 189, 248, 0.055)`), and two soft radial ambient glow blobs positioned deterministically via `sway(t, 1)` and `sway(t, 2)`.
- Uses `transitionLayers(video.timeline.shots, t)` to compute `activeIdx`, `prevIdx`, and `progress`.
- Computes `stageTop = safeStageTop(activeShot.title, ctaOn ? "cta" : activeShot.chip?.(t) ? "chip" : null)` and bounds the stage container strictly to `top: stageTop`, `bottom: 1920 - CAPTION_SAFE_BOTTOM`, `left: 64`, `right: 64`, `overflow: "hidden"`, `display: "flex"`, `flexDirection: "column"`, `justifyContent: "center"`.
- Renders outgoing shot (when `prevIdx !== null`) and incoming shot wrapped in `transitionStyles(activeShot.transition ?? "zoom-cross", progress)` transforms (plus glowing cyan leading-edge line for `"wipe"`).

- [ ] **Step 4: Update `src/engine/Explainer.tsx` to branch on `video.mode === "motion"`**

- Keep `audioOnly` identical.
- If `video.mode === "motion"`: compute `span = shotAt(video.timeline, t)` and `shot = shots[span.id]`, render `<AbsoluteFill style={{ backgroundColor: "#0b0f17" }}>`, `<MotionStage video={video} ctx={ctx} t={t} />`, `<Overlays video={video} shot={shot} shotStart={span.s} t={t} theme={video.theme ?? "dark-tech"} />`, and `{audio}` — zero `<ThreeCanvas>`.
- Else: execute existing 3D `<ThreeCanvas>` + `<Overlays>` unchanged.

- [ ] **Step 5: Run `npm run lint` and `npm test` to verify everything compiles cleanly**

Run: `npm run lint && npm test`
Expected: PASS with zero TypeScript or ESLint errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/overlays/Overlays.tsx src/engine/Explainer.tsx src/engine/motion/MotionStage.tsx
git commit -m "feat(engine): add dual-mode 2D motion stage and dark-tech overlay theme"
```

---

### Task 3: Built-In Dark Tech Icon & Color Token Library (`src/engine/motion/icons.tsx`)

**Files:**
- Create: `src/engine/motion/icons.tsx`

**Interfaces:**
- Produces:
  - `DARK_TECH` palette object (`bg`, `surface`, `surfaceAlt`, `border`, `mint`, `cyan`, `violet`, `amber`, `red`, `ink`, `muted`)
  - `TechIconName` union: `"sparkle" | "terminal" | "code" | "brain" | "bot" | "folder" | "file" | "git" | "plug" | "shield" | "lock" | "image" | "video" | "clock" | "bolt" | "check" | "x" | "warning" | "search" | "copy" | "sliders" | "layers" | "database" | "globe"`
  - `TechIcon: React.FC<{ name: TechIconName; size?: number; color?: string; accent?: string }>`

- [ ] **Step 1: Create `src/engine/motion/icons.tsx`**

Define `DARK_TECH` color constants and `TechIcon` rendering clean, crisp 24×24 viewBox duotone/stroke SVG icons for every `TechIconName` (using deterministic SVG paths only, no external images). Export `TECH_ICON_NAMES` array for validation/test coverage.

- [ ] **Step 2: Add icon exhaustiveness check in `scripts/motion.test.mts`**

Verify `TECH_ICON_NAMES` contains all 24 expected icon names with no duplicates and `DARK_TECH` has non-empty hex/rgba tokens.

- [ ] **Step 3: Run `npm run lint && npm test`**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/motion/icons.tsx scripts/motion.test.mts
git commit -m "feat(motion): add Dark Tech Studio tokens and built-in vector icon set"
```

---

### Task 4: Composable Motion-Graphics Blocks (`src/engine/motion/blocks.tsx` & `src/engine/motion/index.ts`)

**Files:**
- Create: `src/engine/motion/blocks.tsx`
- Create: `src/engine/motion/index.ts`

**Interfaces:**
- Consumes: `stagger`, `typewriter`, `countValue`, `TransitionKind` from `./math`, `DARK_TECH`, `TechIcon`, `TechIconName` from `./icons`, `clamp`, `ramp`, `spring`, `sway` from `../math`
- Produces:
  1. `KineticHeadline`: `{ t: number; at: number; kicker?: string; text: string; sub?: string; align?: "left" | "center" }` — word-by-word spring reveal with `*accent*` highlight spans.
  2. `NodeFlow`: `{ t: number; direction?: "vertical" | "horizontal"; nodes: Array<{ id: string; icon: TechIconName; title: string; subtitle?: string; badge?: string; accent?: "mint" | "cyan" | "amber" | "red"; at: number; activeAt?: number }> }` — animated step/architecture cards with glowing SVG connector lines and travelling pulse dot.
  3. `TerminalCard`: `{ t: number; title?: string; lines: Array<{ text: string; kind?: "cmd" | "info" | "ok" | "err" | "dim"; at: number; highlight?: boolean }> }` — dark terminal window with deterministic `typewriter` for `"cmd"` lines and staggered reveal for output lines.
  4. `PromptCard`: `{ t: number; title?: string; badge?: string; copyHint?: string; sections: Array<{ role: string; text: string; accent?: "mint" | "cyan" | "amber" | "violet"; at: number; activeAt?: number }> }` — structured prompt anatomy card with role chips and active spotlighting.
  5. `ComparisonSplit`: `{ t: number; before: { label: string; title: string; points: string[]; at: number }; after: { label: string; title: string; points: string[]; at: number } }` — red-accented anti-pattern vs mint-accented winning workflow/prompt.
  6. `MetricPanel`: `{ t: number; headline?: { label: string; from: number; to: number; unit?: string; decimals?: number; at: number; dur?: number }; bars?: Array<{ label: string; value: number; max?: number; display?: string; accent?: "mint" | "cyan" | "amber"; at: number }>; meter?: { label: string; used: number; total: number; unit?: string; at: number } }` — animated `fmtID` counter, horizontal benchmark bars, and segmented context-window meter.
  7. `BentoGrid`: `{ t: number; columns?: 1 | 2; items: Array<{ icon: TechIconName; title: string; detail: string; accent?: "mint" | "cyan" | "amber" | "violet"; at: number; activeAt?: number }> }` — compact bento cards with spring entry and active highlight border.
  8. `IllustrationStage`: `{ t: number; at: number; title?: string; caption?: string; variant?: "photo-wipe" | "mcp-bridge" | "doc-to-json" | "custom"; children?: React.ReactNode }` — built-in animated vector illustrations (before/after wipe slider, MCP client-to-tools bridge, unstructured doc → structured JSON card) plus `children` slot for bespoke inline SVGs.
- `src/engine/motion/index.ts` re-exports all of the above plus math helpers and `MotionStage`.

- [ ] **Step 1: Implement `src/engine/motion/blocks.tsx`**

Build all 8 blocks using inline styles driven strictly by `t`, `FONT` from `../fonts`, `DARK_TECH`, and `TechIcon`. Ensure compact sizing so typical 3–4 node flows or 2×2 bento grids fit comfortably inside the ~740px stage height without overflowing or clipping. Avoid CSS `@keyframes` or CSS `transition`.

- [ ] **Step 2: Create `src/engine/motion/index.ts` barrel export**

Re-export `blocks`, `icons`, `math`, and `MotionStage`.

- [ ] **Step 3: Run `npm run lint && npm test`**

Run: `npm run lint && npm test`
Expected: PASS (no Remotion ESLint warnings/errors, no unused locals, strict TypeScript clean).

- [ ] **Step 4: Commit**

```bash
git add src/engine/motion/blocks.tsx src/engine/motion/index.ts
git commit -m "feat(motion): add Dark Tech Studio infographic, UI, and illustration blocks"
```

---

### Task 5: Hard CI Gates for AI Labs (`scripts/account-core.mts`, `scripts/account-gate.mts`, `scripts/account-core.test.mts`)

**Files:**
- Modify: `scripts/account-core.mts`
- Modify: `scripts/account-gate.mts`
- Modify: `scripts/account-core.test.mts`

**Interfaces:**
- Consumes: `Account` from `src/accounts.ts`, `brandProblems`, `accountProblems` in `scripts/account-core.mts`
- Produces:
  - `aiLabsVideoProblems(opts: { indexSource: string; shotsSource: string | null; hasWorldFile: boolean; publishJson: { description?: unknown } | null; naskahText: string | null }): string[]` in `scripts/account-core.mts`

- [ ] **Step 1: Write the failing tests in `scripts/account-core.test.mts`**

Add a `describe("aiLabsVideoProblems", ...)` block testing:
1. Valid motion video without `PromptCard` (`mode: "motion"`, `hasWorldFile: false`, `shotsSource` with `<TerminalCard>`, no prompt block in `description`) → `[]`.
2. Missing `mode: "motion"` in `indexSource` → returns problem mentioning `mode: "motion"`.
3. `hasWorldFile: true` → returns problem rejecting `world.ts`.
4. `shotsSource` uses `PromptCard` + `description` has `"Prompt siap copy:\n\"...\""` + `naskahText` last 3 lines (or `indexSource` `cta.text`) mentions `"deskripsi"` → `[]`.
5. `shotsSource` uses `PromptCard` + `description` lacks `"Prompt siap copy:"` → returns problem mentioning `Prompt siap copy:`.
6. `shotsSource` uses `PromptCard` + `description` has `"Prompt siap copy:"`, but neither `indexSource` CTA nor last 3 lines of `naskahText` mentions `"deskripsi"` → returns problem mentioning `deskripsi`.

- [ ] **Step 2: Run `npm test` to verify new tests fail**

Run: `npx tsx --test scripts/account-core.test.mts`
Expected: FAIL (`aiLabsVideoProblems` is not exported)

- [ ] **Step 3: Implement `aiLabsVideoProblems` in `scripts/account-core.mts` and wire it in `scripts/account-gate.mts`**

- `aiLabsVideoProblems`:
  - Check `/mode\s*:\s*["']motion["']/.test(opts.indexSource)`.
  - If `opts.hasWorldFile`, push `"ai-labs wajib pakai motion graphics (mode: \"motion\"), bukan world.ts 3D"`.
  - Detect prompt card usage via `opts.shotsSource && /\bPromptCard\b/.test(opts.shotsSource)`. When true:
    - Require `typeof opts.publishJson?.description === "string" && /Prompt siap copy:/i.test(opts.publishJson.description)`.
    - Require `/deskripsi/i.test(lastThreeLines(opts.naskahText))` OR `/cta\s*:\s*\{[^}]*deskripsi/is.test(opts.indexSource)`.
- `scripts/account-gate.mts`:
  - When `account.id === "ai-labs"`, read `shots.tsx` (falling back to `shots.ts` if present), check `fs.existsSync(path.join(dir, "world.ts"))`, read `naskah.txt` (if present), and push `...aiLabsVideoProblems(...)` into `problems`.

- [ ] **Step 4: Run `npm run lint && npm test`**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/account-core.mts scripts/account-gate.mts scripts/account-core.test.mts
git commit -m "feat(ci-gate): enforce mode:motion and prompt-in-description rules for ai-labs"
```

---

### Task 6: Update Channel Brief, CI Prompt, and Still-Check Workflow Timing

**Files:**
- Modify: `ops/accounts/ai-labs.md`
- Modify: `scripts/topics.test.mts:19-33`
- Modify: `ops/ci-prompt.md`
- Modify: `.github/workflows/video.yml:207-215`

**Interfaces:**
- Consumes: Component names & props from `src/engine/motion/index.ts`, CI gate markers (`mode: "motion"`, `PromptCard`, `Prompt siap copy:`, `deskripsi`) from Task 5.
- Produces: Updated instructions for the autonomous CI agent and fixed `Still check` frame formula in `.github/workflows/video.yml`.

- [ ] **Step 1: Rewrite `ops/accounts/ai-labs.md` visual, script CTA, and `publish.json` sections**

- Replace `## Scene 3D` with `## Visual: Motion Graphics (Dark Tech Studio)`:
  - Instruct `mode: "motion"` in `src/videos/<slug>/index.ts` (no `fov`, no `createWorld`, no `world.ts`, no `state.ts`, no `Kit`).
  - Show exact import from `../../engine/motion` and document `MotionShotDef`, `TransitionKind` (`"zoom-cross"`, `"slide-up"`, `"slide-left"`, `"wipe"`, `"scale-fade"`), and each block (`KineticHeadline`, `NodeFlow`, `TerminalCard`, `PromptCard`, `ComparisonSplit`, `MetricPanel`, `BentoGrid`, `IllustrationStage`, `TechIcon`) with compact density limits so blocks fit above `y = 1230`.
  - Keep pure-function-of-`t` rule (`ctx.L(n).s` / `ctx.L(n).e`), no `Math.random()`, no CSS `@keyframes`, no live screenshots.
- Update `## Naskah` & `## publish.json`:
  - Explicitly state the **prompt-in-description rule**: whenever the video demonstrates/uses a prompt example (`PromptCard`), include `Prompt siap copy:` with the complete copyable prompt (using `[placeholder]` brackets, never `<placeholder>`) in `publish.json.description` (and `tiktokCaption` if within 2,200 chars), and tell viewers in the closing lines of `naskah.txt` and `cta.text` that the prompt is in the description to copy (`deskripsi`).

- [ ] **Step 2: Update `ops/ci-prompt.md` item 3 & 4**

Clarify that `state.ts` and `world.ts` apply to 3D videos (`kali-aja`, `cerpenek`), whereas `mode: "motion"` videos (`ai-labs`) create `index.ts` and `shots.tsx` (without `world.ts` or `state.ts`).

- [ ] **Step 3: Update `.github/workflows/video.yml` `Still check` frame calculation**

Change line 214 from `Math.floor(s.s*30)+1` to `Math.max(1, Math.floor(Math.min(s.s+0.5, (s.s+s.e)/2)*30))` so every shot still lands past the `0.36s` motion cut transition (and past the `0.16s` 3D flash).

- [ ] **Step 4: Update `scripts/topics.test.mts` and run `npm run lint && npm test`**

Update `"## Scene 3D"` in `scripts/topics.test.mts` `AI Labs brief` test to `"## Visual: Motion Graphics"` (and assert `mode: "motion"` and `Prompt siap copy:` are documented). Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ops/accounts/ai-labs.md scripts/topics.test.mts ops/ci-prompt.md .github/workflows/video.yml
git commit -m "docs(ai-labs): switch brief and CI still-check timing to motion graphics"
```

---

### Task 7: End-to-End Smoke Verification & Visual Still Inspection

**Files:**
- Temporary only (deleted before finish): `src/videos/_smoke-ai-motion/*`, `public/_smoke-ai-motion/*`, temporary edit to `src/videos/registry.ts`

- [ ] **Step 1: Create a temporary local AI Labs motion-graphics test video `_smoke-ai-motion`**

Include 5 shots exercising `KineticHeadline`, `NodeFlow`, `TerminalCard`, `PromptCard`, `ComparisonSplit`, `MetricPanel`, `BentoGrid`, `IllustrationStage`, and multiple `TransitionKind`s, plus valid `publish.json` (`account: "ai-labs"`, `Prompt siap copy:` in `description`), `naskah.txt` (mentioning `deskripsi` at the end), `config.json`, `timeline.json` (via `npm run timeline -- _smoke-ai-motion` using a minimal `alignment.json` + synthesized/silent `vo.mp3` or `music.wav`).

- [ ] **Step 2: Run `account-gate.mts`, `npm run lint`, `npm test`, and `npx remotion bundle`**

Run:
- `npx tsx scripts/account-gate.mts --account ai-labs --slug _smoke-ai-motion`
- `npx tsx scripts/music.mts --missing`
- `npm run lint && npm test && npx remotion bundle --out-dir /tmp/opencode/rbundle-smoke`
Expected: All pass cleanly.

- [ ] **Step 3: Render stills for every shot (settled + mid-transition) and a `karbon-norwegia` regression still**

Run `npx remotion still /tmp/opencode/rbundle-smoke _smoke-ai-motion /tmp/opencode/smoke-<shot>.jpg --frame=<settled_frame> --gl=swangle --image-format=jpeg` for each shot + one mid-transition frame, plus one still of `karbon-norwegia` to verify zero 3D regression.

- [ ] **Step 4: Inspect every rendered JPEG with `read`**

Verify:
- Dark Tech Studio aesthetic (navy grid, glowing accents, crisp typography, icons, cards).
- Zero overlap between stage blocks and header/CTA/chip/karaoke captions.
- Mid-transition frame blends smoothly without clipped artifacts.
- `karbon-norwegia` still looks unchanged.

- [ ] **Step 5: Clean up temporary `_smoke-ai-motion` files and re-run final verification**

Remove `src/videos/_smoke-ai-motion`, `public/_smoke-ai-motion`, restore `src/videos/registry.ts` to its exact pre-smoke state, and run `npm run lint && npm test`.
Expected: Clean git status (only intended commits) and passing lint + tests.
