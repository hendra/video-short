/**
 * Pure helpers for the account plumbing — no I/O, no env access.
 *
 * Exported so account-core.test.mts can unit-test the shipped code instead of a
 * re-implementation.
 */
import { ACCOUNT_IDS, accountById, isAccountId, type Account, type AccountId } from "../src/accounts.ts";

/** The brand line a generated video source must contain, exactly. */
export const brandLine = (account: Account): string =>
  `brand: { prefix: ${JSON.stringify(account.brand.prefix)}, accent: ${JSON.stringify(account.brand.accent)} }`;

/**
 * Problems with the brand of a generated video source: the account's own literals must be
 * present, and no other account's brand may be there instead.
 */
export const brandProblems = (source: string, account: Account, all: readonly Account[]): string[] => {
  const problems: string[] = [];
  if (!source.includes(`prefix: ${JSON.stringify(account.brand.prefix)}`)) {
    problems.push(`brand prefix "${account.brand.prefix}" tidak ditemukan (harus: ${brandLine(account)})`);
  }
  if (!source.includes(`accent: ${JSON.stringify(account.brand.accent)}`)) {
    problems.push(`brand accent "${account.brand.accent}" tidak ditemukan (harus: ${brandLine(account)})`);
  }
  for (const other of all) {
    if (other.id === account.id) continue;
    if (source.includes(`prefix: ${JSON.stringify(other.brand.prefix)}`)) {
      problems.push(`brand milik akun lain (${other.id}) — akun ini harus pakai brand ${account.id}`);
    }
  }
  return problems;
};

/** Problems with the account a finished video declares vs the account the run is for. */
export const accountProblems = (publishJson: unknown, accountId: AccountId): string[] => {
  const problems: string[] = [];
  const value = (publishJson as { account?: unknown } | null)?.account;
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`publish.json: field "account" wajib diisi ("${accountId}")`);
    return problems;
  }
  if (value !== accountId) {
    problems.push(`publish.json: account video "${value}" != akun run "${accountId}"`);
  }
  return problems;
};

/** KEY=value lines for the CI resolve step (GITHUB_ENV format). */
export const envLines = (account: Account, catalogPath: string): string[] => {
  const prompt = [
    account.agent.prompt,
    `Channel: ${account.label}.`,
    `In src/videos/<slug>/index.ts write exactly: ${brandLine(account)}.`,
    `Published-video catalog for this channel: ${catalogPath} — read it before choosing a topic and do not repeat published titles.`,
    `YouTube categoryId: ${account.youtubeCategoryId}.`,
  ].join(" ");
  return [
    `ACCOUNT=${account.id}`,
    `ACCOUNT_LABEL=${account.label}`,
    `BRAND_LINE=${brandLine(account)}`,
    `YOUTUBE_CATEGORY_ID=${account.youtubeCategoryId}`,
    `AGENT_MODEL=${account.agent.model}`,
    `AGENT_FILES=${account.agent.files.join(" ")}`,
    `AGENT_PROMPT=${prompt}`,
    `CATALOG_PATH=${catalogPath}`,
  ];
};

/**
 * Resolve the account a script runs for: the --account flag wins over the ACCOUNT env value;
 * neither given means the default account. An explicitly empty or unknown value throws —
 * it must never silently become the default channel.
 */
export const resolveAccountArg = (flag: string | undefined, envValue: string | undefined): Account => {
  const raw = flag ?? envValue;
  if (raw !== undefined && !isAccountId(raw)) throw new Error(`Unknown account "${raw}". Valid accounts: ${ACCOUNT_IDS.join(", ")}`);
  return accountById(raw);
};
