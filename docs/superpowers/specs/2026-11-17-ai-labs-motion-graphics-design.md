# Design: AI Labs Motion Graphics Engine ("Dark Tech Studio")

**Date:** 2026-11-17
**Status:** Ready for user approval (builder check complete)

## Intent / Why

AI Labs covers practical AI workflows (Claude, ChatGPT, Gemini, OpenCode: prompting, coding agents, debugging, plugins, AI photo/video tools). The current 3D diorama engine (`ThreeCanvas` + `Kit` boxes/cylinders) is designed for physical/geographical explainers (Kali Aja) and wooden-toy stories (Cerpenek), so abstract software/AI concepts look clunky and fail to communicate clearly on a phone screen.

Switching AI Labs to **2D Dark Tech Studio motion graphics** (animated typography, crisp vector icons and illustrations, interactive-looking infographics, terminal/prompt cards, and smooth cinematic transitions) directly serves two goals:
1. High visual polish that fits modern AI/developer Shorts.
2. Immediate viewer comprehension — viewers can read the workflow, prompt structure, or comparison at a glance.

Additionally, whenever an AI Labs video demonstrates a prompt example, the copyable prompt must be included in the video description (`publish.json`) and the ending narration/CTA must tell viewers they can copy it from the description.

**Kali Aja and Cerpenek are completely out of scope for visual changes** — they stay on the existing 3D engine untouched.

## Goals, Non-Goals, and Anti-Goals

### Goals
- Add a native 2D motion-graphics rendering mode (`mode: "motion"`) to `src/engine/` without altering behavior or visuals for 3D channels (`kali-aja`, `cerpenek`).
- Provide a **Dark Tech Studio** visual system and composable component library (`src/engine/motion/`) tuned for 1080×1920 vertical Shorts: animated text, icons, illustrations, infographics, node flows, terminal/prompt cards, before/after splits, and cinematic shot transitions.
- Make the system easy and reliable for the autonomous CI agent (`opencode/inkling-2-small-free`) to author per video without overlapping captions, clipping off-screen, or breaking parallel shard rendering.
- Dramatically reduce AI Labs CI render time by bypassing `ThreeCanvas` / CPU SwiftShader WebGL for 2D compositions.
- Enforce the **prompt-in-description + ending CTA** rule in `ops/accounts/ai-labs.md` for any video that contains a prompt example.

### Non-Goals
- Migrating `kali-aja`, `cerpenek`, or existing 3D videos (`karbon-norwegia`) to 2D motion graphics.
- Changing TTS (`scripts/tts.mts`), offline alignment, `timeline.json` schema, music synthesis (`scripts/music.mts`), or Buffer/Cloudinary publishing mechanics (`scripts/publish.mts`).
- Adding external network assets, remote icon CDNs, or screenshots of live apps (CI runs offline/unauthenticated for third-party apps; everything renders from bundled fonts and local SVG/React).
- Redesigning the karaoke caption timing rules (≤ 5 tokens/chunk, `line-height: 1.8`, `y >= 1270` safe zone).

### Anti-Goals
- Text or infographics colliding with the top header/brand badge or bottom karaoke captions.
- Non-deterministic animations (`Math.random()`, CSS `@keyframes`, `requestAnimationFrame`, React state across frames) — Remotion renders frames out-of-order across 4 parallel CI shards.
- Raw hand-coded pixel layouts per video in CI that drift in quality or break mobile readability.
- Copyable prompts in `description` containing raw `<` or `>` that break YouTube validation, or exceeding YouTube (5,000 bytes) / TikTok (2,200 chars) limits.

## Constraints

- **Canvas & Timing:** 1080×1920, 30 fps, `durationInFrames = Math.ceil(timeline.dur * 30)`, `t = frame / fps`. Every visual property must be a pure function of `t` (and `timeline.json` cues via `ctx.L(n)` / `ctx.shot(id)`).
- **Safe Zones:**
  - Top header & `AI Labs` brand badge occupy `y = 178..~400` (plus optional chip/CTA below header).
  - Karaoke captions sit at `y = 1270` (`left: 90, right: 90`) and occupy the lower third.
  - Motion-graphics stage content must stay cleanly inside the safe visual viewport (`y ≈ 440..1230` when chip/CTA is absent, or dynamically positioned below header/chip/CTA and above `y = 1230`).
