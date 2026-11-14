/**
 * Original, royalty-free lo-fi bed (A minor, 92 BPM) synthesised from scratch, with a soft riser
 * before every shot cut. Writes public/<id>/music.wav (16-bit stereo, 44.1 kHz).
 *
 *   npm run music -- <id>
 */
import fs from "node:fs";
import path from "node:path";
import type { Timeline } from "../src/engine/types";
import { ROOT, publicDir, videoDir, videoIdArg } from "./lib.mts";

// `--missing`: generate for every video that has a timeline but no music.wav yet (used by predev/prerender).
if (process.argv[2] === "--missing") {
  const { execFileSync } = await import("node:child_process");
  for (const v of fs.readdirSync(path.join(ROOT, "src", "videos"))) {
    if (fs.existsSync(path.join(videoDir(v), "timeline.json")) && !fs.existsSync(path.join(publicDir(v), "music.wav")))
      execFileSync(process.execPath, [...process.execArgv, import.meta.filename, v], { stdio: "inherit" });
  }
  process.exit(0);
}
const id = videoIdArg();
const tl: Timeline = JSON.parse(fs.readFileSync(path.join(videoDir(id), "timeline.json"), "utf8"));
const SR = 44100, BPM = 92, BEAT = 60 / BPM, BAR = 4 * BEAT;
const DUR = tl.dur;
const N = Math.floor(SR * DUR);
const cuts = tl.shots.slice(1).map((s) => s.s);

let seed = 7;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
const env = (n: number, a: number, r: number) => {
  const e = new Float32Array(n).fill(1);
  const ai = Math.floor(a * SR), ri = Math.floor(r * SR);
  for (let i = 0; i < ai && i < n; i++) e[i] = i / ai;
  for (let i = 0; i < ri && i < n; i++) e[n - 1 - i] *= i / ri;
  return e;
};
const addAt = (buf: Float32Array, st: number, sig: Float32Array) => {
  const i0 = Math.floor(st * SR);
  for (let i = 0; i < sig.length && i0 + i < N; i++) if (i0 + i >= 0) buf[i0 + i] += sig[i];
};

const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 56, 59]];
const pad = new Float32Array(N), pluck = new Float32Array(N), drums = new Float32Array(N);
for (let b = 0; b <= Math.floor(DUR / BAR); b++) {
  const n = Math.floor(BAR * SR) + Math.floor(0.3 * SR);
  const s = new Float32Array(n), e = env(n, 0.4, 0.5);
  for (const m of chords[b % 4])
    for (const det of [-0.12, 0.12]) {
      const f = midi(m) * 2 ** (det / 12);
      for (let i = 0; i < n; i++) s[i] += 2 * ((i / SR) * f % 1) - 1;
    }
  for (let i = 0; i < n; i++) s[i] *= (e[i] / 6);
  addAt(pad, b * BAR, s);
}
{ // one-pole low-pass on the pad
  const a = Math.exp((-2 * Math.PI * 900) / SR);
  let acc = 0;
  for (let i = 0; i < N; i++) { acc = (1 - a) * pad[i] + a * acc; pad[i] = acc; }
}
const start = cuts[0] ?? 0, step = BEAT / 2;
for (let k = 0; k < Math.floor((DUR - start) / step); k++) {
  const st = start + k * step, ch = chords[Math.floor(st / BAR) % 4], m = ch[[0, 1, 2, 1][k % 4]] + 12;
  const n = Math.floor(0.35 * SR), sig = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; sig[i] = (Math.sin(2 * Math.PI * midi(m) * t) + 0.3 * Math.sin(4 * Math.PI * midi(m) * t)) * Math.exp(-t * 9) * 0.22; }
  addAt(pluck, st, sig);
}
for (let k = 0; k < Math.floor((DUR - start - 1.5) / step); k++) {
  const st = start + k * step;
  if (k % 4 === 0) {
    const n = Math.floor(0.25 * SR), sig = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (110 * Math.exp(-t * 18) + 45) / SR; sig[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 14) * 0.9; }
    addAt(drums, st, sig);
  }
  const n = Math.floor(0.05 * SR), sig = new Float32Array(n);
  for (let i = 0; i < n; i++) sig[i] = gauss() * Math.exp((-i / SR) * 90) * (k % 2 ? 0.1 : 0.06);
  addAt(drums, st, sig);
}
for (const c of cuts) {
  const n = Math.floor(0.6 * SR), sig = new Float32Array(n);
  for (let i = 0; i < n; i++) sig[i] = gauss() * (i / n) ** 2 * 0.05;
  addAt(drums, c - 0.6, sig);
}
const mix = new Float32Array(N), master = env(N, 0.8, 2.5);
let peak = 1e-9;
for (let i = 0; i < N; i++) { mix[i] = (0.9 * pad[i] + pluck[i] + drums[i]) * master[i]; peak = Math.max(peak, Math.abs(mix[i])); }

// 16-bit stereo WAV (right channel delayed 12 ms for width)
const delay = Math.floor(0.012 * SR);
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
const q = (x: number) => Math.max(-32768, Math.min(32767, Math.round((x / peak) * 0.6 * 32767)));
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(q(mix[i]), 44 + i * 4);
  buf.writeInt16LE(q(mix[(i - delay + N) % N]), 46 + i * 4);
}
fs.mkdirSync(publicDir(id), { recursive: true });
fs.writeFileSync(path.join(publicDir(id), "music.wav"), buf);
console.log(`music.wav written (${DUR.toFixed(1)}s)`);
