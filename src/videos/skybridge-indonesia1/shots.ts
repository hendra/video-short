import { keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { ARM, JACK_Y, JX, SPAN, TOWER_H_S, TRUSS_H, TX, Y0, Y_TOP, jackPhase, makeState } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);

  return {
    A: {
      label: "Jl. MH Thamrin, Jakarta",
      title: "Jembatan *290 ton*\ndi antara dua menara",
      camera: K("A", [[[10, 7, 66], [0, 24, 0]], [[4, 10, 58], [0, 26, 0]]]),
      callouts: [{ text: "rangka baja 290 ton", anchor: () => [0, Y0 + TRUSS_H, 0], at: L(1).s + 1.6, dx: 150, dy: 160, variant: "orange" }],
      chip: (t) => (t > L(1).s + 3.4 ? { key: "berat rangka", value: "290 ton" } : null),
    },
    B: {
      label: "Targetnya",
      title: "Naik ke\n*117 meter*",
      camera: K("B", [[[0, 22, 84], [0, 30, 0]], [[0, 46, 74], [0, 44, 0]]]),
      callouts: [
        { text: "posisi akhir", anchor: () => [0, Y_TOP + TRUSS_H, 0], at: L(2).s + 0.8, dx: -40, dy: 160, variant: "orange" },
        { text: "menara ±306 m", anchor: () => [TX, TOWER_H_S, 0], at: L(2).s + 3.0, dx: -120, dy: 120 },
      ],
      chip: () => ({ key: "ketinggian", value: "117 m" }),
    },
    C: {
      label: "Pertanyaannya",
      title: "Kok bisa diangkat\n*lurus & pas?*",
      camera: K("C", [[[2, 4, 48], [0, 28, 0]], [[0, 5, 42], [0, 30, 0]]]),
    },
    D: {
      label: "Langkah 1",
      title: "Dirakit dulu\n*di bawah*",
      tag: "ILUSTRASI",
      camera: K("D", [[[12, 14, 20], [0, 5, 0]], [[9, 11, 16], [0, 5.5, 0]]]),
      callouts: [{ text: "di atas jembatan lantai 3–5", anchor: () => [-5, Y0, 2.1], at: L(4).s + 2.2, dx: -40, dy: 200 }],
    },
    E: {
      label: "Langkah 2",
      title: "*12* strand jack\nhidraulik",
      camera: K("E", [[[12, 49, 15], [3.5, 42, 0]], [[9, 46, 13], [3.2, 40, 0]]]),
      callouts: [
        { text: "strand jack", anchor: () => [SPAN / 2 - 0.85, JACK_Y, 1.5], at: L(5).s + 2.0, dx: 140, dy: -150, variant: "orange" },
        { text: "kabel baja", anchor: () => [SPAN / 2 - 0.85, JACK_Y - 6, 1.5], at: L(5).s + 4.2, dx: 150, dy: 120 },
      ],
      chip: (t) => (t > L(5).s + 1.2 ? { key: "jumlah jack", value: "12" } : null),
    },
    F: {
      label: "Cara kerja",
      title: "Gerak *seperti ulat*",
      tag: "POTONGAN",
      camera: K("F", [[[JX + 7, 5, 11.5], [JX, 3.7, 0]], [[JX + 5.5, 4.6, 10], [JX, 3.7, 0]]]),
      callouts: [
        { text: "penjepit atas", anchor: (t) => [JX + 1.0, 3.95 + jackPhase(S.cycle(t)).ext, 0.4], at: L(6).s + 0.8, dx: 150, dy: -110 },
        { text: "silinder hidraulik", anchor: () => [JX - 1.2, 2.6, 0.2], at: L(6).s + 2.0, dx: -110, dy: -170, variant: "orange" },
        { text: "penjepit bawah", anchor: () => [JX + 1.0, 0.98, 0.4], at: L(6).s + 4.6, dx: 140, dy: 120 },
      ],
      chip: (t) => {
        const j = jackPhase(S.cycle(t));
        return { key: "yang mencengkeram", value: j.upGrip && !j.lowGrip ? "penjepit ATAS" : j.lowGrip && !j.upGrip ? "penjepit BAWAH" : "dua-duanya" };
      },
    },
    G: {
      label: "Langkah 3",
      title: "Naik *serempak*\ndikendalikan komputer",
      camera: K("G", [[[0, 14, 62], [0, 11, 0]], [[0, 16, 56], [0, 12, 0]]]),
      chip: (t) => (Math.abs(S.tilt(t)) > 0.02 ? { key: "status", value: "MIRING!", red: true } : { key: "status", value: "serempak ✓" }),
    },
    H: {
      label: "Pelan tapi pasti",
      title: "Naik sampai\n*117 meter*",
      camera: (t) => {
        const y = S.trussY(t);
        return { position: [16, y + 7, 42], target: [0, y + 3.5, 0] };
      },
      callouts: [{ text: "kantilever 20–27 m", anchor: () => [SPAN / 2 + ARM / 2, Y_TOP + TRUSS_H, 2.1], at: L(8).e - 2.6, dx: 60, dy: -170 }],
      chip: (t) => ({ key: "ketinggian", value: `${Math.round(S.trussY(t) * 3)} m` }),
    },
    I: {
      label: "Langkah akhir",
      title: "Dikunci,\nkabel *dilepas*",
      camera: K("I", [[[SPAN / 2 + 5, Y_TOP + 6, 11], [SPAN / 2, Y_TOP + 1.5, 0]], [[SPAN / 2 + 3.5, Y_TOP + 5, 9], [SPAN / 2, Y_TOP + 1.6, 0]]]),
      callouts: [{ text: "sambungan dikunci", anchor: () => [SPAN / 2 - 0.1, Y_TOP, 2.1], at: L(9).s + 1.0, dx: -120, dy: 180, variant: "orange" }],
    },
    J: {
      label: "Hitungannya",
      title: "Tiap jack cuma\n±*24 ton*",
      camera: K("J", [[[SPAN / 2 + 3, JACK_Y + 5.5, 9.5], [SPAN / 2 - 0.6, JACK_Y - 0.5, 0]], [[SPAN / 2 + 2, JACK_Y + 4.5, 8], [SPAN / 2 - 0.6, JACK_Y - 0.3, 0]]]),
      callouts: [{ text: "290 t ÷ 12 ≈ 24 t", anchor: () => [SPAN / 2 - 0.45, JACK_Y + 0.2, 1.5], at: L(10).s + 0.8, dx: 120, dy: -170, variant: "orange" }],
      chip: (t) => (t < L(10).s + 4.0 ? { key: "beban per jack", value: "±24 ton" } : { key: "strand jack besar", value: "s/d ±1.700 ton" }),
    },
    K: {
      label: "Jadi",
      title: "Tarikan kecil,\n*diulang serempak*",
      camera: orbit(ctx, "K", { target: [0, 44, 0], from: 0.35, to: -0.25, r: [118, 104], h: [70, 58] }),
    },
  };
};
