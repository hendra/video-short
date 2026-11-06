import { fmtID, keyframes, orbit, ramp } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { GALON_COLS, GALON_N, GX, MX, Z1, galonPos, makeState } from "./state";

/**
 * One entry per shot id listed in config.json. Camera keys are [position, target].
 * Callout `at` times are tied to script lines via L(n), so retiming the VO never breaks them.
 */
export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const firstGalon = galonPos(GALON_N - GALON_COLS);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);

  return {
    A: {
      label: "Surabaya · Nov 2026",
      title: "*10 rumah pompa* baru",
      camera: K("A", [[[-15, 17, 24], [-3, 0, -3]], [[7, 10, 17], [2, 0.6, -2.5]]]),
      callouts: [
        { text: "kampung", anchor: () => [-6, 1.1, -5], at: 0.6, dx: -40, dy: -170 },
        { text: "rumah pompa", anchor: () => [2, 1.8, -3.5], at: L(1).s + 1.6, dx: -60, dy: -230, variant: "orange" },
        { text: "sungai", anchor: () => [7.2, S.riverLevel(0) + 0.05, -3], at: L(1).e - 0.4, dx: 90, dy: -200 },
      ],
      chip: (t) =>
        t > L(2).s + 0.3
          ? { key: "kapasitas rancangan", value: fmtID(Math.round(23000 * ramp(t, L(2).s + 0.3, L(2).e - 0.5))), unit: "liter/detik" }
          : null,
    },
    B: {
      label: "Masalahnya",
      title: "Sungai bisa lebih tinggi\ndari *kampung*",
      camera: K("B", [[[2.9, 0, 25], [2.9, -2.4, 0]], [[3.1, -0.3, 21.5], [3.1, -2.2, 0]]]),
      callouts: [
        { text: "sungai", anchor: (t) => [8.4, S.riverLevel(t), 3.9], at: L(4).s + 0.3, dx: 30, dy: -260 },
        { text: "kampung", anchor: () => [-2.4, 0.05, 3.9], at: L(5).s + 0.4, dx: -10, dy: -300 },
        { text: "papan duga", anchor: () => [8.82, 3.45, Z1 - 0.45], at: L(4).s + 1.4, until: L(5).e, dx: -60, dy: -120 },
        { text: "air balik!", anchor: () => [3.4, -1.0, 4.0], at: L(6).s + 0.5, dx: 10, dy: 300, variant: "red" },
      ],
    },
    C: {
      label: "Langkah 1",
      title: "Pintu air *ditutup*",
      camera: K(
        "C",
        [[[8.2, 0.9, 8.2], [4.3, -0.9, 3.4]], [[7.0, 0.3, 7.0], [4.3, -1.0, 3.5]], [[-1.5, 5, 19], [2.4, -0.4, 0]]],
        () => [shot("C").s, S.gateT() + 1.2, L(8).e],
      ),
      callouts: [
        { text: "pintu air", anchor: (t) => [4.32, S.gateY(t), Z1 - 0.45], at: L(7).s + 0.4, until: L(8).s + 0.4, dx: 150, dy: -260 },
        { text: "kolam tampung", anchor: (t) => [2, Math.max(S.pondLevel(t) - 0.3, -1.3), 3.9], at: L(8).s + 1.2, dx: -120, dy: 260 },
      ],
    },
    D: {
      label: "Langkah 2",
      title: "Pompa *mengangkat*\nairnya",
      camera: K("D", [[[-4, 3.2, 14.5], [2.6, 0.9, -1.2]], [[9.5, 4.6, 12.5], [3.4, 1.0, -1.2]]]),
      callouts: [
        { text: "pipa pompa", anchor: () => [3.2, 3.05, -1.35], at: L(9).s + 1.6, dx: -40, dy: -200, variant: "orange" },
        { text: "tanggul", anchor: () => [3.6, 1.6, Z1], at: L(9).s + 3.2, dx: -80, dy: 220 },
      ],
    },
    E: {
      label: "Sebanyak apa?",
      title: "23.000 liter\n= *±1.210 galon*",
      camera: K("E", [[[GX - 3.5, 1.6, 10], [GX - 4.5, 0.3, 5.5]], [[GX + 11, 15, 19], [GX, 0, -1.5]]]),
      callouts: [{ text: "1 galon = 19 L", anchor: () => [firstGalon[0], 0.5, firstGalon[1]], at: shot("E").s + 0.5, until: L(10).s + 3.2, dx: 60, dy: -230 }],
      chip: (t) => ({ key: "per detik", value: fmtID(Math.round(GALON_N * ramp(t, L(10).s + 0.4, L(10).s + 4.6))), unit: "galon" }),
    },
    F: {
      label: "Titik lemah",
      title: "Kalau *laut pasang*…",
      camera: K("F", [[[18, 7.5, 23], [5, -0.6, -5]], [[15.5, 6, 19], [5, -0.2, -4]]]),
      callouts: [
        { text: "laut pasang", anchor: (t) => [2, S.seaLevel(t), -22], at: L(11).s + 0.6, dx: -50, dy: -200, variant: "orange" },
        { text: "air nggak bisa keluar", anchor: () => [5.15, 1.3, -1.35], at: L(11).e - 1.0, dx: 10, dy: 250, variant: "red" },
        { text: "petugas", anchor: () => [1.5, 0.85, -1.85], at: L(12).s + 1.0, dx: -60, dy: -210 },
      ],
      chip: (t) => (t > L(12).s ? { key: "status pompa", value: "KEWALAHAN", red: true } : null),
    },
    G: {
      label: "Rumah pompa Nginden",
      title: "Jalur *pintas*\nke Kali Jagir",
      tag: "ILUSTRASI",
      camera: K("G", [[[MX + 7, 36, 17], [MX, 0, -1.5]], [[MX + 4, 31, 13], [MX - 0.5, 0, -1.5]]]),
      callouts: [
        { text: "rumah pompa Nginden", anchor: () => [MX - 3, 0.9, 5.4], at: L(13).s + 0.5, dx: 60, dy: 210 },
        { text: "Kali Jagir", anchor: () => [MX + 4, 0.2, -7.8], at: L(13).s + 1.6, dx: 40, dy: -190 },
        { text: "jalur pintas", anchor: () => [MX - 3.1, 0.4, -1], at: L(13).s + 2.6, dx: -10, dy: -120, variant: "orange" },
      ],
    },
    H: {
      label: "Musuh terbesar",
      title: "*Sampah*",
      camera: K("H", [[[-1.6, 1.5, 3.9], [0.75, 0.25, 0.95]], [[-0.6, 1.05, 3.1], [0.85, 0.25, 0.95]]]),
      callouts: [
        { text: "saringan", anchor: () => [1.06, 0.35, 1.45], at: L(14).s + 1.2, dx: 170, dy: -140 },
        { text: "sampah numpuk", anchor: () => [0.6, 0.4, 0.9], at: L(14).s + 2.2, dx: -170, dy: 240, variant: "red" },
      ],
      chip: (t) => (t > (L(14).s + L(14).e) / 2 + 0.3 ? { key: "status pompa", value: "BERHENTI", red: true } : null),
    },
    I: {
      label: "Jadi…",
      title: "Airnya *diangkat*,\nbukan hilang",
      camera: orbit(ctx, "I", { target: [-1.5, 0, -3.5], from: -0.35, to: 0.45, r: [27, 22], h: [15, 11] }),
    },
  };
};
