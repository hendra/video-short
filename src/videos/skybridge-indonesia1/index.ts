import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const skybridgeIndonesia1: VideoDef = {
  id: "skybridge-indonesia1",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "skybridge-indonesia1/vo.mp3",
  music: { src: "skybridge-indonesia1/music.wav", volume: 0.2 },
  cta: { text: "Mau dibongkar apa lagi? Tulis di komentar", fromLine: 12 },
  shots,
  createWorld,
};
