# Design: Richer Visual Detail & Line-Beat Animations Across All Channels

**Date:** 2026-11-20
**Status:** Ready for user approval (builder check complete)

## Intent / Why

Generated Shorts across all four channels (**Kali Aja Tau**, **Cerpenek**, **Sastra Mesin**, and **AI Labs**) currently feel static, blocky, and repetitive when watched:
1. **Blocky, low-detail 3D scenes:** `Kit` (`src/engine/kit.ts`) only provides basic primitives (`box`, `cyl`, `ball`) plus a few island/character prefabs. When the autonomous CI agent (`deepseek-v4.1-flash-free`) builds mechanisms, buildings, or props, it stacks flat boxes and cylinders with very little mechanical or environmental detail.
2. **Weak line-by-line narration sync:** Scenes often hold a single slow camera drift for an entire 6–10 second shot while spoken lines pass by without corresponding visual state changes. Viewers hear new facts or actions in the voiceover without seeing parts activate, open, flow, or react at that exact beat.
3. **Monotonous 2D motion cards (`ai-labs`):** Shots typically show one static-feeling block (`BentoGrid`, `TerminalCard`, `NodeFlow`, etc.) with only 3 built-in SVG illustrations, rather than evolving step-by-step with each spoken line.
4. **No motion/beat verification in CI:** `scripts/account-gate.mts` and the `video.yml` still check only verify brand strings, audio sync, and a single still frame per shot (`> 10 KB`). A completely frozen shot or a script that ignores half its `L(n)` lines passes CI unchecked.

This project upgrades both visual engines, adds line-by-line beat choreography helpers, updates all four channel briefs, and adds a fast deterministic pre-render motion & choreography gate — while keeping each channel's existing overlay/caption layout unchanged.

## Goals, Non-Goals, and Anti-Goals

### Goals
- **Richer 3D detail without hurting `--gl=swangle` CPU render speed:** Extend `Kit` (`src/engine/kit.ts`) with reusable mechanical, cutaway, flow, and diorama-life builders using low-cost Three.js geometries and `InstancedMesh`.
- **Line-by-line narration choreography:** Provide simple, composable timing helpers in `src/engine/math.ts` so every spoken line `L(n)` visibly drives a reaction (part activation, cutaway reveal, character gesture/expression, particle flow surge, or camera micro-focus).
- **More dynamic `ai-labs` motion shots:** Add line-synced beat progression, subtle stage camera drift, animated SVG data-packet flow, and new `IllustrationStage` variants in `src/engine/motion/`.
- **Enforce quality before the 40-minute render:** Add a fast (< 2s) deterministic gate (`scripts/check-motion.mts`, wired into `video.yml`) that checks `L(n)` coverage, intra-shot object/camera motion across sampled timestamps, and minimum scene richness.
- **Clear agent guidance:** Update `docs/AUTOPILOT.md` and `ops/accounts/{cerpenek,sastra-mesin,ai-labs}.md` so `deepseek-v4.1-flash-free` uses the new building blocks and beat helpers consistently.

### Non-Goals
- Changing overlay layouts, fonts, header positions, callout auto-pinning, or karaoke caption styling/chunking (`src/engine/overlays/Overlays.tsx`, `scripts/timeline-core.mts`).
- Changing TTS (`scripts/tts.mts`), offline alignment, music synthesis (`scripts/music.mts`), or Buffer/Cloudinary publishing (`scripts/publish.mts`).
- Adding environment maps (IBL), bump maps, VSM shadows, or post-processing passes — these remain banned because they triple SwiftShader (`--gl=swangle`) CPU render time.
- Building a runtime vision/screenshot critique loop for the CI agent.

### Anti-Goals
- Making `Kit` helpers so complex or verbose that `deepseek-v4.1-flash-free` hits its CI timeout or introduces TypeScript errors.
- Breaking `scripts/topics.test.mts`, `scripts/motion.test.mts`, `scripts/account-core.test.mts`, or `scripts/overlays.test.mts` assertions on existing channel briefs and components.
- Introducing non-deterministic animations (`Math.random()`, `Date.now()`, cross-frame mutable state) that fail under Remotion's parallel frame/shard rendering.

## Constraints

