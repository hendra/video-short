/**
 * Post a report to Slack #social for the CI pipeline.
 *   npm run report -- <slug> [--account <id>] [--links <yt,tiktok>]
 *   npm run report -- <slug> [--account <id>] --step <failing-step> --error "<msg>"
 * Requires .env keys: SLACK_BOT_TOKEN, SLACK_SOCIAL_CHANNEL_ID
 * --account sets the channel label in the message; without it, read /tmp/publish-result.json
 * (written by scripts/publish.mts), else the report stays channel-neutral.
 */
import { loadDotenv } from "./lib.mts";
import { isAccountId, ACCOUNT_IDS } from "../src/accounts.ts";
import { buildReportText } from "./report-lib.mts";
loadDotenv();

const args = process.argv.slice(2);
const slug = args[0] || "ci";
const iLinks = args.indexOf("--links"), iStep = args.indexOf("--step"), iErr = args.indexOf("--error"), iAcct = args.indexOf("--account");
let links = iLinks >= 0 ? args[iLinks + 1] : "";
let account = iAcct >= 0 ? args[iAcct + 1] : iAcct === -1 && args.find((a) => a.startsWith("--account="))?.slice("--account=".length);
// If --links missing, recover the just-published links from the same-run temporary result
if (!links || !account) {
  try {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const resultPath = path.join(os.tmpdir(), "publish-result.json");
    const result = JSON.parse(fs.readFileSync(resultPath, "utf8")) as { slug?: string; account?: string; links?: { youtube?: string | null; tiktok?: string | null } };
    if (result.slug === slug) {
      if (!links) links = [result.links?.youtube, result.links?.tiktok].filter(Boolean).join(",");
      if (!account && result.account) account = result.account;
    }
  } catch { /* leave links empty */ }
}
if (account !== undefined && !isAccountId(account)) {
  console.error(`--account "${account}" tidak dikenal (valid: ${ACCOUNT_IDS.join(", ")})`);
  process.exit(1);
}
const step = iStep >= 0 ? args[iStep + 1] : "";
const error = iErr >= 0 ? args[iErr + 1] : "";

const text = buildReportText({ slug, links, step, error, account });

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
