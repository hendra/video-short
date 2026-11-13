import { keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { CX, FX, MP, FAULT_U, cablePulse, cablePoint, fiberPulseX, mapArcWorld, shipX } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);

  return {
    A: {
      label: "Berita hari ini",
      title: "*1.408 km* fiber optik\nbaru terbentang",
      camera: K(
        "A",
        [
          [[13.5, 8.2, 29], [0, -0.8, -2]],
          [[9.2, 5.0, 23], [-0.3, -1.2, -2]],
          [[6.6, 3.5, 18.5], [0.2, -2.0, -1.8]],
        ],
        () => [shot("A").s, L(2).s, shot("A").e],
      ),
      callouts: [
        { text: "InfraNexia +1.408 km", anchor: (t) => [shipX(t) + 1.5, 1.35, -2.5], at: L(1).s + 0.9, until: L(2).s + 1.0, dx: 40, dy: -160, variant: "orange" },
        { text: "total kini 112.000 km", anchor: () => [0.4, -4.4, -1.6], at: L(2).s + 0.9, until: L(3).s - 0.5, dx: 30, dy: 150 },
      ],
      chip: (t) => (t > L(2).s ? { key: "sepanjang 2026", value: "+1.408 km" } : null),
    },
    B: {
      label: "Pertanyaannya",
      title: "*Kok bisa* internet\nmelaju di bawah laut?",
      camera: K(
        "B",
        [
          [[4.6, 0.3, 8.0], [0.4, -2.6, -1.8]],
          [[2.2, -2.5, 5.3], [0.3, -3.85, -1.65]],
          [[1.1, -3.7, 3.3], [0.15, -4.2, -1.6]],
        ],
        () => [shot("B").s, L(4).s, shot("B").e],
      ),
      callouts: [
        { text: "kabel SKKL", anchor: () => [cablePoint(0.42).x, cablePoint(0.42).y, cablePoint(0.42).z], at: L(3).s + 0.8, until: L(4).s + 0.4, dx: -140, dy: -150, variant: "orange" },
        { text: "26.000 km", anchor: () => [cablePoint(0.58).x, cablePoint(0.58).y, cablePoint(0.58).z], at: L(4).s + 0.5, until: shot("B").e - 0.3, dx: 110, dy: 120 },
      ],
      chip: (t) => (t > L(4).e - 1.2 ? { key: "kabel laut", value: "26.000 km" } : null),
    },
    C: {
      label: "Langkah 1 · Jadi cahaya",
      title: "Data kamu berubah\njadi *pulsa laser*",
      tag: "ILUSTRASI",
      camera: K(
        "C",
        [
          [[FX - 6.6, 1.9, 6.0], [FX + 1.1, -0.1, -0.3]],
          [[FX - 3.6, 1.2, 4.2], [FX + 0.8, 0, -0.2]],
          [[FX - 2.2, 0.7, 3.5], [FX + 1.3, 0, -0.15]],
        ],
        () => [shot("C").s, L(6).s, shot("C").e],
      ),
      callouts: [
        { text: "pulsa laser", anchor: (t) => [fiberPulseX(t, 0), 0.32, 0], at: L(5).s + 0.7, until: shot("C").e - 0.4, dx: 30, dy: -180, variant: "orange" },
        { text: "serat kaca", anchor: () => [FX + 1.9, -0.15, 0.82], at: L(6).s + 0.4, until: shot("C").e - 0.4, dx: 40, dy: 180 },
        { text: "setipis rambut", anchor: () => [FX - 2.1, 1.02, 0], at: L(6).s + 1.4, until: shot("C").e - 0.4, dx: -30, dy: -185 },
      ],
      chip: (t) => (t > L(6).s ? { key: "data", value: "1 & 0" } : null),
    },
    D: {
      label: "Langkah 2 · Pantulan total",
      title: "Cahaya *memantul*\ndi dinding serat",
      tag: "ILUSTRASI",
      camera: K(
        "D",
        [
          [[FX - 5.4, 2.5, 5.3], [FX + 1.2, -0.05, -0.15]],
          [[FX - 2.4, 2.8, 4.0], [FX + 0.6, 0.02, 0]],
          [[FX + 1.2, 1.6, 4.2], [FX - 0.6, 0, 0.05]],
        ],
        () => [shot("D").s, L(8).s, shot("D").e],
      ),
      callouts: [
        { text: "dinding serat", anchor: () => [FX - 0.4, 0.36, 0.12], at: L(7).s + 0.6, until: shot("D").e - 0.4, dx: -140, dy: -170 },
        { text: "pantulan internal total", anchor: () => [FX - 0.3, -0.28, 0.12], at: L(7).s + 1.7, until: shot("D").e - 0.4, dx: 60, dy: 170, variant: "orange" },
        { text: "tak bocor keluar", anchor: () => [FX - 2.7, 0.3, 0.1], at: L(8).s + 0.4, until: shot("D").e - 0.4, dx: -30, dy: -185 },
      ],
      chip: (t) =>
        t > L(8).s - 0.4 ? { key: "pantulan", value: "INTERNAL TOTAL" } : null,
    },
    E: {
      label: "Langkah 3 · Kabel laut",
      title: "Ribuan serat dibalut\n*baja*, lalu ditanam",
      tag: "ILUSTRASI",
      camera: K(
        "E",
        [
          [[CX - 2.6, 1.5, 8.2], [CX, 0, 0]],
          [[CX + 0.3, 0.5, 6.4], [CX, 0, 0]],
        ],
        () => [shot("E").s, shot("E").e],
      ),
      callouts: [
        { text: "kawat baja (armor)", anchor: () => [CX - 0.5, 1.42, 0.5], at: L(9).s + 0.5, until: shot("E").e - 0.3, dx: 30, dy: -170 },
        { text: "8 helai serat", anchor: () => [CX + 0.33, 0.18, 0.6], at: L(9).s + 1.3, until: shot("E").e - 0.3, dx: 80, dy: 160, variant: "orange" },
        { text: "pipa tembaga", anchor: () => [CX - 0.62, -0.62, 0.5], at: L(9).s + 2.1, until: shot("E").e - 0.3, dx: -60, dy: 170 },
      ],
      chip: (t) => (t > L(9).s + 0.6 ? { key: "SKKL", value: "26.000 km" } : null),
    },
    F: {
      label: "Sampai di darat",
      title: "Ujungnya berdiri\n*stasiun pantai*",
      camera: K(
        "F",
        [
          [[0.4, 2.0, 6.4], [-11.2, 1.1, -2.2]],
          [[-1.2, 1.45, 4.4], [-11.4, 1.1, -2.15]],
        ],
        () => [shot("F").s, shot("F").e],
      ),
      callouts: [
        { text: "stasiun pantai", anchor: () => [-12.3, 2.3, -1.5], at: L(10).s + 0.4, until: shot("F").e - 0.3, dx: -40, dy: -180 },
        { text: "1,9 juta ODP", anchor: () => [-7.4, 2.4, -0.7], at: L(10).s + 1.3, until: shot("F").e - 0.3, dx: 20, dy: -160, variant: "orange" },
      ],
    },
    G: {
      label: "Analoginya",
      title: "Kayak *selang cahaya*\nsepanjang laut",
      camera: K(
        "G",
        [
          [[2.8, -2.45, 5.5], [0.4, -3.8, -1.6]],
          [[-2.2, -2.9, 4.6], [-1.1, -3.9, -1.6]],
        ],
        () => [shot("G").s, shot("G").e],
      ),
      callouts: [
        {
          text: "pulsa melesat",
          anchor: (t) => {
            const p = cablePoint(cablePulse(t, 0, 6));
            return [p.x, p.y, p.z] as Vec3;
          },
          at: L(11).s + 0.5,
          until: shot("G").e - 0.3,
          dx: 50,
          dy: -150,
          variant: "orange",
        },
        { text: "dindingnya cermin", anchor: () => [0.6, -4.4, -1.6], at: L(11).s + 1.6, until: shot("G").e - 0.3, dx: -20, dy: 130 },
      ],
      chip: (t) => (t > L(11).s + 0.8 ? { key: "analogi", value: "SELANG CAHAYA" } : null),
    },
    H: {
      label: "Jalur cadangan",
      title: "Kalau putus —\n*< 50 milidetik*",
      tag: "ILUSTRASI",
      camera: K(
        "H",
        [
          [[7.0, 2.6, 20.0], [0.6, 0.3, -1.8]],
          [[10.5, 4.4, 22.5], [0.6, 0.55, -2.0]],
          [[8.0, 3.2, 19.5], [0.5, 0.15, -1.9]],
        ],
        () => [shot("H").s, L(12).s + 2.2, shot("H").e],
      ),
      callouts: [
        { text: "titik gangguan", anchor: () => { const p = cablePoint(FAULT_U); return [p.x, p.y, p.z] as Vec3; }, at: L(12).s + 0.3, until: L(12).e - 0.4, dx: 50, dy: -140, variant: "red" },
        { text: "rute cadangan (beda koridor)", anchor: () => [0.8, 4.35, -4.0], at: L(12).s + 1.5, until: shot("H").e - 0.3, dx: -40, dy: -190, variant: "orange" },
        { text: "target < 50 ms", anchor: () => [10.6, 1.9, -4.2], at: L(12).s + 2.2, until: shot("H").e - 0.3, dx: -10, dy: -170 },
      ],
      chip: (t) => (t > L(12).s + 1.6 ? { key: "alih rute", value: "< 50 ms", unit: "target" } : null),
    },
    I: {
      label: "Skalanya",
      title: "*112.000 km* —\nsekitar 3× keliling bumi",
      tag: "ILUSTRASI",
      camera: orbit(ctx, "I", { target: [MP, 0, -0.5], from: -0.75, to: -0.15, r: [10.6, 8.2], h: [6.2, 7.6] }),
      callouts: [
        { text: "koridor Jawa–Sulawesi–Kalimantan", anchor: () => mapArcWorld(0, 0.5), at: L(13).s + 0.5, until: shot("I").e - 0.3, dx: -40, dy: -190, variant: "orange" },
        { text: "1,9 juta titik akses", anchor: () => [MP + 4.6, 0.15, 1.9], at: L(13).s + 1.4, until: shot("I").e - 0.3, dx: -60, dy: 160 },
      ],
      chip: (t) => (t > L(13).s + 0.8 ? { key: "total jaringan", value: "112.000 km", unit: "4 area · 12 regional · 61 distrik" } : null),
    },
    J: {
      label: "Masa depan",
      title: "Trafik AI naik\n*10–20× lipat*",
      camera: K(
        "J",
        [
          [[7.4, 4.6, 17.5], [0.5, 0.6, -2.5]],
          [[10.2, 6.1, 14.2], [0.4, 0.9, -3.0]],
        ],
        () => [shot("J").s, shot("J").e],
      ),
      callouts: [{ text: "pusat data AI", anchor: () => [9.6, 3.05, -5.4], at: L(14).s + 0.7, until: shot("J").e - 0.3, dx: 30, dy: -170, variant: "orange" }],
      chip: (t) => (t > L(14).s + 0.6 ? { key: "trafik antar-DC", value: "10–20×", unit: "diprediksi" } : null),
    },
    K: {
      label: "Jadi…",
      title: "Internet antarpulau\nitu *cahaya di dasar laut*",
      camera: orbit(ctx, "K", { target: [0.2, -2.2, -1.8], from: 0.15, to: 1.05, r: [19, 15], h: [6.5, 4.4] }),
    },
  };
};
