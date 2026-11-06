/**
 * Already have the voiceover (e.g. made in the ElevenLabs web app)? Get exact word timing with
 * Forced Alignment:  POST https://api.elevenlabs.io/v1/forced-alignment  (multipart: file, text)
 *
 *   npm run align -- rumah-pompa                # uses public/<id>/vo.mp3
 *   npm run align -- rumah-pompa path/to/vo.mp3 # copies it to public/<id>/vo.mp3 first
 */
import fs from "node:fs";
import path from "node:path";
import { type Alignment, loadDotenv, publicDir, readScript, requireEnv, videoDir, videoIdArg } from "./lib";

loadDotenv();
const id = videoIdArg();
const apiKey = requireEnv("ELEVENLABS_API_KEY");
const target = path.join(publicDir(id), "vo.mp3");
const src = process.argv[3];
if (src) {
  fs.mkdirSync(publicDir(id), { recursive: true });
  fs.copyFileSync(src, target);
}
if (!fs.existsSync(target)) {
  console.error(`No audio at ${target}`);
  process.exit(1);
}

const form = new FormData();
form.append("file", new Blob([fs.readFileSync(target)], { type: "audio/mpeg" }), "vo.mp3");
form.append("text", readScript(id).join("\n\n"));

const res = await fetch("https://api.elevenlabs.io/v1/forced-alignment", { method: "POST", headers: { "xi-api-key": apiKey }, body: form });
if (!res.ok) {
  console.error(`ElevenLabs ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = (await res.json()) as { words: { text: string; start: number; end: number; loss?: number }[]; loss?: number };
const out: Alignment = { source: "forced", words: data.words.filter((w) => w.text.trim()).map(({ text, start, end }) => ({ text: text.trim(), start, end })) };
fs.writeFileSync(path.join(videoDir(id), "alignment.json"), JSON.stringify(out, null, 1));
console.log(`alignment.json written (${out.words.length} words, avg loss ${data.loss?.toFixed(3) ?? "n/a"}). Next: npm run timeline -- ${id}`);