- **Fonts:** Bundled OFL fonts only (`Inter`, `Inter Display`, `DejaVu Sans Mono` via `src/engine/fonts.ts`).
- **CI Gates & Pipeline:**
  - `npm run lint` (`eslint src && tsc && tsc -p scripts`), `npm test`, `npx remotion bundle`, `npx remotion still ... --gl=swangle`, `scripts/account-gate.mts`, and `scripts/check-duplicates.mts` must all pass.
  - `account-gate.mts` checks `src/videos/<slug>/index.ts` for literal `brand: { prefix: "AI ", accent: "Labs" }` and `publish.json.account === "ai-labs"`.
  - `ops/ci-prompt.md` currently assumes every video creates `state.ts`, `world.ts`, `shots.ts`, `index.ts`; CI rules must allow `mode: "motion"` videos to omit `world.ts`/`state.ts` and use `shots.tsx` (JSX/TSX).

## Approaches Considered

| Approach | How it works | Trade-offs | Decision |
|---|---|---|---|
| **1. Dedicated 2D Mode + Composable Motion-Graphics Kit** | `Explainer.tsx` branches on `video.mode === "motion"` (skipping `ThreeCanvas`). `src/engine/motion/` supplies Dark Tech Studio backdrop, cinematic transitions, SVG icons/illustrations, and safe-zone-aware animated infographic/UI blocks. | Consistent polish and readability; CI agent composes verified blocks via declarative props & `L(n)` cues; much faster CPU renders. Slightly less freeform than blank-slate React, mitigated by a `CustomSvg` / `IllustrationFrame` slot. | **Selected by user** |
| 2. Dedicated 2D Mode with Freeform React/SVG per Video | `Explainer.tsx` mounts raw React per video; agent writes custom SVG/CSS from scratch using only palette tokens. | Maximum layout freedom, but high failure/ugliness rate in autonomous CI runs (caption collisions, inconsistent typography, broken SVGs). | Rejected |
| 3. Keep `ThreeCanvas` 3D Engine for AI Labs | Continue rendering 2D-like cards in Three.js under SwiftShader. | Soft text, slow 35–40 min CI renders, awkward 3D diorama metaphor for software/prompting topics. | Rejected |

## Architecture & Design

### 1. Dual-Mode Engine (`src/engine/types.ts`, `src/engine/Explainer.tsx`)

Keep existing 3D videos 100% backward-compatible by making `mode` optional with `"3d"` as the default:

- `BaseVideoDef`: `{ id, brand, timeline, voice, music?, cta? }`
- `VideoDef3D`: `BaseVideoDef & { mode?: "3d"; fov: number; shots: (ctx: Ctx) => Record<string, ShotDef>; createWorld: (ctx: Ctx) => WorldApi }`
- `VideoDefMotion`: `BaseVideoDef & { mode: "motion"; theme?: "dark-tech"; shots: (ctx: Ctx) => Record<string, MotionShotDef> }`
- `VideoDef = VideoDef3D | VideoDefMotion`

In `src/engine/Explainer.tsx`:
- `audioOnly` handling stays identical for both modes.
- When `video.mode === "motion"`:
  - Skip `<ThreeCanvas>` and `World` completely.
  - Render `<MotionStage video={video} ctx={ctx} t={t} />` + `<Overlays video={video} ... theme="dark-tech" />` (or let `MotionStage` render the backdrop, transitions, and shot content underneath `Overlays`).
- When `video.mode !== "motion"`: execute the exact existing `<ThreeCanvas>` + `<Overlays>` path unchanged.

### 2. Theme-Aware Overlays (`src/engine/overlays/Overlays.tsx`)

