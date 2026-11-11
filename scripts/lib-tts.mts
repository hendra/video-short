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

export type TtsProvider = "gemini" | "gcloud" | "azure" | "elevenlabs";
export type SynthResult = { audio: Buffer; ext: "mp3" | "wav"; words?: TimedWord[] };

const snippet = async (res: Response): Promise<string> => {
  try { return (await res.text()).slice(0, 300); } catch { return ""; }
};

export const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");

/** 44-byte PCM WAV header + data. */
const wavHeader = (pcm: Buffer, sampleRate: number): Buffer => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

/** Gemini TTS via Google AI Studio (free API key, no billing account; PCM 24 kHz mono output). */
export const synthesizeGemini = async (text: string): Promise<SynthResult> => {
  const model = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
  const voice = process.env.GEMINI_TTS_VOICE ?? "Charon";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Say in a warm, clear, conversational Indonesian voice: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { languageCode: "id-ID", voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await snippet(res)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
  const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("gemini: response contained no audio data");
  return { audio: wavHeader(Buffer.from(b64, "base64"), 24000), ext: "wav" };
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

export const synthesize = (p: TtsProvider, text: string): Promise<SynthResult> =>
  p === "gemini" ? synthesizeGemini(text) : p === "gcloud" ? synthesizeGcloud(text) : p === "azure" ? synthesizeAzure(text) : synthesizeElevenLabs(text);

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
export const synthesizeAndPublish = async ({ videoId, lines, provider, synthByProvider }: {
  videoId: string;
  lines: string[];
  provider: "auto" | TtsProvider;
  synthByProvider?: SynthByProvider;
}): Promise<RunResult> => {
  const synth: SynthByProvider = synthByProvider ?? {
    gemini: synthesizeGemini, gcloud: synthesizeGcloud, azure: synthesizeAzure, elevenlabs: synthesizeElevenLabs,
  };
  const order: TtsProvider[] = provider === "auto" ? ["gemini", "gcloud", "azure"] : [provider];
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
    // Publish atomically: same-dir temp file + rename (rename across /tmp -> repo is EXDEV).
    const tmpTarget = path.join(publicDir(videoId), `.vo.mp3.${process.pid}.tmp`);
    fs.copyFileSync(staging, tmpTarget);
    fs.renameSync(tmpTarget, target);
    fs.rmSync(staging, { force: true });
    fs.writeFileSync(path.join(videoDir(videoId), "alignment.json"), JSON.stringify({ source, words }, null, 1));
    return { ok: true, provider: p, bytes: fs.statSync(target).size, wordCount: words.length };
  }
  return { ok: false, attempts };
};
