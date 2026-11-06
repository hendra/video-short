/** Story state as pure functions of time, keyed to script lines (see naskah.txt). */
import { lerp, ramp } from "../../engine/math";
import type { Ctx } from "../../engine/types";

// World layout (x): kampung -12..1 | kolam 1..3 | tanggul 3..4.2 | sungai 4.2..10 | tepi 10..12
// z: -12 (towards the sea) .. 4 (cut face, facing the camera)
export const Z0 = -12;
export const Z1 = 4;
export const BOT = -11;
export const GATE_OPEN = 1.05;
export const GATE_SHUT = -1.45;
export const GX = -60; // galon diorama
export const MX = 60; // map diorama
export const GALON_N = 1210; // 23,000 L / 19 L per galon ≈ 1,210
export const GALON_COLS = 35;
export const galonPos = (i: number): [number, number] => [GX - 6.8 + (i % GALON_COLS) * 0.4, -6.8 + Math.floor(i / GALON_COLS) * 0.4];

export const makeState = ({ L, shot }: Ctx) => {
  const endStart = () => shot("I").s;
  const gateT = () => L(7).e - 1.2;
  const mid = (n: number) => (L(n).s + L(n).e) / 2;
  return {
    gateT,
    riverLevel: (t: number) => {
      let y = lerp(-1.2, 1.55, ramp(t, L(4).s, L(5).e));
      y = lerp(y, 1.8, ramp(t, L(11).s, L(11).e));
      return lerp(y, -0.9, ramp(t, endStart(), endStart() + 0.01));
    },
    seaLevel: (t: number) => lerp(lerp(-0.6, 1.35, ramp(t, L(11).s, L(11).e)), -0.6, ramp(t, endStart(), endStart() + 0.01)),
    gateClose: (t: number) => ramp(t, gateT(), gateT() + 0.8),
    gateY: (t: number) => lerp(GATE_OPEN, GATE_SHUT, ramp(t, gateT(), gateT() + 0.8)) + 0.45,
    pondLevel: (t: number) => lerp(lerp(-1.48, -0.04, ramp(t, L(6).s, L(6).e)), -1.25, ramp(t, L(9).s + 0.6, L(9).e)),
    floodLevel: (t: number) => lerp(lerp(0, 0.32, ramp(t, mid(6), L(6).e + 0.4)), 0, ramp(t, L(9).s + 0.6, L(9).e)),
    rain: (t: number) => ramp(t, L(4).s, L(4).s + 0.6) * (1 - ramp(t, L(9).e, L(9).e + 0.6)),
    backflowOn: (t: number) => t > L(6).s && t < gateT() + 0.6,
    /** Pump flow 0..1: starts at "pompa nyala", chokes at high tide, stops when trash clogs the screen. */
    pumpFlow: (t: number) => {
      if (t >= endStart()) return 1;
      if (t < L(9).s + 0.5) return 0;
      let f = ramp(t, L(9).s + 0.5, L(9).s + 1.2);
      const tide = ramp(t, mid(11), L(11).e) * (1 - ramp(t, shot("G").s, shot("G").s + 0.01));
      f *= lerp(1, 0.12, tide);
      f *= 1 - ramp(t, mid(14), mid(14) + 0.6);
      return f;
    },
  };
};
export type State = ReturnType<typeof makeState>;
