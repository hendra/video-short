/**
 * Generate the voiceover AND word timing in one command.
 *   npm run tts -- <id> [--provider=auto|gemini|gcloud|azure|elevenlabs]
 * Default: auto = gemini (Google AI Studio, free) → gcloud → azure; ElevenLabs is
 * legacy/optional and never part of the automatic chain. Timing comes from the bundled
 * offline aligner (align-core) — no with-timestamps API needed except for elevenlabs.
 */
import { loadDotenv, readScript, videoIdArg } from "./lib.mts";
import { synthesizeAndPublish, type TtsProvider } from "./lib-tts.mts";

loadDotenv();
const id = videoIdArg();

const VALID = ["auto", "gemini", "gcloud", "azure", "elevenlabs"] as const;
const inline = process.argv.find((a) => a.startsWith("--provider="));
const flagIdx = process.argv.indexOf("--provider");
const providerArg = inline ? inline.slice("--provider=".length) : flagIdx > 0 ? process.argv[flagIdx + 1] : undefined;
const provider = providerArg ?? process.env.TTS_PROVIDER ?? "auto";
if (!(VALID as readonly string[]).includes(provider)) {
  console.error(`Unknown --provider "${provider}". Valid: ${VALID.join(", ")}`);
  process.exit(1);
}

const lines = readScript(id);
// Blank line between script lines -> natural pause for the silence detector.
const text = lines.join("\n\n");
if (lines.length === 0 || text.trim().length === 0) {
  console.error("No script lines found in naskah.txt");
  process.exit(1);
}

const result = await synthesizeAndPublish({ videoId: id, lines, provider: provider as "auto" | TtsProvider });
if (!result.ok) {
  if (result.analysisFailure) {
    console.error(`Synthesis succeeded but timing analysis failed: ${result.analysisFailure.reason}`);
    console.error(`Fresh audio kept at ${result.analysisFailure.failedPath}`);
    console.error(`${id}'s committed vo.mp3/alignment.json were NOT touched.`);
  } else {
    console.error("TTS failed on all providers:");
    for (const a of result.attempts) console.error(`  ${a}`);
  }
  process.exit(1);
}
console.log(`vo.mp3 + alignment.json written via ${result.provider} (${result.bytes} bytes, ${result.wordCount} words). Next: npm run timeline -- ${id}`);
