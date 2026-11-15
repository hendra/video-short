/**
 * Print the environment a CI run needs for one account, as KEY=value lines (GITHUB_ENV format).
 *   npx tsx scripts/account-env.mts --account <id> [--require-configured] [--require-credentials]
 * With --require-configured, an unconfigured account exits 1 naming the missing config fields —
 * before the agent, before the render shards. --require-credentials additionally checks that the
 * five publish credentials for this account exist in the environment (nothing is printed; exit 1
 * and the missing secret names go to stderr). Checks run before the env lines are printed.
 */
import { ACCOUNT_IDS, accountById, isAccountId, isConfigured, missingConfigFields } from "../src/accounts.ts";
import { envLines, missingSecrets } from "./account-core.mts";
import { publishedVideosPath } from "./lib.mts";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  const idx = args.indexOf(`--${name}`);
  return inline ? inline.slice(name.length + 3) : idx >= 0 ? args[idx + 1] : undefined;
};

const accountIdRaw = arg("account") ?? process.env.ACCOUNT;

// Explicitly empty or unknown values fail loudly; no flag at all means the default account.
if (accountIdRaw !== undefined && !isAccountId(accountIdRaw)) {
  console.error(`Unknown account "${accountIdRaw}". Valid accounts: ${ACCOUNT_IDS.join(", ")}`);
  process.exit(1);
}

let account;
try {
  account = accountById(accountIdRaw);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

if (args.includes("--require-configured") && !isConfigured(account)) {
  console.error(`akun ${account.id} belum dikonfigurasi (missing: ${missingConfigFields(account).join(", ")})`);
  console.error(`isi src/accounts.ts + secret ${account.secretPrefix}* (lihat docs/PUBLISHING.md)`);
  process.exit(1);
}

if (args.includes("--require-credentials")) {
  const missing = missingSecrets(account, process.env as Record<string, string | undefined>);
  if (missing.length) {
    console.error(`akun ${account.id} belum punya kredensial (secret: ${missing.join(", ")})`);
    process.exit(1);
  }
}

for (const line of envLines(account, publishedVideosPath(account.id))) console.log(line);
