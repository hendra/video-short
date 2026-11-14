/** Shared helpers for the git-tracked published-video catalog. */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mts";

export type PublishedVideo = {
  id: string;
  slug: string | null;
  date: string;
  platform: "youtube" | "tiktok";
  title: string | null;
  text: string;
  link: string | null;
  format: string | null;
  source: "buffer-seed" | "publish";
};
export type PublishedDb = { schema: 1; videos: PublishedVideo[] };

export const PUBLISHED_DB_PATH = path.join(ROOT, "data", "published-videos.json");

export const emptyDb = (): PublishedDb => ({ schema: 1, videos: [] });
export const parseFormat = (catatan?: string | null): string | null =>
  catatan?.trim().match(/^format:\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase() ?? null;

const isRecord = (v: unknown): v is PublishedVideo => {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === "string" && r.id.length > 0
    && (r.slug === null || typeof r.slug === "string")
    && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    && (r.platform === "youtube" || r.platform === "tiktok")
    && (r.title === null || typeof r.title === "string")
    && typeof r.text === "string"
    && (r.link === null || typeof r.link === "string")
    && (r.format === null || typeof r.format === "string")
    && (r.source === "buffer-seed" || r.source === "publish");
};

export const readPublishedDb = (file = PUBLISHED_DB_PATH): PublishedDb => {
  if (!fs.existsSync(file)) return emptyDb();
  let parsed: unknown;
  try { parsed = JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new Error(`published-videos database at ${file} is not valid JSON`); }
  const db = parsed as Partial<PublishedDb>;
  if (db.schema !== 1 || !Array.isArray(db.videos) || !db.videos.every(isRecord)) {
    throw new Error(`published-videos database at ${file} has an invalid shape (expected { schema: 1, videos: [...] })`);
  }
  return { schema: 1, videos: db.videos };
};

export const writePublishedDb = (db: PublishedDb, file = PUBLISHED_DB_PATH): void => {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1) + "\n");
  fs.renameSync(tmp, file);
};

export const mergePublishedDb = (current: PublishedDb, incoming: PublishedVideo[]): { db: PublishedDb; added: number; replaced: number } => {
  const byId = new Map(current.videos.map((v) => [v.id, v]));
  let added = 0, replaced = 0;
  for (const record of incoming) {
    if (byId.has(record.id)) replaced += 1; else added += 1;
    byId.set(record.id, record);
  }
  return { db: { schema: 1, videos: [...byId.values()] }, added, replaced };
};

export const recordPublishedVideos = ({ slug, date, youtube, tiktok, format }: {
  slug: string;
  date: string;
  youtube: { title: string; text: string; link: string | null };
  tiktok: { title: string; text: string; link: string | null };
  format: string | null;
}, file = PUBLISHED_DB_PATH): { added: number; replaced: number } => {
  const incoming: PublishedVideo[] = [
    { id: `${slug}:youtube`, slug, date, platform: "youtube", title: youtube.title, text: youtube.text, link: youtube.link, format, source: "publish" },
    { id: `${slug}:tiktok`, slug, date, platform: "tiktok", title: tiktok.title, text: tiktok.text, link: tiktok.link, format, source: "publish" },
  ];
  const { db, added, replaced } = mergePublishedDb(readPublishedDb(file), incoming);
  writePublishedDb(db, file);
  return { added, replaced };
};
