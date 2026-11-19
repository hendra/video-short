/**
 * Gate: verify `src/videos/<id>/timeline.json` matches actual speech in `public/<id>/vo.mp3`.
 *
 *   npm run check-sync -- <id>
 */
import fs from "node:fs";
import path from "node:path";
import type { Timeline } from "../src/engine/types";
import { speechSegments } from "./align-core.mts";
import { publicDir, videoDir, videoIdArg } from "./lib.mts";
import { checkTimelineSync } from "./sync-core.mts";

const id = videoIdArg();
const voPath = path.join(publicDir(id), "vo.mp3");
const tlPath = path.join(videoDir(id), "timeline.json");

if (!fs.existsSync(voPath)) {
  console.error(`Missing audio: ${voPath}`);
  process.exit(1);
}
if (!fs.existsSync(tlPath)) {
  console.error(`Missing timeline: ${tlPath}`);
  process.exit(1);
}

const tl = JSON.parse(fs.readFileSync(tlPath, "utf8")) as Timeline;
const { dur, segs } = speechSegments(voPath);
const errs = checkTimelineSync(tl, segs, dur);

if (errs.length) {
  console.error(`Sync check failed for ${id} (${errs.length} issues):`);
  for (const e of errs) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`check-sync OK: ${id} (${tl.chunks.length} chunks, ${segs.length} speech segments, ${dur.toFixed(2)}s audio)`);
