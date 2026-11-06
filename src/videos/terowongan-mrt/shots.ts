import { fmtID, keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { MX, R, TY, XS, makeState } from "./state";

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);
  const at = (id: string) => S.tbm(shot(id).s, id); // TBM pose at the start of a shot
  const mid = (n: number) => (L(n).s + L(n).e) / 2;
  const tb = L(1).s + 2.6;
  const F = at("C").front;
  const STA = [-11, -3.5, 3.5, 11];

  return {
    A: {
      label: "MRT Jakarta · 4 Nov 2026",
      title: "Mesin bor *tembus*\nStasiun Mangga Besar",
      camera: K(
        "A",
        [[[XS + 6.5, TY + 0.9, 3.2], [XS + 0.4, TY, -0.5]], [[XS + 5.2, TY + 0.6, 2.4], [XS + 0.6, TY, -0.4]], [[XS - 1.5, -2.6, 24], [XS - 2.5, -4.5, -2]]],
        () => [shot("A").s, L(2).s, L(2).s + 2.4],
      ),
      callouts: [
        { text: "Stasiun Mangga Besar", anchor: () => [XS + 4.5, -2.9, -1], at: L(1).s + 0.6, until: L(2).s + 0.6, dx: -40, dy: -220 },
        { text: "mesin bor (TBM)", anchor: () => [XS + 1.1, TY + 0.4, -0.3], at: tb + 0.5, until: L(2).s + 0.8, dx: 60, dy: 240, variant: "orange" },
        { text: "±28 m", anchor: () => [XS - 2.2, TY / 2, 0.3], at: L(2).s + 1.0, dx: -170, dy: 0, variant: "orange" },
        { text: "jalan raya", anchor: () => [XS - 7, 0.05, -1.6], at: L(2).s + 1.8, dx: -40, dy: -170 },
        { text: "stasiun", anchor: () => [XS + 4.5, -4, -1], at: L(2).s + 2.2, dx: 60, dy: -200 },
      ],
      chip: (t) => (t > tb + 0.3 && t < L(2).s + 0.8 ? { key: "TBM-2", value: "TEMBUS!" } : null),
    },
    B: {
      label: "Pertanyaannya",
      title: "Kok jalan di atasnya\n*nggak ambles?*",
      camera: K("B", [[[F + 7, 1.3, 4.2], [F + 0.5, 0.6, -2.2]], [[F + 1.2, -3.2, 18], [F + 0.4, -4.2, -1]]]),
      callouts: [
        { text: "jalan", anchor: () => [F + 2.5, 0.05, -1.7], at: shot("B").s + 0.3, dx: 40, dy: -180 },
        { text: "gedung tua", anchor: () => [F - 3, 1.6, -5], at: shot("B").s + 1.1, dx: -80, dy: -160 },
        { text: "ambles?", anchor: () => [F + 0.4, -2.5, -0.4], at: mid(3) + 0.7, dx: 170, dy: -60, variant: "red" },
      ],
    },
    C: {
      label: "Kenalan dulu",
      title: "*TBM*: Tunnel\nBoring Machine",
      camera: K("C", [[[F - 1.0, TY + 0.5, 6.4], [F - 1.3, TY, -0.3]], [[F - 2.2, TY + 0.9, 5.0], [F - 1.6, TY, -0.3]]]),
      callouts: [
        { text: "kepala bor", anchor: () => [F + 0.1, TY + 0.55, 0], at: L(4).s + 0.4, dx: 110, dy: -190, variant: "orange" },
        { text: "perisai baja", anchor: () => [F - 1.3, TY + R, -0.3], at: L(4).s + 1.2, dx: -60, dy: -200 },
      ],
      chip: (t) => (t > L(4).e - 1.6 ? { key: "diameter", value: "±6,8 m" } : null),
    },
    D: {
      label: "Langkah 1",
      title: "Kepala bor *mengikis*",
      camera: K("D", [[[F + 2.0, TY + 0.7, 2.9], [F, TY, -0.2]], [[F + 1.4, TY + 0.25, 2.1], [F, TY, -0.25]]]),
      callouts: [{ text: "gigi pemotong", anchor: () => [F + 0.17, TY + 0.5, -0.3], at: L(5).s + 1.2, dx: 120, dy: -230 }],
    },
    E: {
      label: "Kuncinya",
      title: "Tekanan *seimbang*",
      camera: K("E", [[[F - 0.2, TY + 0.6, 3.6], [F - 0.1, TY, -0.3]], [[F + 0.1, TY + 0.25, 2.7], [F, TY, -0.3]]]),
      callouts: [
        { text: "ruang tekanan", anchor: () => [F - 0.35, TY - 0.3, -0.3], at: L(6).s + 1.4, dx: -150, dy: 200, variant: "orange" },
        { text: "tanah + air", anchor: () => [F + 0.6, TY + 0.55, -0.25], at: L(6).s + 2.4, dx: 120, dy: -200 },
      ],
      chip: (t) => (t > L(7).s ? { key: "tekanan", value: "SEIMBANG" } : null),
    },
    F: {
      label: "Langkah 2",
      title: "Ulir *membuang tanah*",
      camera: K("F", [[[F - 1.5, TY + 0.4, 3.4], [F - 1.6, TY, -0.4]], [[F - 3.0, TY + 0.6, 3.0], [F - 2.8, TY, -0.4]]]),
      callouts: [
        { text: "ulir (screw)", anchor: () => [F - 1.6, TY - 0.2, -0.38], at: L(8).s + 1.0, dx: 60, dy: 230, variant: "orange" },
        { text: "ban berjalan", anchor: () => [F - 4.2, TY + 0.12, -0.38], at: L(8).s + 2.6, dx: -40, dy: -210 },
      ],
    },
    G: {
      label: "Langkah 3",
      title: "Pasang *cincin beton*",
      camera: K("G", [[[F - 5.6, TY + 0.2, 0.75], [F - 2.2, TY - 0.05, -0.45]], [[F - 4.4, TY + 0.1, 0.7], [F - 2.3, TY, -0.45]]]),
      callouts: [
        { text: "lengan pemasang", anchor: () => [at("G").tail + 0.0, TY - 0.3, -0.4], at: L(9).s + 1.0, dx: -140, dy: 230, variant: "orange" },
        { text: "segmen beton", anchor: () => [at("G").tail - 1.2, TY + 0.55, -0.55], at: L(9).s + 2.0, dx: 40, dy: -230 },
      ],
    },
    H: {
      label: "Cara maju",
      title: "Kayak *ulat*",
      camera: K("H", [[[F - 1.6, TY + 0.7, 5.0], [F - 2.0, TY, -0.3]], [[F - 0.7, TY + 0.7, 4.6], [F - 1.2, TY, -0.3]]]),
      callouts: [{ text: "dongkrak pendorong", anchor: (t) => [S.tbm(t, "H").tail + 0.15, TY - 0.45, -0.5], at: L(10).s + 0.8, dx: 40, dy: 240, variant: "orange" }],
      chip: (t) => ({ key: "cincin baru", value: String(Math.max(0, S.tbm(t, "H").rings - at("H").rings)) }),
    },
    I: {
      label: "Sentuhan akhir",
      title: "Celah diisi *grout*",
      camera: K("I", [[[at("I").tail - 0.4, TY + 0.6, 2.8], [at("I").tail - 0.6, TY, -0.4]], [[at("I").tail - 1.2, TY + 0.4, 2.3], [at("I").tail - 0.9, TY, -0.4]]]),
      callouts: [
        { text: "grout (semen cair)", anchor: () => [at("I").tail - 0.5, TY + 0.82, -0.25], at: L(11).s + 1.6, dx: -40, dy: -230, variant: "orange" },
        { text: "cincin beton", anchor: () => [at("I").tail - 1.4, TY - 0.7, -0.4], at: L(11).s + 2.4, dx: -60, dy: 220 },
      ],
    },
    J: {
      label: "Kecepatannya",
      title: "±7,5 m *per hari*",
      camera: K("J", [[[F - 3.2, TY + 1.6, 9.5], [F - 2.2, TY - 0.1, -0.6]], [[F - 0.8, TY + 1.4, 8.5], [F - 0.8, TY - 0.1, -0.6]]]),
      chip: (t) => {
        const d = S.dayClock(t);
        return { key: `jam ${String(Math.round(d * 24)).padStart(2, "0")}:00`, value: `${fmtID(7.5 * d, 1)} m`, unit: `≈ ${Math.round(5 * d)} cincin` };
      },
    },
    K: {
      label: "Fase 2A",
      title: "*6 mesin bor*\ndikerahkan",
      tag: "ILUSTRASI",
      camera: K("K", [[[MX + 2, 47, 26], [MX, 0, 1.2]], [[MX + 1, 44, 24], [MX, 0, 1.2]]]),
      callouts: [
        { text: "Bundaran HI", anchor: () => [MX + 1.6, 0.6, -STA[0]], at: L(13).s + 0.3, dx: 190, dy: 0 },
        { text: "Harmoni", anchor: () => [MX + 1.6, 0.6, -STA[1]], at: L(13).s + 0.6, dx: 190, dy: 0 },
        { text: "Mangga Besar", anchor: () => [MX + 1.6, 0.6, -STA[2]], at: L(13).s + 0.9, dx: 190, dy: 0 },
        { text: "Kota", anchor: () => [MX + 1.6, 0.6, -STA[3]], at: L(13).s + 1.2, dx: 190, dy: 0 },
      ],
      chip: () => ({ key: "jalur", value: "3 ruas × 2" }),
    },
    L: {
      label: "Jadi…",
      title: "Kota tetap jalan,\nterowongan *terbentuk*",
      camera: orbit(ctx, "L", { target: [XS - 6, -2.5, -2], from: -0.55, to: 0.35, r: [27, 23], h: [11, 8] }),
    },
  };
};
