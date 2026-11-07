/** Layout + data for "rumus kiamat" (von Foerster, Mora & Amiot, Science 1960). All motion = pure function of t. */
import { clamp, ramp, rng } from "../../engine/math";
import type { Ctx, Vec3 } from "../../engine/types";

// ---------- the 1960 fit: N = K / (U - t)^k  (Science 132:1291, eq. 10–11)
export const K = 1.79e11;
export const U = 2026.87;
export const KEXP = 0.99;
/** Formula population in billions. */
export const formula = (year: number) => K / Math.pow(Math.max(1e-4, U - year), KEXP) / 1e9;

/** UN World Population Prospects 2024 (billions): estimates to 2024, medium projection after. Pre-1950 = historical estimates. */
export const REAL: [number, number][] = [
  [1900, 1.65], [1910, 1.75], [1920, 1.86], [1930, 2.07], [1940, 2.3], [1950, 2.5], [1960, 3.02], [1970, 3.7], [1980, 4.44],
  [1990, 5.33], [2000, 6.15], [2010, 6.99], [2020, 7.84], [2024, 8.16],
];
export const PROJ: [number, number][] = [
  [2024, 8.16], [2030, 8.55], [2040, 9.19], [2050, 9.66], [2060, 10.0], [2070, 10.2], [2080, 10.29], [2085, 10.3], [2090, 10.28], [2100, 10.18],
];
export const realAt = (year: number) => {
  const all = [...REAL, ...PROJ.slice(1)];
  if (year <= all[0][0]) return all[0][1];
  for (let i = 1; i < all.length; i++) if (year <= all[i][0]) {
    const [y0, v0] = all[i - 1], [y1, v1] = all[i];
    return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
  }
  return all[all.length - 1][1];
};

/** 24 data points like the paper's (years 0–1950s); values = fit × (1 ± 7 % rms) — illustrative. */
export const POINT_YEARS = [0, 200, 400, 600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1650, 1700, 1750, 1800, 1850, 1880, 1900, 1920, 1930, 1940, 1950, 1955];
export const POINTS = (() => {
  const r = rng(1960);
  return POINT_YEARS.map((y) => [y, formula(y) * (1 + (r() - 0.5) * 0.24)] as [number, number]);
})();

/** Doubling chain from year 1000 (computed from the fit): 517 → 257 → 127 → 63 years. */
export const DOUBLINGS: [number, number][] = [[1000, 1517], [1517, 1774], [1774, 1901], [1901, 1964]];

// ---------- stages
/** LONG chart (year 0 → 2027) at the origin. */
export const LY = 2.0; // units per billion
export const lx = (year: number) => -12 + (year / 2030) * 24;
export const lp = (year: number, n = formula(year)): Vec3 => [lx(year), n * LY, 0];
export const L_CLIP = 70; // curve drawn up to this height

/** Queue analogy stage. */
export const QX = 200;

/** MODERN chart (1900 → 2100). */
export const MX = 400;
export const MY = 1.0; // units per billion
export const mx = (year: number) => MX - 12 + (year - 1900) * 0.12;
export const mp = (year: number, n: number): Vec3 => [mx(year), n * MY, 0];
export const M_CLIP = 36;

/** Desk stage: calendar + journal. */
export const DX = 600;

export const makeState = ({ L, shot }: Ctx) => ({
  /** Data points revealed (0..24). */
  points: (t: number) => (t < shot("D").s ? 0 : 24 * ramp(t, L(4).s + 0.8, L(4).e - 0.3)),
  /** Doubling brackets revealed (0..4). */
  doublings: (t: number) => 4 * ramp(t, L(5).s + 0.8, L(5).e - 0.4),
  /** Fitted curve draw progress on the long chart (0..1 over years 0..U). */
  fit: (t: number) => (t < shot("C").s ? 0 : t < shot("F").s ? 0.25 * ramp(t, shot("C").s, shot("C").e) : t < shot("G").s ? 0.25 + 0.55 * ramp(t, L(6).s + 1.2, L(6).e) : 0.8 + 0.2 * ramp(t, L(7).s + 0.6, L(7).e - 0.8)),
  /** Year of the marker climbing the curve in shot G. */
  gYear: (t: number) => 1950 + (U - 0.02 - 1950) * Math.pow(ramp(t, L(7).s + 0.6, L(7).e - 0.8), 0.35),
  /** Queue: number of people in line (hyperbolic arrival). */
  queue: (t: number) => {
    const u = ramp(t, L(8).s + 0.2, L(8).e + 0.4);
    return Math.min(160, 3 + Math.floor(4 / Math.max(0.025, 1 - u)));
  },
  /** Modern chart: real-data draw (year reached), formula draw (year reached), projection progress. */
  realYear: (t: number) => (t < shot("I").s ? 1900 : 1900 + (2024 - 1900) * (t < shot("J").s ? 0.75 * ramp(t, L(9).s + 0.3, L(9).e) : t < shot("K").s ? 0.75 : 0.75 + 0.25 * ramp(t, L(11).s, L(11).s + 2.5))),
  fitYear: (t: number) => (t < shot("I").s ? 1900 : t < shot("J").s ? 1900 + 93 * ramp(t, L(9).s + 0.3, L(9).e) : 1993 + (2026.0 - 1993) * ramp(t, L(10).s + 0.5, L(10).e - 0.5)),
  proj: (t: number) => ramp(t, L(12).s + 0.4, L(12).e - 0.4),
  journal: (t: number) => clamp((t - L(2).s - 0.3) / 0.8),
});
export type State = ReturnType<typeof makeState>;
