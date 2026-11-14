/**
 * Offline word-timing engine (shared by `align-local` and `tts`).
 * 1. Detect speech segments with FFmpeg's silencedetect.
 * 2. Dynamic programming: group segments into the script lines so each line's duration matches its
 *    syllable count, preferring to split at long pauses.
 * 3. Inside each line, pin the pauses to the punctuation marks (same DP), then spread words over each
 *    phrase's speech time, weighted by syllables.
 * Accuracy: line and phrase boundaries are usually exact; words inside a phrase are approximate (±0.1 s).
 */
import { spawnSync } from "node:child_process";
import { type TimedWord } from "./lib.mts";

export const syl = (s: string) => Math.max(1, (s.toLowerCase().match(/[aiueo]+/g) ?? []).length);

/** FFmpeg from system PATH, falling back to the copy bundled with Remotion. Returns stderr. */
export const ffmpeg = (args: string[]) => {
  const direct = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (!direct.error) return direct.stderr;
  return spawnSync("npx", ["remotion", "ffmpeg", ...args], { encoding: "utf8" }).stderr;
};

export type Span = { s: number; e: number; segs: [number, number][] };

/** Tokens with no letters/digits (a lone "—") are never spoken: they take no time. */
const weight = (w: string) => (/[\p{L}\p{N}]/u.test(w) ? syl(w) + 0.3 : 0);
const endsPhrase = (w: string) => /[,.;:?!…—–]$/.test(w);
/** Reward (in cost units) for every pause that is pinned to a punctuation mark. */
const CUT_REWARD = 0.15;

/**
 * A speaker pauses at punctuation, so the silences inside a line are anchors: pair the line's phrases
 * (split at punctuation) with its speech segments so each pause lands on a punctuation mark. Returns blocks
 * of [first word, word end, first segment, segment end]; words only drift inside one block, never across a pause.
 * Monotone DP: a block's cost is how far its speech time is from what its syllables predict.
 */
export const pairPhrases = (ws: string[], segs: [number, number][]): [number, number, number, number][] => {
  const ends = ws.flatMap((w, i) => (endsPhrase(w) || i === ws.length - 1 ? [i + 1] : []));
  const P = ends.length, M = segs.length;
  const wsum = [0], dsum = [0];
  ws.forEach((w) => wsum.push(wsum[wsum.length - 1] + weight(w)));
  segs.forEach(([p, q]) => dsum.push(dsum[dsum.length - 1] + q - p));
  const rate = dsum[M] / Math.max(1e-6, wsum[ws.length]);
  const best = Array.from({ length: P + 1 }, () => new Array<number>(M + 1).fill(Infinity));
  const back = Array.from({ length: P + 1 }, () => new Array<[number, number]>(M + 1).fill([0, 0]));
  best[0][0] = 0;
  for (let j = 1; j <= P; j++)
    for (let i = 1; i <= M; i++)
      for (let j0 = 0; j0 < j; j0++)
        for (let i0 = 0; i0 < i; i0++) {
          if (best[j0][i0] === Infinity) continue;
          const exp = Math.max(1e-3, (wsum[ends[j - 1]] - wsum[j0 ? ends[j0 - 1] : 0]) * rate);
          const c = best[j0][i0] + (dsum[i] - dsum[i0] - exp) ** 2 / exp - (j0 ? CUT_REWARD : 0);
          if (c < best[j][i]) { best[j][i] = c; back[j][i] = [j0, i0]; }
        }
  const blocks: [number, number, number, number][] = [];
  for (let j = P, i = M; j > 0; ) {
    const [j0, i0] = back[j][i];
    blocks.unshift([j0 ? ends[j0 - 1] : 0, ends[j - 1], i0, i]);
    j = j0; i = i0;
  }
  return blocks;
};

export const wordsFromSpans = (lines: string[], spans: Span[]): TimedWord[] => {
  const words: TimedWord[] = [];
  lines.forEach((text, li) => {
    const ws = text.split(/\s+/);
    for (const [w0, w1, s0, s1] of pairPhrases(ws, spans[li].segs)) {
      const segs = spans[li].segs.slice(s0, s1);
      const weights = ws.slice(w0, w1).map(weight), tot = Math.max(1e-6, weights.reduce((a, b) => a + b, 0));
      const speech = segs.reduce((a, [p, q]) => a + q - p, 0);
      const at = (x: number) => {
        for (const [p, q] of segs) { if (x <= q - p + 1e-9) return p + x; x -= q - p; }
        return segs[segs.length - 1][1];
      };
      let cur = 0;
      weights.forEach((wt, j) => {
        const d = (speech * wt) / tot;
        words.push({ text: ws[w0 + j], start: at(cur + (d > 0 ? 1e-4 : 0)), end: at(cur + d) });
        cur += d;
      });
    }
  });
  return words;
};

/** Analyze an audio file and time every word in `lines` to it. Throws if too few speech segments are found. */
export const analyzeAlignment = (audioPath: string, lines: string[]): { words: TimedWord[]; spans: Span[] } => {
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
  const spans: Span[] = [];
  for (let i = N, b = S; i > 0; i--) {
    const a = back[i][b];
    spans.unshift({ s: segs[a][0], e: segs[b - 1][1], segs: segs.slice(a, b) });
    b = a;
  }
  console.log(`${S} speech segments, ${rate.toFixed(3)} s/syllable`);
  spans.forEach((sp, i) => console.log(`  ${String(i + 1).padStart(2, "0")}  ${(sp.e - sp.s).toFixed(2)}s (expected ${exp[i].toFixed(2)}s)  ${lines[i].slice(0, 48)}`));
  return { words: wordsFromSpans(lines, spans), spans };
};

/** Estimated timing with no audio (2.7 words/s, 0.55 s pauses) — for previews only. */
export const estimateAlignment = (lines: string[]): TimedWord[] => {
  let t = 0.4;
  const spans: Span[] = lines.map((l) => {
    const d = Math.max(1.2, l.split(/\s+/).length / 2.7);
    const sp = { s: t, e: t + d, segs: [[t, t + d]] as [number, number][] };
    t += d + 0.55;
    return sp;
  });
  console.log("No vo.mp3 yet — wrote an ESTIMATED alignment for previews.");
  return wordsFromSpans(lines, spans);
};
