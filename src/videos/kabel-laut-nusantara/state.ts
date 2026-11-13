/** Layout constants and the animation clock as pure functions of time (tied to script lines). */
import { CatmullRomCurve3, Vector3 } from "three";
import { clamp, lerp, ramp } from "../../engine/math";
import type { Ctx } from "../../engine/types";

// Scale: 1 unit ≈ 6 m. The sea strait runs along x; the cut face of the seafloor is the plane z = 0.
export const BOT = -9; // bottom of the cut face
export const ZB = -9; // back of the diorama
export const SEA_L = -5.5; // sea edges (x)
export const SEA_R = 5.5;
export const LAND_L = -20; // outer edges of the two islands
export const LAND_R = 20;
export const FX = 120; // magnified fiber cross-section scene
export const CX = 200; // magnified submarine-cable cross-section scene
export const MP = 290; // schematic map of the archipelago

/** Submarine cable: shore-to-shore catenary sagging mid-strait on the seabed. */
export const cableCurve = new CatmullRomCurve3([
  new Vector3(-6.9, -1.15, -1.6),
  new Vector3(-4.6, -3.1, -1.6),
  new Vector3(-2.1, -4.5, -1.6),
  new Vector3(0.4, -4.45, -1.6),
  new Vector3(3.1, -3.9, -1.6),
  new Vector3(6.9, -1.2, -1.6),
]);
export const FAULT_U = 0.62; // where the cable "fails" in shot H
export const cablePoint = (u: number) => cableCurve.getPoint(clamp(u));

/** Schematic map arcs (island hops), LOCAL coordinates; the map group sits at x = MP. */
export const mapArcs = [
  new CatmullRomCurve3([new Vector3(-4.3, 0.45, 2.1), new Vector3(-1.5, 2.5, 0.8), new Vector3(1.5, 0.55, -0.7)]),  // Jawa -> Sulawesi
  new CatmullRomCurve3([new Vector3(-1.3, 0.45, -1.7), new Vector3(0.1, 1.9, -1.9), new Vector3(1.3, 0.55, -1.1)]), // Kalimantan -> Sulawesi
  new CatmullRomCurve3([new Vector3(1.7, 0.5, -0.6), new Vector3(3.1, 2.2, -1.0), new Vector3(4.5, 0.45, -0.5)]),   // Sulawesi -> Papua
];
/** World-space point on a map arc. */
export const mapArcWorld = (i: number, u: number): [number, number, number] => {
  const p = mapArcs[i].getPoint(clamp(u));
  return [MP + p.x, p.y, p.z];
};

/** Backup corridor (main diorama): monopole -> sky arc -> data-center tower. Used for plain failure rerouting visuals. */
export const backupArc = new CatmullRomCurve3([
  new Vector3(-9.2, 3.2, -3.2),
  new Vector3(0.8, 4.35, -4.0),
  new Vector3(10.6, 2.6, -4.2),
]);

/** Straight light packets inside the magnified fiber (shot C): 4 packets marching +x. */
export const fiberPulseX = (t: number, i: number) => FX - 4.2 + (((t * 0.33 + i / 4) % 1) * 8.4);

/** Light packets racing along the submarine cable; n packets evenly spaced, u in [0,1). */
export const cablePulse = (t: number, i: number, n = 6) => (t * 0.075 + i / n) % 1;
export const cablePulseVec = (t: number, i: number, n = 6) => cableCurve.getPoint(cablePulse(t, i, n));

/** Zigzag the single hero packet takes inside the magnified fiber (shot D). u sweeps 0 -> 1. */
export const zigPath = (u: number): [number, number, number] => {
  const x = lerp(FX - 4.1, FX + 4.1, u);
  const tri = Math.abs(((u * 6) % 2) - 1) * 2 - 1; // triangle wave -1..1
  return [x, tri * 0.26, 0];
};

/** Ship drift + bob (gentle; the diorama must feel alive, never still). */
export const shipX = (t: number) => 1.7 + Math.sin(t * 0.09) * 1.35;
export const shipBob = (t: number) => Math.sin(t * 0.85) * 0.055;
export const shipRoll = (t: number) => Math.sin(t * 0.66 + 1.2) * 0.028;

export const makeState = ({ L, shot }: Ctx) => ({
  /** Dusk warmth for the final two shots (lines 14–16). */
  warm: (t: number) => ramp(t, L(14).s + 0.4, L(14).s + 3.2),
  /** Route switch in shot H: 0 = traffic on the sea cable, 1 = traffic on the backup corridor. */
  switch: (t: number) => ramp(t, L(12).s + 1.3, L(12).s + 3.0),
  /** Fault flash intensity (H only): strong right after line 12 starts, fading before the line ends. */
  fault: (t: number) => {
    if (t < shot("H").s) return 0;
    const on = ramp(t, L(12).s + 0.15, L(12).s + 0.8);
    const off = 1 - ramp(t, L(12).e - 0.9, L(12).e);
    return on * off * (0.72 + 0.28 * Math.sin(t * 11));
  },
  /** Backup corridor opacity in shot H. */
  /** Backup corridor glow: fades in during line 12 and fades out by the end of shot H. */
  arcGlow: (t: number) => ramp(t, L(12).s + 1.0, L(12).s + 2.4) * (1 - ramp(t, shot("H").e - 0.8, shot("H").e + 1.5)),
  /** Sea-cable emissive fades as traffic switches to the backup corridor. */
  cableFade: (t: number) => 1 - 0.75 * ramp(t, L(12).s + 1.2, L(12).s + 3.0),
  /** Hero pulse position inside the magnified fiber (shots C & D): straight in C, zigzag in D. */
  fiberU: (t: number) => clamp((t - L(7).s + 1.2) / (L(8).e - L(7).s + 1.6)),
  /** Zigzag path overlay opacity (shot D). */
  zig: (t: number) => ramp(t, L(7).s + 0.4, L(7).s + 1.4) * (1 - ramp(t, L(8).e + 0.2, L(8).e + 0.8)),
  waterShimmer: (t: number) => 0.52 + 0.07 * Math.sin(t * 1.25),
  /** Blinking beacon on the landing station: period ~1.6 s. */
  beacon: (t: number) => (Math.sin(t * 3.9) > 0.55 ? 1 : 0.12),
});

export type State = ReturnType<typeof makeState>;
