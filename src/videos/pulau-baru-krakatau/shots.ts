import { fmtID, keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { AK, MC, MX, NW, SE, makeState } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);

  return {
    A: {
      label: "SELAT SUNDA · 11 NOV 2026",
      title: "Pulau *baru*\nmuncul di Sunda",
      camera: K(
        "A",
        [[[10.6, 6.1, 11.6], [0, 0, -1.2]], [[7.6, 4.1, 8.0], [0, 0.2, -1.3]], [[5.2, 2.3, 6.0], [-1.2, 0.3, -1.3]]],
        () => [shot("A").s, L(2).s, L(2).s + 2.4],
      ),
      callouts: [
        { text: "Anak Krakatau", anchor: () => [AK.x, 2.35, AK.z], at: L(1).s + 0.5, until: L(2).e + 0.4, dx: -120, dy: -130 },
        { text: "pulau baru ±750 m", anchor: () => [NW.x, 0.4, NW.z], at: L(1).s + 1.5, dx: 20, dy: -85, variant: "orange" },
        { text: "pulau baru ±600 m", anchor: () => [SE.x, 0.35, SE.z], at: L(1).s + 2.4, dx: -235, dy: -85, variant: "orange" },
      ],
    },
    B: {
      label: "PERTANYAANNYA",
      title: "Kok bisa *muncul*\nbegitu saja?",
      camera: K(
        "B",
        [[[-2.1, 1.05, 3.7], [-3.9, 0.3, -0.9]], [[-4.55, 0.82, 2.6], [NW.x, 0.18, NW.z]]],
      ),
      callouts: [
        { text: "tinggi cuma ±1–2 m", anchor: () => [NW.x, 0.42, NW.z], at: L(3).s + 0.7, dx: -95, dy: -105, variant: "orange" },
      ],
    },
    C: {
      label: "YANG TERJADI",
      title: "Erupsi menerus\n*25 jam*",
      camera: K(
        "C",
        [[[4.7, 2.9, 5.5], [AK.x, 1.15, AK.z]], [[3.1, 2.1, 4.1], [AK.x, 1.6, AK.z]]],
      ),
      callouts: [
        { text: "kolom erupsi", anchor: () => [AK.x, 3.6, AK.z], at: L(4).s + 0.9, dx: 65, dy: -60, variant: "orange" },
        { text: "4–6 Sept 2026", anchor: () => [AK.x, 1.35, -0.85], at: L(4).s + 2.0, dx: 120, dy: 20 },
      ],
    },
    D: {
      label: "LANGKAH 1",
      title: "Magma *naik*\nlewat rekahan",
      camera: K(
        "D",
        [[[4.8, -0.7, 8.9], [-0.4, -3.9, 0]], [[2.0, -2.1, 6.4], [-1.8, -4.5, 0.1]]],
      ),
      callouts: [
        { text: "ruang magma", anchor: () => [0, -5.15, 0.45], at: L(5).s + 0.4, dx: -130, dy: -45, variant: "orange" },
        { text: "rekahan", anchor: () => [-2.1, -4.5, 0.15], at: L(5).s + 1.6, dx: -30, dy: -110 },
      ],
    },
    E: {
      label: "LANGKAH 2",
      title: "Lewat *dua titik*\nerupsi baru",
      camera: K(
        "E",
        [[[0.6, -0.8, 7.6], [-0.1, -3.35, -0.1]], [[-1.5, -1.6, 6.1], [-1.4, -3.6, -0.1]]],
      ),
      callouts: [
        { text: "±750 m (barat laut)", anchor: () => [-1.35, -4.35, 0.15], at: L(6).s + 0.5, dx: -235, dy: -60, variant: "orange" },
        { text: "±600 m (tenggara)", anchor: () => [1.55, -4.35, 0.15], at: L(6).s + 1.2, dx: 40, dy: -60, variant: "orange" },
      ],
    },
    F: {
      label: "LANGKAH 3",
      title: "Kena air laut,\nlava *membeku*",
      camera: K(
        "F",
        [[[-6.3, -0.75, 2.35], [NW.x, -1.25, -0.85]], [[-5.35, 0.65, 2.05], [NW.x, 0.3, NW.z]]],
      ),
      callouts: [
        { text: "lava + air = batuan", anchor: () => [NW.x, 0.35, NW.z], at: L(7).s + 0.7, dx: 40, dy: -115, variant: "orange" },
      ],
    },
    G: {
      label: "MENIMBUN",
      title: "Batuan menimbun\nhingga *menembus* laut",
      camera: K(
        "G",
        [[[-1.75, 0.66, 2.6], [NW.x, 0.08, NW.z]], [[-2.25, 1.0, 2.05], [NW.x, 0.3, NW.z]]],
      ),
      callouts: [
        { text: "daratan baru", anchor: () => [NW.x, 0.35, NW.z], at: L(8).s + 1.2, dx: -50, dy: -110, variant: "orange" },
      ],
      chip: (t) => (t > L(8).s + 0.3 ? { key: "TINGGI PULAU", value: `±${fmtID(S.islandM(t), 1)} m` } : null),
    },
    H: {
      label: "SEJAJAR",
      title: "Di atas jalur\n*rekahan tua*",
      tag: "ILUSTRASI",
      camera: K(
        "H",
        [[[MX + 0.3, 2.1, 13.4], [MX, 1.5, 0]], [[MX + 0.15, 1.75, 10.6], [MX, 1.45, 0]]],
      ),
      callouts: [
        { text: "Danan", anchor: () => [MX - 2.12, 1.62, -0.04], at: shot("H").s + 0.5, dx: -120, dy: -65 },
        { text: "titik baru NW", anchor: () => [MX - 0.68, 1.62, -0.04], at: shot("H").s + 1.6, dx: -150, dy: 90, variant: "orange" },
        { text: "Rakata", anchor: () => [MX + 2.05, 1.62, -0.04], at: shot("H").s + 0.9, dx: 10, dy: -65 },
      ],
      chip: (t) => (t > shot("H").s + 1.8 ? { key: "ARAH REKAHAN", value: "NW → SE" } : null),
    },
    I: {
      label: "ANALOGINYA",
      title: "Kayak *lilin* menetes\nke air dingin",
      camera: K(
        "I",
        [[[-5.2, 0.35, 1.55], [NW.x, 0.3, NW.z]], [[-4.45, 0.75, 1.15], [NW.x, 0.45, NW.z]]],
      ),
      callouts: [
        { text: "lelehan → beku", anchor: () => [NW.x, 0.42, NW.z], at: L(10).s + 0.6, dx: -60, dy: -105, variant: "orange" },
      ],
    },
    J: {
      label: "MASIH DUGAAN",
      title: "'Gunung *Cucu*\nKrakatau'?",
      camera: K(
        "J",
        [[[2.4, 1.8, 9.6], [0, 0.8, -1.35]], [[0.9, 1.4, 7.3], [0, 1.0, -1.4]]],
      ),
      callouts: [
        { text: "Badan Geologi: masih diduga", anchor: () => [AK.x, 2.4, AK.z], at: L(11).s + 0.6, dx: -165, dy: -105, variant: "orange" },
      ],
      chip: (t) => (t > L(11).s + 0.4 ? { key: "STATUS", value: "SIAGA", red: true } : null),
    },
    K: {
      label: "ANGKANYA",
      title: "Luas *sepersepuluh*,\nvolume *2–5%*",
      tag: "ILUSTRASI",
      camera: K(
        "K",
        [[[MC + 4, 6.2, 22.5], [MC - 0.8, 1.1, 0]], [[MC + 2.4, 4.3, 17.5], [MC - 0.8, 0.8, 0]]],
      ),
      callouts: [
        { text: "Krakatau 1883", anchor: () => [MC - 3.4, 3.75, 0], at: L(12).s + 0.5, dx: -115, dy: -55 },
        { text: "Anak Krakatau", anchor: () => [MC + 3.0, 0.92, 0], at: L(12).s + 1.1, dx: -30, dy: -85, variant: "orange" },
      ],
      chip: (t) => (t > L(13).s + 0.3 ? { key: "VOLUME", value: "2–5%" } : t > L(12).s + 0.3 ? { key: "LUAS", value: "±1/10" } : null),
    },
    L: {
      label: "JADI…",
      title: "Bukan pertanda\n*letusan besar*",
      camera: orbit(ctx, "L", { target: [0, 0.35, -1.4], from: -0.6, to: 0.35, r: [12.5, 10], h: [5.0, 3.7] }),
    },
  };
};
