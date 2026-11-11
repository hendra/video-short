import { keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { DAM_X, GHOST, ISLANDS, ISPAN, SUBSTATION_X, bedY, makeState } from "./state";

const C = ISLANDS[1]; // camera anchor island (second from left)
const I1 = ISLANDS[0]; // cable-source island
const GHOST_POS = ISLANDS[GHOST[0]];

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);
  const mid = (n: number) => (L(n).s + L(n).e) / 2;

  return {
    A: {
      label: "Waduk Karangkates · 2026",
      title: "Delapan pulau surya\n*mengapung* di Malang",
      camera: K(
        "A",
        [
          [[-2, 17.5, 19], [-2, 0, -5]],
          [[-4, 12.5, 16.5], [-3, 0, -5]],
          [[-6.5, 7.5, 13], [-2, 0, -4]],
        ],
        () => [shot("A").s, L(2).s, shot("A").e - 0.8],
      ),
      callouts: [
        { text: "Waduk Sutami (Karangkates)", anchor: () => [-6, 0, -6], at: L(1).s + 0.8, dx: -60, dy: 130 },
        { text: "panel surya terapung", anchor: () => [C.x, 0.45, C.z], at: L(1).s + 2.6, dx: 90, dy: -160, variant: "orange" },
        { text: "bendungan Sutami", anchor: () => [DAM_X + 1.4, 1.2, -3], at: L(2).s + 0.4, until: L(2).e, dx: -150, dy: -40 },
      ],
      chip: (t) => (t > L(2).s + 0.3 ? { key: "kapasitas", value: "133 MWp", unit: "≈100 MW AC" } : null),
    },
    B: {
      label: "Tunggu dulu…",
      title: "Kok bisa panel surya\n*mengapung*?",
      camera: K(
        "B",
        [
          [[C.x + 9, 5.5, 9.5], [C.x, 0.2, C.z]],
          [[C.x + 4.6, 1.6, 6.2], [C.x, 0.1, C.z]],
        ],
      ),
      callouts: [
        { text: "di atas air, bukan di tanah", anchor: () => [C.x, 0.35, C.z - 1], at: shot("B").s + 1.0, dx: 80, dy: -170, variant: "orange" },
        { text: "kenapa nggak tenggelam?", anchor: () => [C.x, -0.15, C.z + 1.2], at: mid(3) + 0.9, dx: 60, dy: 190 },
      ],
    },
    C: {
      label: "Langkah 1",
      title: "Panel di atas *ponton*,\nrakit anti-tenggelam",
      camera: K(
        "C",
        [
          [[C.x + 6.4, 1.5, 4.4], [C.x, 0, C.z]],
          [[C.x + 3.4, 0.85, 3.4], [C.x, -0.1, C.z]],
        ],
      ),
      callouts: [
        { text: "panel fotovoltaik", anchor: () => [C.x - 0.7, 0.45, C.z], at: L(5).s + 0.7, dx: -110, dy: -200, variant: "orange" },
        { text: "ponton (setengah terendam)", anchor: () => [C.x + 1.4, 0.02, C.z + 1.25], at: L(5).s + 2.2, dx: 70, dy: 170 },
      ],
      chip: (t) => (t > mid(5) ? { key: "prinsip", value: "GAYA APUNG" } : null),
    },
    D: {
      label: "Langkah 2",
      title: "Dijangkar ke *dasar waduk*",
      camera: K(
        "D",
        [
          [[C.x + 5.4, 1.1, 6.1], [C.x, -2.9, C.z]],
          [[C.x + 3.2, 0.3, 4.2], [C.x + 0.7, -5.0, C.z + 0.9]],
        ],
      ),
      callouts: [
        { text: "tali tambat (mooring)", anchor: () => [C.x + 1.9, -2.1, C.z + 1.45], at: L(6).s + 0.9, dx: 130, dy: -160, variant: "orange" },
        { text: "jangkar di dasar waduk", anchor: () => [C.x + 2.6, bedY(C.x + 2.6) + 0.15, C.z + 1.5], at: L(6).s + 2.4, dx: 90, dy: 120 },
      ],
    },
    E: {
      label: "Bonusnya",
      title: "Air di bawahnya *adem*",
      camera: K(
        "E",
        [
          [[C.x - 4.6, 1.15, 3.1], [C.x, 0.25, C.z]],
          [[C.x - 2.6, 0.75, 2.3], [C.x + 0.4, 0.2, C.z]],
        ],
      ),
      callouts: [
        { text: "panel nggak kepanasan", anchor: () => [C.x, 0.42, C.z], at: L(7).s + 0.7, dx: -120, dy: -210, variant: "orange" },
        { text: "air dingin di bawahnya", anchor: () => [C.x, -0.9, C.z + 0.8], at: L(7).s + 2.3, dx: -40, dy: 210 },
      ],
      chip: (t) => (t > mid(7) ? { key: "efek", value: "lebih stabil" } : null),
    },
    F: {
      label: "Langkah 3",
      title: "Arus *searah* jadi\narus *bolak-balik*",
      camera: K(
        "F",
        [
          [[C.x + 5.8, 1.7, 4.8], [C.x + 0.9, 0.28, C.z - 0.6]],
          [[C.x + 3.4, 1.15, 3.2], [C.x + 1.3, 0.3, C.z - 0.8]],
        ],
      ),
      callouts: [
        { text: "panel → arus searah (DC)", anchor: () => [C.x - 0.4, 0.44, C.z], at: L(8).s + 0.6, dx: -120, dy: -200 },
        { text: "inverter mengubahnya", anchor: () => [C.x + ISPAN[0] / 2 - 0.35, 0.44, C.z - ISPAN[1] / 2 + 0.32], at: L(8).s + 1.8, dx: 40, dy: -225, variant: "orange" },
      ],
      chip: (t) => (t > mid(8) ? { key: "DC → AC", value: "inverter" } : null),
    },
    G: {
      label: "Menyusuri kabel",
      title: "Kabel *bawah air*\nke tepi waduk",
      camera: K(
        "G",
        [
          [[I1.x + 3.4, 2.6, 5.4], [I1.x - 0.4, -1.3, I1.z]],
          [[SUBSTATION_X + 5.4, 2.4, 4.6], [SUBSTATION_X, 0.8, -0.6]],
        ],
        () => [shot("G").s, shot("G").e - 0.3],
      ),
      callouts: [
        { text: "kabel menyusur dasar waduk", anchor: () => [-12.1, bedY(-12.1) + 0.35, -2.5], at: L(9).s + 0.8, until: L(9).s + 2.9, dx: -40, dy: 215, variant: "orange" },
        { text: "gardu tepi waduk", anchor: () => [SUBSTATION_X + 0.9, 1.15, -0.55], at: L(9).s + 3.0, dx: 80, dy: -170 },
        { text: "tersambung ke jaringan PLN", anchor: () => [SUBSTATION_X - 1.5, 1.15, -0.55], at: L(9).s + 4.2, dx: -20, dy: -220 },
      ],
      chip: (t) => (t > L(9).s + 0.4 ? { key: "rute", value: "BAWAH AIR" } : null),
    },
    H: {
      label: "Angkanya",
      title: "71 hektare, cuma\n*3,7%* dari waduk",
      camera: K(
        "H",
        [
          [[2, 15.5, 13.5], [0, 0, -5.5]],
          [[-3.5, 10.5, 11.5], [-1.5, 0, -5]],
        ],
      ),
      callouts: [
        { text: "≈ 71 hektare area panel", anchor: () => [-3.5, 0.3, -6], at: L(10).s + 0.8, dx: -90, dy: 180, variant: "orange" },
        { text: "± US$ 90 juta investasi", anchor: () => [5.2, 0.35, -3.3], at: L(10).s + 2.4, dx: 70, dy: -190 },
        { text: "3,7% luas muka air tertinggi", anchor: () => [-8.5, 0.1, -8.5], at: L(11).s + 0.5, dx: -60, dy: 210 },
      ],
      chip: (t) => (t > L(11).s ? { key: "porsi", value: "3,7%" } : null),
    },
    I: {
      label: "Progres",
      title: "Enam dari *delapan*\npulau terpasang",
      camera: K(
        "I",
        [
          [[GHOST_POS.x + 6.2, 5.5, 7.5], [GHOST_POS.x, 0.4, GHOST_POS.z]],
          [[GHOST_POS.x + 3.6, 3.0, 5.6], [GHOST_POS.x, 0.3, GHOST_POS.z]],
        ],
      ),
      callouts: [
        { text: "pulau 7 & 8 menyusul dipasang", anchor: () => [GHOST_POS.x, 0.4, GHOST_POS.z], at: L(12).s + 1.0, dx: 80, dy: -190, variant: "orange" },
        { text: "target operasi: Januari 2027", anchor: () => [GHOST_POS.x + 1.8, 0.25, GHOST_POS.z], at: L(13).s + 0.4, dx: 40, dy: 210 },
      ],
      chip: (t) => ({ key: "progres", value: `±${Math.round(S.progress(t))}%`, unit: "target Jan 2027" }),
    },
    J: {
      label: "Jadi…",
      title: "Waduk tetap waduk,\nlistrik *jalan terus*",
      camera: orbit(ctx, "J", { target: [-2, -0.5, -4], from: -0.62, to: 0.34, r: [24, 19.5], h: [9.5, 6.5] }),
    },
  };
};
