import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const kabelLautNusantara: VideoDef = {
  id: "kabel-laut-nusantara",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "kabel-laut-nusantara/vo.mp3",
  music: { src: "kabel-laut-nusantara/music.wav", volume: 0.2 },
  cta: { text: "Mau dibongkar apa lagi? Tulis di komentar", fromLine: 16 },
  shots,
  createWorld,
};
