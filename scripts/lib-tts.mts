/**
 * Voiceover provider clients for `npm run tts`.
 * Primary (zero billing): Gemini TTS via Google AI Studio.
 * Backup 1: Google Cloud TTS (API key, free within monthly quota).
 * Backup 2: Azure AI Speech F0 (subscription key + region, 500k chars/month free).
 * Legacy optional: ElevenLabs (with-timestamps). Not part of the automatic chain.
 * Keys are read from process.env at call time; API keys are never logged.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAlignment, ffmpeg } from "./align-core.mts";
import { type TimedWord, publicDir, videoDir } from "./lib.mts";
import type { Account } from "../src/accounts.ts";

export type TtsProvider = "gemini" | "gcloud" | "azure" | "elevenlabs";
export type SynthResult = { audio: Buffer; ext: "mp3" | "wav"; words?: TimedWord[] };

// Locked production identity — do not read from env or swap per-run.
const GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";

const snippet = async (res: Response): Promise<string> => {
  try { return (await res.text()).slice(0, 300); } catch { return ""; }
};

export const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");

// Gemini TTS takes no SSML; this style hint is the only lever for a faster hook (best effort, not guaranteed).
export const HOOK_HINT = "kalimat pertama sedikit lebih cepat dan bertenaga; tekankan angka dan kata kunci";

/** Gemini TTS via Google AI Studio, in the voice and style of the account the video belongs to. */
export const synthesizeGemini = async (text: string, tts: Account["tts"]): Promise<SynthResult> => {
  const model = GEMINI_TTS_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text, speechMetadata: { style: `${tts.style}; ${HOOK_HINT}` } }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { languageCode: "id-ID", voiceConfig: { voice: tts.voice } },
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await snippet(res)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
  const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("gemini: response contained no audio data");
  return { audio: Buffer.from(b64, "base64"), ext: "wav" };
};

/** Google Cloud Text-to-Speech (API key; 4M WaveNet chars/month free). */
export const synthesizeGcloud = async (text: string): Promise<SynthResult> => {
  const voice = process.env.GCLOUD_TTS_VOICE ?? "id-ID-Wavenet-B";
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GCLOUD_TTS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { text }, voice: { languageCode: "id-ID", name: voice }, audioConfig: { audioEncoding: "MP3" } }),
  });
  if (!res.ok) throw new Error(`gcloud ${res.status}: ${await snippet(res)}`);
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error("gcloud: response contained no audioContent");
  return { audio: Buffer.from(data.audioContent, "base64"), ext: "mp3" };
};

/** Azure AI Speech F0 (subscription key + region; 500k chars/month free). */
export const synthesizeAzure = async (text: string): Promise<SynthResult> => {
  const voice = process.env.AZURE_SPEECH_VOICE ?? "id-ID-ArdiNeural";
  const res = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "explainer-3d",
    },
    body: `<speak version="1.0" xml:lang="id-ID"><voice name="${voice}">${xmlEscape(text)}</voice></speak>`,
  });
  if (!res.ok) throw new Error(`azure ${res.status}: ${await snippet(res)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.length === 0) throw new Error("azure: response contained no audio bytes");
  return { audio, ext: "mp3" };
};

/** ElevenLabs (legacy, optional): with-timestamps — per-word timing comes back with the audio. */
export const synthesizeElevenLabs = async (text: string): Promise<SynthResult> => {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const voiceId = process.env.ELEVENLABS_VOICE_ID!;
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: process.env.ELEVENLABS_VOICE_SETTINGS ? JSON.parse(process.env.ELEVENLABS_VOICE_SETTINGS) : undefined,
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${await snippet(res)}`);
  const data = (await res.json()) as {
    audio_base64: string;
    alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
  };
  if (!data.alignment) throw new Error("elevenlabs: response has no alignment");
  const { characters, character_start_times_seconds: st, character_end_times_seconds: en } = data.alignment;
  if (characters.join("") !== text) console.warn("Warning: aligned characters differ from the sent text; word timing uses character order.");
  const words: TimedWord[] = [];
  let cur: TimedWord | null = null;
  characters.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: "", start: st[i], end: en[i] };
    cur.text += c;
    cur.end = en[i];
  });
  if (cur) words.push(cur);
  return { audio: Buffer.from(data.audio_base64, "base64"), ext: "mp3", words };
};

