import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const terowonganMrt: VideoDef = {
  id: "terowongan-mrt",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "terowongan-mrt/vo.mp3",
  music: { src: "terowongan-mrt/music.wav", volume: 0.2 },
  cta: { text: "Mau dibongkar apa lagi? Tulis di komentar", fromLine: 15 },
  shots,
  createWorld,
};
