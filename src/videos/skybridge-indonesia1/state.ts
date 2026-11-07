/** Layout + story state for the Indonesia 1 skybridge lift. 1 unit = 3 m. All motion = pure function of t. */
import { clamp, lerp, ramp, smooth } from "../../engine/math";
import type { Ctx } from "../../engine/types";

export const M = 1 / 3; // units per metre
export const TOWER_W = 16; // footprint (48 m) — illustrative
export const TOWER_H_S = 306 * M;
export const TOWER_H_N = 303 * M;
export const ARM = 24 * M; // cantilever 20–27 m → 24 m average (illustrative)
export const SPAN = 26 * M; // lifted truss length (illustrative; total gap = 2 arms + span)
export const GAP = 2 * ARM + SPAN; // inner-face distance
export const TX = GAP / 2 + TOWER_W / 2; // tower centre x (±)
export const Y_TOP = 117 * M; // final elevation of the truss bottom chord (117 m)
export const LOWER_BRIDGE_Y = 12 * M; // existing floor 3–5 skybridge (roof)
export const Y0 = LOWER_BRIDGE_Y + 0.25; // assembled on the lower skybridge roof
export const TRUSS_H = 9 * M; // two floors
export const TRUSS_W = 4.2; // ~12.6 m wide
export const JACK_Y = Y_TOP + TRUSS_H + 1.6; // jacks sit on the arm tops

/** Jack close-up stage. */
export const JX = 500;
export const STROKE = 1.0;

/** Strand-jack cycle at phase c (cycles): piston extension and which anchor grips. */
export const jackPhase = (c: number) => {
  const p = c % 1;
  const ext = p < 0.55 ? smooth(p / 0.55) * STROKE : p < 0.65 ? STROKE : STROKE * (1 - smooth((p - 0.65) / 0.35));
  return { p, ext, upGrip: p < 0.6, lowGrip: p >= 0.55 };
};

export const makeState = ({ L, shot }: Ctx) => {
  const liftStart = L(7).s + 0.4;
  const liftEnd = L(8).e - 0.6;
  return {
    /** Truss members built (0..1). */
    build: (t: number) => (t < shot("D").s ? 1 : t < shot("E").s ? ramp(t, L(4).s + 0.3, L(4).e - 0.4) : 1),
    /** Jacks + strands installed (0..1). */
    jacks: (t: number) => (t < shot("E").s ? 0 : ramp(t, L(5).s + 1.0, L(5).s + 3.8)),
    /** Truss bottom elevation (units). G: first metres + tilt demo; H: the long climb. */
    trussY: (t: number) => {
      if (t < liftStart) return Y0;
      const g = ramp(t, liftStart, L(7).e) * 0.12; // first 12 % during the sync demo
      const h = ramp(t, L(8).s + 0.2, liftEnd);
      const k = t < L(8).s ? g : lerp(0.12, 1, smooth(h));
      return lerp(Y0, Y_TOP, k);
    },
    /** Tilt (rad, + = east end higher) — the "one side faster" demo, then corrected. */
    tilt: (t: number) => {
      const a = ramp(t, L(7).s + 3.0, L(7).s + 4.2);
      const b = ramp(t, L(7).s + 5.0, L(7).s + 6.2);
      return 0.09 * (a - b);
    },
    /** Lock flash (0..1) and strands released (0..1). */
    lock: (t: number) => ramp(t, L(9).s + 0.6, L(9).s + 1.6),
    release: (t: number) => ramp(t, L(9).s + 2.4, L(9).e - 0.2),
    /** Jack cycle phase (continuous) for the close-up. */
    cycle: (t: number) => Math.max(0, t - shot("F").s - 0.6) / 2.6,
    /** Warm light at the end. */
    dusk: (t: number) => smooth(clamp((t - shot("K").s) / 4)),
  };
};
export type State = ReturnType<typeof makeState>;