`Overlays` gains an optional `theme?: "cream" | "dark-tech"` (default `"cream"`):
- **`"cream"` (default for 3D channels):** zero visual changes (`#f4f1ea` top gradient, `#1d2328` ink, white/cream flash cut, `Callouts` projecting 3D anchors).
- **`"dark-tech"` (for AI Labs `mode: "motion"`):**
  - Top gradient fade uses `#0b0f17` instead of `#f4f1ea` so text stays readable without a beige band over the dark canvas.
  - Header label in `#7fe3c4` (mint) / `#94a3b8` (slate), title in `#f8fafc` with highlighted `*words*` in `#7fe3c4` (or cyan `#38bdf8`).
  - `AI Labs` brand badge uses `#111a2b` fill + `1px solid rgba(127, 227, 196, 0.35)` border + `#fff` / `#7fe3c4` text.
  - `Chip` and `CTA` cards use dark glass styling (`rgba(15, 23, 42, 0.88)`, crisp `#38bdf8`/`#7fe3c4` border, clear icon, readable contrast).
  - **Disable the white/cream cut flash** in `dark-tech` mode (`flash` opacity = 0) because `MotionStage` provides cinematic shot transitions instead.
  - **Callouts:** `MotionShotDef` omits 3D `camera` and 3D `callouts` (2D shots render annotations directly inside their infographic/card layouts rather than projecting 3D coordinates). `Overlays` safely handles `callouts` being absent / `pose` being optional in `"motion"` mode.
  - **Captions:** Keep `CAPTION_TOP = 1270`, `line-height: 1.8`, single active chunk, `≤ 5` tokens, with dark-tech styling (`rgba(11, 15, 23, 0.92)`, subtle `1px solid rgba(56, 189, 248, 0.3)` border, `#7fe3c4` active word highlight).

### 3. Dark Tech Studio Motion-Graphics Kit (`src/engine/motion/`)

All components are pure React components parameterized by `t` (seconds) and `shotStart` / `shotEnd`, using deterministic easing helpers (`clamp`, `smooth`, `ramp`, `spring`, `drop`, `sway` from `src/engine/math.ts` + new pure motion helpers like `stagger(t, start, index, gap, dur)` and `typewriter(text, t, start, cps)`).

#### 3.1 Backdrop & Cinematic Transitions (`src/engine/motion/MotionStage.tsx`)
- **Backdrop:** Deep navy-to-slate radial gradient (`#0b0f17` → `#132238`), subtle technical dot/line grid (`rgba(56, 189, 248, 0.06)`), and 2 slow drifting radial glow blobs driven deterministically by `sway(t, seed)` — continuous across shot cuts so the video feels like one cohesive studio world.
- **Stage Safe Container:** Positioned automatically below the header/chip/CTA (`top` computed using `headerBottom` + chip/CTA height, `bottom: 1245`, `left: 64`, `right: 64`), vertically centered within the remaining safe band (`~750–820px` tall).
- **Cinematic Shot Transitions:** Each `MotionShotDef` specifies `transition?: "zoom-cross" | "slide-up" | "slide-left" | "wipe" | "scale-fade"` (default `"zoom-cross"`).
  - During a `0.36s` overlap window around each shot cut (`shot.s` to `shot.s + 0.36`), both the outgoing shot and incoming shot render simultaneously inside the stage container:
    - `zoom-cross`: outgoing scales `1 -> 0.93` & fades `1 -> 0`; incoming scales `1.06 -> 1` & fades `0 -> 1`.
    - `slide-up`: outgoing drifts `0 -> -60px` & fades; incoming springs `80px -> 0` & fades in.
    - `slide-left`: outgoing slides `0 -> -100px` & fades; incoming slides `100px -> 0` & fades in.
    - `wipe`: incoming reveals via `clipPath: inset(0 (1-p)*100% 0 0)` with a glowing cyan leading edge line.
    - `scale-fade`: clean subtle zoom-in + opacity crossfade.
  - Because every shot's `render(ctx)` is a pure function of `(t, shotProgress)`, rendering two adjacent shots across a `0.36s` cut window is completely deterministic across parallel shards.

#### 3.2 Reusable Motion Blocks (`src/engine/motion/blocks.tsx`)
1. **`KineticHeadline`** — Big animated statement / hook / rule callout with per-word `spring` pop-in (`at` timestamp), optional `*highlight*` mint/cyan gradient or pill background, and subtle kicker tag.
2. **`NodeFlow`** — Animated architecture / agent / pipeline diagram:
   - List of nodes `{ id, icon, title, subtitle?, badge?, accent?: "mint" | "cyan" | "amber" | "red", at?: number, activeAt?: number }` connected vertically or horizontally with animated SVG connectors (growing stroke-dashoffset + travelling glowing pulse dot along the path).
