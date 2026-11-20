# Buffer Slot Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3 runs/day per account; each run's video is scheduled in Buffer at fixed per-platform WIB air times, YouTube only 2×/day.

**Architecture:** A pure slot table + helpers in `scripts/publish-lib.mts`. The slot is fixed once at run start (build job) and passed to publish, so a slow run never drifts into the next slot. `publish.mts` switches `shareNow` → `customScheduled`+`dueAt` (falls back to `shareNow` if the air time already passed) and stops polling scheduled posts.

**Tech Stack:** TypeScript (tsx), node:test, Buffer GraphQL, GitHub Actions, Cloudflare Worker cron.

**Spec:** `docs/superpowers/specs/2026-11-21-buffer-slot-scheduling-design.md`

## Global Constraints

- Air times WIB (UTC+7, no DST): pagi TT 07:00 / IG 08:00 / no YT; siang TT 13:00 / IG 12:00 / YT 12:00; malam TT 19:00 / IG 20:00 / YT 19:00.
- Instagram only when `account.buffer.instagramChannelId` is set.
- Cron: `30 22,3,10 * * *` (UTC) = 05:30, 10:30, 17:30 WIB.
- Buffer: `mode: "customScheduled"`, `schedulingType: "automatic"`, `dueAt` ISO UTC. Past due → `mode: "shareNow"` (no `dueAt`).
- Verification: `npm run lint` + `npm test`.

## Review Focus

- Cron 22:30 UTC = 05:30 WIB **next calendar day**: the slot date must be the WIB date, not UTC → test `slotFor(2026-11-20T22:30Z)` = pagi 2026-11-21.
- Run started after 19:00 WIB (manual) → pagi of the next WIB day, never "today's" pagi in the past → test.
- Slow run: slot fixed at start, publish at 07:30 WIB for pagi → TikTok `shareNow`, IG still scheduled 08:00 → test `postTiming`.
- pagi slot must never produce a YouTube post → test on `slotTimes`/publish input builder.
- Duplicate check must see `scheduled` posts (the queued video) → test the fetch filter.

---

### Task 1: Slot table and pure helpers

**Files:**
- Modify: `scripts/publish-lib.mts`
- Test: `scripts/publish.test.mts`

**Interfaces:**
- Produces:
  - `type Slot = "pagi" | "siang" | "malam"`; `type Platform = "youtube" | "tiktok" | "instagram"`
  - `SLOT_TIMES: Record<Slot, Partial<Record<Platform, string>>>` (`"HH:MM"` WIB; pagi has no `youtube`)
  - `isSlot(s: string): s is Slot`
  - `slotFor(now: Date): { slot: Slot; date: string }` — first slot (WIB date `YYYY-MM-DD`) whose earliest air time is after `now`; rolls to next WIB day's pagi.
  - `dueAt(slot: Slot, date: string, platform: Platform): string | null` — ISO UTC, `null` if the slot has no time for that platform.
  - `postTiming(due: string, now: Date): { mode: "customScheduled"; dueAt: string } | { mode: "shareNow" }`

- [ ] **Step 1: Write failing tests** (describe `"slot scheduling"`)

```ts
assert.deepEqual(slotFor(new Date("2026-11-20T22:30:00Z")), { slot: "pagi", date: "2026-11-21" }); // 05:30 WIB
assert.deepEqual(slotFor(new Date("2026-11-21T03:30:00Z")), { slot: "siang", date: "2026-11-21" }); // 10:30
assert.deepEqual(slotFor(new Date("2026-11-21T10:30:00Z")), { slot: "malam", date: "2026-11-21" }); // 17:30
assert.deepEqual(slotFor(new Date("2026-11-21T12:30:00Z")), { slot: "pagi", date: "2026-11-22" }); // 19:30 manual
assert.equal(dueAt("pagi", "2026-11-21", "tiktok"), "2026-11-21T00:00:00.000Z");
assert.equal(dueAt("pagi", "2026-11-21", "youtube"), null);
assert.equal(dueAt("malam", "2026-11-21", "instagram"), "2026-11-21T13:00:00.000Z");
assert.deepEqual(postTiming("2026-11-21T00:00:00.000Z", new Date("2026-11-21T00:30:00Z")), { mode: "shareNow" });
assert.deepEqual(postTiming("2026-11-21T01:00:00.000Z", new Date("2026-11-21T00:30:00Z")), { mode: "customScheduled", dueAt: "2026-11-21T01:00:00.000Z" });
assert.equal(isSlot("siang"), true); assert.equal(isSlot("sore"), false);
```

- [ ] **Step 2:** `npm test` → FAIL (exports missing).
- [ ] **Step 3:** Implement in `publish-lib.mts`. WIB = `Date.UTC(...) - 7h`; compute WIB date via `new Date(now.getTime() + 7h).toISOString().slice(0,10)`. Earliest air time per slot = min of its `SLOT_TIMES` values.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Change `instagramInput(channelId, videoUrl, caption)` to take a 4th arg `timing` (return of `postTiming`) and spread it instead of `mode: "shareNow"`; update its existing test to pass `{ mode: "shareNow" }` and add one asserting `customScheduled` + `dueAt` is carried.
- [ ] **Step 6:** `npm run lint && npm test` → PASS. Commit `feat: slot table and Buffer timing helpers`.

### Task 2: Duplicate check includes scheduled posts