- **Pure Function of `t`:** Every 3D transform, material property, instanced matrix, and 2D React style must remain a pure deterministic function of `t` (seconds) and `timeline.json`.
- **CPU Render Budget (`--gl=swangle`):** Keep segment counts modest (≤ 24 radial segments for curved tubes/gears), prefer `InstancedMesh` for repeated elements (bubbles, sparks, clouds, flow dots, rivets), and avoid extra shadow-casting lights beyond `kit.lights()`.
- **Existing Brief & Gate Contracts:**
  - `cerpenek` keeps `tanpa callouts` and its prefab assertions in `scripts/topics.test.mts`.
  - `sastra-mesin` keeps `theme: "blueprint"` and `world.ts`.
  - `ai-labs` keeps `mode: "motion"`, `captions: false`, and `y = 1480` safe bottom.
  - `kali-aja` keeps its `cream` overlay theme and `docs/AUTOPILOT.md` rules.
- **Standalone CI Verification:** The new motion gate (`scripts/check-motion.mts`) must be able to evaluate a generated `src/videos/<slug>/` video deterministically in Node/tsx without launching Chrome or WebGL, or by using a lightweight JS simulation / AST + runtime world evaluation.

## Approaches Considered

| Approach | How it works | Trade-offs | Decision |
|---|---|---|---|
| **1. Composable Engine Upgrade + Line-Beat Choreography + Motion Gate** | Upgrade `Kit` with CPU-cheap mechanical/diorama builders, add `L(n)` beat/pulse/focus helpers in `math.ts`, add multi-beat & diagram helpers to `engine/motion/`, update all 4 briefs, and enforce with a fast pre-render gate. | Preserves per-topic visual originality and stays fast on `--gl=swangle`; relies on CI agent wiring the improved primitives, verified by the new gate. | **Selected by user** |
| 2. Pre-Built Declarative Scene Templates | Replace custom per-video `world.ts` / `shots.tsx` with 5–6 fixed parameterized templates driven by JSON config. | High consistency, low agent failure rate, but videos across a channel quickly look identical regardless of topic. | Rejected |
| 3. Multi-Pass Vision Critique Loop in CI | Render sample frames per shot, inspect with a VLM, and rewrite scene code iteratively. | Not viable on `deepseek-v4.1-flash-free` (no vision, already near CI timeout). | Rejected |

## Architecture & Design

### 1. Line-by-Line Beat Choreography Helpers (`src/engine/math.ts`)

Currently, videos mainly use `ramp(t, L(n).s, L(n).e)` or `spring((t - L(n).s) / d)` ad hoc. Add concise, self-documenting helpers to `src/engine/math.ts` (and re-export in `src/engine/motion/math.ts` where pure):

1. **`beat(t: number, line: Line, lead = 0.28): number`**
   - Returns `0` before `line.s`, springs smoothly (`spring`) to `1` over `lead` seconds as the line begins, and stays `1` afterward.
   - Replaces repetitive `spring((t - L(n).s) / 0.3)` boilerplate so activating an object on a line is a 1-expression call.
2. **`pulse(t: number, line: Line, fade = 0.22): number`**
   - Returns `0` outside `[line.s, line.e]`, ramps smoothly up to `1` over `fade` seconds at the start of the line, holds `1`, and ramps back to `0` over `fade` seconds at the end of the line (clamped cleanly if `line.e - line.s < 2 * fade`).
   - Drives "currently being explained" highlights: emissive glow intensity, scale emphasis (`1 + 0.08 * pulse(...)`), callout focus, or motion card spotlighting.
3. **`between(t: number, fromLine: Line, toLine: Line, fade = 0.25): number`**
   - Returns `0..1` window spanning multiple consecutive lines (`fromLine.s` to `toLine.e`), ideal for cutaway shell open/close states or multi-line sub-processes.
4. **`stepIndex(t: number, lines: readonly Line[]): number`**
   - Pure helper returning `-1` before `lines[0].s`, or the index `0..lines.length - 1` of the latest line whose `.s <= t`. Simplifies sequential multi-step progression in both 3D worlds and 2D motion blocks.
5. **`focusOffset(t: number, cues: Array<{ at: number; offset: Vec3; targetOffset?: Vec3 }>, transition = 0.35): { position: Vec3; target: Vec3 }`** (or `cameraBeat(base: CamPose, ...)`):
   - Lets a `camera(t)` function smoothly nudge camera position/target toward a sub-component right when a specific `L(n)` line is spoken, eliminating 8-second static/linear camera holds without breaking `keyframes()` / `orbit()`.

### 2. 3D `Kit` Upgrades (`src/engine/kit.ts`)

All new builders live on `Kit`, use `this.resolve(...)` / `this.add(...)`, keep shadows optional for tiny decorative parts, and return handle objects whose sub-meshes/pivots are cleanly animatable in `update(t)`:

