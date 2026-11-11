import { keyframes, orbit } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { MX, makeState } from "./state";

/** dome height of the Newton diorama at horizontal offset dx from its centre */
const domeY0 = (dx: number) => -8.32 + Math.sqrt(Math.max(0, 64 - dx * dx));

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);
  const sat = (n: number, frac = 0.5) => {
    const a = L(n).s, b = L(n).e;
    return S.satPos(a + (b - a) * frac);
  };
  const off = (p: Vec3, dx: number, dy: number, dz: number): Vec3 => [p[0] + dx, p[1] + dy, p[2] + dz];
  const mid = (n: number) => (L(n).s + L(n).e) / 2;
  const burst: Vec3 = [-8.6, 7.2, -9.5];

  const A0 = sat(1), B0 = sat(2), C0 = sat(3), E0 = sat(5), F0 = sat(6), I0 = sat(9);
  const L0 = sat(12, 0.1), L1 = S.satPos(L(12).e);

  return {
    A: {
      label: "4 NOVEMBER 2026 · 19.39 WIB",
      title: "Satelit NASA *Swift*\njatuh di atas Sumut",
      tag: "ILUSTRASI",
      camera: K(
        "A",
        [[[7.2, 8.4, 24.5], [0, 1.9, 0]], [[4.7, 5.6, 19.8], [0, 1.5, 0]]],
      ),
      callouts: [
        { text: "Neil Gehrels Swift", anchor: () => A0, at: L(1).s + 0.7, until: L(2).s - 0.2, dx: 30, dy: -150 },
      ],
      chip: (t) => (t > L(1).s + 1.2 && t < L(2).s ? { key: "4 NOV 2026", value: "19.39 WIB", unit: "RE-ENTRY" } : null),
    },
    B: {
      label: "PROFIL",
      title: "Dirancang *2 tahun,*\nbertahan hampir 22",
      camera: K("B", [[off(B0, 3.0, 1.5, 4.2), B0], [off(B0, -2.4, 2.0, 3.6), B0]]),
      callouts: [
        { text: "luncur November 2004", anchor: () => B0, at: L(2).s + 0.5, until: L(2).e, dx: 120, dy: -180 },
        { text: "dirancang cuma 2 tahun", anchor: () => B0, at: L(2).s + 2.6, dx: -110, dy: 190, variant: "orange" },
      ],
      chip: (t) => (t > L(2).s + 0.8 ? { key: "massa", value: "1.450 kg" } : null),
    },
    C: {
      label: "Pertanyaannya",
      title: "Tapi tunggu… *kok bisa?*",
      camera: K("C", [[off(C0, 3.4, 0.7, 4.4), C0], [off(C0, 2.3, 1.8, 3.3), C0]]),
      callouts: [
        { text: "nggak ada mesin pendorong", anchor: () => off(C0, 0, -0.5, 0), at: L(3).s + 1.3, until: L(3).e, dx: 130, dy: -60, variant: "orange" },
        { text: "kok bisa jatuh?", anchor: () => C0, at: mid(3) + 1.1, dx: -150, dy: -150, variant: "red" },
      ],
    },
    D: {
      label: "KONSEP KUNCI",
      title: "Orbit = *jatuh\nyang meleset*",
      tag: "ILUSTRASI",
      camera: K("D", [[[10.6, 10.8, 13.6], [0, 1.3, 0]], [[8.0, 8.3, 11.2], [0, 1.2, 0]]]),
      callouts: [
        { text: "kecepatan ke samping", anchor: () => off(S.satPos(L(4).s + 2.2), 0.9, 0.1, 0), at: L(4).s + 1.4, until: L(4).e, dx: 150, dy: -130, variant: "orange" },
        { text: "gravitasi menarik terus", anchor: () => off(S.satPos(L(4).s + 2.2), 0, -1.6, 0), at: L(4).s + 2.1, dx: -130, dy: 90 },
      ],
      chip: (t) => (t > L(4).s + 1.2 ? { key: "kecepatan", value: "±22× suara" } : null),
    },
    E: {
      label: "LANGKAH 1",
      title: "Hambatan *udara tipis*",
      camera: K("E", [[off(E0, 1.6, 1.2, 2.8), E0], [off(E0, -1.3, 1.6, 2.2), E0]]),
      callouts: [
        { text: "molekul udara nyasar", anchor: () => off(E0, 1.1, 0.25, 0.6), at: L(5).s + 0.9, dx: 130, dy: -140 },
        { text: "energi dicuri setahap", anchor: () => E0, at: L(5).s + 3.1, dx: -40, dy: 200, variant: "orange" },
      ],
      chip: (t) => (t > L(5).s + 1.0 ? { key: "hambatan", value: "TIPIS", unit: "tapi konstan" } : null),
    },
    F: {
      label: "LANGKAH 2",
      title: "Matahari *makin aktif*",
      camera: K("F", [[off(F0, 0.7, 0.8, 5.2), [F0[0] * 0.4, F0[1] + 1.6, F0[2] - 3.2]], [off(F0, 2.4, 1.5, 4.2), [F0[0] * 0.4, F0[1] + 2.1, F0[2] - 3.2]]]),
      callouts: [
        { text: "atmosfer atas memuai", anchor: () => [F0[0] * 0.55, F0[1] + 0.4, F0[2] - 1.6], at: L(6).s + 1.5, until: L(6).e, dx: 120, dy: -130, variant: "orange" },
        { text: "makin tebal = makin seret", anchor: () => F0, at: L(6).s + 3.2, dx: -110, dy: 130 },
      ],
      chip: (t) => (t > L(6).s + 1.2 ? { key: "atmosfer", value: "MEMUAI" } : null),
    },
    G: {
      label: "LANGKAH 3",
      title: "*Spiral* menurun",
      tag: "ILUSTRASI",
      camera: K("G", [[[7.6, 13.2, 11.6], [0, 0.5, 0]], [[4.6, 12.1, 9.2], [0, 0.7, 0]]]),
      callouts: [
        { text: "orbit makin rendah", anchor: () => S.satPos(L(7).s + 3.4), at: L(7).s + 1.4, until: L(7).e + 0.2, dx: 130, dy: -60, variant: "orange" },
      ],
      chip: () => ({ key: "ketinggian", value: "600 → 275 km" }),
    },
    H: {
      label: "PENYELAMATAN",
      title: "Wahana LINK *gagal*",
      camera: K("H", [[off(S.linkPos(L(8).s + 0.6), 1.7, 1.5, 2.7), S.satPos(L(8).s + 0.6)], [off(S.satPos(L(8).e), 3.6, 1.3, 3.2), S.satPos(L(8).e)]]),
      callouts: [
        { text: "LINK mendekat", anchor: () => S.linkPos(L(8).s + 1.6), at: L(8).s + 1.0, until: L(8).e - 0.9, dx: 60, dy: 160 },
        { text: "kendali orientasi hilang", anchor: () => S.linkPos(L(8).e - 0.2), at: L(8).e - 0.55, dx: -60, dy: -170, variant: "red" },
      ],
      chip: (t) => (t > L(8).e - 1.0 ? { key: "LINK", value: "ABORTED", red: true } : null),
    },
    I: {
      label: "20 OKTOBER 2026",
      title: "Pengamatan *terakhir*",
      camera: K("I", [[off(I0, 2.4, 1.5, 3.7), off(I0, -0.5, 0.4, 0)], [off(I0, 1.1, 1.0, 2.6), off(I0, -0.5, 0.4, 0)]]),
      callouts: [
        { text: "ledakan sinar gamma", anchor: () => burst, at: L(9).s + 1.5, until: L(9).e, dx: 60, dy: 150, variant: "orange" },
      ],
      chip: () => ({ key: "20 OKT 2026", value: "OBS TERAKHIR" }),
    },
    J: {
      label: "ANALOGI",
      title: "Lempar *sekencang\nmungkin…*",
      tag: "ILUSTRASI",
      camera: K("J", [[[MX + 4.0, 1.9, 10.6], [MX - 1.4, -0.7, 0]], [[MX + 2.0, 1.2, 8.6], [MX - 1.2, -0.4, 0]]]),
      callouts: [
        { text: "bola dilempar lurus", anchor: () => [MX - 2.3, domeY0(MX - 2.3) + 0.2, 0], at: L(10).s + 0.7, until: L(10).e - 2.2, dx: 60, dy: -160 },
        { text: "lintasannya mengitari bumi", anchor: () => [MX + 2.6, -3.1, 0], at: L(10).s + 3.1, dx: 30, dy: -130, variant: "orange" },
      ],
    },
    K: {
      label: "LEGASINYA",
      title: "*Dua ribu* semburan\ngamma tercatat",
      camera: K("K", [[[-7.2, 6.2, 12.8], burst], [[-4.3, 4.2, 10.2], [burst[0] + 2.0, burst[1] + 1.1, burst[2]]]]),
      callouts: [
        { text: "ledakan terkuat di alam semesta", anchor: () => burst, at: L(11).s + 0.9, until: L(11).e, dx: -40, dy: 160 },
      ],
      chip: (t) => (t < mid(11) ? { key: "sinar gamma", value: "2.000+" } : { key: "datanya dipakai", value: "≈7.000", unit: "makalah" }),
    },
    L: {
      label: "4 NOVEMBER 2026 · 19.39 WIB",
      title: "*Terbakar* di atmosfer",
      tag: "ILUSTRASI",
      camera: K("L", [[off(L0, 2.9, 2.3, 5.3), L0], [off(L1, 2.0, 1.4, 3.7), L1]]),
      callouts: [
        { text: "sebagian besar hangus", anchor: () => S.satPos(L(12).s + 1.6), at: L(12).s + 1.1, dx: 130, dy: -120, variant: "orange" },
      ],
      chip: (t) => (t > L(12).s + 0.5 ? { key: "risiko melukai", value: "1 : 2.100" } : null),
    },
    M: {
      label: "Jadi…",
      title: "*Gravitasi* selalu menang",
      camera: orbit(ctx, "M", { target: [0, -0.4, 0], from: 0.6, to: 1.5, r: [15.5, 12.3], h: [6.4, 4.4] }),
    },
    N: {
      label: "KALI AJA TAU",
      title: "Mau dibongkar\n*apa lagi?*",
      camera: orbit(ctx, "N", { target: [0, -0.2, 0], from: 1.5, to: 2.35, r: [12.3, 10.8], h: [4.4, 3.6] }),
    },
  };
};
