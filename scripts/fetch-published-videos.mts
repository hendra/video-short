/**
 * Fetch Buffer's sent-post history into an ephemeral JSON file for duplicate/republish checks.
 *   npx tsx scripts/fetch-published-videos.mts [--account <id>] [--out /tmp/published-videos-<id>.json]
 * The access token stays in this process; the output contains only public post text/metadata.
 * Nothing from this data is committed by CI.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ACCOUNTS, DEFAULT_ACCOUNT, isAccountId, type AccountId } from "../src/accounts.ts";
import { loadDotenv, publishedVideosPath } from "./lib.mts";
import type { RecentPost } from "./duplicate-core.mts";

export const fetchPublishedVideos = async (token = process.env.BUFFER_ACCESS_TOKEN, accountId: AccountId = DEFAULT_ACCOUNT): Promise<RecentPost[]> => {
  if (!token) throw new Error("Missing BUFFER_ACCESS_TOKEN in .env (posts:read only; see docs/PUBLISHING.md)");
  const { orgId, youtubeChannelId, tiktokChannelId } = ACCOUNTS[accountId].buffer;

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

  const posts: RecentPost[] = [];
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
            organizationId: orgId,
            filter: { channelIds: [youtubeChannelId, tiktokChannelId], status: ["sent"] },
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
      posts.push({
        id: `buffer:${node.id}`,
        platform: service.includes("tiktok") ? "tiktok" : "youtube",
        date: (node.sentAt ?? node.createdAt ?? new Date().toISOString()).slice(0, 10),
        title: node.metadata?.title ?? null,
        text: node.text,
        link: node.externalLink ?? null,
        source: "buffer",
      });
    }
    const pageInfo = body?.data?.posts?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
    after = pageInfo.endCursor;
    if (page === 99) truncated = true;
  }
  if (truncated) console.error("published-videos: stopped after 10,000 posts");
  return posts;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name: string) => {
    const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
    const idx = process.argv.indexOf(`--${name}`);
    return inline ? inline.slice(name.length + 3) : idx > 0 ? process.argv[idx + 1] : undefined;
  };
  const accountId = arg("account") ?? process.env.ACCOUNT ?? DEFAULT_ACCOUNT;
  if (!isAccountId(accountId)) {
    console.error(`Unknown account "${accountId}". Valid accounts: kali-aja, ai-labs`);
    process.exit(1);
  }
  const outPath = arg("out") ?? publishedVideosPath(accountId as AccountId);
  loadDotenv();
  try {
    const posts = await fetchPublishedVideos(process.env.BUFFER_ACCESS_TOKEN, accountId as AccountId);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(posts, null, 1));
    console.log(`published-videos: wrote ${posts.length} sent posts to ${outPath}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
