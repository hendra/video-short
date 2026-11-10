import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const rumahPompa: VideoDef = {
  id: "rumah-pompa",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "rumah-pompa/vo.mp3",
  music: { src: "rumah-pompa/music.wav", volume: 0.22 },
  cta: { text: "Mau dibongkar apa lagi? Tulis di komentar", fromLine: 16 },
  shots,
  createWorld,
};
