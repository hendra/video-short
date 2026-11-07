import { fmtID, keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { BAR, CITY, CX, HW, MEGA_CITY, MG, makeState } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);
  const cityMid: Vec3 = [CITY.x + (CITY.n * CITY.sp) / 2, 0.6, CITY.z + (CITY.n * CITY.sp) / 2];
  const megaMid: Vec3 = [MEGA_CITY.x + (MEGA_CITY.nx * MEGA_CITY.sp) / 2, 0.6, MEGA_CITY.z + (MEGA_CITY.nz * MEGA_CITY.sp) / 2];

  return {
    A: {
      label: "Jakarta · 3 Nov 2026",
      title: "Pusat data *AI* baru\ndi Jakarta",
      tag: "ILUSTRASI",
      camera: K(
        "A",
        [[[15, 11, 22], [0, 2.6, -8]], [[13, 10, 20], [0, 2.6, -8]], [[2, 36, 34], [0, 0, -28]]],
        () => [shot("A").s, L(2).s + 0.3, L(2).s + 3.4],
      ),
      callouts: [
        { text: "pusat data AI", anchor: () => [0, 5.4, -7], at: L(1).s + 0.8, until: L(2).s + 0.4, dx: 120, dy: -230, variant: "orange" },
        { text: "gardu listrik", anchor: () => [-11.7, 2.4, -6], at: L(1).s + 3.0, until: L(2).s + 0.4, dx: -60, dy: 230 },
        { text: "kompleks rumah", anchor: () => cityMid, at: L(2).s + 4.2, dx: -130, dy: -200 },
      ],
      chip: (t) =>
        t < L(2).s
          ? { key: "NTT DATA JKT2A", value: "12 MW" }
          : { key: "1 pusat data AI (IEA)", value: `${fmtID(Math.round(100000 * S.houses1(t)))} rumah` },
    },
    B: {
      label: "Pertanyaannya",
      title: "Isinya cuma komputer,\n*kok sebesar kota?*",
      tag: "ILUSTRASI",
      camera: K("B", [[[2, 36, 34], [0, 0, -28]], [[0, 32, 30], [0, 0, -27]]]),
      callouts: [
        { text: "pusat data AI", anchor: () => [0, 5.4, -7], at: shot("B").s + 0.3, dx: 40, dy: -200, variant: "orange" },
        { text: "satu kota?", anchor: () => cityMid, at: shot("B").s + 1.2, dx: -120, dy: -180, variant: "red" },
      ],
    },
    C: {
      label: "Isi rak",
      title: "Ribuan *chip AI*\nbekerja bareng",
      camera: K("C", [[[2.2, 2.6, 3.5], [0, 2.1, -8]], [[1.0, 2.3, 1.2], [0, 2.1, -8]]]),
      callouts: [
        { text: "chip AI (GPU)", anchor: () => [0, 2.3, -4.2], at: L(4).s + 0.9, dx: 150, dy: -170, variant: "orange" },
        { text: "rak server", anchor: () => [-3.2, 2.2, -8.3], at: L(4).s + 2.2, dx: -80, dy: 190 },
      ],
      chip: (t) => (t > L(4).s + 3.0 ? { key: "bekerja", value: "siang-malam" } : null),
    },
    D: {
      label: "Langkah 1",
      title: "Listrik masuk,\n*dua jalur*",
      camera: K(
        "D",
        [[[-20, 8, 16], [-9, 2.8, -7]], [[-17, 9, 14], [-8, 3.0, -7]], [[16, 10, 18], [6, 3, -7]]],
        () => [shot("D").s, L(5).s + 3.0, L(5).e],
      ),
      callouts: [
        { text: "gardu", anchor: () => [-11.7, 2.4, -7.5], at: L(5).s + 0.8, until: L(5).s + 3.0, dx: -30, dy: -190 },
        { text: "dua jalur", anchor: () => [-9, 3.55, -6], at: L(5).s + 1.8, until: L(5).s + 3.0, dx: 130, dy: 180, variant: "orange" },
        { text: "genset cadangan", anchor: () => [HW + 1.9, 1.8, -5], at: L(5).s + 3.6, dx: 0, dy: 220, variant: "orange" },
      ],
      chip: (t) => (t > L(5).s + 2.4 ? { key: "listrik masuk", value: "2 jalur + genset" } : null),
    },
    E: {
      label: "Langkah 2",
      title: "Chip menghitung,\n*jadi panas*",
      camera: K("E", [[[0, 5.8, 5.5], [0, 2.6, -9]], [[0.6, 5.0, 1.5], [0, 2.8, -9]]]),
      callouts: [
        { text: "chip menghitung", anchor: () => [0, 2.3, -4.2], at: L(6).s + 0.4, until: L(6).s + 3.4, dx: 150, dy: -200 },
        { text: "panas", anchor: () => [3.2, 4.0, -7], at: L(6).s + 3.0, dx: 130, dy: -190, variant: "red" },
      ],
      chip: (t) => (t > L(6).s + 2.2 ? { key: "listrik →", value: "PANAS" } : null),
    },
    F: {
      label: "Langkah 3",
      title: "Panas harus\n*dibuang*",
      camera: K(
        "F",
        [[[13, 14, 11], [0, 4, -10]], [[13, 14, 11], [0, 4, -10]], [[5, 13, 24], [0, 2.5, -4]]],
        () => [shot("F").s, L(7).e - 1.0, L(8).s + 1.4],
      ),
      callouts: [
        { text: "udara panas", anchor: () => [-3.4, 4.6, -9], at: L(7).s + 0.5, until: L(8).s - 0.2, dx: -90, dy: 200, variant: "red" },
        { text: "pendingin (chiller)", anchor: () => [3.4, 6.9, -12], at: L(7).s + 3.0, until: L(8).s - 0.2, dx: 20, dy: -230, variant: "orange" },
        { text: "kompor listrik", anchor: () => [0, 1.1, 3.4], at: L(8).s + 1.6, dx: -140, dy: 200 },
        { text: "AC raksasa", anchor: () => [-3.4, 6.6, -15.6], at: L(8).s + 2.0, dx: 100, dy: -240, variant: "orange" },
      ],
      chip: (t) => (t > L(7).s + 3.8 && t < L(8).s ? { key: "pendingin", value: "ikut makan listrik" } : null),
    },
    G: {
      label: "Angkanya",
      title: "2024: *415 TWh*",
      camera: K("G", [[[CX - 2, 5.5, 27], [CX, 4.4, 0]], [[CX - 1, 5.8, 25], [CX, 4.6, 0]]]),
      callouts: [{ text: "semua pusat data dunia", anchor: () => [CX - 3, BAR.h24, 0], at: L(9).s + 4.2, dx: 80, dy: -200, variant: "orange" }],
      chip: (t) =>
        t > L(9).s + 6.0
          ? { key: "porsi listrik dunia", value: "±1,5%" }
          : { key: "2024 · TWh", value: `${fmtID(Math.round(415 * S.bar24(t)))}` },
    },
    H: {
      label: "Perkiraan IEA",
      title: "2030: *±945 TWh*",
      camera: K("H", [[[CX, 6.5, 29], [CX, 4.9, 0]], [[CX + 1, 7.0, 27], [CX, 5.0, 0]]]),
      callouts: [
        { text: "2030", anchor: () => [CX + 3, BAR.h30, 0], at: L(10).s + 3.2, dx: -30, dy: -200, variant: "orange" },
        { text: "listrik seluruh Jepang", anchor: () => [CX - 6.5, BAR.japan, 0], at: L(10).s + 4.0, dx: 60, dy: -200 },
      ],
      chip: (t) => ({ key: "2030 · TWh", value: `${fmtID(Math.round(945 * S.bar30(t)))}` }),
    },
    I: {
      label: "Yang terbesar",
      title: "*20×* pusat data\nAI biasa",
      tag: "ILUSTRASI",
      camera: K("I", [[[MG.x + 20, 74, 42], [MG.x + 20, 0, -32]], [[MG.x + 20, 80, 50], [MG.x + 20, 0, -32]]]),
      callouts: [
        { text: "1 pusat data AI biasa", anchor: () => [MG.x + 4, 3.2, -3], at: L(11).s + 0.2, until: L(11).s + 3.0, dx: 120, dy: -200, variant: "orange" },
        { text: "≈ 2 juta rumah", anchor: () => megaMid, at: L(11).s + 4.2, dx: 40, dy: -220, variant: "orange" },
      ],
      chip: (t) => (t > L(11).s + 3.4 ? { key: "setara", value: "±2 juta rumah" } : { key: "ukuran", value: `${Math.max(1, Math.round(1 + 19 * S.mega(t)))}×` }),
    },
    J: {
      label: "Jadi…",
      title: "Chip nonstop,\n*panas dibuang*",
      camera: orbit(ctx, "J", { target: [0, 2, -8], from: -0.6, to: 0.4, r: [34, 28], h: [18, 13] }),
    },
  };
};