3. **`TerminalCard`** — Dark IDE/CLI window (`#070a0f`, window dots, title bar) with deterministic `typewriter` command typing (`$ ...`) and staggered output lines (`kind: "cmd" | "info" | "ok" | "err" | "dim"`, each with `at` timestamp and optional line highlight).
4. **`PromptCard`** — Structured AI prompt breakdown card showing labeled sections (`ROLE`, `CONTEXT`, `TASK`, `CONSTRAINT`, etc.) with color-coded chips, active spotlighting at `activeAt`, and an optional `"Salin di deskripsi ↓"` footer hint.
5. **`ComparisonSplit`** — Two-panel Before/After or Salah/Benar comparison (stacked vertically or side-by-side in the safe box) with animated reveal, strike-through / red border on the anti-pattern, and emerald glow + checkmark on the winning pattern.
6. **`MetricPanel`** — Infographic numbers & charts:
   - `StatCounter`: animated numeric count-up (`ramp` + `spring`) with unit and delta badge.
   - `BarList`: horizontal animated progress/benchmark bars with labels and percentage/value callouts.
   - `ContextMeter`: segmented capacity gauge (ideal for context window / token budget / speedups).
7. **`BentoGrid`** — 2-column or 3-row animated card grid (`icon`, `title`, `detail`, `at`, `highlightAt`) for tips, 3-step workflows, or tool capabilities.
8. **`IllustrationStage`** — Spotlight frame for rich vector compositions (e.g., layered document-to-JSON transform, photo before/after wipe slider, MCP plug connecting client to tools, animated cursor clicking UI elements) plus a clean `children` slot for topic-specific inline `<svg>` drawings.

#### 3.3 Built-in SVG Icon & Illustration Set (`src/engine/motion/icons.tsx`)
A self-contained library of crisp 24×24 / 48×48 duotone SVG icons (`sparkle`, `terminal`, `code`, `brain`, `bot`, `folder`, `file`, `git`, `plug`, `shield`, `lock`, `image`, `video`, `clock`, `bolt`, `check`, `x`, `warning`, `search`, `copy`, `sliders`, `layers`, `database`, `globe`) so the CI agent never has to hand-draw messy paths for common concepts.

### 4. Motion Shot Definition (`MotionShotDef`)

```ts
export type TransitionKind = "zoom-cross" | "slide-up" | "slide-left" | "wipe" | "scale-fade";

export type MotionShotDef = {
  label: string;
  title: string;
  tag?: string;
  transition?: TransitionKind;
  chip?: (t: number) => ChipState | null;
  render: (frame: { t: number; local: number; dur: number; progress: number }) => React.ReactNode;
};
```

In `src/videos/<slug>/shots.tsx`, the agent writes `shots = (ctx: Ctx): Record<string, MotionShotDef> => ({ ... })` using `ctx.L(n).s` / `ctx.L(n).e` for all animation timings inside `render`.

### 5. CI Prompt, Account Brief, and Prompt-in-Description Rule

