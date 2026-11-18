# Sastra Mesin Instagram Reels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Buffer Instagram Reels publishing for `sastra-mesin` (`6afe07c2ece6dfde5f116be8`) using `tiktokCaption`, while keeping 2-platform accounts unchanged.

**Architecture:** Add optional `instagramChannelId?: string` to `Account.buffer`, build pure Buffer input/node helpers in `scripts/publish-lib.mts`, wire them into `scripts/publish.mts` and `scripts/fetch-published-videos.mts`, and extend `scripts/report-lib.mts` / `scripts/report.mts` for an optional 3rd link.

**Tech Stack:** TypeScript, Node `node:test` via `tsx`, Buffer GraphQL API.

**Spec:** `docs/superpowers/specs/2026-11-19-sastra-mesin-instagram-design.md`

## Global Constraints

- Verification = `npm run lint` + `npm test`; no new dependencies.
- `publish.json` schema (`validatePublishJson`) and `ops/ci-prompt.md` remain unchanged; Instagram reuses `PUB.tiktokCaption`.
- Buffer `InstagramPostMetadataInput` requires non-null `type: "reel"` and `shouldShareToFeed: true`, plus `isAiGenerated: true`.
- Three existing accounts (`kali-aja`, `ai-labs`, `cerpenek`) keep no `instagramChannelId` and identical 2-link Slack reports.

## Review Focus

1. An account with `instagramChannelId: "TODO_IG"` must count as unconfigured (`missingConfigFields` returns `"buffer.instagramChannelId"`, `isConfigured` returns `false`) — pinned by Task 1 test.
2. Two-platform accounts (`instagramChannelId === undefined`) must still produce 2-element `channelIds` and 2-line Slack reports (`▶️` + `🎵`, no empty `📸`) — pinned by Tasks 2 and 3 tests.
3. `fetch-published-videos.mts` must map `channelService` `"instagram"` to `platform: "instagram"` instead of falling back to `"youtube"` — pinned by Task 2 test.
4. `report.mts` `links` extraction must handle `publish-result.json` with `instagram` omitted or `null` without inserting a trailing comma — pinned by Task 3 test.
5. `publish.mts` must never call `bufferPost(instagramInput(...))` when `instagramChannelId` is absent, and must fail cleanly if `igLink` fails/times out when it is present — verified by `publish.mts` control flow inspection and `npm run lint`.

---

### Task 1: Optional `instagramChannelId` on `Account.buffer`

**Files:**
- Modify: `src/accounts.ts` (`Account.buffer`, `ACCOUNTS["sastra-mesin"].buffer`, `missingConfigFields`)
- Test: `scripts/accounts.test.mts`

**Interfaces:**
- Produces: `Account.buffer.instagramChannelId?: string`; `ACCOUNTS["sastra-mesin"].buffer.instagramChannelId === "6afe07c2ece6dfde5f116be8"`.

- [ ] **Step 1: Write failing tests** in `scripts/accounts.test.mts`:
  - Update `"Sastra Mesin is fully configured with its own Buffer org and channels"` to include `instagramChannelId: "6afe07c2ece6dfde5f116be8"` in `assert.deepEqual(s.buffer, …)`.
  - Update `"each account's buffer ids are either all real or all placeholder"` to include `a.buffer.instagramChannelId` when defined (`filter((v): v is string => typeof v === "string")`).
  - Add `"a placeholder instagramChannelId counts as unconfigured"`:
```ts
test("a placeholder instagramChannelId counts as unconfigured", () => {
  const a = { ...ACCOUNTS["sastra-mesin"], buffer: { ...ACCOUNTS["sastra-mesin"].buffer, instagramChannelId: "TODO_IG" } };
  assert.deepEqual(missingConfigFields(a), ["buffer.instagramChannelId"]);
  assert.equal(isConfigured(a), false);
});
```

- [ ] **Step 2:** Run `npx tsx --test scripts/accounts.test.mts` → Expected: FAIL (`deepEqual` and `missingConfigFields` fail).

- [ ] **Step 3: Implement** in `src/accounts.ts`:
  - Add `instagramChannelId?: string` to `Account["buffer"]`.
  - Set `instagramChannelId: "6afe07c2ece6dfde5f116be8"` on `ACCOUNTS["sastra-mesin"].buffer`.
  - Update `missingConfigFields(account)` to check `(["orgId", "youtubeChannelId", "tiktokChannelId", "instagramChannelId"] as const)` filtered where `typeof account.buffer[field] === "string" && account.buffer[field].startsWith("TODO_")`.

- [ ] **Step 4:** Run `npm run lint && npm test` → Expected: 0 lint errors, all tests pass.

- [ ] **Step 5: Commit** `feat(sastra-mesin): add optional instagramChannelId to account config`.

---

### Task 2: Buffer Instagram Reels input, publish & duplicate fetch

**Files:**
- Modify: `scripts/publish-lib.mts`
- Modify: `scripts/publish.mts:103-195`
- Modify: `scripts/fetch-published-videos.mts:14-87`
- Test: `scripts/publish.test.mts`

**Interfaces:**
- Produces in `scripts/publish-lib.mts`:
  - `export const instagramInput = (channelId: string, videoUrl: string, caption: string) => ({ ... })`
  - `export const bufferChannelIds = (buffer: Account["buffer"]): string[]`
  - `export const mapBufferPostNode = (node: { id?: string; channelService?: string; createdAt?: string; sentAt?: string | null; text?: string; externalLink?: string | null; metadata?: { title?: string | null } }): RecentPost | null`

