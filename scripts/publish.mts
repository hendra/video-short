/**
 * Publish a finished video to YouTube + TikTok via Cloudinary (signed upload) and Buffer (GraphQL).
 *   npm run publish -- <slug>
 *
 * Requirements:
 *   - out/<slug>-final.mp4 must exist (run render + loudnorm first)
 *   - src/videos/<slug>/publish.json must exist: { title, description, tiktokTitle, tiktokCaption, catatan? }
 *   - .env keys: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, BUFFER_ACCESS_TOKEN
 * Idempotent: if docs/ledger.md already contains a row for <slug>, exits 0 without any API call.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadDotenv, readScript } from "./lib.mts";

loadDotenv();

const slug = process.argv[2];
if (!slug) { console.error("Usage: npm run publish -- <slug>"); process.exit(1); }

const fail = (msg: string): never => { console.error(msg); process.exit(1); };
const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);
const ledgerHas = (ledger: string, s: string) => new RegExp(`^\\|[^\\n]*\\|\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|`, "m").test(ledger);
const videoChars = () => readScript(slug).reduce((a, l) => a + l.length, 0);

const ledgerPath = path.join(ROOT, "docs", "ledger.md");
const mp4Path = path.join(ROOT, "out", `${slug}-final.mp4`);
const publishPath = path.join(ROOT, "src", "videos", slug, "publish.json");

if (!fs.existsSync(mp4Path)) fail(`No final mp4 at ${mp4Path} — render + loudnorm first.`);
if (!fs.existsSync(publishPath)) fail(`Missing ${publishPath} — the agent must write publish.json (see ops/ci-prompt.md).`);
if (!fs.existsSync(ledgerPath)) fail(`No ${ledgerPath}`);

const PUB = JSON.parse(fs.readFileSync(publishPath, "utf8")) as { title: string; description: string; tiktokTitle: string; tiktokCaption: string; catatan?: string };
for (const k of ["title", "description", "tiktokTitle", "tiktokCaption"] as const) {
  if (!PUB[k] || typeof PUB[k] !== "string" || !PUB[k].trim()) fail(`publish.json: missing/empty "${k}"`);
}

// ---------- ledger-first idempotency: never double-publish
if (ledgerHas(fs.readFileSync(ledgerPath, "utf8"), slug)) {
  console.log(`publish: ledger already has ${slug} — skipping (no API calls).`);
  process.exit(0);
}

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME, CLOUD_KEY = process.env.CLOUDINARY_API_KEY, CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET;
const BUFFER = process.env.BUFFER_ACCESS_TOKEN;
for (const [n, v] of [["CLOUDINARY_CLOUD_NAME", CLOUD_NAME], ["CLOUDINARY_API_KEY", CLOUD_KEY], ["CLOUDINARY_API_SECRET", CLOUD_SECRET], ["BUFFER_ACCESS_TOKEN", BUFFER]] as const) {
  if (!v) fail(`Missing ${n} in .env (see .env.example / docs/PUBLISHING.md).`);
}

// ---------- 1. Cloudinary signed upload
const publicId = `shorts/${today()}/${slug}`;
const ts = Math.floor(Date.now() / 1000);
const sign = sha1(`public_id=${publicId}&timestamp=${ts}${CLOUD_SECRET}`);
const fileBuf = fs.readFileSync(mp4Path);
const form = new FormData();
form.append("file", new Blob([new Uint8Array(fileBuf)], { type: "video/mp4" }), `${slug}-final.mp4`);
form.append("public_id", publicId);
form.append("timestamp", String(ts));
form.append("api_key", CLOUD_KEY!);
form.append("signature", sign);
console.log(`uploading ${mp4Path} (${fileBuf.length} bytes) -> Cloudinary ${publicId} …`);
const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, { method: "POST", body: form });
const up = (await upRes.json()) as { secure_url?: string; bytes?: number; resource_type?: string; error?: { message: string } };
if (!upRes.ok) fail(`Cloudinary ${upRes.status}: ${up.error?.message ?? JSON.stringify(up)}`);
if (up.bytes !== fileBuf.length) fail(`Cloudinary bytes mismatch: expected ${fileBuf.length}, got ${up.bytes}`);
console.log(`  -> ${up.secure_url}`);

// ---------- 2. Buffer GraphQL createPost
const YT = "6aedb753e29c69a171803f6e", TT = "6aedb7fee29c69a171804662";
const bufferPost = async (input: Record<string, unknown>) => {
  const query = `mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status channelService externalLink sharedNow } }
    ... on NotFoundError { message }
    ... on UnauthorizedError { message }
    ... on UnexpectedError { message }
    ... on InvalidInputError { message }
    ... on LimitReachedError { message }
    ... on RestProxyError { message }
  }
}`;
  const res = await fetch("https://api.buffer.com/graphql", {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUFFER}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { input } }),
  });
  const body = (await res.json()) as any;
  if (body?.errors?.length) fail(`Buffer HTTP ${res.status}: ${body.errors.map((e: any) => e?.message ?? JSON.stringify(e)).join("; ")}`);
  const data = body?.data?.createPost;
  if (!data || data.__typename !== "PostActionSuccess") fail(`Buffer: ${data?.message ?? JSON.stringify(data ?? body)}`);
  return data.post as { id: string; status: string; channelService: string; externalLink?: string | null };
};

const ytInput = {
  channelId: YT, mode: "shareNow", schedulingType: "automatic", needsApproval: false,
  text: PUB.description,
  assets: [{ video: { url: up.secure_url! } }],
  metadata: { youtube: { title: PUB.title, categoryId: "27", privacy: "public" as const, madeForKids: false, isAiGenerated: true, notifySubscribers: true } },
};
const ttInput = {
  channelId: TT, mode: "shareNow", schedulingType: "automatic", needsApproval: false,
  text: PUB.tiktokCaption,
  assets: [{ video: { url: up.secure_url! } }],
  metadata: { tiktok: { isAiGenerated: true, title: PUB.tiktokTitle } },
};
const yt = await bufferPost(ytInput);
console.log(`youtube: ${yt.id} status=${yt.status} ${yt.externalLink ?? ""}`);
const tt = await bufferPost(ttInput);
console.log(`tiktok:  ${tt.id} status=${tt.status} ${tt.externalLink ?? ""}`);

// ---------- 3. Poll until both settle (max 5 min)
const deadline = Date.now() + 5 * 60_000;
const poll = async (id: string) => {
  while (Date.now() < deadline) {
    const res = await fetch("https://api.buffer.com/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${BUFFER}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ post(input: { id: \"" + id + "\" }) { id status externalLink } }" }),
    });
    const p = ((await res.json()) as any)?.data?.post;
    if (p?.status === "sent") return p.externalLink as string;
    if (p?.status === "error") return null;
    await new Promise((r) => setTimeout(r, 20_000));
  }
  return null;
};
const [ytLink, ttLink] = await Promise.all([poll(yt.id), poll(tt.id)]);
if (!ytLink || !ttLink) fail(`post settled with error or timeout (yt=${yt.status}/${ytLink ?? "pending"}, tt=${tt.status}/${ttLink ?? "pending"}) — do NOT retry blindly; check Buffer UI.`);

// ---------- 4. Ledger row (uncommitted; workflow commits)
const chars = videoChars();
const row = `| ${today()} | ${slug} | ${chars.toLocaleString("id-ID")} | (Gemini, gratis) | ${ytLink} | ${ttLink} | ${PUB.catatan ?? "autopilot CI"} |`;
fs.appendFileSync(ledgerPath, row + "\n");
console.log(`ledger: ${row}`);
console.log(`publish: done`);
