/**
 * Publish a finished video to YouTube + TikTok via Cloudinary (signed upload) and Buffer (GraphQL).
 *   npm run publish -- <slug>
 *
 * Requirements:
 *   - out/<slug>-final.mp4 must exist (run render + loudnorm first)
 *   - src/videos/<slug>/publish.json must exist: { title, description, tiktokTitle, tiktokCaption, catatan? }
 *   - .env keys: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, BUFFER_ACCESS_TOKEN
 * Idempotent: if docs/ledger.md already contains a row for <slug>, exits 0 without any API call.
 * Set PUBLISH_COMMIT=1 to also commit+push the ledger row (fetch/rebase/push, 3 attempts)
 * after it is written — used by the CI workflow so the idempotency record survives the job.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, loadDotenv, readScript } from "./lib.mts";
import { ledgerHas, cloudinarySign, validatePublishJson, extractBufferError } from "./publish-lib.mts";

loadDotenv();

const slug = process.argv[2];
if (!slug) { console.error("Usage: npm run publish -- <slug>"); process.exit(1); }

const fail = (msg: string): never => { console.error(msg); process.exit(1); };
const today = () => new Date().toISOString().slice(0, 10);
const videoChars = () => readScript(slug).reduce((a, l) => a + l.length, 0);

const ledgerPath = path.join(ROOT, "docs", "ledger.md");
const mp4Path = path.join(ROOT, "out", `${slug}-final.mp4`);
const publishPath = path.join(ROOT, "src", "videos", slug, "publish.json");

if (!fs.existsSync(mp4Path)) fail(`No final mp4 at ${mp4Path} — render + loudnorm first.`);
if (!fs.existsSync(publishPath)) fail(`Missing ${publishPath} — the agent must write publish.json (see ops/ci-prompt.md).`);
if (!fs.existsSync(ledgerPath)) fail(`No ${ledgerPath}`);

const PUB = JSON.parse(fs.readFileSync(publishPath, "utf8")) as { title: string; description: string; tiktokTitle: string; tiktokCaption: string; catatan?: string };
{
  const problems = validatePublishJson(PUB);
  if (problems.length) fail(`publish.json: ${problems.join("; ")}`);
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
const sign = cloudinarySign({ public_id: publicId, overwrite: "true", timestamp: ts }, CLOUD_SECRET!);
const fileBuf = fs.readFileSync(mp4Path);
const form = new FormData();
form.append("file", new Blob([new Uint8Array(fileBuf)], { type: "video/mp4" }), `${slug}-final.mp4`);
form.append("public_id", publicId);
form.append("timestamp", String(ts));
form.append("overwrite", "true");
form.append("api_key", CLOUD_KEY!);
form.append("signature", sign);
console.log(`uploading ${mp4Path} (${fileBuf.length} bytes) -> Cloudinary ${publicId} …`);
const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, { method: "POST", body: form });
const upRaw = await upRes.text();
let up: { secure_url?: string; bytes?: number; resource_type?: string; error?: { message: string } } = {};
try { up = JSON.parse(upRaw); } catch { fail(`Cloudinary HTTP ${upRes.status}: non-JSON response (${upRaw.slice(0, 200)})`); }
if (!upRes.ok) fail(`Cloudinary ${upRes.status}: ${up.error?.message ?? JSON.stringify(up)}`);
if (up.bytes !== fileBuf.length) fail(`Cloudinary bytes mismatch: expected ${fileBuf.length}, got ${up.bytes}`);
if (up.resource_type && up.resource_type !== "video") fail(`Cloudinary resource_type is "${up.resource_type}" (expected "video") — refusing to publish.`);
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
  const raw = await res.text();
  let body: any = null;
  try { body = JSON.parse(raw); } catch { fail(`Buffer HTTP ${res.status}: non-JSON response (${raw.slice(0, 200)})`); }
  if (!res.ok) fail(`Buffer HTTP ${res.status}: ${extractBufferError(body) || raw.slice(0, 200)}`);
  const errDetail = extractBufferError(body);
  if (errDetail) fail(`Buffer: ${errDetail}`);
  const data = body?.data?.createPost;
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
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    const res = await fetch("https://api.buffer.com/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${BUFFER}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ post(input: { id: \"" + id + "\" }) { id status externalLink } }" }),
    });
    const raw = await res.text();
    let body: any = null;
    try { body = JSON.parse(raw); } catch { console.error(`poll ${id}: non-JSON response (HTTP ${res.status}): ${raw.slice(0, 200)}`); }
    if (body?.errors?.length) console.error(`poll ${id}: ${body.errors.map((e: any) => e?.message ?? JSON.stringify(e)).join("; ")}`);
    const p = body?.data?.post;
    if (p?.status) lastStatus = p.status;
    if (p?.status === "sent") return { link: p.externalLink as string, status: p.status };
    if (p?.status === "error") return { link: null, status: p.status };
    await new Promise((r) => setTimeout(r, 20_000));
  }
  return { link: null, status: lastStatus };
};
const [ytP, ttP] = await Promise.all([poll(yt.id), poll(tt.id)]);
const ytLink = ytP.link, ttLink = ttP.link;
if (!ytLink || !ttLink) fail(`post settled with error or timeout (yt=${ytP.status}/${ytLink ?? "pending"}, tt=${ttP.status}/${ttLink ?? "pending"}) — do NOT retry blindly; check Buffer UI.`);

// ---------- 4. Ledger row
const chars = videoChars();
const row = `| ${today()} | ${slug} | ${chars.toLocaleString("id-ID")} | (Gemini, gratis) | ${ytLink} | ${ttLink} | ${PUB.catatan ?? "autopilot CI"} |`;
fs.appendFileSync(ledgerPath, row + "\n");
console.log(`ledger: ${row}`);

// Two-phase idempotency (CI): commit+push the ledger row right now so the
// publish is durable before the workflow's commit step even starts. Rebase onto
// origin/main with retry — main can move mid-run.
if (process.env.PUBLISH_COMMIT === "1") {
  const git = (args: string[]) => {
    console.log(`git ${args.join(" ")}`);
    return execFileSync("git", args, { cwd: ROOT, stdio: "inherit" });
  };
  git(["config", "user.name", "video-short-ci"]);
  git(["config", "user.email", "ci@video-short.local"]);
  git(["add", "docs/ledger.md"]);
  git(["commit", "-m", `ledger: ${slug} published`]);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      git(["fetch", "origin", "main"]);
      git(["rebase", "origin/main"]);
      git(["push", "origin", "HEAD:main"]);
      break;
    } catch (e) {
      if (attempt === 3) {
        console.error(`publish: ledger committed but PUSH FAILED after 3 attempts — the workflow will fail; the ledger line that must land on main:\n${row}`);
        throw e;
      }
      console.error(`publish: push attempt ${attempt} failed — retrying after rebase`);
    }
  }
}
console.log(`publish: done`);
