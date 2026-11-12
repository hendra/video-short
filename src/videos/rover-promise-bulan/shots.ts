import { keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { CRATER, MX, ROVER_END, ROVER_HOME, makeState, terrainHeight } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);
  const mid = (n: number) => (L(n).s + L(n).e) / 2;
  const roverTop = (t: number): Vec3 => {
    const p = S.roverPos(t);
    return [p[0], p[1] + 2.05, p[2]];
  };
  const homeY = terrainHeight(ROVER_HOME[0], ROVER_HOME[2]);
  const drillGround: Vec3 = [ROVER_HOME[0] + 0.78, homeY + 0.05, ROVER_HOME[2] + 0.24];

  return {
    A: {
      label: "NOVEMBER 2026 · NASA",
      title: "Rover *nuklir*\nke Kutub Selatan Bulan",
      camera: K(
        "A",
        [[[-13.2, 6.6, 13.4], [6.0, 3.4, -8.0]], [[-8.6, 4.1, 9.6], [0.6, 0.4, -0.3]]],
        () => [shot("A").s, L(2).s + 1.0],
      ),
      callouts: [
        { text: "PROMISE", anchor: (t) => roverTop(t), at: L(1).s + 0.9, until: L(2).s + 0.4, dx: 70, dy: -170, variant: "orange" },
        { text: "Kutub Selatan Bulan", anchor: () => [CRATER[0], 0.4, CRATER[2] + 2.2], at: L(1).s + 2.2, dx: 90, dy: -120 },
      ],
      chip: (t) => (t > L(1).s + 1.6 && t < L(2).e ? { key: "luncur", value: "akhir 2028", unit: "misi ±18 bulan" } : null),
    },
    B: {
      label: "PERTANYAANNYA",
      title: "*Gelap.* Beku.\nKok bisa jalan?",
      camera: K("B", [[[-7.8, 4.4, 8.6], [CRATER[0], -0.6, CRATER[2]]], [[-3.0, 2.2, 4.6], [CRATER[0], -1.6, CRATER[2]]]]),
      callouts: [
        { text: "kawah bayangan permanen", anchor: () => [CRATER[0], 0.3, CRATER[2] + 1.1], at: L(3).s + 0.8, until: L(3).e, dx: -60, dy: -160 },
        { text: "kok bisa?", anchor: (t) => roverTop(t), at: mid(3) + 0.8, dx: 80, dy: -140, variant: "red" },
      ],
    },
    C: {
      label: "KENAPA NUKLIR",
      title: "*Malam Bulan*\nterlalu panjang",
      camera: K("C", [[[-1.2, 1.05, 9.2], [CRATER[0], 0.4, CRATER[2]]], [[2.6, 1.5, 8.0], [CRATER[0], 0.8, CRATER[2]]]]),
      callouts: [
        { text: "matahari cuma menggosok ufuk", anchor: () => [30, 1.6, -22], at: L(4).s + 0.6, until: L(4).e, dx: -80, dy: 60 },
        { text: "panel surya = gelap gulita", anchor: (t) => roverTop(t), at: L(4).s + 2.0, dx: -60, dy: -190, variant: "orange" },
      ],
      chip: (t) => (t > L(4).s + 1.0 ? { key: "malam Bulan", value: "±14 hari" } : null),
    },
    D: {
      label: "LANGKAH 1",
      title: "*Panas radioaktif*\ndiubah jadi listrik",
      camera: K("D", [[[-8.3, 1.9, 5.6], [-5.45, homeY + 0.72, 2.6]], [[-6.6, 1.5, 4.3], [-5.45, homeY + 0.72, 2.6]]]),
      callouts: [
        { text: "sirip pendingin panas", anchor: () => [-5.5, homeY + 0.72, 2.6], at: L(5).s + 1.1, dx: -40, dy: -185, variant: "orange" },
        { text: "tanpa reaktor, tanpa ledakan", anchor: (t) => { const p = S.roverPos(t); return [p[0], p[1] + 0.95, p[2]] as Vec3; }, at: L(5).s + 2.4, dx: 60, dy: 200 },
      ],
      chip: (t) => (t > L(5).s + 1.2 ? { key: "RTG", value: "PANAS → LISTRIK" } : null),
    },
    E: {
      label: "LANGKAH 2",
      title: "Bor *±1 meter*\nmencari es air",
      camera: K("E", [[[-0.9, 2.0, 5.9], [-3.6, homeY + 0.4, 2.7]], [[-2.3, 1.25, 4.3], [-3.75, homeY + 0.15, 2.8]]]),
      callouts: [
        { text: "regolit (tanah Bulan)", anchor: () => drillGround, at: L(6).s + 1.1, dx: -30, dy: 210 },
        { text: "±1 m", anchor: (t) => { const p = S.roverPos(t); return [p[0] + 0.78, p[1] + 0.06, p[2] + 0.24] as Vec3; }, at: L(6).s + 2.3, dx: 120, dy: 60, variant: "orange" },
      ],
      chip: (t) => (t > L(6).s + 1.4 ? { key: "kedalaman bor", value: "±1,0 m" } : null),
    },
    F: {
      label: "LANGKAH 3",
      title: "*Spektrometer*\nmembaca komposisi",
      camera: K("F", [[[-7.2, 3.3, 6.6], [-4.2, homeY + 0.5, 2.3]], [[-5.3, 2.5, 5.0], [-4.0, homeY + 0.6, 2.2]]]),
      callouts: [
        { text: "spektrum khas es air", anchor: (t) => { const p = S.roverPos(t); return [p[0] + 1.9, terrainHeight(p[0] + 1.9, p[2] + 0.9) + 0.05, p[2] + 0.9] as Vec3; }, at: L(7).s + 1.6, dx: 20, dy: 205, variant: "orange" },
        { text: "kamera cahaya tampak", anchor: (t) => { const p = S.roverPos(t); return [p[0] + 0.35, p[1] + 1.9, p[2] - 0.25] as Vec3; }, at: L(7).s + 0.7, until: L(7).e, dx: 110, dy: -160 },
      ],
    },
    G: {
      label: "TANPA MATAHARI",
      title: "*−203 °C*\ndi bayangan permanen",
      camera: K("G", [[[1.0, 6.4, 3.6], [CRATER[0], -2.4, CRATER[2]]], [[2.8, 4.6, 1.6], [CRATER[0], -2.6, CRATER[2]]]]),
      callouts: [
        { text: "bayangan permanen", anchor: () => [CRATER[0], -1.6, CRATER[2]], at: L(8).s + 0.7, until: L(8).e, dx: -20, dy: -175 },
        { text: "−203 °C, tak pernah cair", anchor: () => [CRATER[0] + 1.3, -2.2, CRATER[2] + 0.6], at: L(8).s + 2.4, dx: 60, dy: 170, variant: "red" },
      ],
      chip: (t) => (t > L(8).s + 1.0 ? { key: "suhu kawah", value: "−203 °C", red: true } : null),
    },
    H: {
      label: "TARGETNYA",
      title: "Es air, beku sejak\n*miliaran tahun*",
      camera: K("H", [[[2.3, 3.3, 1.3], [CRATER[0] + 0.4, -2.5, CRATER[2]]], [[3.4, 2.5, 0.2], [CRATER[0], -2.7, CRATER[2] + 0.3]]]),
      callouts: [
        { text: "diduga es air", anchor: () => [CRATER[0] + 0.7, -2.45, CRATER[2] - 0.4], at: L(9).s + 1.2, dx: 80, dy: -170, variant: "orange" },
        { text: "merekam sejarah tata surya", anchor: () => [CRATER[0] - 1.1, -2.55, CRATER[2] + 0.9], at: L(9).s + 3.0, dx: -30, dy: 175 },
      ],
      chip: (t) => (t > L(9).s + 1.0 ? { key: "material", value: "H₂O", unit: "diduga" } : null),
    },
    I: {
      label: "HEMAT BIAYA",
      title: "Dibangun dari\n*suku cadang Mars*",
      tag: "ILUSTRASI",
      camera: K("I", [[[MX + 0.5, 2.1, 11.8], [MX, 0.35, 0]], [[MX + 0.2, 1.35, 8.4], [MX, 0.4, 0]]]),
      callouts: [
        { text: "Curiosity & Perseverance", anchor: () => [MX - 1.75, 0.55, 0.4], at: L(10).s + 0.8, dx: -110, dy: -185 },
        { text: "PROMISE", anchor: () => [MX + 1.75, 0.72, 0.4], at: L(10).s + 1.9, dx: -10, dy: -175, variant: "orange" },
      ],
      chip: (t) => (t > L(10).s + 1.2 ? { key: "perangkat keras", value: "rover Mars" } : null),
    },
    J: {
      label: "KONTRAK",
      title: "*US$94 juta*\nuntuk Blue Origin",
      camera: K("J", [[[-8.6, 3.6, 9.4], [0.5, 0.3, -0.8]], [[-5.6, 2.6, 7.2], [0.8, 0.4, -0.9]]]),
      callouts: [
        { text: "dikirim oleh Blue Origin", anchor: (t) => { const p = S.roverPos(t); return [p[0], p[1] + 1.0, p[2]] as Vec3; }, at: L(11).s + 0.8, dx: -30, dy: -185 },
        { text: "perusahaan Jeff Bezos", anchor: () => [CRATER[0], 0.4, CRATER[2] + 2.4], at: L(11).s + 2.0, dx: 90, dy: -120 },
      ],
      chip: (t) => (t > L(11).s + 0.9 ? { key: "kontrak dasar", value: "US$94 jt", unit: "Blue Origin" } : null),
    },
    K: {
      label: "JADI…",
      title: "Bukan cuma *cari es*:\nuji coba rumah di Bulan",
      camera: K(
        "K",
        [
          [[-7.4, 2.5, 7.6], [ROVER_HOME[0], homeY + 0.9, ROVER_HOME[2]]],
          [[-1.6, 2.1, 6.2], [ROVER_END[0], terrainHeight(ROVER_END[0], ROVER_END[2]) + 0.9, ROVER_END[2]]],
        ],
        () => [shot("K").s, shot("K").s + (shot("K").e - shot("K").s) * 0.72],
      ),
      chip: (t) => (t > L(12).s + 0.8 ? { key: "misi", value: "±18 BULAN" } : null),
    },
    L: {
      label: "KALI AJA TAU",
      title: "*Bulan*: calon rumah\nkedua kita?",
      camera: orbit(ctx, "L", { target: [0.5, -0.4, 0], from: -0.65, to: 0.5, r: [15.5, 11.5], h: [8.0, 5.0] }),
    },
  };
};
