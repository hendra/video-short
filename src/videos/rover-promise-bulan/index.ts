import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const roverPromiseBulan: VideoDef = {
  id: "rover-promise-bulan",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "rover-promise-bulan/vo.mp3",
  music: { src: "rover-promise-bulan/music.wav", volume: 0.2 },
  cta: { text: "Mau dibongkar apa lagi? Tulis di komentar", fromLine: 14 },
  shots,
  createWorld,
};
