/**
 * Print the environment a CI run needs for one account, as KEY=value lines (GITHUB_ENV format).
 *   npx tsx scripts/account-env.mts --account <id> [--require-configured]
 * With --require-configured, an unconfigured account exits 1 naming the missing fields —
 * before the agent, before the render shards.
 */
import { accountById, isConfigured, missingConfigFields } from "../src/accounts.ts";
import { envLines } from "./account-core.mts";
import { publishedVideosPath } from "./lib.mts";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  const idx = args.indexOf(`--${name}`);
  return inline ? inline.slice(name.length + 3) : idx >= 0 ? args[idx + 1] : undefined;
};

const accountId = arg("account") ?? process.env.ACCOUNT;

let account;
try {
  account = accountById(accountId);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

if (args.includes("--require-configured") && !isConfigured(account)) {
  console.error(`akun ${account.id} belum dikonfigurasi (missing: ${missingConfigFields(account).join(", ")})`);
  console.error(`isi src/accounts.ts + secret ${account.secretPrefix}* (lihat docs/PUBLISHING.md)`);
  process.exit(1);
}

for (const line of envLines(account, publishedVideosPath(account.id))) console.log(line);
