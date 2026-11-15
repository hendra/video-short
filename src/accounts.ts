/**
 * Account config — the single source of truth for every channel this pipeline publishes to.
 *
 * One pipeline, many accounts: a CI run is scoped to exactly one account (see
 * `scripts/account-env.mts`), and `publish.json.account` decides which Buffer channel a
 * finished video goes to. Kali Aja's values are the ones the pipeline has always used.
 *
 * Kept free of node imports so it can be imported from scripts and from src alike.
 */

export type AccountId = "kali-aja" | "ai-labs";

export type Account = {
  id: AccountId;
  /** Channel name used in Slack reports. */
  label: string;
  /** Brand overlay shown on every frame (prefix + highlighted accent). */
  brand: { prefix: string; accent: string };
  /** Buffer org + the two channels (YouTube, TikTok) inside it. */
  buffer: { orgId: string; youtubeChannelId: string; tiktokChannelId: string };
  /** YouTube video category id. */
  youtubeCategoryId: string;
  /** Instruction files the agent reads, plus the model it runs on. */
  agent: { model: string; prompt: string; files: string[] };
};

export const ACCOUNT_IDS: readonly AccountId[] = ["kali-aja", "ai-labs"];

export const DEFAULT_ACCOUNT: AccountId = "kali-aja";

export const ACCOUNTS: Record<AccountId, Account> = {
  "kali-aja": {
    id: "kali-aja",
    label: "Kali Aja Tau",
    brand: { prefix: "Kali Aja ", accent: "Tau" },
    buffer: {
      orgId: "6aed53e7ec5c7c6d73f3e437",
      youtubeChannelId: "6aedb753e29c69a171803f6e",
      tiktokChannelId: "6aedb7fee29c69a171804662",
    },
    youtubeCategoryId: "27",
    agent: {
      model: "opencode/inkling-2-small-free",
      prompt:
        "You are in CI. Follow AGENTS.md and docs/AUTOPILOT.md. Follow ops/ci-prompt.md exactly. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "docs/AUTOPILOT.md", "ops/ci-prompt.md"],
    },
  },
  "ai-labs": {
    id: "ai-labs",
    label: "AI Labs",
    brand: { prefix: "AI ", accent: "Labs" },
    buffer: {
      orgId: "TODO_AI_LABS_BUFFER_ORG_ID",
      youtubeChannelId: "TODO_AI_LABS_YOUTUBE_CHANNEL_ID",
      tiktokChannelId: "TODO_AI_LABS_TIKTOK_CHANNEL_ID",
    },
    youtubeCategoryId: "30",
    agent: {
      model: "opencode/inkling-2-small-free",
      prompt:
        "You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/ai-labs.md (channel brief) and ops/topics/ai-labs.md (topic backlog) — they are part of your instructions, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/ai-labs.md", "ops/topics/ai-labs.md"],
    },
  },
};

export const isAccountId = (v: unknown): v is AccountId => typeof v === "string" && (ACCOUNT_IDS as readonly string[]).includes(v);

/** Look up an account; unknown ids throw instead of silently falling back to a live channel. */
export const accountById = (id?: string | null): Account => {
  if (id === undefined || id === null || id === "") return ACCOUNTS[DEFAULT_ACCOUNT];
  if (!isAccountId(id)) throw new Error(`Unknown account "${id}". Valid accounts: ${ACCOUNT_IDS.join(", ")}`);
  return ACCOUNTS[id];
};

/** Config fields that still hold a TODO_ placeholder, e.g. ["buffer.orgId"]. */
export const missingConfigFields = (account: Account): string[] =>
  (["orgId", "youtubeChannelId", "tiktokChannelId"] as const)
    .filter((field) => account.buffer[field].startsWith("TODO_"))
    .map((field) => `buffer.${field}`);

/** True when the account is safe to publish to (no placeholder left). */
export const isConfigured = (account: Account): boolean => missingConfigFields(account).length === 0;