#### 5.1 `ops/accounts/ai-labs.md`
- Replace `## Scene 3D` with `## Visual: Motion Graphics (Dark Tech Studio)`:
  - Specify `mode: "motion"` in `src/videos/<slug>/index.ts` (no `fov`, no `createWorld`, no `world.ts`, no `Kit`).
  - Document the available components in `src/engine/motion`, `TransitionKind` options, safe-zone discipline (rely on the kit's layout blocks rather than raw absolute positioning), pure-function-of-`t` rule, and binding all animation triggers to `ctx.L(n).s` / `ctx.L(n).e`.
  - Keep the rule forbidding live app screenshots (rebuild UI/flows cleanly with `TerminalCard`, `PromptCard`, `NodeFlow`, `ComparisonSplit`, etc.).
- Update `## Naskah` and `## publish.json` for **prompt examples**:
  - **If the video contains a prompt example (or template):**
    1. Put the full, ready-to-copy prompt cleanly in `publish.json.description` (and `tiktokCaption` if it fits within 2,200 chars; otherwise keep a compact version in `tiktokCaption` while ensuring the full prompt is in YouTube `description`), e.g. under a `Prompt siap copy:` section. Ensure no raw `<` or `>` characters (use `[placeholder]` brackets instead of `<placeholder>` so YouTube does not reject or alter them) and stay under 5,000 UTF-8 bytes.
    2. In the final narration lines of `naskah.txt` and in `cta.text` (`index.ts`), explicitly tell the viewer that the prompt is in the description if they want to copy it (e.g., `"Prompt lengkapnya sudah ada di deskripsi, tinggal copy aja."`).
  - **If the video does NOT contain a prompt example** (e.g., a CLI flag, config setting, or tool comparison with no copyable prompt): use a normal closing takeaway/CTA without promising a prompt in the description.

#### 5.2 `ops/ci-prompt.md`, `AGENTS.md`, `scripts/account-gate.mts`, and `.github/workflows/video.yml`
- Note in `ops/ci-prompt.md` that `state.ts` and `world.ts` apply to 3D videos; `mode: "motion"` videos (AI Labs) produce `index.ts` and `shots.tsx` (plus `naskah.txt`, `config.json`, `timeline.json`, `alignment.json`, `publish.json`) and must not create `world.ts`.
- **Hard CI Gate (`scripts/account-gate.mts` + `scripts/account-core.mts`):**
  - Keep validating `publish.json.account` and literal `brand: { prefix: "AI ", accent: "Labs" }` in `index.ts`.
  - When `account === "ai-labs"`:
    1. Reject if `src/videos/<slug>/world.ts` exists or `index.ts` does not declare `mode: "motion"`.
    2. When `shots.tsx` (or `shots.ts`) references `PromptCard`, require `publish.json.description` to include the `Prompt siap copy:` marker and require `naskah.txt` (last 3 lines) or `index.ts` `cta.text` to mention `deskripsi` so viewers are always pointed to the copyable prompt.
  - Add unit tests in `scripts/account-core.test.mts` covering these new invariants.
- **Still-Check Frame Timing (`.github/workflows/video.yml`):**
  - Update the `Still check` step (`frame = Math.floor(s.s * 30) + 1`) to sample past any cut transition/flash: `Math.max(1, Math.floor(Math.min(s.s + 0.5, (s.s + s.e) / 2) * 30))`. This ensures 2D motion stills capture the settled incoming shot (rather than 92% of the outgoing shot during the `0.36s` transition) and avoids the `0.16s` cream flash on 3D shots.

### 6. What's Left to the Builder

1. Exact spacing, typography scale, border radii, glow opacities, and SVG path artwork inside `src/engine/motion/*` (matching Dark Tech Studio Option A).
2. Exact placement of the `MotionStage` transition wrapper relative to `Overlays` (ensuring the top header & bottom captions stay anchored and crisp while the mid-screen stage transitions smoothly between shots, with header text itself animating cleanly via `Header` `local` time).
3. Whether `VideoDef` union types or `Explainer.tsx` need minor helper exports so `tsc` and `eslint` pass cleanly with zero warnings.
4. Adding deterministic unit tests for `src/engine/motion` timing/layout helpers (`stagger`, `typewriter`, transition progress math, safe-zone clamping) and `scripts/account-core.test.mts` gate checks.
5. Creating and visually verifying stills (every shot + mid-transition frames) of a sample AI Labs motion-graphics video locally (via `npx remotion bundle` + `npx remotion still`) before cleanup, ensuring zero overlap with header/CTA/captions and verifying the final look.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Text or cards inside a motion block overflow vertically past `y = 1230` into captions | `MotionStage` clips/bounds the stage container above `CAPTION_TOP` and provides compact vertical presets (`BentoGrid`, `NodeFlow`, `TerminalCard` max-lines guidance in `ops/accounts/ai-labs.md`); still-frame visual inspection verifies real content density. |
| Agent in CI tries to import `Kit` or write `world.ts` out of habit, or omits the prompt from description | `ops/accounts/ai-labs.md` and `ops/ci-prompt.md` specify `mode: "motion"` + `Prompt siap copy:`, and `scripts/account-gate.mts` hard-fails the build before render if violated. |
| Regression on Kali Aja or Cerpenek 3D renders | `mode` defaults to `"3d"`; `"cream"` overlay theme is default; `karbon-norwegia` + `npm run lint` + `npm test` + bundle gate prove zero regression. |
| Copyable prompt in `description` uses `<placeholder>` and triggers YouTube rejection or exceeds byte limit | `ops/accounts/ai-labs.md` instructs `[placeholder]` syntax; `scripts/publish-lib.mts` already enforces 5,000-byte YouTube & 2,200-char TikTok caps and converts any stray `<`/`>` via `youtubeSafe`. |
