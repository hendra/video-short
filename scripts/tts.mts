/**
 * Generate the voiceover AND exact per-character timing in one call:
 *   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps
 * Writes public/<id>/vo.mp3 and src/videos/<id>/alignment.json.
 *
 *   npm run tts -- rumah-pompa
 */
import fs from "node:fs";
import path from "node:path";
import { type Alignment, type TimedWord, loadDotenv, publicDir, readScript, requireEnv, videoDir, videoIdArg } from "./lib.mts";

loadDotenv();
const id = videoIdArg();
const apiKey = requireEnv("ELEVENLABS_API_KEY");
const voiceId = requireEnv("ELEVENLABS_VOICE_ID");
const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

const lines = readScript(id);
// Blank line between script lines -> natural pause; offsets stay exact because we build the text ourselves.
const text = lines.join("\n\n");

type Resp = {
  audio_base64: string;
  alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
};

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    text,
    model_id: modelId,
    voice_settings: process.env.ELEVENLABS_VOICE_SETTINGS ? JSON.parse(process.env.ELEVENLABS_VOICE_SETTINGS) : undefined,
  }),
});
if (!res.ok) {
  console.error(`ElevenLabs ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = (await res.json()) as Resp;
if (!data.alignment) throw new Error("Response has no alignment");
const { characters, character_start_times_seconds: st, character_end_times_seconds: en } = data.alignment;
if (characters.join("") !== text) console.warn("Warning: aligned characters differ from the sent text; word timing uses character order.");

// characters -> words (split on whitespace)
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

fs.mkdirSync(publicDir(id), { recursive: true });
fs.writeFileSync(path.join(publicDir(id), "vo.mp3"), Buffer.from(data.audio_base64, "base64"));
const out: Alignment = { source: "tts", words };
fs.writeFileSync(path.join(videoDir(id), "alignment.json"), JSON.stringify(out, null, 1));
console.log(`vo.mp3 + alignment.json written (${words.length} words, ${words[words.length - 1].end.toFixed(1)}s). Next: npm run timeline -- ${id}`);
