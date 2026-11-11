/** Layout constants and animation state as pure functions of t (tied to script lines). */
import { clamp, lerp, ramp, rng } from "../../engine/math";
import type { Ctx, Vec3 } from "../../engine/types";

// Scale: 1 unit ≈ 4–5 m. The reservoir runs along x; the diorama is cut at z = 0 (aquarium face).
export const ZB = -13; // back of the diorama
export const BOT = -8.2; // below the deepest bed point
export const WATER_Y = 0; // water surface

/** Lake-bed profile (top of the bed) as a piecewise-linear function of x. */
const BED: [number, number][] = [
  [-28, -1.9],
  [-20, -3.0],
  [-10, -5.4],
  [0, -6.6],
  [13, -6.6],
  [17.5, -5.1],
];
export const bedY = (x: number): number => {
  if (x <= BED[0][0]) return BED[0][1];
  for (let i = 0; i < BED.length - 1; i++) {
    const [x0, y0] = BED[i], [x1, y1] = BED[i + 1];
    if (x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0));
  }
  return BED[BED.length - 1][1];
};

/** The eight PV islands: 4 columns × 2 rows, deterministic jitter. */
export const ISLANDS: { x: number; z: number }[] = (() => {
  const r = rng(7);
  const cols = [-12.5, -6.6, -0.7, 5.2];
  const rows = [-3.1, -8.4];
  const out: { x: number; z: number }[] = [];
  for (const z of rows)
    for (const x of cols) out.push({ x: x + (r() - 0.5) * 0.5, z: z + (r() - 0.5) * 0.5 });
  return out;
})();
/** Index of the two islands still being finished (ghosted until the progress shot). */
export const GHOST = [6, 7];

export const ISPAN: [number, number] = [4.9, 3.7]; // island size (x, z)

/** Point on the underwater export cable: island A → sag to bed → along bed → up the shore to the substation. */
export const CABLE_POINTS: Vec3[] = [
  [ISLANDS[0].x, -0.35, ISLANDS[0].z],
  [ISLANDS[0].x + 1.2, bedY(ISLANDS[0].x + 1.2) - 0.12, ISLANDS[0].z + 0.8],
  [-14, bedY(-14) - 0.12, -4.2],
  [-17.2, bedY(-17.2) - 0.12, -3.0],
  [-19.4, -0.9, -1.2],
  [-20.6, 0.55, -0.4],
  [-21.6, 0.95, 0],
];

export const SUBSTATION_X = -21.6; // shore substation centre
export const DAM_X = 17.5; // dam toe (west face)
export const CREST_Y = 4.6; // dam crest height

export const makeState = ({ L, shot }: Ctx) => ({
  /** Gentle floating bob for island i. */
  bob: (i: number, t: number) => Math.sin(t * 0.85 + i * 1.7) * 0.05,
  /** 0 → islands 6 & 7 are ghosts still being lowered into place; 1 → fully seated. */
  ghost: (t: number) => ramp(t, shot("I").s + 1.0, shot("I").e - 0.6),
  /** Progress-ring value shown in the chip during shot I. */
  progress: (t: number) => lerp(62, 70, ramp(t, shot("I").s + 0.2, shot("I").s + 2.0)),
  /** Cool water under the panels (shot E): gentle breathing strength. */
  cool: (t: number) => 0.55 + 0.45 * Math.sin(t * 1.6) ** 2,
  /** Pulse position along the export cable, 0..1. */
  pulse: (t: number, k: number, speed = 0.16) => (t * speed + k / 7) % 1,
  /** Boat drift across the frame. */
  boat: (t: number) => Math.sin(t * 0.32) * 1.6,
  /** Warm colour grade for the closing orbit. */
  warm: (t: number) => ramp(t, shot("J").s, shot("J").s + 2.2),
  clamp,
  lerp,
  ramp,
  L,
});
export type State = ReturnType<typeof makeState>;
