import { fmtID, keyframes } from "../../engine/math";
import type { Ctx, ShotDef, Vec3 } from "../../engine/types";
import { ALT0, ALT1, ALT_REQ, AUSTIN, CHART, ELEUTHERA, GX, JET, KM, SITE, makeState, profile } from "./state";

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const shots = (ctx: Ctx): Record<string, ShotDef> => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const K = (id: string, keys: [Vec3, Vec3][], times?: () => number[]) => keyframes(ctx, id, keys, times);
  const J = (d: Vec3) => add(JET, d);
  const pinTop = (p: Vec3): Vec3 => [p[0], 2.0, p[2]];

  return {
    A: {
      label: "Minggu, 1 November 2026",
      title: "Learjet 60 jatuh di\n*Greenacres, Florida*",
      tag: "ILUSTRASI",
      camera: K("A", [[add(SITE, [3, 16, 17]), add(SITE, [-1, 0, -2])], [add(SITE, [1, 20, 22]), add(SITE, [-2, 0, -2])]]),
      callouts: [{ text: "Greenacres, Florida", anchor: () => pinTop(SITE), at: L(1).s + 0.8, dx: -150, dy: 190, variant: "red" }],
      chip: (t) => (t > L(1).s + 4.2 ? { key: "korban jiwa", value: "9 orang", red: true } : null),
    },
    B: {
      label: "Keterangan awal",
      title: "Kronologi menurut\n*NTSB & FAA*",
      tag: "ILUSTRASI",
      camera: K("B", [[[-1, 82, 22], [-1, 0, -4]], [[-2, 90, 24], [-2, 0, -4]]]),
      callouts: [
        { text: "Texas", anchor: () => [-20, 0.4, -10], at: shot("B").s + 0.3, dx: 40, dy: -120 },
        { text: "Florida", anchor: () => [12, 0.4, -2], at: shot("B").s + 0.6, dx: 0, dy: -150 },
      ],
    },
    C: {
      label: "10:37 waktu Florida",
      title: "Terbang dari Austin\nmenuju *Bahama*",
      tag: "RUTE ILUSTRASI",
      camera: K("C", [[[0, 102, 26], [0, 0, -4]], [[1, 96, 24], [1, 0, -3]]]),
      callouts: [
        { text: "Austin, Texas", anchor: () => pinTop(AUSTIN), at: L(3).s + 0.3, dx: 40, dy: 170 },
        { text: "Bahama (tujuan)", anchor: () => pinTop(ELEUTHERA), at: L(3).s + 3.4, dx: -60, dy: 170 },
      ],
      chip: (t) => (t < L(3).s + 4.6 ? { key: "pukul 10:37", value: "lepas landas" } : { key: "di dalam", value: "2 kru + 7 penumpang" }),
    },
    D: {
      label: "Pukul 12:47",
      title: "Turbulensi sedang\n& *es tipis*",
      camera: K("D", [[J([10, 2.6, 7]), J([-0.8, 0, 0])], [J([8.5, 1.6, 6.5]), J([-0.6, 0, 0.6])], [J([5.5, 2.4, 6.0]), J([-0.4, -0.2, 1.4])]], () => [shot("D").s, L(5).s, shot("D").e]),
      callouts: [
        { text: "turbulensi sedang", anchor: () => J([-1.2, 0.5, 0]), at: L(4).s + 1.6, until: L(5).s - 0.2, dx: -120, dy: -210 },
        { text: "es tipis di sayap", anchor: () => J([-0.2, -0.22, 2.0]), at: L(4).s + 4.4, dx: 120, dy: 200, variant: "orange" },
      ],
      chip: (t) =>
        t < L(5).s ? { key: "ketinggian", value: "10,7 km" } : t < L(5).s + 2.6 ? { key: "suhu luar", value: "−47 °C" } : { key: "guncangan", value: "±200 m" },
    },
    E: {
      label: "Permintaan kru",
      title: "Minta naik ke\n*11,3 km*",
      camera: K("E", [[J([10, 3.4, 7.5]), J([-0.5, 0.3, 0])], [J([9, 1.6, 8.5]), J([-0.3, 0.3, 0])]]),
      chip: (t) => (t < L(6).s + 2.6 ? { key: "kru → ATC", value: "naik 11,3 km?" } : { key: "ATC", value: "DISETUJUI" }),
    },
    F: {
      label: "< 30 detik kemudian",
      title: "Turun cepat,\npanggilan *Mayday*",
      camera: K("F", [[J([9, 2.0, 10]), J([-0.3, 0, 0])], [J([4, 5.5, 12]), J([0, -0.6, 0])]]),
      callouts: [
        {
          text: "hidung menukik",
          anchor: (t) => {
            const p = S.attitude(t).pitch;
            return J([3.2 * Math.cos(p), 3.2 * Math.sin(p), 0]);
          },
          at: L(7).s + 3.0,
          dx: 120,
          dy: 220,
          variant: "red",
        },
      ],
      chip: (t) => (t < L(8).s ? { key: "radio", value: "MAYDAY", red: true } : { key: "laporan kru", value: "OVERSPEED", red: true }),
    },
    G: {
      label: "Data FAA",
      title: "Anjlok *8 km*\ndalam ±1 menit",
      camera: K("G", [[[CHART.x0 + 2.6, 8.0, 25], [CHART.x0 + 2.6, 8.0, 0]], [[CHART.x0 + 3.0, 7.6, 24], [CHART.x0 + 2.8, 7.6, 0]]]),
      callouts: [
        { text: "11,3 km (diminta)", anchor: () => [CHART.x0 + 6.4, ALT_REQ, 0], at: shot("G").s + 0.3, dx: -40, dy: -110 },
        { text: "10,7 km", anchor: () => [CHART.x0 + 0.4, ALT0, 0], at: shot("G").s + 0.6, dx: -20, dy: 110 },
        { text: "2,7 km", anchor: () => [CHART.x0 + CHART.level + CHART.drop, ALT1, 0], at: L(9).e - 0.2, dx: 60, dy: 120, variant: "red" },
      ],
      chip: (t) => {
        const a = profile(S.chartU(t));
        return { key: "ketinggian", value: `${fmtID(a, 1)} km`, red: a < ALT0 - 0.5 };
      },
    },
    H: {
      label: "Sekitar pukul 12:50",
      title: "Jatuh di jalan dekat\n*Military Trail*",
      camera: K("H", [[[GX + 16, 26, 30], [GX + 0.5, 0, -1]], [[GX + 10, 20, 24], [GX, 0, -1]]]),
      callouts: [
        { text: "lokasi jatuh", anchor: () => [GX, 6.6, 0], at: L(10).s + 0.6, dx: 150, dy: -60, variant: "red" },
        { text: "Military Trail", anchor: () => [GX, 0.1, -12], at: L(10).s + 1.6, dx: -170, dy: -40 },
      ],
      chip: (t) => (t > L(10).s + 4.0 ? { key: "di darat", value: "1 orang luka" } : null),
    },
    I: {
      label: "Temuan penting",
      title: "*Elevator kiri*\nditemukan terpisah",
      camera: K("I", [[J([-7.5, 4.2, -5.5]), J([-3.0, 1.4, -0.6])], [J([-6.4, 3.6, -4.6]), J([-3.1, 1.5, -0.7])]]),
      callouts: [
        { text: "elevator kiri", anchor: () => J([-3.33, 1.58, -0.9]), at: L(11).s + 1.0, dx: 160, dy: 190, variant: "orange" },
        { text: "pengatur naik-turun hidung", anchor: () => J([-3.0, 1.6, 0.9]), at: L(11).s + 3.0, dx: -60, dy: -220 },
      ],
      chip: (t) => (t > L(11).s + 5.2 ? { key: "jarak dari lokasi", value: "2–6 km" } : null),
    },
    J: {
      label: "Kata NTSB",
      title: "Lepas *sebelum*\npesawat jatuh",
      tag: "ARAH ILUSTRASI",
      camera: K("J", [[[GX + 30, 230, 190], [GX, 0, -8]], [[GX + 40, 250, 205], [GX, 0, -10]]]),
      callouts: [
        { text: "2 km", anchor: () => [GX + 2 * KM, 0.6, 0], at: shot("J").s + 1.2, dx: 70, dy: -80, variant: "orange" },
        { text: "6 km", anchor: () => [GX + 6 * KM * 0.6, 0.6, 6 * KM * 0.8], at: shot("J").s + 1.6, dx: -40, dy: -110, variant: "orange" },
        { text: "lokasi jatuh", anchor: () => [GX, 30, 0], at: shot("J").s + 0.5, dx: -170, dy: -90, variant: "red" },
      ],
      chip: (t) => (t > L(12).s + 2.6 ? { key: "belum diketahui", value: "penyebab / akibat?" } : null),
    },
    K: {
      label: "Penyelidikan",
      title: "Fokus: *cuaca* &\nperekam suara kokpit",
      camera: K("K", [[J([9, 1.6, 12]), J([1.6, 0, 1.6])], [J([8, 1.0, 10.5]), J([2.0, -0.3, 2.2])]]),
      callouts: [
        { text: "awan hujan, turbulensi", anchor: () => J([-3, 2.2, -3]), at: L(13).s + 0.4, dx: -60, dy: -200 },
        { text: "perekam suara kokpit", anchor: () => J([3.4, -0.4, 3.8]), at: L(13).s + 2.4, dx: 80, dy: 200, variant: "orange" },
      ],
    },
    L: {
      label: "Status",
      title: "Penyebab\n*masih diselidiki*",
      tag: "ILUSTRASI",
      camera: K("L", [[[8, 42, 32], [4, 0, -1]], [[12, 34, 26], [8, 0, 0]]]),
      chip: () => ({ key: "penyebab", value: "belum ditentukan" }),
    },
    M: {
      label: "Untuk keluarga korban",
      title: "*Turut berduka*",
      camera: K("M", [[add(SITE, [2, 22, 24]), add(SITE, [-2, 0, -2])], [add(SITE, [1, 17, 19]), add(SITE, [-2, 0, -2])]]),
    },
  };
};
