import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AccountId } from "../src/accounts.ts";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const videoDir = (id: string) => path.join(ROOT, "src", "videos", id);
export const publicDir = (id: string) => path.join(ROOT, "public", id);

/** Ephemeral Buffer catalog snapshot for one account (never committed). */
export const publishedVideosPath = (accountId: AccountId): string =>
  path.join(os.tmpdir(), `published-videos-${accountId}.json`);

export type VideoConfig = {
  /** [shotId, first script line of that shot] in order. */
  shots: [string, number][];
  /** Seconds of picture after the last word. */
  tail: number;
};

/** naskah.txt: lines formatted "NN  text". Everything else is a comment. */
export const readScript = (id: string): string[] => {
  const raw = fs.readFileSync(path.join(videoDir(id), "naskah.txt"), "utf8");
  return raw
    .split(/\r?\n/)
    .map((l) => /^(\d{2})\s+(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[2].trim());
};

export const readConfig = (id: string): VideoConfig => JSON.parse(fs.readFileSync(path.join(videoDir(id), "config.json"), "utf8"));

export const requireEnv = (name: string) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Put it in .env (see .env.example) or export it.`);
    process.exit(1);
  }
  return v;
};

/** Minimal .env loader so the scripts have no extra dependency. */
export const loadDotenv = () => {
  const f = path.join(ROOT, ".env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
};

export const videoIdArg = () => {
  const id = process.argv[2];
  if (!id || !fs.existsSync(videoDir(id))) {
    console.error(`Usage: npm run <script> -- <video-id>   (folders in src/videos: ${fs.readdirSync(path.join(ROOT, "src", "videos")).join(", ")})`);
    process.exit(1);
  }
  return id;
};

/** Words with timing, the common format every alignment source is converted to. */
export type TimedWord = { text: string; start: number; end: number };
export type Alignment = { source: "tts" | "forced" | "estimated"; words: TimedWord[] };
