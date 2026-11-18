/**
 * naskah.txt + alignment.json + config.json  ->  src/videos/<id>/timeline.json
 * (lines, karaoke caption chunks with per-word timing, and shot spans).
 *
 *   npm run timeline -- <id>
 */
import fs from "node:fs";
import path from "node:path";
import type { Chunk, Line, ShotSpan, Timeline, Word } from "../src/engine/types";
import { type Alignment, readConfig, readScript, videoDir, videoIdArg } from "./lib.mts";
import { chunksOf, normWord as norm } from "./timeline-core.mts";

const id = videoIdArg();
const lines = readScript(id);
const cfg = readConfig(id);
const al: Alignment = JSON.parse(fs.readFileSync(path.join(videoDir(id), "alignment.json"), "utf8"));

// ---------- map aligned words onto script words (tolerates small differences, e.g. normalised numbers)
const script = lines.flatMap((text, li) => text.split(/\s+/).map((w) => ({ w, li })));
const timed: (Word | null)[] = script.map(() => null);
let j = 0;
script.forEach((sw, i) => {
  const n = norm(sw.w);
  for (let k = j; k < Math.min(al.words.length, j + 4); k++) {
    if (norm(al.words[k].text) === n) {
      timed[i] = { w: sw.w, s: al.words[k].start, e: al.words[k].end };
      j = k + 1;
      return;
    }
  }
});
const matched = timed.filter(Boolean).length;
if (matched < script.length * 0.8) {
  console.error(`Only ${matched}/${script.length} words matched the alignment — is naskah.txt the text that was spoken?`);
  process.exit(1);
}
// interpolate the few unmatched words between their matched neighbours
for (let i = 0; i < timed.length; i++) {
  if (timed[i]) continue;
  let a = i - 1;
  while (a >= 0 && !timed[a]) a--;
  let b = i + 1;
  while (b < timed.length && !timed[b]) b++;
  const t0 = a >= 0 ? timed[a]!.e : 0;
  const t1 = b < timed.length ? timed[b]!.s : t0 + 0.4 * (b - a);
  const span = (t1 - t0) / (b - a);
  timed[i] = { w: script[i].w, s: t0 + span * (i - a - 1), e: t0 + span * (i - a) };
}
const words = timed as Word[];

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const outLines: Line[] = [];
const chunks: Chunk[] = [];
let wi = 0;
lines.forEach((text, li) => {
  const n = text.split(/\s+/).length;
  const lw = words.slice(wi, wi + n).map((w) => ({ w: w.w, s: r3(w.s), e: r3(w.e) }));
  wi += n;
  outLines.push({ n: li + 1, s: lw[0].s, e: lw[lw.length - 1].e, text });
  for (const c of chunksOf(lw)) chunks.push({ s: c[0].s, e: c[c.length - 1].e, words: c });
});

const dur = r3(outLines[outLines.length - 1].e + cfg.tail);
const shots: ShotSpan[] = cfg.shots.map(([sid, first], i) => ({
  id: sid,
  s: i === 0 ? 0 : r3(outLines[first - 1].s - 0.15),
  e: i === cfg.shots.length - 1 ? dur : r3(outLines[cfg.shots[i + 1][1] - 1].s - 0.15),
}));

const tl: Timeline = { dur, lines: outLines, chunks, shots };
fs.writeFileSync(path.join(videoDir(id), "timeline.json"), JSON.stringify(tl, null, 1));
console.log(`timeline.json: ${dur.toFixed(1)}s, ${outLines.length} lines, ${chunks.length} caption chunks, ${matched}/${script.length} words matched (${al.source})`);
for (const s of shots) console.log(`  shot ${s.id}: ${s.s.toFixed(2)} – ${s.e.toFixed(2)}`);
