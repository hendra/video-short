/**
 * Backfill Buffer's sent-post history into the git-tracked published-video catalog.
 *   npx tsx scripts/sync-published-videos.mts [--out data/published-videos.json]
 * The access token stays in this process; the output contains only public post text/metadata.
 * New CI publishes update the same file directly in scripts/publish.mts.
 */
import path from "node:path";
import { loadDotenv, ROOT } from "./lib.mts";
import { mergePublishedDb, readPublishedDb, writePublishedDb, type PublishedVideo } from "./published-db.mts";

loadDotenv();

const YT = "6aedb753e29c69a171803f6e";
const TT = "6aedb7fee29c69a171804662";
const ORG = "6aed53e7ec5c7c6d73f3e437";
const arg = (name: string) => {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  const idx = process.argv.indexOf(`--${name}`);
  return inline ? inline.slice(name.length + 3) : idx > 0 ? process.argv[idx + 1] : undefined;
};
const outPath = path.resolve(ROOT, arg("out") ?? "data/published-videos.json");
const token = process.env.BUFFER_ACCESS_TOKEN;
if (!token) throw new Error("Missing BUFFER_ACCESS_TOKEN in .env (posts:read only; see docs/PUBLISHING.md)");

const query = `query($input: PostsInput!, $first: Int, $after: String) {
  posts(input: $input, first: $first, after: $after) {
    edges {
      node {
        id channelService createdAt sentAt text externalLink
        metadata {
          ... on YoutubePostMetadata { title }
          ... on TiktokPostMetadata { title }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

type BufferNode = {
  id?: string;
  channelService?: string;
  createdAt?: string;
  sentAt?: string | null;
  text?: string;
  externalLink?: string | null;
  metadata?: { title?: string | null };
};

const posts: PublishedVideo[] = [];
let after: string | null = null;
let truncated = false;
for (let page = 0; page < 100; page += 1) {
  const res = await fetch("https://api.buffer.com/graphql", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          organizationId: ORG,
          filter: { channelIds: [YT, TT], status: ["sent"] },
          sort: [{ field: "createdAt", direction: "desc" }],
        },
        first: 100,
        after,
      },
    }),
  });
  const raw = await res.text();
  let body: {
    data?: { posts?: { edges?: { node?: BufferNode }[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } } };
    errors?: { message?: string }[];
  } | null = null;
  try { body = JSON.parse(raw); } catch { throw new Error(`Buffer HTTP ${res.status}: non-JSON response (${raw.slice(0, 200)})`); }
  if (!res.ok || body?.errors?.length) {
    const detail = body?.errors?.map((e) => e?.message ?? JSON.stringify(e)).join("; ");
    throw new Error(`Buffer: ${detail || `HTTP ${res.status}`}`);
  }
  for (const edge of body?.data?.posts?.edges ?? []) {
    const node = edge?.node;
    if (!node?.id || !node.text) continue;
    const service = (node.channelService ?? "").toLowerCase();
    const platform = service.includes("tiktok") ? "tiktok" : "youtube";
    posts.push({
      id: `buffer:${node.id}`,
      slug: null,
      date: (node.sentAt ?? node.createdAt ?? new Date().toISOString()).slice(0, 10),
      platform,
      title: node.metadata?.title ?? null,
      text: node.text,
      link: node.externalLink ?? null,
      format: null,
      source: "buffer-seed",
    });
  }
  const pageInfo = body?.data?.posts?.pageInfo;
  if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
  after = pageInfo.endCursor;
  if (page === 99) truncated = true;
}

const { db, added, replaced } = mergePublishedDb(readPublishedDb(outPath), posts);
writePublishedDb(db, outPath);
console.log(`published-videos: imported ${posts.length} Buffer posts into ${outPath} (${added} added, ${replaced} updated, ${db.videos.length} total)${truncated ? " — stopped at 10,000" : ""}`);
