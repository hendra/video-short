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

/** Gemini TTS via Google AI Studio, in the voice and style of the account the video belongs to. */
export const synthesizeGemini = async (text: string, tts: Account["tts"]): Promise<SynthResult> => {
  const model = GEMINI_TTS_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text, speechMetadata: { style: tts.style } }] }],
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

// -38 dB matches align-core's silencedetect. stop_duration 0.18 + the 0.02 s detection window ≈ 0.2 s pauses;
// the reversed pass removes the head of the reversed audio = the tail, keeping 0.05 s for a seamless loop.
const TRIM_FILTER =
  "silenceremove=start_periods=1:start_threshold=-38dB:stop_periods=-1:stop_duration=0.18:stop_threshold=-38dB," +
  "areverse,silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.05,areverse";

/** Remove leading silence, shorten pauses to ≤ 0.2 s and the tail to 0.05 s (MP3 in, MP3 out). */
export const trimSilence = (srcPath: string, destPath: string): void => {
  fs.rmSync(destPath, { force: true });
  const err = ffmpeg(["-hide_banner", "-y", "-i", srcPath, "-af", TRIM_FILTER, "-codec:a", "libmp3lame", "-b:a", "128k", destPath]);
  if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) throw new Error(`ffmpeg silence trim failed: ${err.slice(-300)}`);
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
    // ElevenLabs ships its own timestamps; trimming would shift them.
    if (!(p === "elevenlabs" && result.words)) {
      const trimmed = `${staging}.trim.mp3`;
      try {
        trimSilence(staging, trimmed);
        fs.renameSync(trimmed, staging);
      } catch (e) {
        fs.rmSync(trimmed, { force: true });
        attempts.push(`${p}: ${(e as Error).message}`);
        console.error(`${p} failed while trimming silence: ${(e as Error).message}`);
        continue;
      }
    }
    let words: TimedWord[];
    let source: "tts" | "estimated";
    if (p === "elevenlabs" && result.words) {
      words = result.words;
      source = "tts";
    } else {
      try {
        words = analyzeAlignment(staging, lines).words;
      } catch (e) {
        const failed = path.join(os.tmpdir(), `vo-${videoId}-failed.mp3`);
        fs.renameSync(staging, failed);
        return { ok: false, attempts, analysisFailure: { failedPath: failed, reason: (e as Error).message } };
      }
      source = "estimated";
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
