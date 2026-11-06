/** Layout constants and story state as pure functions of time (tied to script lines). */
import { clamp, lerp, ramp, smooth } from "../../engine/math";
import type { Ctx, Vec3 } from "../../engine/types";

// ---------- stages (far apart, one camera)
/** Map: 1 unit = 0.5° of lon/lat, origin at 27°N 88°W, +x east, -z north. */
export const MK = 2;
export const geo = (lat: number, lon: number, y = 0): Vec3 => [(lon + 88) * MK, y, -(lat - 27) * MK];
export const AUSTIN = geo(30.27, -97.74);
export const SITE = geo(26.63, -80.13);
export const ELEUTHERA = geo(25.47, -76.68);

/** Sky stage: the jet (nose +x, length ≈ 6 units, 1 unit ≈ 3 m) hangs at JET; clouds move around it. */
export const SKY_X = 300;
export const JET: Vec3 = [SKY_X, 60, 0];

/** Altitude chart: 1 unit = 1 km vertically, 4 units = 1 minute horizontally. */
export const ALT_X = 600;
export const ALT0 = 35250 * 0.0003048; // 10.74 km (FAA)
export const ALT1 = 8750 * 0.0003048; // 2.67 km
export const ALT_REQ = 37000 * 0.0003048; // 11.28 km requested
export const CHART = { x0: ALT_X - 4.5, level: 2.2, drop: 4 }; // level segment, then 1 min plunge

/** Ground stage: 1 unit = 50 m, site at the origin of the stage, Military Trail along z. */
export const GX = 1000;
export const KM = 20; // units per km on the ground stage

/** Altitude profile used by the chart (km) at chart-x u (units from x0). Wobble = ±0.2 km turbulence. */
export const profile = (u: number) => {
  if (u <= CHART.level) return ALT0 + 0.2 * Math.sin(u * 7.3) * Math.sin(u * 2.1 + 0.4);
  const k = clamp((u - CHART.level) / CHART.drop);
  // accelerating dive (10k → 30k ft/min): quadratic-ish, ends at ALT1 after one minute
  return lerp(ALT0, ALT1, Math.pow(k, 1.6));
};

export const makeState = ({ L, shot }: Ctx) => {
  return {
    /** Route arc reveal on the map (shot C). */
    route: (t: number) => (t < shot("C").s ? 0 : t >= shot("C").e ? 1 : ramp(t, L(3).s + 0.6, L(3).e - 0.6)),
    /** Ice build-up on the leading edges. */
    ice: (t: number) => ramp(t, L(4).s + 3.5, L(5).e),
    /** Turbulence amplitude (0..1). */
    turb: (t: number) => ramp(t, L(4).s + 1.0, L(4).s + 2.5) * (t > L(9).s ? 0 : 1),
    /** Nose-up for the climb request, then the upset: pitch (rad, + = nose up) and bank (rad, + = right wing down). */
    attitude: (t: number) => {
      const up = 0.07 * ramp(t, L(6).s + 0.8, L(6).s + 2.4);
      const dive = ramp(t, L(7).s + 1.6, L(8).e);
      return { pitch: up * (1 - dive) - 0.55 * dive, bank: 0.62 * smooth(clamp((t - L(7).s - 2.2) / 4)) };
    },
    /** Vertical speed in the sky stage (units/s the clouds rush upwards). */
    sink: (t: number) => 2 + 60 * ramp(t, L(7).s + 1.6, L(8).e),
    /** Chart progress: chart-x of the marker (0..level+drop). */
    chartU: (t: number) => lerp(0, CHART.level + CHART.drop, ramp(t, L(9).s + 0.3, L(9).e + 0.2)),
    /** Elevator highlight on the tail (shot I). */
    elevator: (t: number) => ramp(t, L(11).s + 0.4, L(11).s + 1.4),
    /** Ring band 2–6 km (shot J). */
    band: (t: number) => ramp(t, shot("J").s + 0.3, shot("J").s + 1.8),
  };
};
export type State = ReturnType<typeof makeState>;
