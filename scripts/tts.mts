/**
 * Generate the voiceover AND word timing in one command.
 *   npm run tts -- <id> [--provider=auto|gemini] [--account <id>]
 * Gemini 3.8 Flash TTS in the voice of the video's account (`tts` in src/accounts.ts). The account is
 * --account, else the ACCOUNT env var (set by CI's "Resolve account" step), else the default account.
 * There is no provider fallback and no other voice switch; a failed run stops and reports. Timing comes
 * from the bundled offline aligner — no with-timestamps API needed.
 */
import { loadDotenv, readScript, videoIdArg } from "./lib.mts";
import { synthesizeAndPublish, type TtsProvider } from "./lib-tts.mts";
import { resolveAccountArg, voiceProblem } from "./account-core.mts";

loadDotenv();
const id = videoIdArg();

const VALID = ["auto", "gemini"] as const;
const inline = process.argv.find((a) => a.startsWith("--provider="));
const flagIdx = process.argv.indexOf("--provider");
const providerArg = inline ? inline.slice("--provider=".length) : flagIdx > 0 ? process.argv[flagIdx + 1] : undefined;
const provider = providerArg ?? "auto"; // TTS_PROVIDER is intentionally ignored: production identity is locked.
if (!(VALID as readonly string[]).includes(provider)) {
  console.error(`Unknown --provider "${provider}". Valid: ${VALID.join(", ")}`);
  process.exit(1);
}

const accountInline = process.argv.find((a) => a.startsWith("--account="));
const accountIdx = process.argv.indexOf("--account");
const accountFlag = accountInline ? accountInline.slice("--account=".length) : accountIdx > 0 ? process.argv[accountIdx + 1] : undefined;
let account;
try {
  account = resolveAccountArg(accountFlag, process.env.ACCOUNT);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const voiceIssue = voiceProblem(account);
if (voiceIssue) {
  console.error(voiceIssue);
  process.exit(1);
}

const lines = readScript(id);
// Blank line between script lines -> natural pause for the silence detector.
const text = lines.join("\n\n");
if (lines.length === 0 || text.trim().length === 0) {
  console.error("No script lines found in naskah.txt");
  process.exit(1);
}

const result = await synthesizeAndPublish({ videoId: id, lines, provider: provider as "auto" | TtsProvider, tts: account.tts });
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
console.log(`account=${account.id} voice=${account.tts.voice}`);
console.log(`vo.mp3 + alignment.json written via ${result.provider} (${result.bytes} bytes, ${result.wordCount} words). Next: npm run timeline -- ${id}`);