- [ ] **Step 1: Write failing tests** in `scripts/publish.test.mts`:
```ts
describe("instagramInput", () => {
  test("builds a Buffer Reel payload sharing to feed with AI flag", () => {
    const p = instagramInput("6afe07c2ece6dfde5f116be8", "https://cdn/v.mp4", "Caption #shorts");
    assert.deepEqual(p, {
      channelId: "6afe07c2ece6dfde5f116be8",
      mode: "shareNow",
      schedulingType: "automatic",
      needsApproval: false,
      text: "Caption #shorts",
      assets: [{ video: { url: "https://cdn/v.mp4" } }],
      metadata: { instagram: { type: "reel", shouldShareToFeed: true, isAiGenerated: true } },
    });
  });
});

describe("bufferChannelIds and mapBufferPostNode", () => {
  test("includes instagramChannelId only when configured", () => {
    assert.equal(bufferChannelIds(ACCOUNTS["kali-aja"].buffer).length, 2);
    assert.deepEqual(bufferChannelIds(ACCOUNTS["sastra-mesin"].buffer), [
      "6afdf52fece6dfde5f101631",
      "6afdf54bece6dfde5f101af0",
      "6afe07c2ece6dfde5f116be8",
    ]);
  });

  test("maps instagram, tiktok, and youtube nodes and drops incomplete nodes", () => {
    assert.equal(mapBufferPostNode({ id: "1", text: "x", channelService: "instagram" })?.platform, "instagram");
    assert.equal(mapBufferPostNode({ id: "2", text: "x", channelService: "tiktok" })?.platform, "tiktok");
    assert.equal(mapBufferPostNode({ id: "3", text: "x", channelService: "youtube" })?.platform, "youtube");
    assert.equal(mapBufferPostNode({ id: "4" }), null);
  });
});
```

- [ ] **Step 2:** Run `npx tsx --test scripts/publish.test.mts` → Expected: FAIL (`instagramInput` / helpers not exported).

- [ ] **Step 3: Implement**:
  - Export `instagramInput`, `bufferChannelIds`, and `mapBufferPostNode` from `scripts/publish-lib.mts`.
  - Update `scripts/fetch-published-videos.mts` to use `bufferChannelIds(ACCOUNTS[accountId].buffer)` in `filter.channelIds` and `mapBufferPostNode(node)` when building `posts`.
  - Update `scripts/publish.mts`: when `account.buffer.instagramChannelId` is defined, post `instagramInput(IG, up.secure_url!, PUB.tiktokCaption)`, poll `ig.id` in parallel with `yt.id` and `tt.id`, fail if `igP` was requested and `!igP.link`, and include `...(igLink ? { instagram: igLink } : {})` in `publish-result.json`'s `links`.

- [ ] **Step 4:** Run `npm run lint && npm test` → Expected: 0 lint errors, all tests pass.

- [ ] **Step 5: Commit** `feat(publish): support optional Instagram Reels via Buffer`.

---

### Task 3: Slack report 3rd link & documentation

**Files:**
- Modify: `scripts/report-lib.mts`
- Modify: `scripts/report.mts:19-33`
- Modify: `docs/PUBLISHING.md`, `ops/accounts/sastra-mesin.md`, `AGENTS.md`
- Test: `scripts/report.test.mts`

**Interfaces:**
- Produces: `export const formatLinksCsv = (links?: { youtube?: string | null; tiktok?: string | null; instagram?: string | null }): string` in `scripts/report-lib.mts`.

- [ ] **Step 1: Write failing tests** in `scripts/report.test.mts`:
```ts
test("success report includes instagram line when a 3rd link is provided and omits it for 2 links", () => {
  const two = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2", account: "kali-aja" });
  assert.equal(two.includes("📸"), false);
  const three = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2,https://ig/3", account: "sastra-mesin" });
  assert.match(three, /📸 https:\/\/ig\/3/);
});

test("formatLinksCsv omits null/missing links cleanly", () => {
  assert.equal(formatLinksCsv({ youtube: "https://yt/1", tiktok: "https://tt/2" }), "https://yt/1,https://tt/2");
  assert.equal(formatLinksCsv({ youtube: "https://yt/1", tiktok: "https://tt/2", instagram: "https://ig/3" }), "https://yt/1,https://tt/2,https://ig/3");
  assert.equal(formatLinksCsv({ youtube: "https://yt/1", tiktok: null, instagram: null }), "https://yt/1");
});
```

- [ ] **Step 2:** Run `npx tsx --test scripts/report.test.mts` → Expected: FAIL (`formatLinksCsv` not exported, `📸` missing).

- [ ] **Step 3: Implement**:
  - In `scripts/report-lib.mts`: unpack `const [yt, tt, ig] = links.split(",");`, append `\n📸 ${ig}` only when `ig` is truthy; export `formatLinksCsv`.
  - In `scripts/report.mts`: extend `result.links` type with `instagram?: string | null` and compute `links = formatLinksCsv(result.links)` when `--links` is absent.
  - Update `docs/PUBLISHING.md` (mention optional Instagram Reels in `sastra-mesin` summary + GraphQL payload example `type: "reel"`, `shouldShareToFeed: true`, `isAiGenerated: true`), `ops/accounts/sastra-mesin.md` (note under `## publish.json` that `tiktokCaption` also feeds Instagram Reels), and `AGENTS.md` (mention Instagram Reels for Sastra Mesin).

- [ ] **Step 4:** Run `npm run lint && npm test` → Expected: 0 lint errors, all tests pass.

- [ ] **Step 5: Commit** `feat(sastra-mesin): report Instagram link to Slack and update docs`.
