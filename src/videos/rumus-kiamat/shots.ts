import { fmtID, keyframes } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { DX, LY, L_CLIP, MX, QX, U, formula, lp, lx, makeState, mp, mx, realAt } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);
  const D = (x: number, y: number, z: number): Vec3 => [DX + x, y, z];
  const Q = (x: number, y: number, z: number): Vec3 => [QX + x, y, z];
  const M = (x: number, y: number, z: number): Vec3 => [MX + x, y, z];

  return {
    A: {
      label: "Lagi viral",
      title: "Kiamat\n*13 November 2026?*",
      camera: K("A", [[D(1.0, 4.4, 18), D(0, 3.5, 0)], [D(0.4, 4.2, 16.5), D(0, 3.4, 0)]]),
      chip: (t) => (t > L(1).s + 3.4 ? { key: "kata netizen", value: "minggu depan", red: true } : null),
    },
    B: {
      label: "Asalnya",
      title: "Makalah di jurnal\n*Science*, 1960",
      camera: K("B", [[D(-1.0, 7.5, 8.5), D(-2.6, 0.8, 1.2)], [D(-1.8, 6.8, 7.8), D(-3.0, 0.6, 1.3)]]),
      callouts: [{ text: "Science, Nov 1960", anchor: () => D(-3.2, 0.3, 1.4), at: L(2).s + 1.4, dx: 120, dy: 230, variant: "orange" }],
    },
    C: {
      label: "Pertanyaannya",
      title: "Kok bisa rumus\nmenghitung *kiamat?*",
      tag: "ILUSTRASI",
      camera: K("C", [[[18, 9, 22], [-1, 2, 0]], [[15, 7, 19], [0, 2, 0]]]),
    },
    D: {
      label: "Datanya",
      title: "*24* perkiraan\npenduduk dunia",
      tag: "ILUSTRASI",
      camera: K("D", [[[17, 6, 17], [-2, 1.5, 0]], [[12, 7, 18], [2, 2.5, 0]]]),
      callouts: [
        { text: "tahun 0", anchor: () => lp(0, 0.1), at: L(4).s + 1.0, dx: 60, dy: 150 },
        { text: "1950-an", anchor: () => lp(1950), at: L(4).e - 1.2, dx: -140, dy: -120 },
      ],
      chip: (t) => ({ key: "titik data", value: `${Math.min(24, Math.floor(S.points(t)))} / 24` }),
    },
    E: {
      label: "Langkah 1",
      title: "Berlipat dua\nmakin *cepat*",
      camera: K("E", [[[9, 9, 28], [5, 2.5, 1.2]], [[8, 7, 24], [6, 2.4, 1.4]]]),
      callouts: [
        { text: "±517 tahun", anchor: () => [lx(1258), 0.25, 2.4], at: L(5).s + 1.2, dx: -40, dy: 170 },
        { text: "±63 tahun", anchor: () => [lx(1932), 0.25, 2.4], at: L(5).s + 4.2, dx: 60, dy: 200, variant: "orange" },
      ],
      chip: (t) => (t > L(5).s + 2.4 ? { key: "waktu berlipat dua", value: "517→257→127→63 th" } : null),
    },
    F: {
      label: "Langkah 2",
      title: "Satu kurva,\n*satu rumus*",
      camera: K("F", [[[-1, 9, 36], [-1.5, 6.5, 0]], [[0, 8.5, 33], [-1.2, 6.2, 0]]]),
      chip: (t) => (t > L(6).s + 3.0 ? { key: "selisih rata-rata", value: "±7 %" } : null),
    },
    G: {
      label: "Langkah 3",
      title: "Sisa waktu nol →\n*tak terhingga*",
      camera: (t) => {
        const y = S.gYear(t);
        const p = lp(y, Math.min(formula(y), L_CLIP / LY));
        const h = Math.max(6, p[1]);
        return { position: [lx(U) - 6, h + 2, 24], target: [lx(U) - 1.5, h - 1, 0] };
      },
      callouts: [{ text: "2026,87 = 13 Nov", anchor: (t) => [lx(U), Math.max(4, lp(S.gYear(t), Math.min(formula(S.gYear(t)), L_CLIP / LY))[1] - 4), 0], at: L(7).s + 3.6, dx: -170, dy: 40, variant: "red" }],
      chip: (t) => {
        const y = S.gYear(t);
        const n = formula(y);
        return t > L(7).e - 1.2 ? { key: "N (rumus)", value: "∞", red: true } : { key: `N tahun ${Math.floor(y)}`, value: n >= 100 ? `${fmtID(n / 1000, 1)} triliun` : `${fmtID(n, 1)} miliar`, red: n > 9 };
      },
    },
    H: {
      label: "Analogi",
      title: "Antrean yang\n*makin cepat*",
      camera: K("H", [[Q(2.5, 6.5, 9), Q(1.5, 0.3, 2.0)], [Q(-1.5, 17, 13), Q(-1.5, 0, 1.0)]]),
      chip: (t) => ({ key: "orang di antrean", value: `${S.queue(t)}` }),
    },
    I: {
      label: "Ujian kenyataan",
      title: "Akurat sampai\n*±1993*",
      camera: K("I", [[M(-3, 6, 22), M(-3.5, 3.6, 0)], [M(-1, 6, 20), M(-1.5, 3.8, 0)]]),
      callouts: [
        { text: "data PBB", anchor: (t) => mp(S.realYear(t), realAt(S.realYear(t))), at: L(9).s + 1.2, dx: -130, dy: -150 },
        { text: "rumus 1960", anchor: (t) => mp(S.fitYear(t), formula(S.fitYear(t))), at: L(9).s + 1.6, dx: 120, dy: 150, variant: "red" },
      ],
      chip: (t) => (t > L(9).e - 1.4 ? { key: "1993 · rumus", value: "5,5 miliar" } : null),
    },
    J: {
      label: "Lalu meleset",
      title: "Rumus: *200 miliar*\ndi awal 2026",
      camera: K("J", [[M(1, 8, 27), M(0.5, 8, 0)], [M(3, 27, 30), M(2.6, 25, 0)]]),
      callouts: [{ text: "terus naik → 205 M", anchor: () => [mx(2025.7), 37, 0], at: L(10).e - 1.5, dx: -150, dy: 60, variant: "red" }],
      chip: (t) => {
        const y = S.fitYear(t);
        return { key: `rumus, tahun ${Math.floor(y)}`, value: `${fmtID(formula(y), 1)} miliar`, red: true };
      },
    },
    K: {
      label: "Kenyataannya",
      title: "Cuma *8,2 miliar*",
      camera: K("K", [[M(4, 7, 19), M(3, 6, 0)], [M(5, 6.5, 17), M(3.6, 6.2, 0)]]),
      callouts: [{ text: "8,2 miliar (PBB)", anchor: () => mp(2024, 8.16), at: L(11).s + 2.4, dx: 120, dy: -170 }],
      chip: (t) => (t > L(11).s + 4.0 ? { key: "anak per perempuan", value: "3,3 (1990) → 2,3" } : null),
    },
    L: {
      label: "Proyeksi PBB",
      title: "Puncak ±*10,3 miliar*\nlalu turun",
      tag: "PROYEKSI",
      camera: K("L", [[M(5, 8, 22), M(5, 7, 0)], [M(7, 8, 21), M(7, 7.2, 0)]]),
      callouts: [{ text: "puncak ±2085", anchor: () => mp(2085, 10.3), at: L(12).e - 1.6, dx: -60, dy: -150 }],
      chip: (t) => (t > L(12).s + 2 ? { key: "tahun 2100", value: "10,2 miliar" } : null),
    },
    M: {
      label: "Fakta kecil",
      title: "13 November =\n*ulang tahun* von Foerster",
      camera: K("M", [[D(2.0, 4.8, 18), D(1.6, 3.2, 0.8)], [D(2.4, 4.6, 16.5), D(1.8, 3.1, 0.9)]]),
      callouts: [{ text: "lahir 13 Nov 1911", anchor: () => D(3.4, 1.35, 1.6), at: L(13).s + 1.4, dx: 80, dy: 220, variant: "orange" }],
    },
    N: {
      label: "Jadi",
      title: "Yang gagal:\n*asumsi trennya*",
      camera: K("N", [[M(0, 12, 34), M(0, 9, 0)], [M(1, 11, 31), M(1, 8.5, 0)]]),
    },
  };
};
