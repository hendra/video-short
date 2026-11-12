/** Layout constants and rover motion as pure functions of time (tied to script lines). */
import { clamp, lerp, ramp, smooth } from "../../engine/math";
import type { Ctx, Vec3 } from "../../engine/types";

// Stylised lunar south-pole diorama. 1 unit ≈ 2.5 m. Crater at CRATER (x, z).
export const CRATER: Vec3 = [4.5, 0, -2.5];
export const CRATER_R = 3.9;
const CRATER_DEPTH = 3.1;

/** Height of the terrain surface at (x, z): gentle dunes + rim bump − crater bowl. */
export const terrainHeight = (x: number, z: number) => {
  let h = 0.16 * Math.sin(x * 0.55 + 1.7) * Math.cos(z * 0.45 + 0.4) + 0.11 * Math.sin(x * 1.25 + 0.6) * Math.sin(z * 1.05 + 2.0);
  const d = Math.hypot(x - CRATER[0], z - CRATER[2]);
  h += 0.42 * Math.exp(-(((d - CRATER_R) / 0.6) ** 2)); // raised rim
  if (d < CRATER_R) h -= CRATER_DEPTH * (Math.cos((Math.PI * d) / CRATER_R) * 0.5 + 0.5); // smooth bowl
  return h;
};

/** Rover start on flat ground, facing the crater (+x). */
export const ROVER_HOME: Vec3 = [-4.6, 0, 2.6];
/** Where the rover drives to during the closing shots. */
export const ROVER_END: Vec3 = [1.4, 0, 0.6];

export const MX = 120; // "spare parts from Mars" schematic diorama

export const makeState = ({ L, shot }: Ctx) => {
  /** 0..1 drive progress: parked until line 12, then rolls toward the crater rim. */
  const drive = (t: number) => ramp(t, shot("K").s + 0.3, L(13).e - 0.4);
  const roverPos = (t: number): Vec3 => {
    const u = smooth(drive(t));
    const x = lerp(ROVER_HOME[0], ROVER_END[0], u);
    const z = lerp(ROVER_HOME[2], ROVER_END[2], u);
    return [x, terrainHeight(x, z), z];
  };
  /** Wheel rotation angle from distance travelled (wheel r = 0.28). */
  const wheelSpin = (t: number) => {
    const p = roverPos(t);
    const d0 = Math.hypot(ROVER_HOME[0] - ROVER_END[0], ROVER_HOME[2] - ROVER_END[2]);
    const d = Math.hypot(p[0] - ROVER_HOME[0], p[2] - ROVER_HOME[2]);
    void d0;
    return d / 0.28;
  };
  /** Drill arm extension 0..1: extends during line 6, retracts by line 7. */
  const drill = (t: number) => ramp(t, L(6).s + 0.9, L(6).s + 2.6) * (1 - ramp(t, L(6).e + 0.2, L(6).e + 1.4));
  /** Spectrometer beam sweep 0..1..0 across the ground during line 7. */
  const scan = (t: number) => {
    const a = L(7).s + 0.8, b = L(7).e - 0.4;
    return Math.sin(clamp((t - a) / Math.max(0.1, b - a)) * Math.PI) * ramp(t, a, a + 0.5);
  };
  /** RTG heat glow pulse during line 5 (and a soft idle glow elsewhere). */
  const rtg = (t: number) => {
    const active = shot("D").s <= t && t < shot("D").e;
    const base = active ? 0.72 + 0.28 * Math.sin(t * 3.4) : 0.38;
    return base * ramp(t, L(5).s - 0.2, L(5).s + 0.8) + 0.18;
  };
  /** Ice glow reveal: starts in line 8, fully bright in line 9. */
  const ice = (t: number) => 0.25 + 0.75 * ramp(t, L(8).s + 1.0, L(9).e - 0.6);
  /** Frost shimmer inside the crater (line 8 onwards). */
  const frost = (t: number) => ramp(t, L(8).s + 0.6, L(8).e - 0.2);
  /** Warm grade for the closing shots. */
  const warm = (t: number) => ramp(t, L(12).s + 0.4, L(12).s + 2.6);
  /** RTG exhaust heat shimmer particles intensity. */
  const rtgHeat = (t: number) => (shot("D").s <= t && t < shot("D").e ? 1 : 0.35);

  return { drive, roverPos, wheelSpin, drill, scan, rtg, ice, frost, warm, rtgHeat };
};
export type State = ReturnType<typeof makeState>;
