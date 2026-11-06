/**
 * ElevenLabs credit gate for the scheduler.
 *   GET https://api.elevenlabs.io/v1/user/subscription  (needs a key with "User: read")
 *
 *   npm run credits                      # print usage
 *   npm run credits -- --video <id>      # also price that video's naskah; exit 2 if not enough credits
 *   npm run credits -- --need 1500       # exit 2 if fewer than 1500 credits remain
 * Credits per character depend on the model: flash/turbo = 0.5, multilingual/v3/v4 = 1.
 */
import { loadDotenv, readScript, requireEnv } from "./lib.mts";

loadDotenv();
const key = requireEnv("ELEVENLABS_API_KEY");
const model = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
const rate = /flash|turbo/.test(model) ? 0.5 : 1;
const SAFETY = 150; // margin for retakes / rounding

const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
if (!res.ok) {
  console.error(`ElevenLabs ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const s = (await res.json()) as { tier: string; character_count: number; character_limit: number; next_character_count_reset_unix?: number };
const remaining = s.character_limit - s.character_count;
const reset = s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : "?";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
let need = Number(arg("--need") ?? 0);
const vid = arg("--video");
if (vid) need = Math.ceil(readScript(vid).join("\n\n").length * rate);

console.log(JSON.stringify({ tier: s.tier, used: s.character_count, limit: s.character_limit, remaining, reset, model, rate, need }));
if (need && remaining < need + SAFETY) {
  console.error(`NOT ENOUGH CREDITS: need ${need} (+${SAFETY} margin), remaining ${remaining}, resets ${reset}`);
  process.exit(2);
}
