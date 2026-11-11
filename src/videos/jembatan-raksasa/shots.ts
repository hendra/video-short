import { keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { SMALL_X, SPAN, SPAN_X, makeState } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);

  return {
    A: {
      label: "Bondowoso · 6 Nov 2026",
      title: "*Jembatan Sentong*\ndibuka lagi",
      tag: "ILUSTRASI",
      camera: K("A", [
        [[SMALL_X + 20, 11.5, 44], [SMALL_X, -1.2, 10]],
        [[SMALL_X + 12.5, 6.2, 30], [SMALL_X, 0.0, 10]],
      ]),
      callouts: [
        { text: "Jembatan Sentong", anchor: () => [SMALL_X, 0.62, 10.4], at: L(1).s + 0.6, dx: 130, dy: -250 },
        { text: "truk berat", anchor: () => [SMALL_X - 2.4, 0.72, 10.6], at: L(1).s + 2.2, dx: -150, dy: 170, variant: "orange" },
      ],
      chip: (t) => (t > L(1).e - 1.2 ? { key: "lalu lintas", value: "DIBUKA" } : null),
    },
    B: {
      label: "Pertanyaannya",
      title: "Kok bisa *nanggung*\nribuan ton?",
      camera: K("B", [
        [[SMALL_X + 9.5, 2.6, 22], [SMALL_X, -0.5, 10]],
        [[SMALL_X + 7.0, 1.8, 18], [SMALL_X + 0.5, -0.2, 10]],
      ]),
      callouts: [
        { text: "truk", anchor: () => [SMALL_X + 1.8, 0.4, 10.6], at: L(2).s + 0.4, dx: 130, dy: 150 },
        { text: "ribuan ton?", anchor: () => [SMALL_X + 0.6, 0.6, 10], at: L(2).s + 2.0, dx: 30, dy: -240, variant: "red" },
      ],
    },
    C: {
      label: "Contoh nyata",
      title: "Jawabannya:\n*kabel pancang*",
      tag: "ILUSTRASI",
      camera: K("C", [
        [[41, 11, 42], [0, 0.6, 0]],
        [[28, 7.2, 30], [0, 1.4, 0]],
      ]),
      callouts: [
        { text: "Jembatan Suramadu", anchor: () => [12, 3.1, 0], at: L(3).s + 1.0, dx: 120, dy: -250 },
      ],
    },
    D: {
      label: "Bentangnya",
      title: "*434 m* bentang utama",
      camera: K("D", [
        [[23.2, 5.2, 16.0], [SPAN, 4.2, 0.3]],
        [[25.0, 3.6, 13.0], [SPAN, 3.3, 0.3]],
      ]),
      callouts: [
        { text: "menara 140 m", anchor: () => [SPAN, 9.6, 1.05], at: L(4).s + 0.6, dx: 110, dy: -260, variant: "orange" },
        { text: "bentang utama 434 m", anchor: () => [4.5, 0.7, 0.4], at: L(4).s + 1.9, dx: 60, dy: 120 },
      ],
      chip: (t) => (t > L(4).e - 1.4 ? { key: "bentang utama", value: "434 m" } : null),
    },
    E: {
      label: "Langkah 1",
      title: "Kabel *kipas baja*",
      camera: K("E", [
        [[10.5, 6.2, 14.5], [SPAN, 6.6, 0.3]],
        [[12.0, 4.6, 11.5], [SPAN, 5.4, 0.3]],
      ]),
      callouts: [
        { text: "kipas kabel", anchor: () => [SPAN, 8.2, 1.05], at: L(5).s + 0.8, dx: 130, dy: -280, variant: "orange" },
        { text: "gaya tarik", anchor: () => [SPAN - 7.3, 4.1, 1.05], at: L(6).s + 0.9, dx: 140, dy: 190 },
      ],
      chip: (t) => (t > L(6).e - 1.2 ? { key: "gaya", value: "TARIK" } : null),
    },
    F: {
      label: "Langkah 2",
      title: "*Jalur bebannya*",
      camera: K("F", [
        [[7.5, 1.8, 19], [SPAN, 2.0, 0]],
        [[10.0, 0.8, 16.5], [SPAN, 1.0, 0]],
      ]),
      callouts: [
        { text: "menara (tekan)", anchor: () => [SPAN, 4.4, 1.05], at: L(7).s + 0.8, dx: 150, dy: -250, variant: "orange" },
        { text: "fondasi di tanah", anchor: () => [SPAN, -4.6, 0], at: L(7).s + 2.1, dx: 30, dy: 190 },
      ],
      chip: (t) => (t > L(7).e - 1.2 ? { key: "menara", value: "TEKAN" } : null),
    },
    G: {
      label: "Langkah 3",
      title: "*35 m* buat kapal\nlewat",
      tag: "ILUSTRASI",
      camera: K("G", [
        [[3.0, -2.0, 16], [0, -0.4, 0]],
        [[-2.6, -1.4, 13.2], [0, -0.6, 0]],
      ]),
      callouts: [
        { text: "celah 35 m", anchor: () => [0, 0.5, 0], at: L(8).s + 0.6, dx: 120, dy: -220 },
      ],
      chip: (t) => (t > L(8).e - 1.2 ? { key: "celah", value: "35 m" } : null),
    },
    H: {
      label: "Panjangnya",
      title: "*5,4 km*, digantung\nsama kabel",
      tag: "ILUSTRASI",
      camera: orbit(ctx, "H", { target: [0, 0.8, 0], from: 1.05, to: -0.85, r: [30, 25], h: [13.5, 10.5] }),
      callouts: [
        { text: "Surabaya ↔ Madura", anchor: () => [0, 2.3, 0], at: L(9).s + 0.5, dx: 0, dy: -250 },
      ],
      chip: (t) => (t > L(9).e - 1.2 ? { key: "panjang", value: "±5,4 km" } : null),
    },
    I: {
      label: "Setiap harinya",
      title: "*±26.000* kendaraan\ntiap hari",
      camera: K("I", [
        [[8.0, 4.6, 12.5], [0, 0.1, 0]],
        [[5.0, 3.2, 10.0], [0, 0.15, 0]],
      ]),
      callouts: [
        { text: "arus harian", anchor: (t) => { const tp = S.truckSeed[0]; const SPAN = SPAN_X + 1; const span = SPAN_X * 2 + 2; const x = -SPAN - 1 + (((tp[1] + t * tp[2]) % span) + span) % span; return [x, 1.05, 0]; }, at: L(10).s + 0.4, dx: 120, dy: -230, variant: "orange" },
      ],
      chip: (t) => (t > L(10).s + 0.8 ? { key: "kendaraan", value: "±26.000", unit: "per hari" } : null),
    },
    J: {
      label: "Jadi…",
      title: "Bukan menahan,\ntapi *menyalurkan*",
      camera: orbit(ctx, "J", { target: [0, 0.4, 0], from: -0.85, to: 0.85, r: [25, 20], h: [8.5, 5.5] }),
    },
  };
};
