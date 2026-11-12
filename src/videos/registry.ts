import type { VideoDef } from "../engine/types";
import { rumahPompa } from "./rumah-pompa";
import { learjetGreenacres } from "./learjet-greenacres";
import { rumusKiamat } from "./rumus-kiamat";
import { skybridgeIndonesia1 } from "./skybridge-indonesia1";
import { aiListrikKota } from "./ai-listrik-kota";
import { terowonganMrt } from "./terowongan-mrt";
import { jembatanRaksasa } from "./jembatan-raksasa";
import { pltsKarangkates } from "./plts-karangkates";
import { satelitSwift } from "./satelit-swift";
import { pulauBaruKrakatau } from "./pulau-baru-krakatau";
import { roverPromiseBulan } from "./rover-promise-bulan";

// Register every video here. Composition props must be JSON, so compositions only carry the id.
export const VIDEOS: Record<string, VideoDef> = {
  [rumahPompa.id]: rumahPompa,
  [terowonganMrt.id]: terowonganMrt,
  [learjetGreenacres.id]: learjetGreenacres,
  [rumusKiamat.id]: rumusKiamat,
  [skybridgeIndonesia1.id]: skybridgeIndonesia1,
  [aiListrikKota.id]: aiListrikKota,
  [jembatanRaksasa.id]: jembatanRaksasa,
  [pltsKarangkates.id]: pltsKarangkates,
  [satelitSwift.id]: satelitSwift,
  [pulauBaruKrakatau.id]: pulauBaruKrakatau,
  [roverPromiseBulan.id]: roverPromiseBulan,
};
