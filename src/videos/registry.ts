import type { VideoDef } from "../engine/types";
import { rumahPompa } from "./rumah-pompa";
import { terowonganMrt } from "./terowongan-mrt";

// Register every video here. Composition props must be JSON, so compositions only carry the id.
export const VIDEOS: Record<string, VideoDef> = {
  [rumahPompa.id]: rumahPompa,
  [terowonganMrt.id]: terowonganMrt,
};
