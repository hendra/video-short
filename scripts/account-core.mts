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

/** Why an account cannot be voiced yet (its voice is still a TODO_ placeholder), or null when it can. */
export const voiceProblem = (account: Account): string | null =>
  account.tts.voice.startsWith("TODO_") ? `suara akun ${account.id} belum dipilih (tts.voice di src/accounts.ts)` : null;

const lastThreeLines = (text: string | null): string =>
  (text ?? "").split(/\r?\n/).filter((l) => l.trim() !== "").slice(-3).join("\n");

/** Rules specific to ai-labs videos: motion graphics only, no world.ts, and PromptCard must link to description. */
export const aiLabsVideoProblems = (opts: {
  indexSource: string;
  shotsSource: string | null;
  hasWorldFile: boolean;
  publishJson: { description?: unknown } | null;
  naskahText: string | null;
}): string[] => {
  const problems: string[] = [];
  if (!/mode\s*:\s*["']motion["']/.test(opts.indexSource)) {
    problems.push('ai-labs wajib pakai mode: "motion" di index.ts');
  }
  if (opts.hasWorldFile) {
    problems.push('ai-labs wajib pakai motion graphics (mode: "motion"), bukan world.ts 3D');
  }
  if (opts.shotsSource && /\bPromptCard\b/.test(opts.shotsSource)) {
    const desc = opts.publishJson?.description;
    if (typeof desc !== "string" || !/Prompt siap copy:/i.test(desc)) {
      problems.push('shots pakai PromptCard — publish.json description wajib berisi "Prompt siap copy:"');
    }
    const mentionsDeskripsi =
      /deskripsi/i.test(lastThreeLines(opts.naskahText)) || /cta\s*:\s*\{[^}]*deskripsi/i.test(opts.indexSource);
    if (!mentionsDeskripsi) {
      problems.push('shots pakai PromptCard — CTA di index.ts atau 3 baris terakhir naskah.txt wajib menyebut "deskripsi"');
    }
  }
  return problems;
};
