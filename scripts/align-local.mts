/**
 * Free, offline word timing — no API needed (works with audio from any TTS).
 * 1. Detect speech segments with FFmpeg's silencedetect.
 * 2. Dynamic programming: group segments into the script lines so each line's duration matches its
 *    syllable count, preferring to split at long pauses.
 * 3. Spread words over each line's speech time (pauses skipped), weighted by syllables.
 * Accuracy: line boundaries are usually exact; words inside a line are approximate (±0.2 s).
 * Prefer `npm run tts` (which also runs this engine) or `npm run align` (ElevenLabs Forced Alignment)
 * when you have an API key.
 *
 *   npm run align:local -- <id> [path/to/vo.mp3]     # without audio: writes an estimate for previews
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Alignment, type TimedWord, publicDir, readScript, videoDir, videoIdArg } from "./lib.mts";
import { analyzeAlignment, estimateAlignment } from "./align-core.mts";

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

let words: TimedWord[];
if (!haveAudio) {
  words = estimateAlignment(lines);
} else {
  let audioPath = target;
  let stage = "";
  if (srcBuf) {
    stage = path.join(os.tmpdir(), `explainer-vo-${process.pid}.mp3`);
    fs.writeFileSync(stage, srcBuf);
    audioPath = stage;
  }
  try {
    words = analyzeAlignment(audioPath, lines).words;
  } finally {
    if (stage) fs.rmSync(stage, { force: true });
  }
}

const out: Alignment = { source: "estimated", words };
// Only now that the analysis succeeded: replace vo.mp3 (keeps audio and alignment.json in sync).
if (srcBuf && !sameFile) {
  fs.mkdirSync(publicDir(id), { recursive: true });
  fs.writeFileSync(target, srcBuf);
}
fs.writeFileSync(path.join(videoDir(id), "alignment.json"), JSON.stringify(out, null, 1));
console.log(`alignment.json written. Next: npm run timeline -- ${id}`);