export const hasProviderEnv = (p: TtsProvider): { ok: boolean; missing: string } => {
  const need =
    p === "gemini" ? ["GEMINI_API_KEY"]
    : p === "gcloud" ? ["GCLOUD_TTS_KEY"]
    : p === "azure" ? ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"]
    : ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"];
  const missing = need.filter((v) => !process.env[v]);
  return missing.length ? { ok: false, missing: missing.join(", ") } : { ok: true, missing: "" };
};

/** Write the provider's audio to destPath as MP3 (WAV gets transcoded via FFmpeg). */
export const stageToMp3 = (audio: Buffer, ext: "mp3" | "wav", destPath: string): void => {
  if (ext === "mp3") {
    fs.writeFileSync(destPath, audio);
    return;
  }
  const wavPath = path.join(os.tmpdir(), `explainer-stage-${process.pid}.wav`);
  fs.writeFileSync(wavPath, audio);
  try {
    const err = ffmpeg(["-hide_banner", "-y", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "128k", destPath]);
    if (!fs.existsSync(destPath)) throw new Error(`ffmpeg produced no MP3 at ${destPath}: ${err.slice(-300)}`);
  } finally {
    fs.rmSync(wavPath, { force: true });
  }
};

const MAX_PAUSE = 0.2;
const LOOP_TAIL = 0.05;

/** Silences (−38 dB, like align-core) longer than MAX_PAUSE → the [from, to] spans to cut out. */
const cutsFor = (srcPath: string): { dur: number; cuts: [number, number][] } => {
  const log = ffmpeg(["-hide_banner", "-i", srcPath, "-af", `silencedetect=n=-38dB:d=${MAX_PAUSE}`, "-f", "null", "-"]);
  const dur = Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(log)?.slice(1).reduce((a, v, i) => a + Number(v) * [3600, 60, 1][i], 0));
  if (!Number.isFinite(dur)) throw new Error(`ffmpeg could not read ${srcPath}: ${log.slice(-300)}`);
  const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const cuts = st.flatMap((a, i): [number, number][] => {
    const b = Math.min(en[i] ?? dur, dur);
    if (a <= 0.01) return [[0, b]]; // leading silence: drop it
    if (b >= dur - 0.01) return [[a + LOOP_TAIL, dur]]; // tail: keep 0.05 s for the loop seam
    return [[a + MAX_PAUSE / 2, b - MAX_PAUSE / 2]]; // inner pause: keep 0.1 s on each side
  });
  return { dur, cuts };
};

/**
 * Remove leading silence, shorten pauses to ≤ 0.2 s and the tail to 0.05 s (MP3 in, MP3 out).
 * Returns the map from a time in the raw take to the trimmed audio, so timing found on the raw take
 * (where line breaks are still the longest pauses) can be moved onto the trimmed file.
 */
export const trimSilence = (srcPath: string, destPath: string): ((t: number) => number) => {
  const { dur, cuts } = cutsFor(srcPath);
  fs.rmSync(destPath, { force: true });
  // Kept spans between cuts, joined sample-accurately with atrim + concat.
  const keep: [number, number][] = [];
  let at = 0;
  for (const [a, b] of cuts) {
    if (a > at) keep.push([at, a]);
    at = b;
  }
  if (dur > at) keep.push([at, dur]);
  const graph = keep.map(([a, b], i) => `[0:a]atrim=start=${a.toFixed(5)}:end=${b.toFixed(5)},asetpts=PTS-STARTPTS[k${i}]`).join(";") +
    `;${keep.map((_, i) => `[k${i}]`).join("")}concat=n=${keep.length}:v=0:a=1[out]`;
  const err = keep.length
    ? ffmpeg(["-hide_banner", "-y", "-i", srcPath, "-filter_complex", graph, "-map", "[out]", "-codec:a", "libmp3lame", "-b:a", "128k", destPath])
    : "no audio left after trimming";
  if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) throw new Error(`ffmpeg silence trim failed: ${err.slice(-300)}`);
  return (t) => t - cuts.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(t, b) - a), 0);
};

