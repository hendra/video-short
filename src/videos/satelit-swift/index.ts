import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const satelitSwift: VideoDef = {
  id: "satelit-swift",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "satelit-swift/vo.mp3",
  music: { src: "satelit-swift/music.wav", volume: 0.2 },
  cta: { text: "Mau dibongkar apa lagi? Tulis di komentar", fromLine: 14 },
  shots,
  createWorld,
};