#### 2.1 Mechanical, Fluid & Explainer Prefabs (Kali Aja Tau & Sastra Mesin)
1. **`kit.tube(points: Vec3[], r: number, m: string | Material, o?: { tubularSegments?: number; radialSegments?: number; parent?: Object3D })`**
   - Uses `CatmullRomCurve3` + `TubeGeometry` (defaults: `tubularSegments = 28`, `radialSegments = 10` — smooth silhouette, low triangle count). Enables curved pipes, copper wiring, blood vessels, rivers, and ducts instead of angled box segments.
   - Also exposes a companion pure helper **`sampleCurve(points: Vec3[], u: number): Vec3`** (or returns `{ mesh, at(u: number): Vec3 }` on the handle) so particles/objects can travel smoothly along the exact same curve.
2. **`kit.flowDots(points: Vec3[], count: number, color: string, o?: { r?: number; speed?: number; spread?: number })`**
   - Builds an `InstancedMesh` of small glowing spheres (`r = 0.045` default) with a `.update(t, rate = 1, active = true)` helper that integrates or advances deterministic phases `(i / count + t * speed * rate) % 1` along `CatmullRomCurve3`.
   -Note on varying speed: supports passing an integrated `phaseOffset` (or `active` scale `0..1`) so callers adhere to the hard rule ("integrate rate from 0 to `t`, never `t * speed` when speed changes").
3. **`kit.gear(x: number, y: number, z: number, o: { r?: number; thickness?: number; teeth?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D })`**
   - Procedural toothed gear built from a hub cylinder, rim, and `teeth` bevelled/box cogs grouped around a centered pivot so rotating around `axis` spins cleanly in `update(t)`.
4. **`kit.fan(x: number, y: number, z: number, o: { r?: number; blades?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D })`**
   - Centered hub + pitched blades (3–6 blades), returns `{ root, rotor }` so `rotor.rotation[axis]` spins turbines, propellers, cooling fans, or wind rotors.
5. **`kit.coil(x: number, y0: number, z: number, o: { r?: number; tubeR?: number; h?: number; turns?: number; color?: string | Material; parent?: Object3D })`**
   - Helical `TubeGeometry` for compression springs, heating elements, induction coils, and shock absorbers. Scaling `root.scale.y` compresses/extends the spring cleanly.
6. **`kit.arrow(from: Vec3, to: Vec3, color: string | Material, o?: { r?: number; headR?: number; parent?: Object3D })`**
   - Clean 3D cylinder shaft + cone tip oriented from `from` to `to`, useful for force, heat, current, or pressure vectors; returns `{ root, setProgress(u) }` to grow/pulse along the vector.
7. **`kit.ring(x: number, y: number, z: number, r: number, tubeR: number, m: string | Material, o?: { rot?: Vec3; parent?: Object3D })`**
   - `TorusGeometry` for seals, gaskets, magnetic field rings, pipe flanges, and water ripples.
8. **`kit.cutawayShell(parts: Object3D[], slideOffset: Vec3)`** (or pure helper **`cutaway(group: Object3D, openU: number, offset: Vec3)`**)
   - Slides an outer casing smoothly aside (`lerp3([0,0,0], offset, openU)`) and/or adjusts opacity/visibility when `openU >= 0.99`, making "outside → cutaway inside" reveals effortless in every explainer.
9. **`kit.glow(mat: MeshStandardMaterial, color: string, intensity: number)`** (or `kit.activeMat(baseColor, surface, emissiveColor)`)
   - Allows `update(t)` to drive `mat.emissiveIntensity = pulse(t, L(n)) * 0.8` without sharing mutated state across unrelated meshes (creates an uncached or per-part material instance when requested via `{ unique: true }` or dedicated `glowMat()`).

#### 2.2 Diorama Life & Storytelling Upgrades (Cerpenek & Environmental Scenes)
1. **`kit.figure(...)` richer articulation & expressions:**
   - Keep existing `{ root, head, armL, armR, legL, legR }` return contract 100% backward compatible, and add `eyesL`, `eyesR` (or `blinkGroup`) + `torso` pivot so characters can breathe subtly, blink deterministically (`Math.sin(...) > 0.96`), nod while speaking, and tilt their torso when walking/reaching.
   - Add an optional `prop` helper or `handAnchor` (`armR` tip) plus **`kit.prop(kind, ...)`** for common story objects (`"lantern"`, `"crate"`, `"pot"`, `"scroll"`, `"torch"`, `"flower"`, `"rock"`), replacing bare boxes with recognizable wooden-toy props.
2. **`kit.cloud(x, y, z, s)`** & **`kit.ripple(x, z, maxR, color)`**:
   - Soft clustered low-poly clouds that drift gently across the sky dome (`sway`), and expanding concentric water rings around `kit.boat` or `kit.swimmer`.
