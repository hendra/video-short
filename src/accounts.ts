/**
 * Account config — the single source of truth for every channel this pipeline publishes to.
 *
 * One pipeline, many accounts: a CI run is scoped to exactly one account (see
 * `scripts/account-env.mts`), and `publish.json.account` decides which Buffer channel a
 * finished video goes to. Kali Aja's values are the ones the pipeline has always used. Voice and the
 * YouTube made-for-kids declaration are per account too.
 *
 * Kept free of node imports so it can be imported from scripts and from src alike.
 */

export type AccountId = "kali-aja" | "ai-labs" | "cerpenek";

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
  /** YouTube "made for kids" declaration sent with every upload (true disables comments + notifications there). */
  madeForKids: boolean;
  /** Gemini TTS voice id + speaking style for this channel's voiceover. */
  tts: { voice: string; style: string };
  /** Instruction files the agent reads, plus the model it runs on. */
  agent: { model: string; prompt: string; files: string[] };
};

export const ACCOUNT_IDS: readonly AccountId[] = ["kali-aja", "ai-labs", "cerpenek"];

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
    madeForKids: false,
    tts: { voice: "id-id-podcaster-1", style: "natural, warm, conversational" },
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
      orgId: "67654dffc44cce0b50102d9e",
      youtubeChannelId: "6af91d59ece6dfde5fcb8689",
      tiktokChannelId: "6af91d8bece6dfde5fcb87ac",
    },
    youtubeCategoryId: "28",
    madeForKids: false,
    tts: { voice: "id-id-podcaster-1", style: "natural, warm, conversational" },
    agent: {
      model: "opencode/inkling-2-small-free",
      prompt:
        "You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/ai-labs.md (channel brief) and ops/topics/ai-labs.md (topic backlog) — they are part of your instructions, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/ai-labs.md", "ops/topics/ai-labs.md"],
    },
  },
  // Cerpenek (Cerita Pendek Nenek): dongeng anak 5–10 tahun. Buffer ids and the voice stay TODO_
  // until the owner supplies them — `--require-configured` refuses to run the account before that.
  cerpenek: {
    id: "cerpenek",
    label: "Cerpenek",
    brand: { prefix: "Cerpe", accent: "nek" },
    buffer: {
      orgId: "TODO_CERPENEK_ORG",
      youtubeChannelId: "TODO_CERPENEK_YOUTUBE",
      tiktokChannelId: "TODO_CERPENEK_TIKTOK",
    },
    youtubeCategoryId: "27",
    madeForKids: true,
    tts: { voice: "TODO_VOICE", style: "lembut, hangat, pelan; seperti nenek mendongeng untuk anak" },
    agent: {
      model: "opencode/inkling-2-small-free",
      prompt:
        "You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/cerpenek.md (channel brief) and ops/topics/cerpenek.md (topic backlog) — they are part of your instructions, they override ops/ci-prompt.md where they differ, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/cerpenek.md", "ops/topics/cerpenek.md"],
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

/** Config fields that still hold a TODO_ placeholder, e.g. ["buffer.orgId", "tts.voice"]. */
export const missingConfigFields = (account: Account): string[] => [
  ...(["orgId", "youtubeChannelId", "tiktokChannelId"] as const)
    .filter((field) => account.buffer[field].startsWith("TODO_"))
    .map((field) => `buffer.${field}`),
  ...(account.tts.voice.startsWith("TODO_") ? ["tts.voice"] : []),
];

/** True when the account is safe to publish to (no placeholder left). */
export const isConfigured = (account: Account): boolean => missingConfigFields(account).length === 0;