**Files:**
- Modify: `scripts/fetch-published-videos.mts:47`, `scripts/publish-lib.mts` (`mapBufferPostNode`, `BufferNode`)
- Test: `scripts/publish.test.mts`

- [ ] **Step 1:** Extract the filter into `publish-lib.mts`: `bufferPostsFilter(buffer: Account["buffer"]) => ({ channelIds: bufferChannelIds(buffer), status: ["sent", "scheduled"] })`. Test asserts `status` deep-equals `["sent", "scheduled"]`.
- [ ] **Step 2:** Add `dueAt?: string | null` to `BufferNode` and the query fields; `mapBufferPostNode` date = `sentAt ?? dueAt ?? createdAt`. Test: node with only `dueAt: "2026-11-22T00:00:00Z"` → `date === "2026-11-22"`.
- [ ] **Step 3:** Use `bufferPostsFilter` in `fetch-published-videos.mts`; update its header comment ("sent + scheduled").
- [ ] **Step 4:** `npm run lint && npm test` → PASS. Commit `feat: duplicate check also sees scheduled Buffer posts`.

### Task 3: publish.mts schedules per slot

**Files:**
- Modify: `scripts/publish.mts`
- Create: `scripts/slot.mts` (prints `slotFor(new Date())` as `slot=<s>\ndate=<d>` for `$GITHUB_OUTPUT`)

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces: CLI `npm run publish -- <slug> [--account <id>] [--slot <pagi|siang|malam> --date <YYYY-MM-DD>]`; without `--slot`, uses `slotFor(new Date())`. Writes `/tmp/publish-result.json` = `{ slug, account, date, title, slot, schedule: { youtube?, tiktok, instagram? } (ISO or "now"), links: {…} }`.

- [ ] **Step 1:** Parse `--slot`/`--date` (reject unknown slot / non `YYYY-MM-DD` with `fail`). Both or neither.
- [ ] **Step 2:** Build inputs with `postTiming(dueAt(...), new Date())` per platform; skip YouTube when `dueAt` is `null`. Log `slot=<s> date=<d>` and each platform's mode/dueAt.
- [ ] **Step 3:** After `createPost`: posts whose status is `sent` or that used `shareNow` are polled as today; `scheduled` posts are accepted as-is (fail only if status is `error`). Keep the "do NOT retry blindly" failure message.
- [ ] **Step 4:** Write the new `publish-result.json`; keep cleanup unchanged; update header comment (no "both posts settled", Cloudinary must stay live until air time).
- [ ] **Step 5:** `npm run lint && npm test` → PASS. Manual smoke: `npx tsx scripts/slot.mts` prints a valid slot. Commit `feat: publish schedules Buffer posts at slot air times`.

### Task 4: Slack report shows the schedule

**Files:**
- Modify: `scripts/report-lib.mts`, `scripts/report.mts`
- Test: `scripts/report.test.mts`

- [ ] **Step 1:** Test: `buildReportText({ slug: "x", account: "kali-aja", schedule: { youtube: "2026-11-21T05:00:00.000Z", tiktok: "2026-11-21T06:00:00.000Z" } })` contains `":calendar:"`, `"Kali Aja"`-label, `"YouTube 12:00 WIB"`, `"TikTok 13:00 WIB"`, `` "`x`" ``. `"now"` renders as `"sekarang"`. Existing link-based tests stay green.
- [ ] **Step 2:** Add optional `schedule?: Partial<Record<Platform, string>>` to `buildReportText`; when present and no `error`, render `:calendar: *[label] Video dijadwalkan*` + one line per platform (WIB `HH:MM`) + any links available.
- [ ] **Step 3:** `report.mts` reads `schedule` from `publish-result.json` alongside links.
- [ ] **Step 4:** `npm run lint && npm test` → PASS. Commit `feat: Slack report shows scheduled air times`.

### Task 5: CI wiring, cron, docs

**Files:**
- Modify: `.github/workflows/video.yml`, `ops/cloudflare-cron/wrangler.toml:11`, `ops/cloudflare-cron/worker.js:2-3`, `docs/PUBLISHING.md`, `ops/README.md:3`, `docs/AUTOPILOT.md:5`, `README.md:10`

- [ ] **Step 1:** `video.yml` build job: first step after checkout/npm ci runs `npx tsx scripts/slot.mts >> "$GITHUB_OUTPUT"` (id `slot`); expose `slot`/`slot_date` job outputs; publish step passes `--slot "$SLOT" --date "$SLOT_DATE"`; rename step to `Publish (Cloudinary → Buffer, scheduled)`. Dry run: echo slot/date in the publish job.
- [ ] **Step 2:** `wrangler.toml` crons = `["30 22,3,10 * * *"]`; worker header comment: 22:30/03:30/10:30 UTC = 05:30/10:30/17:30 WIB.
- [ ] **Step 3:** Docs: replace "6×/hari …" lines with the 3-slot table; PUBLISHING.md Step 2 uses `customScheduled` + `dueAt`, Step 3 notes scheduled posts aren't polled, duplicate section mentions `scheduled`, and the "YouTube 2/hari limit" reason.
- [ ] **Step 4:** `npm run lint && npm test` → PASS; `git grep -n "0,2,4,5,9,12\|07:30/09:30"` → no hits. Commit `chore: 3 daily slots in cron, CI and docs`.
- [ ] **Step 5 (after merge, operator):** `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`; one `gh workflow run video-run -f account=kali-aja -f dry_run=true` to confirm slot output.
