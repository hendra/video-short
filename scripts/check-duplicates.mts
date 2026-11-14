/**
 * Deterministic near-duplicate gate for generated videos.
 *   npx tsx scripts/check-duplicates.mts <slug> [--db data/published-videos.json]
 * Exits non-zero before render/publish when the candidate is too close to a published video.
 */
import fs from "node:fs";
import path from "node:path";
import { videoDir, readScript, ROOT } from "./lib.mts";
import { findDuplicate, type CandidatePost } from "./duplicate-core.mts";
import { PUBLISHED_DB_PATH, readPublishedDb } from "./published-db.mts";

const slug = process.argv[2];
const inline = process.argv.find((a) => a.startsWith("--db="));
const flagIdx = process.argv.indexOf("--db");
const dbPath = inline ? inline.slice("--db=".length) : flagIdx > 0 ? process.argv[flagIdx + 1] : PUBLISHED_DB_PATH;
if (!slug) {
  console.error("Usage: npx tsx scripts/check-duplicates.mts <slug> [--db data/published-videos.json]");
  process.exit(1);
}
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(ROOT, dbPath);
let db;
try {
  db = readPublishedDb(absoluteDbPath);
} catch (e) {
  console.error(`duplicate gate: ${(e as Error).message}`);
  process.exit(1);
}

const publishPath = path.join(videoDir(slug), "publish.json");
if (!fs.existsSync(publishPath)) {
  console.error(`missing ${publishPath}`);
  process.exit(1);
}
const publish = JSON.parse(fs.readFileSync(publishPath, "utf8")) as Partial<CandidatePost>;
for (const field of ["title", "tiktokTitle", "description", "tiktokCaption"] as const) {
  if (typeof publish[field] !== "string" || !publish[field]!.trim()) {
    console.error(`publish.json: missing or invalid ${field}`);
    process.exit(1);
  }
}
// Keep naskah in scope for validation, but duplicates are judged on the publish copy — naskah is full text and would over-match.
if (readScript(slug).length === 0) {
  console.error(`missing or empty ${path.join(videoDir(slug), "naskah.txt")}`);
  process.exit(1);
}
const candidate = publish as CandidatePost;
const match = findDuplicate(candidate, db.videos);
if (match) {
  const summary = (match.post.title ?? match.post.text).replace(/\s+/g, " ").slice(0, 90);
  console.error(`duplicate gate: candidate ${match.field} is too close to a published ${match.post.platform ?? ""} video (containment=${match.containment.toFixed(2)}, jaccard=${match.jaccard.toFixed(2)}): ${summary}`);
  console.error("choose a new topic, angle, or title; then re-run the gate");
  process.exit(1);
}
console.log(`duplicate gate: ${db.videos.length} published catalog entries checked; no close match for ${slug}`);
