# Richer Visual Detail & Line-Beat Animations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every generated Short show more visual detail and react visibly to each spoken script line, enforced by a fast pre-render gate.

**Architecture:** Add pure `L(n)`-beat timing helpers to `src/engine/math.ts`, add CPU-cheap mechanical/diorama builders to `Kit`, add line-synced spotlighting and new SVG illustrations to the 2D motion engine, then teach all four channel briefs to use them and reject static scenes with a new deterministic `check-motion` gate that samples the world/scene graph in Node before the 40-minute render.

**Tech Stack:** TypeScript, Remotion 4, React Three Fiber, three.js 0.178, node:test via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-20-rich-animations-design.md`

## Global Constraints

- Everything visible must be a pure function of `t`: no `Math.random()`, no `Date.now()`, no cross-frame mutable state.
- No environment maps (IBL), no bump maps, no VSM shadows, no post-processing passes.
- Round geometry: ≤ 24 radial segments; repeated small elements use `InstancedMesh`; tiny decorative parts set `castShadow = false`.
- Overlay layouts, caption styling/chunking, TTS, alignment, music and publishing are unchanged.
- `npm run lint` = `eslint src && tsc && tsc -p scripts`; `npm test` = `tsx --test scripts/*.test.mts`. Both must pass after every task.
- Existing brief assertions in `scripts/topics.test.mts` and `scripts/motion.test.mts` must keep passing; brief edits add text, never remove the strings those tests pin.
- `src/` compiles with `types: ["web"]` and `noUnusedLocals: true`; Node-only code belongs in `scripts/`.

## Review Focus

- **Render-time blow-up:** new geometry must not push `--gl=swangle` past the 90-minute shard timeout; keep triangle counts low and reuse `Kit` materials.
- **Shared-material poisoning:** `Kit.mat()` caches by colour+params, so a per-part emissive pulse must go through `glowMat()` and never mutate a cached material.
- **Gate false rejection:** `check-motion` must accept legitimately animated videos; a too-strict threshold blocks every run.
- **Gate false acceptance from React ids:** `renderToStaticMarkup` output contains `useId` values; markup must be normalized before comparison or ids alone look like motion.
- **Agent breakage:** the CI agent runs close to timeout; brief examples must be copy-pasteable and the new helpers must be simple enough to wire without type errors.

---

### Task 1: Line-beat timing helpers

**Files:**
- Modify: `src/engine/math.ts` (append at end)
- Test: `scripts/beat.test.mts` (create)

**Interfaces:**
- Consumes: `Line`, `CamPose`, `Vec3` from `src/engine/types.ts`; existing `spring`, `ramp`, `clamp`, `lerp`, `lerp3` in `math.ts`.
- Produces:
  - `beat(t: number, line: Line, lead?: number): number`
  - `pulse(t: number, line: Line, fade?: number): number`
  - `between(t: number, from: Line, to: Line, fade?: number): number`
  - `stepIndex(t: number, lines: readonly Line[]): number`
  - `focusOffset(base: CamPose, t: number, cues: readonly FocusCue[], transition?: number): CamPose`
  - `type FocusCue = { at: number; offset: Vec3; targetOffset?: Vec3 }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { beat, between, focusOffset, pulse, stepIndex } from "../src/engine/math.ts";
import type { Line } from "../src/engine/types.ts";

const line = (n: number, s: number, e: number): Line => ({ n, s, e, text: `baris ${n}` });

describe("beat", () => {
  test("is 0 before the line starts and 1 shortly after", () => {
    const l = line(1, 2, 5);
    assert.equal(beat(1.9, l), 0);
    assert.equal(beat(2, l), 0);
    assert.equal(beat(2 + 0.28, l), 1);
    assert.equal(beat(9, l), 1);
  });
  test("rises monotonically inside the lead window", () => {
    const l = line(1, 2, 5);
    const a = beat(2.05, l), b = beat(2.1, l), c = beat(2.2, l);
    assert.ok(a < b && b < c, `${a} ${b} ${c}`);
  });
});

describe("pulse", () => {
  const l = line(2, 4, 8);
  test("is 0 outside the line and 1 in the middle", () => {
    assert.equal(pulse(3.9, l), 0);
    assert.equal(pulse(4, l), 0);
    assert.equal(pulse(6, l), 1);
    assert.equal(pulse(8, l), 0);
    assert.equal(pulse(8.1, l), 0);
  });
  test("stays within [0,1] for a line shorter than two fade windows", () => {
    const short = line(3, 4, 4.1);
    for (const t of [4, 4.03, 4.05, 4.08, 4.1]) {
      const v = pulse(t, short);
      assert.ok(v >= 0 && v <= 1, `pulse(${t}) = ${v}`);
    }
  });
});

describe("between", () => {
  const a = line(1, 2, 4), b = line(2, 4, 6), c = line(3, 6, 9);
  test("spans several lines and fades at both ends", () => {
    assert.equal(between(1.5, a, c), 0);
    assert.equal(between(2, a, c), 0);
    assert.equal(between(5, a, c), 1);
    assert.equal(between(9, a, c), 0);
  });
});

describe("stepIndex", () => {
  const lines = [line(1, 1, 2), line(2, 3, 4), line(3, 5, 6)];
  test("returns -1 before the first line and the latest reached index after", () => {
    assert.equal(stepIndex(0.5, lines), -1);
    assert.equal(stepIndex(1, lines), 0);
    assert.equal(stepIndex(3.5, lines), 1);
    assert.equal(stepIndex(99, lines), 2);
  });
  test("returns -1 for an empty list", () => assert.equal(stepIndex(5, []), -1));
});

describe("focusOffset", () => {
  const base = { position: [0, 5, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  test("returns the base pose before any cue", () => {
    assert.deepEqual(focusOffset(base, 0, [{ at: 2, offset: [1, 0, 0] }]), base);
  });
  test("has fully applied the latest cue after its transition window", () => {
    const pose = focusOffset(base, 3, [{ at: 2, offset: [1, 0, 0], targetOffset: [0, 1, 0] }]);
    assert.deepEqual(pose.position, [1, 5, 10]);
    assert.deepEqual(pose.target, [0, 1, 0]);
  });
  test("blends from the previous cue towards the current one", () => {
    const cues = [
      { at: 1, offset: [2, 0, 0] as [number, number, number] },
      { at: 4, offset: [4, 0, 0] as [number, number, number] },
    ];
    const mid = focusOffset(base, 4.175, cues, 0.35).position[0];
    assert.ok(mid > 2 && mid < 4, `mid = ${mid}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/beat.test.mts`
Expected: FAIL — `beat is not a function` / export not found.

- [ ] **Step 3: Implement the five helpers in `src/engine/math.ts`**

`beat` = `spring((t - line.s) / lead)` clamped to `[0,1]` with default `lead = 0.28`.
`pulse` = `Math.min(ramp(t, line.s, line.s + fade), 1 - ramp(t, line.e - fade, line.e))`, clamped to `[0,1]`, default `fade = 0.22`.
`between` = `Math.min(ramp(t, from.s, from.s + fade), 1 - ramp(t, to.e - fade, to.e))`, clamped, default `fade = 0.25`.
`stepIndex` = index of the last line with `line.s <= t`, else `-1`.
`focusOffset` = find the last cue with `at <= t`; the previous cue is the one before it (its offset `[0,0,0]` and `targetOffset [0,0,0]` when absent); `u = ramp(t, cur.at, cur.at + transition)`; return `{ position: base.position + lerp3(prev.offset, cur.offset, u), target: base.target + lerp3(prevTarget, curTarget, u) }` with missing `targetOffset` treated as `[0,0,0]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/beat.test.mts && npm run lint`
Expected: all tests pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/math.ts scripts/beat.test.mts
git commit -m "feat(engine): add line-beat timing helpers (beat, pulse, between, stepIndex, focusOffset)"
```

---

### Task 2: Kit mechanical builders

**Files:**
- Modify: `src/engine/kit.ts` (add methods inside `class Kit`, imports at top)
- Test: `scripts/kit.test.mts` (create)

**Interfaces:**
- Consumes: `Kit`, `Kit.mat`, `Kit.add`, `Kit.cyl`, `Kit.part` (private), `lerp3`/`Vec3` from `./math`/`./types`.
- Produces (all on `class Kit`):
  - `tube(points: Vec3[], r: number, m: string | Material, o?: { tubularSegments?: number; radialSegments?: number; parent?: Object3D }): { mesh: Mesh; at(u: number): Vec3 }`
  - `ring(x: number, y: number, z: number, r: number, tubeR: number, m: string | Material, o?: { rot?: Vec3; parent?: Object3D }): Mesh`
  - `coil(x: number, y0: number, z: number, o: { r?: number; tubeR?: number; h?: number; turns?: number; color?: string | Material; parent?: Object3D }): Group`
  - `gear(x: number, y: number, z: number, o: { r?: number; thickness?: number; teeth?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D }): { root: Group; rotor: Group }`
  - `fan(x: number, y: number, z: number, o: { r?: number; blades?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D }): { root: Group; rotor: Group }`
  - `arrow(from: Vec3, to: Vec3, m: string | Material, o?: { r?: number; headR?: number; parent?: Object3D }): { root: Group; setProgress(u: number): void }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Group, Mesh, Object3D } from "three";
import { Kit } from "../src/engine/kit.ts";

const countMeshes = (o: Object3D): number => {
  let n = o instanceof Mesh ? 1 : 0;
  o.children.forEach((c) => (n += countMeshes(c)));
  return n;
};

describe("Kit mechanical builders", () => {
  test("tube builds a curved mesh and samples points along it", () => {
    const kit = new Kit(new Group());
    const t = kit.tube([[0, 0, 0], [1, 1, 0], [2, 0, 0]], 0.1, "#888");
    assert.ok(countMeshes(t.mesh) >= 1);
    const a = t.at(0), b = t.at(1);
    assert.ok(Math.abs(a[0]) < 1e-6 && Math.abs(b[0] - 2) < 1e-3, `${a} ${b}`);
  });

  test("ring, coil, gear, fan and arrow all build geometry with no NaN transforms", () => {
    const root = new Group();
    const kit = new Kit(root);
    kit.ring(0, 0, 0, 0.4, 0.05, "#999");
    kit.coil(0, 0, 0, { turns: 4 });
    const gear = kit.gear(0, 0, 0, { teeth: 8 });
    const fan = kit.fan(0, 0, 0, { blades: 4 });
    const arrow = kit.arrow([0, 0, 0], [0, 2, 0], "#f00");
    assert.ok(gear.rotor instanceof Group && fan.rotor instanceof Group);
    assert.ok(countMeshes(root) >= 12, `only ${countMeshes(root)} meshes`);
    root.traverse((o) => {
      assert.ok(Number.isFinite(o.position.x + o.position.y + o.position.z));
      assert.ok(Number.isFinite(o.rotation.x + o.rotation.y + o.rotation.z));
    });
    arrow.setProgress(0.5);
    assert.ok(Number.isFinite(arrow.root.scale.y));
  });

  test("gear teeth count matches the requested teeth", () => {
    const kit = new Kit(new Group());
    const { rotor } = kit.gear(0, 0, 0, { teeth: 10 });
    assert.equal(rotor.children.length, 10);
  });

  test("a full mechanism stays inside the CPU render triangle budget", () => {
    const root = new Group();
    const kit = new Kit(root);
    kit.tube([[0, 0, 0], [1, 1, 0], [2, 0, 0]], 0.1, "#888");
    kit.coil(0, 0, 0, { turns: 4 });
    kit.gear(0, 0, 0, { teeth: 10 });
    kit.fan(0, 0, 0, { blades: 4 });
    let tris = 0;
    root.traverse((o) => {
      const g = (o as Mesh).geometry as { index?: { count: number } | null; attributes?: { position?: { count: number } } } | undefined;
      if (!g?.attributes?.position) return;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    assert.ok(tris < 20000, `mechanism uses ${tris} triangles, budget is 20000`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/kit.test.mts`
Expected: FAIL — `kit.tube is not a function`.

- [ ] **Step 3: Implement the six builders in `src/engine/kit.ts`**

`tube`: `new CatmullRomCurve3(points.map((p) => new Vector3(...p)))` → `new TubeGeometry(curve, tubularSegments ?? 28, r, radialSegments ?? 10, false)`, wrap with `worldUV`, `add(...)`, and return `{ mesh, at: (u) => curve.getPointAt(clamp(u, 0, 1)).toArray() as Vec3 }`.
`ring`: `TorusGeometry(r, tubeR, 10, 24)`, optional `rot` euler, `castShadow = false`.
`coil`: helix points `[x + cos(θ)·r, y0 + h·u, z + sin(θ)·r]` for `θ = u·turns·2π` over 40 samples → reuse `tube(points, tubeR ?? 0.03, color ?? "#9aa3ad")`; return the parent `Group`.
`gear`: `root` group at `(x,y,z)` rotated so the spin axis is `axis` (default `"z"`); inside it a `rotor` group holding a hub `cyl`, a rim, and `teeth` small boxes placed at `angle = i/teeth·2π` on radius `r`. Return `{ root, rotor }`.
`fan`: same pivot convention; `rotor` holds a hub ball plus `blades` pitched boxes (`rotation.x` tilt ≈ 0.5) at `angle = i/blades·2π`.
`arrow`: `root` group placed at `from`, oriented with `quaternion.setFromUnitVectors(new Vector3(0,1,0), dir.normalize())`; shaft `CylinderGeometry(r ?? 0.03, r ?? 0.03, len, 12)` at `y = len/2` and cone head (`headR ?? r*2.2`, height `r*4`) at `y = len`; `setProgress(u)` sets `root.scale.y = clamp(u, 0, 1)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/kit.test.mts && npm run lint`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/kit.ts scripts/kit.test.mts
git commit -m "feat(kit): add tube, ring, coil, gear, fan and arrow builders"
```

---

### Task 3: Kit flow, cutaway and glow

**Files:**
- Modify: `src/engine/kit.ts`
- Test: `scripts/kit.test.mts` (extend)

**Interfaces:**
- Consumes: Task 2's `tube` handle, `setInstance`, `particles`.
- Produces:
  - `flowDots(points: Vec3[], count: number, color: string, o?: { r?: number; speed?: number; parent?: Object3D }): InstancedMesh & { update(t: number, rate?: number): void }`
  - `cutaway(parts: readonly Object3D[], openU: number, offset: Vec3): void` — a method on `class Kit` (`kit.cutaway(...)`).
  - `glowMat(color: string, emissive: string, o?: Surface | MeshStandardMaterialParameters): MeshStandardMaterial` — a method on `class Kit` (`kit.glowMat(...)`), never cached.

- [ ] **Step 1: Write the failing test** (append to `scripts/kit.test.mts`; it already defines `countMeshes`)

```ts
test("flowDots advances along the curve and clamps its rate", () => {
  const kit = new Kit(new Group());
  const dots = kit.flowDots([[0, 0, 0], [1, 0, 0], [2, 0, 0]], 6, "#7fe3c4", { speed: 0.5 });
  const before = Array.from(dots.instanceMatrix.array.slice(0, 16));
  dots.update(1, 1);
  const after = Array.from(dots.instanceMatrix.array.slice(0, 16));
  assert.notDeepEqual(before, after);
  for (const v of after) assert.ok(Number.isFinite(v));
  dots.update(1, 0); // rate 0 freezes the flow
  assert.deepEqual(Array.from(dots.instanceMatrix.array.slice(0, 16)), after);
});

test("cutaway slides parts open and hides nothing until fully open", () => {
  const kit = new Kit(new Group());
  const shell = kit.box(0, 1, 0, 1, 0, 1, "#ccc");
  kit.cutaway([shell], 0, [2, 0, 0]);
  assert.equal(shell.position.x, 0.5);
  assert.equal(shell.visible, true);
  kit.cutaway([shell], 1, [2, 0, 0]);
  assert.equal(shell.position.x, 2.5);
  assert.equal(shell.visible, false);
  kit.cutaway([shell], 0, [2, 0, 0]);
  assert.equal(shell.position.x, 0.5, "reopening returns to the captured base position");
});

test("glowMat returns a fresh material each call and never touches the cache", () => {
  const kit = new Kit(new Group());
  const a = kit.glowMat("#888", "#20C9C3");
  const b = kit.glowMat("#888", "#20C9C3");
  assert.notEqual(a, b);
  a.emissiveIntensity = 0.9;
  assert.notEqual(b.emissiveIntensity, 0.9);
  assert.notEqual(kit.mat("#888"), a);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/kit.test.mts`
Expected: FAIL — `kit.flowDots is not a function`.

- [ ] **Step 3: Implement in `src/engine/kit.ts`**

`flowDots`: build one `InstancedMesh` of `SphereGeometry(r ?? 0.045, 10, 8)` with an emissive-tinted `MeshStandardMaterial`; store the `CatmullRomCurve3` and `speed ?? 0.35` in a closure; `update(t, rate = 1)` places dot `i` at `curve.getPointAt(((i / count) + t * speed * rate) % 1)` via `setInstance`, then sets `instanceMatrix.needsUpdate = true`. `rate` is a caller-supplied scale of `t` (callers pass `beat(t, L(n))` so speed ramps instead of jumping).
`cutaway`: for each part, `part.position.set(...lerp3([0,0,0], offset, clamp(openU)).map((v, i) => base[i] + v))` where `base` is captured on first call and cached on the object via a `WeakMap`; `part.visible = openU < 0.99`.
`glowMat`: `new MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, ...(typeof o === "string" ? SURFACES[o] : { ...SURFACES.matte, grain: false, ...o }) })` — always uncached.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/kit.test.mts && npm run lint`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/kit.ts scripts/kit.test.mts
git commit -m "feat(kit): add flowDots, cutaway and glowMat for narration-synced reveals"
```

---

### Task 4: Diorama life (Cerpenek)

**Files:**
- Modify: `src/engine/kit.ts`
- Test: `scripts/kit.test.mts` (extend)

**Interfaces:**
- Consumes: `figure`, `face`, `part`, `pivot`, `spring`/`sway` from `./math`.
- Produces:
  - `figure(...)` return gains `torso: Group` and `blink: Group` (existing `root/head/armL/armR/legL/legR` unchanged).
  - `cloud(x: number, y: number, z: number, s?: number): Group`
  - `ripple(x: number, z: number, maxR?: number, color?: string): { root: Group; setPhase(u: number): void }`
  - `prop(kind: PropKind, x: number, y: number, z: number, s?: number): Group`
  - `export type PropKind = "lantern" | "crate" | "pot" | "torch" | "scroll" | "rock" | "flower"`
  - `export type PoseMode = "idle" | "talk" | "walk" | "wave" | "sad" | "point"`
  - `export const poseFigure = (fig: FigureParts, t: number, mode: PoseMode, seed?: number): void`

- [ ] **Step 1: Write the failing test** (append to `scripts/kit.test.mts`; add `poseFigure` to the `../src/engine/kit.ts` import)

```ts
test("figure exposes torso and blink groups", () => {
  const kit = new Kit(new Group());
  const f = kit.figure(0, 0, 0, { age: "anak" });
  assert.ok(f.torso instanceof Group && f.blink instanceof Group);
  assert.ok(f.blink.children.length >= 4);
});

test("poseFigure writes finite poses and differs per mode", () => {
  const kit = new Kit(new Group());
  const f = kit.figure(0, 0, 0);
  const snap = () => [f.armR.rotation.z, f.head.rotation.y, f.legL.rotation.x];
  poseFigure(f, 2, "talk", 1);
  const talk = snap();
  poseFigure(f, 2, "walk", 1);
  const walk = snap();
  for (const v of [...talk, ...walk]) assert.ok(Number.isFinite(v));
  assert.notDeepEqual(talk, walk);
});

test("cloud, ripple and prop build visible geometry", () => {
  const root = new Group();
  const kit = new Kit(root);
  kit.cloud(0, 6, -4, 1.4);
  const rp = kit.ripple(0, 0, 1.2);
  for (const kind of ["lantern", "crate", "pot", "torch", "scroll", "rock", "flower"] as const) kit.prop(kind, 0, 0, 0);
  rp.setPhase(0.5);
  assert.ok(countMeshes(root) >= 20, `only ${countMeshes(root)} meshes`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/kit.test.mts`
Expected: FAIL — `f.torso` undefined.

- [ ] **Step 3: Implement in `src/engine/kit.ts`**

`figure`: wrap the torso parts in a `torso` pivot at `[0, 0.36, 0]` and parent the existing head/arm/leg pivots under `root` as today; move the eye/sclera/pupil/specular parts created by `face()` into a `blink` group pivoted at the head centre so `blink.scale.y` squashes them. Return the two extra groups.
`cloud`: 3–4 overlapping `IcosahedronGeometry` clumps, `flatShading`, white-grey (`#f2f4f6` / `#e2e8ee`), `castShadow = false`.
`ripple`: 3 concentric `TorusGeometry` rings lying flat (`rotation.x = -Math.PI/2`) with `MeshBasicMaterial({ color, transparent: true })`; `setPhase(u)` sets ring `i` radius scale `0.3 + (u + i/3) % 1` and opacity `1 - ((u + i/3) % 1)`.
`prop`: switch on `PropKind` building from `box`/`cyl`/`ball`/`ConeGeometry` — e.g. `lantern` = small `box` frame + amber emissive `ball`, `crate` = box with two darker plank strips, `torch` = `cyl` handle + orange cone flame, `flower` = thin `cyl` stem + 5 small `ball` petals.
`poseFigure`: sets `armR.rotation.z`, `armL.rotation.z`, `head.rotation.x/y`, `legL/legR.rotation.x`, `torso.rotation.x`, and `blink.scale.y` per mode from `t` and `sway(t, seed)`; `"walk"` alternates legs with `Math.sin(t * 6)`, `"talk"` gestures `armR` and nods, `"sad"` droops head (`head.rotation.x = 0.35`), `"wave"` raises `armR`, `"point"` extends `armR` forward, `"idle"` breathes (`torso.rotation.x = sway(t, seed) * 0.03`) and blinks when `sway(t, seed + 9) > 0.94`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/kit.test.mts && npm run lint`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/kit.ts scripts/kit.test.mts
git commit -m "feat(kit): add poseFigure presets, blinking figures, clouds, ripples and story props"
```

---

### Task 5: Motion block spotlighting and BeatCallout

**Files:**
- Modify: `src/engine/motion/blocks.tsx`
- Test: `scripts/motion.test.mts` (extend)

**Interfaces:**
- Consumes: existing `ACCENT_HEX`, `ACCENT_TINT`, `ACCENT_BORDER`, `cardShell`, `spring`, `ramp`, `stagger`, `FONT`.
- Produces:
  - `TerminalLine` gains `activeAt?: number`; `MetricPanel` `bars[]` entries gain `activeAt?: number`; `ComparisonSide` gains optional `pointsAt?: number[]` (one cue per point; `points: string[]` is unchanged).
  - `BeatCallout: React.FC<{ t: number; at: number; until?: number; step: number; text: string; accent?: "mint" | "cyan" | "amber" | "violet"; align?: "left" | "center" }>`

- [ ] **Step 1: Write the failing test** (append to `scripts/motion.test.mts`; add `import { renderToStaticMarkup } from "react-dom/server";` and import `BeatCallout` from `../src/engine/motion/blocks.tsx`)

```ts
test("BeatCallout appears at its cue and hides after until", () => {
  const el = BeatCallout({ t: 2, at: 2, step: 1, text: "Parse" });
  assert.equal(React.isValidElement(el), true);
  const html = renderToStaticMarkup(el as React.ReactElement);
  assert.match(html, /Parse/);
  assert.match(html, />1</);
  const hidden = renderToStaticMarkup(BeatCallout({ t: 9, at: 2, until: 5, step: 2, text: "Validate" }) as React.ReactElement);
  assert.match(hidden, /opacity:0/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/motion.test.mts`
Expected: FAIL — `BeatCallout` is not exported.

- [ ] **Step 3: Implement in `src/engine/motion/blocks.tsx`**

`BeatCallout`: rounded pill, mono uppercase step badge + `FONT.ui` label, `spring` pop-in at `at`, opacity `0` when `t < at` or (`until` set and `t > until`), accent-tinted background/border from the existing accent maps.
Spotlighting: in `TerminalCard`, `MetricPanel` bars and `ComparisonSplit` points, compute `latestActive` the same way `NodeFlow` already does; the active row keeps full opacity with an accent left border, others get `opacity: 0.55`. `ComparisonSplit` reads its per-point cues from `pointsAt` when present.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/motion.test.mts && npm run lint`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/motion/blocks.tsx scripts/motion.test.mts
git commit -m "feat(motion): add BeatCallout and line-synced spotlighting to cards"
```

---

### Task 6: New illustrations and stage drift

**Files:**
- Modify: `src/engine/motion/blocks.tsx` (`IllustrationStage` + three new SVG components)
- Modify: `src/engine/motion/MotionStage.tsx` (stage micro-drift)
- Test: `scripts/motion.test.mts` (extend)

**Interfaces:**
- Consumes: `DARK_TECH`, `FONT`, `ramp`, `spring`, `sway`, `clamp`.
- Produces:
  - `IllustrationStage` `variant` union gains `"agent-loop" | "context-window" | "code-diff"`, and gains `activeStep?: number`.
  - `MotionStage` wrapper gains a deterministic drift transform: `translate3d(sway(t,3)*6px, sway(t,5)*5px, 0) scale(1 + 0.012*(1+sway(t,7))/2)`.

- [ ] **Step 1: Write the failing test** (append to `scripts/motion.test.mts`; add `import { renderToStaticMarkup } from "react-dom/server";`, `import React from "react";` and `IllustrationStage` to the existing imports)

```ts
test("each IllustrationStage variant renders and changes with t", () => {
  for (const variant of ["agent-loop", "context-window", "code-diff"] as const) {
    const a = renderToStaticMarkup(React.createElement(IllustrationStage, { t: 1, at: 1, variant, activeStep: 0 }));
    const b = renderToStaticMarkup(React.createElement(IllustrationStage, { t: 3, at: 1, variant, activeStep: 2 }));
    assert.match(a, /<svg/);
    assert.notEqual(a, b, `${variant} did not change between timestamps`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/motion.test.mts`
Expected: FAIL — unknown variant falls through to the MCP bridge drawing (identical markup).

- [ ] **Step 3: Implement**

`AgentLoopIllustration`: four nodes on a circle (Think, Tool, Observe, Verify) with an SVG arc path and a token dot whose position comes from `(t - at) * 0.6 % 1`; `activeStep` brightens that node's stroke.
`ContextWindowIllustration`: a row of 12 token blocks; the first `Math.round(12 * ramp(t, at, at + 1.2))` blocks fill mint, the block at `activeStep` gets an amber ring; a compaction arrow appears when `activeStep >= 2`.
`CodeDiffIllustration`: 5 red `-` lines and 5 mint `+` lines revealed by `ramp` at staggered offsets, plus a check badge at the end.
Wire them into the `mode` switch in `IllustrationStage` before the default branch; keep `viewBox="0 0 840 360"` and `DARK_TECH` colours.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/motion.test.mts && npm run lint`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/motion/blocks.tsx src/engine/motion/MotionStage.tsx scripts/motion.test.mts
git commit -m "feat(motion): add agent-loop, context-window and code-diff illustrations plus stage drift"
```

---

### Task 7: check-motion gate

**Files:**
- Create: `scripts/motion-gate-core.mts` (pure checks, unit-testable)
- Create: `scripts/check-motion.mts` (CLI wrapper)
- Create: `scripts/motion-gate.test.mts`
- Modify: `package.json` (add `"check-motion": "tsx scripts/check-motion.mts"`)

**Interfaces:**
- Consumes: `Timeline`, `VideoDef`, `VideoDef3D`, `VideoDefMotion` from `src/engine/types.ts`; `videoDir` from `scripts/lib.mts`; `Scene` from `three`; `renderToStaticMarkup` from `react-dom/server`.
- Produces:
  - `lineCoverage(source: string, lineCount: number): { covered: number; ratio: number }`
  - `findForbidden(source: string): string[]`
  - `countNodes(root: Object3D): number`
  - `snapshotWorld(video: VideoDef3D, tl: Timeline): Array<{ shot: string; cameraMoved: boolean; sceneMoved: boolean; nodes: number }>`
  - `snapshotMotion(video: VideoDefMotion, tl: Timeline): Array<{ shot: string; changed: boolean }>`
  - `motionProblems(opts: { account: "3d" | "motion"; source: string; lineCount: number; samples: ... }): string[]`
  - `THRESHOLDS = { lineCoverage: 0.7, minNodes: 15, cameraEps: 0.02, sceneEps: 0.005 }`

- [ ] **Step 1: Write the failing test**

```ts
import { THRESHOLDS, findForbidden, lineCoverage, motionProblems, snapshotMotion } from "./motion-gate-core.mts";
import React from "react";
import type { Timeline, VideoDefMotion } from "../src/engine/types.ts";

test("lineCoverage counts distinct L(n) references", () => {
  assert.equal(lineCoverage("L(1); L(2); L(2);", 4).covered, 2);
  assert.ok(Math.abs(lineCoverage("L(1); L(2);", 4).ratio - 0.5) < 1e-9);
  assert.equal(lineCoverage("ctx.L(3)", 4).covered, 1);
});

test("findForbidden flags nondeterminism", () => {
  assert.deepEqual(findForbidden("const x = 1;"), []);
  assert.equal(findForbidden("Math.random()").length, 1);
  assert.equal(findForbidden("Date.now()").length, 1);
});

test("motionProblems rejects a static 3D shot and accepts a moving one", () => {
  const staticShot = { shot: "s1", cameraMoved: false, sceneMoved: false, nodes: 40 };
  const movingShot = { shot: "s1", cameraMoved: true, sceneMoved: false, nodes: 40 };
  assert.ok(motionProblems({ account: "3d", source: "L(1)", lineCount: 1, world: [staticShot], motion: [] }).length > 0);
  assert.deepEqual(motionProblems({ account: "3d", source: "L(1)", lineCount: 1, world: [movingShot], motion: [] }), []);
});

test("motionProblems rejects a thin scene and a frozen 2D shot", () => {
  const thin = { shot: "s1", cameraMoved: true, sceneMoved: true, nodes: THRESHOLDS.minNodes - 1 };
  assert.ok(motionProblems({ account: "3d", source: "L(1)", lineCount: 1, world: [thin], motion: [] }).some((p) => p.includes("nodes")));
  assert.ok(motionProblems({ account: "motion", source: "L(1)", lineCount: 1, world: [], motion: [{ shot: "s1", changed: false }] }).length > 0);
});

test("motionProblems rejects low line coverage", () => {
  const problems = motionProblems({ account: "3d", source: "L(1)", lineCount: 10, world: [], motion: [] });
  assert.ok(problems.some((p) => p.includes("cakupan baris")), problems.join("; "));
});

test("snapshotMotion ignores React useId noise so a frozen card is still frozen", () => {
  const shots = new Map([
    ["s1", { render: () => React.createElement("svg", { id: "r1" }, React.createElement("circle", { cx: 1 })) }],
  ]);
  const samples = snapshotMotion(
    { shots: () => shots } as unknown as VideoDefMotion,
    { dur: 4, lines: [], chunks: [], shots: [{ id: "s1", s: 0, e: 4 }] } as Timeline,
  );
  assert.equal(samples.length, 1);
  assert.equal(samples[0].changed, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/motion-gate.test.mts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/motion-gate-core.mts`**

`lineCoverage`: regex `/\.?L\((\d+)\)/g` over the concatenated sources, count distinct numbers within `1..lineCount`.
`findForbidden`: match `/\bMath\.random\s*\(/` and `/\bDate\.now\s*\(/`.
`countNodes`: recursive count of `Mesh` + `InstancedMesh` nodes.
`snapshotWorld`: for each shot, sample `u ∈ {0.1, 0.5, 0.9}`, call `shot.camera(t)` and `world.update(t, shotId, pose, scene)` with `scene = new Scene()`; compare camera `position`/`target` with `cameraEps`; traverse `world.root` comparing `position`, `rotation`, `scale`, `matrixWorld` elements, `InstancedMesh.instanceMatrix.array` and mesh `material.emissiveIntensity` with `sceneEps`.
`snapshotMotion`: for each shot, `renderToStaticMarkup(shot.render({ t, local, dur, progress }))` at the three samples, strip `/id="[^"]*"/g` and `/url\(#[^)]*\)/g`, compare the three strings.
`motionProblems`: reports `cakupan baris` when `ratio < THRESHOLDS.lineCoverage`, `nodes` when a shot has fewer than `minNodes`, a static-shot message per shot when neither camera nor scene moved (3D) or markup was identical (2D), and every `findForbidden` hit.

- [ ] **Step 4: Implement `scripts/check-motion.mts`**

CLI: `npx tsx scripts/check-motion.mts <slug>`; reads `src/videos/<slug>/{state.ts,world.ts,shots.ts,shots.tsx,index.ts}` (whichever exist), imports `VIDEOS[slug]` from `../src/videos/registry.ts` dynamically, picks `account: "motion" | "3d"` from `video.mode`, runs the core checks, prints `check-motion OK: <slug> (<n> shots, coverage <ratio>)` or lists problems and `process.exit(1)`. Missing registry entry is a hard failure with a message naming the slug.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test scripts/motion-gate.test.mts && npm run lint`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/motion-gate-core.mts scripts/check-motion.mts scripts/motion-gate.test.mts package.json
git commit -m "feat(ci): add deterministic check-motion gate for line beats and shot motion"
```

---

### Task 8: Briefs and workflow wiring

**Files:**
- Modify: `docs/AUTOPILOT.md` (§6)
- Modify: `ops/accounts/sastra-mesin.md` (§Scene 3D)
- Modify: `ops/accounts/cerpenek.md` (§Scene 3D)
- Modify: `ops/accounts/ai-labs.md` (§Visual: Motion Graphics)
- Modify: `ops/ci-prompt.md` (checks list)
- Modify: `.github/workflows/video.yml` (Gates step)
- Test: `scripts/topics.test.mts` (extend)

**Interfaces:**
- Consumes: helper names from Tasks 1–6 (`beat`, `pulse`, `between`, `stepIndex`, `focusOffset`, `tube`, `flowDots`, `gear`, `fan`, `coil`, `arrow`, `cutaway`, `glowMat`, `poseFigure`, `cloud`, `ripple`, `prop`, `BeatCallout`, new `IllustrationStage` variants).
- Produces: brief text and CI wiring only.

- [ ] **Step 1: Write the failing test**

```ts
describe("briefs teach line-beat choreography", () => {
  test("every 3D brief documents the beat helpers and new kit parts", () => {
    for (const p of ["docs/AUTOPILOT.md", "ops/accounts/sastra-mesin.md", "ops/accounts/cerpenek.md"]) {
      const text = fs.readFileSync(path.join(ROOT, p), "utf8");
      assert.match(text, /beat\(t, L\(/, `${p} must show beat(t, L(n))`);
      assert.match(text, /pulse\(t, L\(/, `${p} must show pulse(t, L(n))`);
    }
    const sm = fs.readFileSync(path.join(ROOT, "ops/accounts/sastra-mesin.md"), "utf8");
    for (const name of ["kit.tube(", "kit.gear(", "kit.flowDots(", "kit.cutaway(", "kit.glowMat("]) assert.ok(sm.includes(name), `sastra-mesin must show ${name}`);
    const cp = fs.readFileSync(path.join(ROOT, "ops/accounts/cerpenek.md"), "utf8");
    for (const name of ["poseFigure(", "kit.cloud(", "kit.prop(", "kit.ripple("]) assert.ok(cp.includes(name), `cerpenek must show ${name}`);
  });

  test("ai-labs brief documents the new motion beats", () => {
    const text = fs.readFileSync(path.join(ROOT, "ops/accounts/ai-labs.md"), "utf8");
    for (const s of ["BeatCallout", "agent-loop", "context-window", "code-diff", "activeAt"]) assert.ok(text.includes(s), `ai-labs must document ${s}`);
  });

  test("CI runs the motion gate before rendering", () => {
    const wf = fs.readFileSync(path.join(ROOT, ".github/workflows/video.yml"), "utf8");
    assert.ok(wf.includes("check-motion"), "workflow must run check-motion");
    const prompt = fs.readFileSync(path.join(ROOT, "ops/ci-prompt.md"), "utf8");
    assert.ok(prompt.includes("check-motion"), "ci-prompt must list check-motion");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/topics.test.mts`
Expected: FAIL — briefs lack the new patterns.

- [ ] **Step 3: Update the four briefs**

Each brief gets a short subsection plus one copy-pasteable snippet — no restructuring of existing sections:
- `docs/AUTOPILOT.md` §6: add "**Koreografi per baris**" — every shot wires its sub-animations to the `L(n)` lines spoken in it via `beat(t, L(n))`/`pulse(t, L(n))`; at least one mechanism must visibly move (`flowDots`, spinning `gear`/`fan`, sliding `cutaway`, `glowMat` pulse); cameras need ≥ 2 keyframes plus an optional `focusOffset` nudge.
- `ops/accounts/sastra-mesin.md`: add cutaway/exploded usage with `cutaway` + `tube`/`gear`/`coil`/`fan`/`flowDots`, keeping the cyan/orange/steel semantics, and the rule that the part being narrated is the part that moves.
- `ops/accounts/cerpenek.md`: add `poseFigure(fig, t, mode, seed)` per-line pose switching, `kit.cloud`, `kit.ripple`, `kit.prop`, keeping "tanpa callouts".
- `ops/accounts/ai-labs.md`: require ≥ 2–3 internal `at`/`activeAt` beats tied to `ctx.L(n).s` per shot, and document `BeatCallout` plus the three new `IllustrationStage` variants.

- [ ] **Step 4: Wire the gate into CI**

`.github/workflows/video.yml` Gates step becomes `npm run lint && npm test && npm run check-sync -- "$SLUG" && npm run check-motion -- "$SLUG" && npx remotion bundle --out-dir /tmp/rbundle`; add `check-motion` to the check list in `ops/ci-prompt.md` and to the failing-step name map in the same job.

- [ ] **Step 5: Run tests and lint**

Run: `npm run lint && npm test`
Expected: all suites pass, including the pre-existing brief assertions.

- [ ] **Step 6: Commit**

```bash
git add docs/AUTOPILOT.md ops/accounts/*.md ops/ci-prompt.md .github/workflows/video.yml scripts/topics.test.mts
git commit -m "docs(briefs): require line-beat choreography and wire check-motion into CI"
```

---

## Verification before handoff

- `npm run lint && npm test` — clean.
- `npx remotion bundle --out-dir /tmp/opencode/rbundle` — bundles (registry is empty in the repo, so this only proves the engine still compiles/bundles).
- Eyeball check is deferred: generated videos only exist in CI, so the first scheduled run after merge is the real visual proof. Watch its `check-motion` output for false rejections.
