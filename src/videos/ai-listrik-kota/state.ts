/** Layout constants and story animations as pure functions of time (tied to script lines). */
import { clamp, ramp } from "../../engine/math";
import type { Ctx } from "../../engine/types";

// Scale: 1 unit ≈ 2 m. The data hall runs along -z; the cut face is the plane z = 0 (open to the camera).
export const HW = 6; // half width of the hall (x)
export const HL = 18; // length (z: 0 .. -HL)
export const HH = 5; // ceiling height
export const RACK_X = 3.2; // aisle at x = 0, rack rows at ±RACK_X
export const RACK_H = 3;
export const RACK_Z = Array.from({ length: 10 }, (_, i) => -1.6 - i * 1.65);
export const ROOF_Z0 = -9; // roof shelf (with the chillers) covers z < ROOF_Z0
export const CITY = { x: -12, z: -52, n: 20, sp: 1.2 }; // 400 symbolic houses
export const CX = 120; // bar chart
export const MG = { x: 200, cols: 5, rows: 4 }; // 20-hall campus + big city
export const MEGA_CITY = { x: 200, z: -64, nx: 40, nz: 32, sp: 1.0 };
export const BAR = { h24: 4.15, h30: 9.45, japan: 9.1 }; // 1 unit = 100 TWh

export const makeState = ({ L, shot }: Ctx) => ({
  /** Chips start computing (line 4/6): LEDs blink faster, heat builds in line 6. */
  load: (t: number) => 0.35 + 0.65 * ramp(t, L(4).s + 0.5, L(4).e),
  power: (t: number) => ramp(t, L(5).s + 0.3, L(5).s + 1.6),
  gen: (t: number) => ramp(t, L(5).s + 3.2, L(5).s + 4.2),
  heat: (t: number) => ramp(t, L(6).s + 1.8, L(6).e + 1.2),
  cooling: (t: number) => ramp(t, L(7).s + 2.4, L(7).s + 4.2),
  stove: (t: number) => ramp(t, L(8).s + 0.2, L(8).s + 1.8),
  houses1: (t: number) => ramp(t, L(2).s + 3.0, L(2).e - 0.4),
  bar24: (t: number) => ramp(t, L(9).s + 1.2, L(9).s + 4.0),
  bar30: (t: number) => ramp(t, L(10).s + 0.6, L(10).s + 3.4),
  japan: (t: number) => ramp(t, L(10).s + 3.0, L(10).s + 3.8),
  mega: (t: number) => ramp(t, L(11).s + 0.5, L(11).s + 3.0),
  megaCity: (t: number) => ramp(t, L(11).s + 3.2, L(11).e),
  chipPop: (t: number) => clamp(ramp(t, shot("C").s + 0.2, shot("C").s + 1.0)),
});
export type State = ReturnType<typeof makeState>;
