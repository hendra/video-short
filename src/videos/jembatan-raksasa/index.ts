import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const jembatanRaksasa: VideoDef = {
  id: "jembatan-raksasa",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "jembatan-raksasa/vo.mp3",
  music: { src: "jembatan-raksasa/music.wav", volume: 0.2 },
  cta: { text: "Mau dibongkar apa lagi? Tulis di komentar", fromLine: 13 },
  shots,
  createWorld,
};