3. **`poseFigure(fig, t, mode, seed)`** helper (in `kit.ts` or `math.ts`):
   - Pure per-frame pose presets: `"idle"` (gentle breathing + blink + sway), `"talk"` (gesturing `armR`, slight head nod), `"walk"` (alternating legs & counter-swinging arms), `"wave"`, `"sad"` (drooped head & shoulders), `"point"`. Ensures Cerpenek characters are never frozen mannequins.

### 3. Dynamic `ai-labs` Motion Graphics Upgrades (`src/engine/motion/`)

Keep the 8 block names and Dark Tech Studio palette intact, while upgrading them so shots react line-by-line to narration:

1. **`MotionStage.tsx` subtle camera drift & beat-synced backdrop:**
   - Add a gentle, deterministic micro-drift (`sway(t)` within ±6 px / scale `1.0..1.025`) to the stage wrapper so even quiet reading beats have subtle cinematic motion.
   - Add an optional `beatPulse?: number` or `accent?: AccentKey` subtle radial pulse behind the active block when lines change.
2. **Inline line-by-line focus / annotation across blocks (`blocks.tsx`):**
   - Add optional `activeAt?: number` / `until?: number` support cleanly across `TerminalLine`, `MetricPanel` bars, and `ComparisonSide` points (joining `NodeFlow`, `PromptCard`, `BentoGrid` which already have `activeAt`), dimming inactive items slightly (`opacity: 0.55`) while spotlighting the currently narrated item with a subtle scale + glow border.
   - Add a new lightweight **`BeatCallout`** (or `StepBadge`) sub-component exported from `src/engine/motion` that can float a crisp animated pill (`"1. Parse"`, `"2. Validate"`) anchored above/beside a block timed to `L(n).s`.
3. **More `IllustrationStage` variants (`src/engine/motion/blocks.tsx`):**
   - Currently `variant` only has `"photo-wipe" | "mcp-bridge" | "doc-to-json" | "custom"`. Add 3 high-utility animated SVG presets tailored to AI Labs' backlog:
     - `"agent-loop"`: Think → Tool Call → Observe → Verify circular loop with a moving glowing token synchronized to `t`.
     - `"context-window"`: Token blocks filling a memory bar, showing compaction/pruning vs overflow.
     - `"code-diff"`: Side-by-side / unified red-to-mint diff lines scanning into place with a checkmark verification badge.
   - Allow passing optional `activeStep?: number` (or `progress?: number`) to `IllustrationStage` so the agent can sync SVG highlights directly to `stepIndex(t, [...])` or `L(n)`.

### 4. Channel Brief Updates (`docs/AUTOPILOT.md`, `ops/accounts/*.md`)

Update all 4 channel briefs with concrete, concise instructions and copy-pasteable code patterns (preserving every existing test assertion in `scripts/topics.test.mts`):

1. **`docs/AUTOPILOT.md` (Kali Aja Tau):**
   - Document the new `Kit` mechanical/flow helpers (`tube`, `gear`, `fan`, `coil`, `arrow`, `flowDots`, `cutaway`, `glowMat`) and `beat`/`pulse`/`between` helpers.
   - Mandate **line-beat choreography**: every shot must wire its sub-animations to the specific `L(n)` lines spoken during that shot (not a single `ramp` across the whole shot), and use at least one dynamic mechanism (flowing `flowDots`, spinning `gear`/`fan`, sliding cutaway shell, or pulsing `glowMat`).
   - Require `keyframes` with ≥ 2 distinct camera poses + subtle `focusOffset` or motion per shot.
2. **`ops/accounts/sastra-mesin.md` (Sastra Mesin):**
   - Emphasize cutaway/exploded shells (`cutaway`) paired with `tube`, `gear`, `coil`, `fan`, and `flowDots` colored strictly by physical semantics (`#20C9C3` cyan energy/fluid, `#FF8A36` orange heat/moving mechanics, `#81909C` steel frame).
   - Mandate line-synced mechanical cause-and-effect: when `L(k)` explains part A pushing part B, `beat(t, L(k))` / `pulse(t, L(k))` drives that exact motion and highlights that part.
3. **`ops/accounts/cerpenek.md` (Cerpenek):**
   - Document `poseFigure(fig, t, mode, seed)`, `kit.cloud(...)`, `kit.prop(...)`, and `kit.ripple(...)`.
   - Mandate that every character visible in a shot uses `poseFigure` switched per line (`L(n)`) — e.g. `"walk"` while arriving, `"talk"` while speaking, `"sad"` or `"wave"` at emotional beats — plus drifting clouds and water ripples when water is present.
