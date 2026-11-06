import type { Timeline, VideoDef } from "../../engine/types";
import { shots } from "./shots";
import timeline from "./timeline.json";
import { createWorld } from "./world";

export const learjetGreenacres: VideoDef = {
  id: "learjet-greenacres",
  brand: { prefix: "Kali Aja ", accent: "Tau" },
  fov: 44,
  timeline: timeline as Timeline,
  voice: "learjet-greenacres/vo.mp3",
  music: { src: "learjet-greenacres/music.wav", volume: 0.14 },
  shots,
  createWorld,
};
