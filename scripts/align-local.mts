/**
 * Free, offline word timing — no API needed (works with audio from any TTS: ElevenLabs web app, FreeTTS, …).
 * 1. Detect speech segments with FFmpeg's silencedetect.
 * 2. Dynamic programming: group segments into the script lines so each line's duration matches its
 *    syllable count, preferring to split at long pauses.
 * 3. Spread words over each line's speech time (pauses skipped), weighted by syllables.
 * Accuracy: line boundaries are usually exact; words inside a line are approximate (±0.2 s).
 * Prefer `npm run align` (ElevenLabs Forced Alignment) when you have an API key.
 *
 *   npm run align:local -- <id> [path/to/vo.mp3]     # without audio: writes an estimate for previews
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Alignment, type TimedWord, publicDir, readScript, videoDir, videoIdArg } from "./lib.mts";

const id = videoIdArg();
const lines = readScript(id);
const target = path.join(publicDir(id), "vo.mp3");
const src = process.argv[3];
const sameFile = src !== undefined && path.resolve(src) === path.resolve(target);
if (src && !sameFile && !fs.existsSync(src)) {
  console.error(`No audio at ${src}`);
  process.exit(1);
}
// Stage the source in memory; public/<id>/vo.mp3 is only replaced after the analysis succeeds.
const srcBuf = src ? fs.readFileSync(sameFile ? target : src) : null;
const haveAudio = srcBuf !== null || fs.existsSync(target);
const syl = (s: string) => Math.max(1, (s.toLowerCase().match(/[aiueo]+/g) ?? []).length);

const ffmpeg = (args: string[]) => {
  const direct = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (!direct.error) return direct.stderr;
  return spawnSync("npx", ["remotion", "ffmpeg", ...args], { encoding: "utf8" }).stderr; // FFmpeg bundled with Remotion
};

let spans: { s: number; e: number; segs: [number, number][] }[];
if (!haveAudio) {
  // estimate (2.7 words/s, 0.55 s pauses) so the video can be previewed before the VO exists
  let t = 0.4;
  spans = lines.map((l) => {
    const d = Math.max(1.2, l.split(/\s+/).length / 2.7);
    const sp = { s: t, e: t + d, segs: [[t, t + d]] as [number, number][] };
    t += d + 0.55;
    return sp;
  });
  console.log("No vo.mp3 yet — wrote an ESTIMATED alignment for previews.");
} else {
  let audioPath = target;
  let stage = "";
  if (srcBuf) {
    stage = path.join(os.tmpdir(), `explainer-vo-${process.pid}.mp3`);
    fs.writeFileSync(stage, srcBuf);
    audioPath = stage;
  }
  try {
  const log = ffmpeg(["-hide_banner", "-i", audioPath, "-af", "silencedetect=n=-38dB:d=0.12", "-f", "null", "-"]);
  const dur = Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(log)?.slice(1).reduce((a, v, i) => a + Number(v) * [3600, 60, 1][i], 0));
  const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const segs: [number, number][] = [];
  let cur = 0;
  st.forEach((a, i) => {
    if (a - cur > 0.08) segs.push([cur, a]);
    cur = en[i] ?? dur;
  });
  if (dur - cur > 0.08) segs.push([cur, dur]);
  const S = segs.length, N = lines.length;
  if (S < N) throw new Error(`Only ${S} speech segments for ${N} lines — leave short pauses between lines.`);
  const k = lines.map(syl);
  const gaps = segs.slice(0, -1).map((s, i) => segs[i + 1][0] - s[1]);
  const g = [...gaps].sort((a, b) => b - a).slice(0, N - 1).reduce((a, b) => a + b, 0) / (N - 1);
  const rate = (segs[S - 1][1] - segs[0][0] - (N - 1) * g) / k.reduce((a, b) => a + b, 0);
  const exp = k.map((x) => x * rate);
  const gapAfter = [...gaps, 1];
  const best = Array.from({ length: N + 1 }, () => new Array<number>(S + 1).fill(Infinity));
  const back = Array.from({ length: N + 1 }, () => new Array<number>(S + 1).fill(0));
  best[0][0] = 0;
  for (let i = 1; i <= N; i++)
    for (let b = i; b <= S - (N - i); b++)
      for (let a = i - 1; a < b; a++) {
        if (best[i - 1][a] === Infinity) continue;
        const d = segs[b - 1][1] - segs[a][0];
        const c = best[i - 1][a] + (d - exp[i - 1]) ** 2 / exp[i - 1] - 6 * gapAfter[b - 1];
        if (c < best[i][b]) { best[i][b] = c; back[i][b] = a; }
      }
  spans = [];
  for (let i = N, b = S; i > 0; i--) {
    const a = back[i][b];
    spans.unshift({ s: segs[a][0], e: segs[b - 1][1], segs: segs.slice(a, b) });
    b = a;
  }
  console.log(`${S} speech segments, ${rate.toFixed(3)} s/syllable`);
  spans.forEach((sp, i) => console.log(`  ${String(i + 1).padStart(2, "0")}  ${(sp.e - sp.s).toFixed(2)}s (expected ${exp[i].toFixed(2)}s)  ${lines[i].slice(0, 48)}`));
  } finally {
    if (stage) fs.rmSync(stage, { force: true });
  }
}

const words: TimedWord[] = [];
lines.forEach((text, i) => {
  const ws = text.split(/\s+/), segs = spans[i].segs;
  const weights = ws.map((w) => syl(w) + 0.3), tot = weights.reduce((a, b) => a + b, 0);
  const speech = segs.reduce((a, [p, q]) => a + q - p, 0);
  const at = (x: number) => {
    for (const [p, q] of segs) { if (x <= q - p + 1e-9) return p + x; x -= q - p; }
    return segs[segs.length - 1][1];
  };
  let cur = 0;
  ws.forEach((w, j) => {
    const d = (speech * weights[j]) / tot;
    words.push({ text: w, start: at(cur + 1e-4), end: at(cur + d) });
    cur += d;
  });
});
const out: Alignment = { source: "estimated", words };
// Only now that the analysis succeeded: replace vo.mp3 (keeps audio and alignment.json in sync).
if (srcBuf && !sameFile) {
  fs.mkdirSync(publicDir(id), { recursive: true });
  fs.writeFileSync(target, srcBuf);
}
fs.writeFileSync(path.join(videoDir(id), "alignment.json"), JSON.stringify(out, null, 1));
console.log(`alignment.json written. Next: npm run timeline -- ${id}`);
