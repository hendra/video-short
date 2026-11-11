/** Layout constants for the bridge diorama and traffic/ship flow. 1 unit ≈ 12 m (Suramadu main span 434 m ≈ 36 u). */
import { lerp, ramp } from "../../engine/math";
import type { Ctx } from "../../engine/types";

export const SEA_Y = -5.2;        // sea surface
export const DECK_Y = 0;          // bridge deck top
export const SPAN = 18;           // pylon half-distance (main span 36 u ≈ 434 m)
export const APP = 13;            // approach viaduct length each side
export const TOWER_TOP = 11.7;    // pylon top (≈ 140 m)
export const DECK_T = 0.55;       // visible deck thickness
export const HALF_W = 1.25;       // deck half-width (≈ 30 m)
export const SMALL_X = 74;        // small-bridge (Sentong) diorama centre
export const SPAN_X = SPAN + APP;  // half deck length (31)

export const makeState = ({ L }: Ctx) => ({
  /** Cable fan anchors on a pylon, from low to high (matches the deck fan). */
  cableAnchors: (() => {
    const a: number[] = [];
    for (let i = 0; i < 8; i++) a.push(lerp(4.3, TOWER_TOP - 0.5, i / 7));
    return a;
  })(),
  /** Deck anchor x positions for cables on the main-span side (offset from pylon). */
  deckAnchorsMain: [3.2, 6.0, 8.6, 10.8, 12.6, 14.3, 15.9, 17.3],
  /** Deck anchor x positions for cables on the approach-span side. */
  deckAnchorsApp: [2.6, 4.8, 6.8, 8.6, 10.2, 11.7, 13.0, 14.1],
  /** Deterministic pseudo-lanes for trucks: [lane, offset, speed, colorIdx]. */
  truckSeed: ((): [number, number, number, number][] => {
    const seed = [7, 3, 11, 5, 9, 1, 13, 6, 4, 12, 2, 10, 8, 14, 15, 16, 17, 18];
    return seed.map((s, i) => [i % 2, (s * 4.7) % 64, 2.6 + (s % 5) * 0.45, s % 6]);
  })(),
  /** Ships: [zSpeed, offsetZ, hullColor] — flow along the strait (z axis), wrap around. */
  shipSeed: [
    [1.15, 12, "#b5482f"],
    [-0.95, -20, "#3f6f8f"],
    [0.8, 40, "#8a6d3b"],
  ] as [number, number, string][],
  /** Glow ramps used by the world update (pulse in E/F/G, then fade out). */
  loadPull: (t: number) => ramp(t, L(5).s + 0.6, L(5).s + 2.0) * (1 - ramp(t, L(7).e - 0.5, L(7).e + 1.5)),   // cables glow E–F
  towerPush: (t: number) => ramp(t, L(7).s + 0.6, L(7).s + 2.2) * (1 - ramp(t, L(8).e - 1.0, L(8).e + 0.5)),  // towers + foundations glow F–G
  clearGlow: (t: number) => ramp(t, L(8).s + 0.6, L(8).s + 2.0),  // clearance arrows in shot G (line 8)
  /** Slow day cycle tint for the finale (warm). */
  warm: (t: number) => ramp(t, L(13).s, L(13).e),
});
export type State = ReturnType<typeof makeState>;
