/**
 * Post a report to Slack #social for the CI pipeline.
 *   npm run report -- <slug> --links <yt,tiktok>
 *   npm run report -- <slug> --step <failing-step> --error "<msg>"
 * Requires .env keys: SLACK_BOT_TOKEN, SLACK_SOCIAL_CHANNEL_ID
 */
import { loadDotenv } from "./lib.mts";
loadDotenv();

const args = process.argv.slice(2);
const slug = args[0];
if (!slug) { console.error("Usage: npm run report -- <slug> [--links a,b] [--step name --error msg]"); process.exit(1); }
const iLinks = args.indexOf("--links"), iStep = args.indexOf("--step"), iErr = args.indexOf("--error");
const links = iLinks >= 0 ? args[iLinks + 1] : "";
const step = iStep >= 0 ? args[iStep + 1] : "";
const error = iErr >= 0 ? args[iErr + 1] : "";

let text: string;
if (error) {
  text = `:x: *[video-short CI]* run gagal di *${step || "unknown step"}* untuk \`${slug}\`\nError: ${error.slice(0, 300)}`;
} else if (links) {
  const [yt, tt] = links.split(",");
  text = `:rocket: *[Kali Aja Tau] Video baru live*\n*Judul:* lihat di ${yt ?? ""}\n▶️ ${yt ?? "?"}\n🎵 ${tt ?? "?"}\nProject: \`${slug}\` — diproduksi otomatis oleh video-short CI (self-hosted runner).`;
} else {
  text = `:information_source: *[video-short CI]* \`${slug}\` — report (tidak ada links/error diberikan)`;
}

const token = process.env.SLACK_BOT_TOKEN, channel = process.env.SLACK_SOCIAL_CHANNEL_ID;
if (!token || !channel) { console.error("Missing SLACK_BOT_TOKEN or SLACK_SOCIAL_CHANNEL_ID in .env"); process.exit(1); }

const res = await fetch("https://slack.com/api/chat.postMessage", {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ channel, text, unfurl_links: false }),
});
const body = (await res.json()) as { ok: boolean; ts?: string; error?: string };
if (!body.ok) { console.error(`slack: ${body.error ?? "unknown"}`); process.exit(1); }
console.log(`slack: posted (ts ${body.ts})`);
