/**
 * Gate that a generated video belongs to the run account and carries the right brand.
 *   npx tsx scripts/account-gate.mts --account <id> --slug <slug>
 * Runs after the agent, before render: publish.json.account must equal the run account,
 * and the video source must contain this account's brand literals (and no other account's).
 */
import fs from "node:fs";
import path from "node:path";
import { ACCOUNTS, accountById, isAccountId } from "../src/accounts.ts";
import { accountProblems, brandProblems } from "./account-core.mts";
import { videoDir } from "./lib.mts";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  const idx = args.indexOf(`--${name}`);
  return inline ? inline.slice(name.length + 3) : idx >= 0 ? args[idx + 1] : undefined;
};

const accountId = arg("account") ?? process.env.ACCOUNT;
const slug = arg("slug");

if (!slug) {
  console.error("Usage: npx tsx scripts/account-gate.mts --account <id> --slug <slug>");
  process.exit(1);
}
if (accountId === undefined || !isAccountId(accountId)) {
  console.error(`Unknown account "${accountId ?? ""}". Valid accounts: kali-aja, ai-labs`);
  process.exit(1);
}

const account = accountById(accountId);

const problems: string[] = [];

const publishPath = path.join(videoDir(slug), "publish.json");
if (!fs.existsSync(publishPath)) {
  problems.push(`missing ${publishPath}`);
} else {
  try {
    problems.push(...accountProblems(JSON.parse(fs.readFileSync(publishPath, "utf8")), account.id));
  } catch {
    problems.push(`${publishPath}: not valid JSON`);
  }
}

const indexPath = path.join(videoDir(slug), "index.ts");
if (!fs.existsSync(indexPath)) {
  problems.push(`missing ${indexPath}`);
} else {
  problems.push(...brandProblems(fs.readFileSync(indexPath, "utf8"), account, Object.values(ACCOUNTS)));
}

if (problems.length) {
  console.error(`account gate DITOLAK (akun ${account.id}, slug ${slug}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`account gate: slug ${slug} milik akun ${account.id}, brand sesuai`);