4. **`ops/accounts/ai-labs.md` (AI Labs):**
   - Require every `MotionShotDef` to bind at least 2–3 internal beats (`at` / `activeAt`) to `ctx.L(n).s` rather than animating everything in at `shot.s`, and document the new `IllustrationStage` variants (`"agent-loop"`, `"context-window"`, `"code-diff"`) and `BeatCallout`.

### 5. Fast Deterministic Pre-Render Motion & Choreography Gate (`scripts/check-motion.mts` + `scripts/motion-gate-core.mts`)

Add a deterministic check that runs in `build` (right after `check-sync` and before `stills` / the 40-minute shard render) via `npm run check-motion -- <slug>`:

1. **Line-beat coverage check (source + timeline analysis):**
   - Parse `state.ts`, `world.ts`, `shots.ts` (or `shots.tsx` for `mode: "motion"`), and `index.ts`.
   - Verify that `L(...)` references cover **at least 70%** of the lines in `naskah.txt` (excluding pure metadata/empty lines), ensuring the agent did not just wire `L(1)` and `L(last)` while leaving the middle un-choreographed.
   - Verify no `Math.random` or `Date.now` calls exist in any video source file.
2. **3D Intra-shot motion & scene richness check (for `mode !== "motion"`):**
   - Evaluate `video.createWorld(ctx)` and `video.shots(ctx)` directly in Node (Three.js scene graph works headlessly in Node with zero WebGL context!).
   - Sample 3 timestamps per shot (`s + 0.1 * dur`, `s + 0.5 * dur`, `s + 0.9 * dur`):
     - Compute camera pose difference across the shot: assert camera position or target moves noticeably (or an object moves if camera is locked).
     - Traverse `world.root` and record world matrices / positions / rotations / scales / `InstancedMesh` matrices / `material.emissiveIntensity` across the 3 samples: assert **at least one non-camera scene property changes inside every shot** (catches frozen dioramas where only the camera pans!).
     - Check scene richness: verify `world.root` contains a minimum count of distinct meshes/instances (e.g., ≥ 15 mesh/instanced nodes) so a bare 3-box scene fails fast before wasting 40 minutes of CI render time.
3. **2D Motion shot beat density check (for `mode === "motion"`):**
   - Render `shot.render(frame)` with React (`renderToStaticMarkup` from `react-dom/server`) at 3 timestamps per shot (`s + 0.05 * dur`, `s + 0.5 * dur`, `s + 0.92 * dur`) and assert the serialized markup changes within every shot (proving elements actually animate/enter/highlight during the shot rather than appearing frozen).

### 6. Testing & Verification

- Unit tests in `scripts/kit.test.mts` (or extending `scripts/motion.test.mts`):
  - Pure math helpers (`beat`, `pulse`, `between`, `stepIndex`, `focusOffset`) produce finite, clamped, monotonic/expected values at boundary timestamps.
  - `Kit` builders (`tube`, `gear`, `fan`, `coil`, `arrow`, `ring`, `flowDots`, `cloud`, `prop`, `poseFigure`) build valid Three.js subtrees in headless Node without errors and mutate cleanly as pure functions of `t`.
  - New `IllustrationStage` variants and `blocks.tsx` `activeAt` props render cleanly across timestamps.
- Unit tests in `scripts/motion-gate.test.mts`:
  - Verify `check-motion` rejects a frozen 3D shot, a bare `< 15` mesh scene, `Math.random()`, low `L(n)` coverage, and a static 2D motion shot; verify it accepts a well-choreographed synthetic 3D and 2D video.
- Update `scripts/topics.test.mts` if needed so all brief assertions pass cleanly.
- Smoke-test end-to-end by bundling + rendering stills in `/tmp/opencode` on a temporary synthetic test video (cleaned up before commit, or verified via `npm run lint && npm test` + `npx remotion still` on a test fixture).

## What Is Left to the Builder

- Exact triangle/segment counts for `Kit` geometries (within the `≤ 24` radial segment budget) and color/size defaults for `kit.prop(...)` variants.
- Exact AST/regex pattern for counting `L(n)` coverage in `check-motion.mts` (including `ctx.L(n)` and `L(n)` aliases).
- Exact DOM markup structure of the 3 new `IllustrationStage` SVGs (`agent-loop`, `context-window`, `code-diff`) as long as they fit inside `viewBox="0 0 840 360"` and use `DARK_TECH` tokens + `FONT`.
- Wiring `npm run check-motion -- "$SLUG"` into `.github/workflows/video.yml` (`Gates` step) and `ops/ci-prompt.md` (`Run checks before stopping`).
