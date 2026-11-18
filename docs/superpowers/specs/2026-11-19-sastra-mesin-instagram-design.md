# Sastra Mesin Instagram Reels — Design

**Date:** 2026-11-19
**Scope:** Small change — add optional Instagram Reels publishing to the Buffer pipeline and enable it for `sastra-mesin`.

## Intent & Why

Upload every finished `sastra-mesin` Short to Instagram Reels alongside YouTube Shorts and TikTok, using the Instagram channel already connected to Buffer (`6afe07c2ece6dfde5f116be8`).

## Goals, Non-Goals & Anti-Goals

- **Goals:**
  - Support an optional `instagramChannelId?: string` on `Account.buffer` in `src/accounts.ts`, set to `6afe07c2ece6dfde5f116be8` for `sastra-mesin`.
  - Publish the same Cloudinary MP4 to Buffer as an Instagram Reel (`type: "reel"`, `shouldShareToFeed: true`, `isAiGenerated: true`) using `PUB.tiktokCaption`.
  - Poll the Instagram post alongside YouTube and TikTok until settled, include its link in `publish-result.json` and Slack reports, and include `instagramChannelId` in `fetch-published-videos.mts` for duplicate detection.
- **Non-Goals:**
  - Adding Instagram to `kali-aja`, `ai-labs`, or `cerpenek`.
  - Adding a separate `instagramCaption` field to `publish.json` (user chose option 1: reuse `tiktokCaption`).
- **Anti-Goals:**
  - Changing the `publish.json` schema, CI agent prompt, or `validatePublishJson` contract.
  - Breaking Slack reports or duplicate checks for 2-platform accounts.

## Constraints

- Buffer `InstagramPostMetadataInput` requires non-null `type` (`PostType!`, `"reel"`) and `shouldShareToFeed` (`Boolean!`, `true`), and supports `isAiGenerated: true`.
- Buffer token lacks `account:read`; channel ID is fixed in `src/accounts.ts` (`6afe07c2ece6dfde5f116be8`).
- Reuse `tiktokCaption` (≤ 2,200 chars, fits Instagram Reels' 2,200-char cap).

## Approaches

1. **Optional `instagramChannelId` on `Account.buffer`** *(picked)* — extends `publish.mts`, `publish-lib.mts`, `fetch-published-videos.mts`, `report.mts`, and `report-lib.mts` cleanly with zero impact on 2-platform accounts and no `publish.json` changes.
2. Separate Instagram upload script — duplicates Cloudinary upload, Buffer GraphQL, polling, and duplicate checks. Rejected.
3. Required `instagramChannelId` on all accounts — breaks the three existing accounts that have no Instagram channel. Rejected.

## Design

- **`src/accounts.ts`**: add `instagramChannelId?: string` to `Account.buffer`; set `"sastra-mesin".buffer.instagramChannelId = "6afe07c2ece6dfde5f116be8"`. `missingConfigFields` flags `"buffer.instagramChannelId"` only if defined and starting with `"TODO_"`.
- **`scripts/publish-lib.mts`**: add `instagramInput(channelId, videoUrl, caption)` returning `{ channelId, mode: "shareNow", schedulingType: "automatic", needsApproval: false, text: caption, assets: [{ video: { url: videoUrl } }], metadata: { instagram: { type: "reel", shouldShareToFeed: true, isAiGenerated: true } } }` (plus export `youtubeInput`/`tiktokInput` or keep `instagramInput` testable in `publish.test.mts`).
- **`scripts/publish.mts`**: when `account.buffer.instagramChannelId` is set, call `bufferPost(instagramInput(...))`, poll `ig.id` in `Promise.all` with `yt.id` and `tt.id`, fail if `igLink` is missing/error, and write `instagram: igLink` inside `publish-result.json`'s `links`.
- **`scripts/fetch-published-videos.mts`**: pass `...(instagramChannelId ? [instagramChannelId] : [])` to `channelIds`, and map `service.includes("instagram")` to `"instagram"`.
- **`scripts/report.mts` & `scripts/report-lib.mts`**: include `result.links?.instagram` when building `--links` CSV; in `buildReportText`, unpack `[yt, tt, ig]` and append `\n📸 ${ig}` only when `ig` is truthy.
- **`docs/PUBLISHING.md`, `ops/accounts/sastra-mesin.md`**: document Instagram Reels support and the `6afe07c2ece6dfde5f116be8` channel ID.
- **Tests**: `accounts.test.mts` (assert `sastra-mesin` `instagramChannelId` + 24-hex uniqueness check), `publish.test.mts` (assert `instagramInput` payload fields), `report.test.mts` (2-link unchanged, 3-link appends `📸`).

## Left to the Builder

Exact helper extraction in `publish-lib.mts` and minor wording in `docs/PUBLISHING.md`.