export type RunResult =
  | { ok: true; provider: TtsProvider; bytes: number; wordCount: number }
  | { ok: false; attempts: string[]; analysisFailure?: { failedPath: string; reason: string } };
export type SynthByProvider = Record<TtsProvider, (text: string) => Promise<SynthResult>>;

/**
 * Synthesize the voiceover, stage it, analyze the timing, and only then replace
 * public/<id>/vo.mp3 + src/videos/<id>/alignment.json (always together).
 * On timing-analysis failure the committed pair is left untouched and the fresh
 * audio is kept at os.tmpdir()/vo-<id>-failed.mp3 (never published silently).
 */
export const synthesizeAndPublish = async ({ videoId, lines, provider, tts, synthByProvider }: {
  videoId: string;
  lines: string[];
  provider: "auto" | TtsProvider;
  tts: Account["tts"];
  synthByProvider?: SynthByProvider;
}): Promise<RunResult> => {
  const synth: SynthByProvider = synthByProvider ?? {
    gemini: (t) => synthesizeGemini(t, tts), gcloud: synthesizeGcloud, azure: synthesizeAzure, elevenlabs: synthesizeElevenLabs,
  };
  const order: TtsProvider[] = provider === "auto" ? ["gemini"] : [provider];
  const attempts: string[] = [];
  const text = lines.join("\n\n");
  const staging = path.join(os.tmpdir(), `vo-${videoId}-staging.mp3`);
  const target = path.join(publicDir(videoId), "vo.mp3");

  for (const p of order) {
    const env = hasProviderEnv(p);
    if (!env.ok) {
      attempts.push(`${p}: skipped (missing ${env.missing})`);
      console.log(`skipping ${p}: missing ${env.missing}`);
      continue;
    }
    let result: SynthResult;
    try {
      result = await synth[p](text);
    } catch (e) {
      attempts.push(`${p}: ${(e as Error).message}`);
      console.error(`${p} failed: ${(e as Error).message}`);
      continue;
    }
    try {
      stageToMp3(result.audio, result.ext, staging);
    } catch (e) {
      attempts.push(`${p}: ${(e as Error).message}`);
      console.error(`${p} failed while staging audio: ${(e as Error).message}`);
      continue;
    }
    let words: TimedWord[];
    let source: "tts" | "estimated";
    if (p === "elevenlabs" && result.words) {
      words = result.words; // own timestamps; not trimmed so they stay valid
      source = "tts";
    } else {
      try {
        // Align on the raw take: line breaks are still the longest pauses there, which the aligner relies on.
        words = analyzeAlignment(staging, lines).words;
      } catch (e) {
        const failed = path.join(os.tmpdir(), `vo-${videoId}-failed.mp3`);
        fs.renameSync(staging, failed);
        return { ok: false, attempts, analysisFailure: { failedPath: failed, reason: (e as Error).message } };
      }
      source = "estimated";
      const trimmed = `${staging}.trim.mp3`;
      try {
        const map = trimSilence(staging, trimmed);
        fs.renameSync(trimmed, staging);
        words = words.map((w) => ({ ...w, start: map(w.start), end: map(w.end) }));
      } catch (e) {
        fs.rmSync(trimmed, { force: true });
        attempts.push(`${p}: ${(e as Error).message}`);
        console.error(`${p} failed while trimming silence: ${(e as Error).message}`);
        continue;
      }
    }
    fs.mkdirSync(publicDir(videoId), { recursive: true });
    // Publish: prebuild both artifacts, then swap both into place back-to-back (each rename is
    // atomic within its directory; the gap can't yield new-audio + missing alignment).
    const json = JSON.stringify({ source, words }, null, 1);
    const tmpTarget = path.join(publicDir(videoId), `.vo.mp3.${process.pid}.tmp`);
    const tmpAlignment = path.join(videoDir(videoId), `.alignment.json.${process.pid}.tmp`);
    fs.copyFileSync(staging, tmpTarget);
    fs.writeFileSync(tmpAlignment, json);
    fs.renameSync(tmpTarget, target);
    fs.renameSync(tmpAlignment, path.join(videoDir(videoId), "alignment.json"));
    fs.rmSync(staging, { force: true });
    return { ok: true, provider: p, bytes: fs.statSync(target).size, wordCount: words.length };
  }
  return { ok: false, attempts };
};
