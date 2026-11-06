/** Layout constants and the TBM's motion as pure functions of time (tied to script lines). */
import { clamp, lerp, ramp } from "../../engine/math";
import type { Ctx } from "../../engine/types";

// Scale: 1 unit ≈ 4 m. Tunnel axis runs along +x at z = 0; the cut face of the soil is the plane z = 0.
export const TY = -7; // tunnel centre (≈ 28 m deep)
export const R = 0.85; // shield radius (Ø ≈ 6.8 m)
export const BORE = 0.88;
export const RING_OUT = 0.82;
export const RING_IN = 0.72;
export const W = 0.375; // ring width (≈ 1.5 m)
export const SHIELD = 2.2; // shield length
export const XS = 16; // diaphragm wall of the station
export const XS_W = 0.5; // wall thickness
export const X0 = -40; // first ring
export const F_WORK = 5.2; // where the mechanism shots happen
export const MX = 200; // six-TBM diorama
export const BOT = -12;
export const ZB = -9; // back of the diorama

export const makeState = ({ L, shot }: Ctx) => {
  /** Inchworm cycle position c: integer part = rings completed in the sequence, u<0.6 pushing, u>=0.6 erecting. */
  const cyc = (t: number) => {
    const G = shot("G"), H = shot("H"), I = shot("I"), J = shot("J");
    if (t < G.s) return 0.6; // waiting with jacks extended, gap ready for a ring
    if (t < G.e) return lerp(0.6, 1.0, ramp(t, L(9).s + 0.6, L(9).e));
    if (t < H.e) return lerp(1.0, 3.0, clamp((t - H.s) / (H.e - H.s)));
    if (t < I.e) return lerp(3.0, 3.6, clamp((t - I.s) / (I.e - I.s)));
    if (t < J.e) return lerp(3.6, 8.6, ramp(t, J.s + 0.4, J.e - 0.3)); // a day in fast-forward: 5 rings
    return 8.6;
  };
  // rings already built so that, at c = 0.6 (jacks fully extended), the cutterhead sits at F_WORK
  const N0 = Math.round((F_WORK - SHIELD - X0) / W) - 1;
  return {
    cyc,
    /** Tail of the shield, front of the cutterhead, rings fully placed, ring being erected (0..1), jack extension. */
    tbm: (t: number, shotId: string) => {
      if (shotId === "A") {
        // breakthrough into the station
        const tb = L(1).s + 2.6;
        const front = lerp(XS - 0.05, XS + XS_W + 0.9, ramp(t, tb - 0.5, tb + 1.6));
        return { front, tail: front - SHIELD, rings: Math.floor((front - SHIELD - 0.2 - X0) / W), erect: 0, ext: 0.2, through: ramp(t, tb, tb + 0.4), tb };
      }
      const c = cyc(t), k = Math.floor(c), u = c - k;
      const push = Math.min(1, u / 0.6);
      const erect = u >= 0.6 ? (u - 0.6) / 0.4 : 0;
      const tail = X0 + (N0 + k) * W + W * push;
      return { front: tail + SHIELD, tail, rings: N0 + k, erect, ext: W * push, through: 0, tb: Infinity };
    },
    /** Pressure-balance arrows grow during line 6, the "risk" wedge shows during line 3. */
    pressure: (t: number) => ramp(t, L(6).s + 1.0, L(6).s + 2.2),
    risk: (t: number) => ramp(t, (L(3).s + L(3).e) / 2, (L(3).s + L(3).e) / 2 + 0.6) * (1 - ramp(t, L(7).s + 1.0, L(7).s + 1.6)),
    grout: (t: number) => ramp(t, L(11).s + 1.6, L(11).e),
    dayClock: (t: number) => ramp(t, shot("J").s + 0.4, shot("J").e - 0.3),
  };
};
export type State = ReturnType<typeof makeState>;
