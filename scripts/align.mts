/**
 * Already have the voiceover (e.g. made in the ElevenLabs web app)? Get exact word timing with
 * Forced Alignment:  POST https://api.elevenlabs.io/v1/forced-alignment  (multipart: file, text)
 *
 *   npm run align -- <id>                # uses public/<id>/vo.mp3
 *   npm run align -- <id> path/to/vo.mp3 # stages it; public/<id>/vo.mp3 is only replaced after the alignment succeeds
 */
import fs from "node:fs";
import path from "node:path";
import { type Alignment, loadDotenv, publicDir, readScript, requireEnv, videoDir, videoIdArg } from "./lib.mts";

loadDotenv();
const id = videoIdArg();
const apiKey = requireEnv("ELEVENLABS_API_KEY");
const target = path.join(publicDir(id), "vo.mp3");
const src = process.argv[3];
const sameFile = src !== undefined && path.resolve(src) === path.resolve(target);
if (src && !sameFile && !fs.existsSync(src)) {
  console.error(`No audio at ${src}`);
  process.exit(1);
}
const srcBuf = src ? fs.readFileSync(sameFile ? target : src) : null;
const audio = srcBuf ?? (fs.existsSync(target) ? fs.readFileSync(target) : null);
if (!audio) {
  console.error(`No audio at ${target}`);
  process.exit(1);
}

const form = new FormData();
form.append("file", new Blob([audio], { type: "audio/mpeg" }), "vo.mp3");
form.append("text", readScript(id).join("\n\n"));

const res = await fetch("https://api.elevenlabs.io/v1/forced-alignment", { method: "POST", headers: { "xi-api-key": apiKey }, body: form });
if (!res.ok) {
  console.error(`ElevenLabs ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = (await res.json()) as { words: { text: string; start: number; end: number; loss?: number }[]; loss?: number };
const out: Alignment = { source: "forced", words: data.words.filter((w) => w.text.trim()).map(({ text, start, end }) => ({ text: text.trim(), start, end })) };
// Only now that the alignment succeeded: replace vo.mp3 (keeps audio and alignment.json in sync).
if (srcBuf && !sameFile) {
  fs.mkdirSync(publicDir(id), { recursive: true });
  fs.writeFileSync(target, srcBuf);
}
fs.writeFileSync(path.join(videoDir(id), "alignment.json"), JSON.stringify(out, null, 1));
console.log(`alignment.json written (${out.words.length} words, avg loss ${data.loss?.toFixed(3) ?? "n/a"}). Next: npm run timeline -- ${id}`);
