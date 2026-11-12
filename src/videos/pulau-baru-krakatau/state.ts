/** Layout constants and magma motion as pure functions of time (tied to script lines). */
import { clamp, lerp, ramp } from "../../engine/math";
import type { Ctx } from "../../engine/types";

// Scale: stylized cutaway diorama. Sea level = y 0. Fissure axis runs along +x. Cut face is the plane z = 0.
export const SEAFLOOR = -3.6;
export const BOT = -9.6; // bottom of the rock slab
export const ZB = -9; // back of the rock/water slabs
export const MX = 220; // schematic straight-line map (shot H)
export const MC = 320; // size comparison (shot K)

export const AK = { x: 0, z: -1.7, baseR: 4.6, craterY: 2.05 }; // Anak Krakatau edifice
export const NW = { x: -3.6, z: -1.0 }; // new island cluster, NW (±750 m)
export const SE = { x: 3.25, z: -0.9 }; // new island cluster, SE (±600 m)
export const CH = { x: 0, y: -6.0, z: -0.15 }; // magma chamber (in the cut face)

export const makeState = ({ L, shot }: Ctx) => {
  /** Magma blob climbing the NW dike during line 5 (Langkah 1). */
  const rise = (t: number) => ramp(t, L(5).s + 0.8, L(5).e - 0.2);
  /** Vents "breathe" (Langkah 2): pulsing glow. Deterministic sine — pure function of t. */
  const pulse = (t: number) => 0.55 + 0.45 * Math.sin(t * 2.6);
  /** Cooling during line 7 (Langkah 3): 0 = fresh lava glow, 1 = hardened black rock. */
  const cool = (t: number) => ramp(t, L(7).s + 0.4, L(7).e + 0.6);
  /** New islands: present-day (A/B) full size; hidden during the flashback (C–F); regrow in G. */
  const grow = (t: number) => (t < L(4).s ? 1 : t < L(8).s ? 0 : ramp(t, L(8).s + 0.3, L(8).e - 0.2));
  /** Ash column intensity for the September eruption flashback (line 4). */
  const plume = (t: number) =>
    t < L(4).s ? 0 : t < L(4).e ? ramp(t, L(4).s + 0.4, L(4).s + 1.6) : 1 - ramp(t, L(4).e, L(4).e + 1.5);
  /** Map/comparison reveal helpers for the schematic shots. */
  const mapU = (t: number) => ramp(t, shot("H").s + 0.3, shot("H").s + 2.6);
  const cmpU = (t: number) => ramp(t, shot("K").s + 0.3, shot("K").s + 2.2);
  /** Interpolated NW dike endpoints for blob placement. */
  const dikeNW = { a: { x: -0.75, y: -5.75, z: 0.02 }, b: { x: NW.x, y: -3.3, z: 0.02 } };
  const dikeSE = { a: { x: 0.75, y: -5.75, z: 0.02 }, b: { x: SE.x, y: -3.3, z: 0.02 } };
  return {
    rise,
    pulse,
    cool,
    grow,
    plume,
    mapU,
    cmpU,
    dikeNW,
    dikeSE,
    /** Island height readout for the G-shot chip, in metres (Badan Geologi: ±1–2 m). */
    islandM: (t: number) => lerp(0.2, 1.8, grow(t)),
    clamp01: (v: number) => clamp(v),
  };
};
export type State = ReturnType<typeof makeState>;
