# Upwayyy Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Upwayyy as the 5th account: horror-game lore Shorts cut over official Steam trailer footage, rendered by a new `mode: "footage"` with a red/white `"upwayyy"` overlay theme.

**Architecture:** `scripts/fetch-footage.mts` pulls Steam trailers (no audio) and splits them into scene clips under `public/<slug>/clips/`. A `FootageExplainer` in `src/engine/Explainer.tsx` plays one clip per shot with Remotion `<Sequence>` + `@remotion/media` `<Video>`, then reuses `Overlays`, captions, audio, timeline, gates and publish unchanged. Account wiring follows the existing per-account pattern (`src/accounts.ts`, `pick-format`, `music`, `account-core`/`account-gate`, briefs in `ops/`).

**Tech Stack:** TypeScript, Remotion 4 (`@remotion/media`), ffmpeg/ffprobe, node:test via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-21-upwayyy-channel-design.md`

## Global Constraints

- Verification = `npm run lint` + `npm test` (offline, mocked) + bundle + eyeballed stills.
- Everything visible is a pure function of `t`; timing bound to `L(n)`; no `Math.random`/`Date.now`.
- Account id `upwayyy`; brand literal `brand: { prefix: "Up", accent: "wayyy" }`; YouTube category `"20"`; `madeForKids: false`; voice `id-id-podcaster-1`, style `"santai, akrab, seperti teman gamer bercerita; serius saat cerita seram"`.
- Buffer ids are `TODO_` placeholders (user fills them); YouTube **and** TikTok both required.
- Upwayyy red = `#ff2a2a`; text white. Other accounts' themes must not change.
- Music moods: `["mencekam", "misteri", "klimaks"]`, files `public/upwayyy/music/<mood>.mp3` (user supplies from Suno).
- Script rules unchanged: ≤130 words, 45–55 s, loop-line ending, `tail ≤ 0.3`.
- Footage: Steam trailers only, `-an` (no audio), never YouTube downloads; no clip reused within a video.
- Description line: `Cuplikan: trailer resmi <Game> (Steam). Suara: AI (Google AI Studio).`
- Do **not** add `upwayyy` to `ops/cloudflare-cron/wrangler.toml` `ACCOUNTS` (only after Buffer ids exist — user step).

## Review Focus

1. Steam app with no `movies` or `success:false` (age-gated / delisted) → fetcher exits non-zero with a clear message, writes nothing. → Task 2 test.
2. Shot longer than its clip → last frame holds (no black frame). → Task 3 (`clipTimeAt` test).
3. Trailer title/logo cards at start/end → trimmed before splitting. → Task 2 `planClips` test.
4. Same clip used in two shots → account gate rejects. → Task 5 test.
5. Clip path in `index.ts` that doesn't exist under `public/<slug>/clips/` → account gate rejects (render would 404). → Task 5 test.

---

### Task 1: Account, format pool, music moods

**Files:**
- Modify: `src/accounts.ts`, `scripts/pick-format.mts`, `scripts/music.mts`, `.github/workflows/video.yml:18` (account description), `.gitignore`
- Test: `scripts/accounts.test.mts`, `scripts/pick-format.test.mts`, `scripts/music.test.mts`

**Interfaces:**
- Produces: `AccountId` includes `"upwayyy"`; `ACCOUNTS.upwayyy`; `FORMATS_BY_ACCOUNT.upwayyy`; `MOODS_BY_ACCOUNT.upwayyy`.

- [ ] **Step 1: Update tests first**
  - `accounts.test.mts`: `ACCOUNT_IDS` deep-equals `["kali-aja","ai-labs","cerpenek","sastra-mesin","upwayyy"]`; new test: `ACCOUNTS.upwayyy` has brand `{prefix:"Up",accent:"wayyy"}`, `youtubeCategoryId "20"`, `madeForKids false`, `tts.voice "id-id-podcaster-1"`, `agent.files ["AGENTS.md","ops/ci-prompt.md","ops/accounts/upwayyy.md","ops/topics/upwayyy.md"]`, and `isConfigured(ACCOUNTS.upwayyy) === false` with `missingConfigFields` = `["buffer.orgId","buffer.youtubeChannelId","buffer.tiktokChannelId"]`. If an existing test asserts every account is configured, exclude `upwayyy` there with a comment.
  - `pick-format.test.mts`: ids for `upwayyy` = `["lore-recap","ending-explained","villain-origin","hidden-detail","timeline","character-story"]`; weights `[3,2,2,2,1,1]`; every instruction mentions `aside` (the Upwayyy personal line).
  - `music.test.mts`: `resolveMusicTrack("teknik","upwayyy",…)` throws listing `mencekam, misteri, klimaks`.
- [ ] **Step 2:** `npm test` → those tests FAIL.
- [ ] **Step 3: Implement**
  - `src/accounts.ts`: add id to `AccountId` and `ACCOUNT_IDS`; entry `upwayyy` with `label "Upwayyy"`, buffer `orgId/youtubeChannelId/tiktokChannelId: "TODO_…"`, values from Global Constraints, `agent.model` same as others, `agent.prompt` modelled on Sastra Mesin's (brief + topics override `ops/ci-prompt.md`; AUTOPILOT does not apply).
  - `pick-format.mts`: `UPWAYYY` pool, ids/weights as tested. Each instruction: hook with a personal gamer aside in Upwayyy voice, short spoiler warning, story beats, one honest mid-video reaction (`aside`), loop-line ending; facts only from fetched sources; theories labelled.
  - `music.mts`: `upwayyy: ["mencekam","misteri","klimaks"]`.
  - `video.yml`: add `upwayyy` to the account description list.
  - `.gitignore`: add `public/*/clips/`.
- [ ] **Step 4:** `npm run lint && npm test` → PASS.
- [ ] **Step 5:** Commit `feat(upwayyy): account, format pool, music moods`.

### Task 2: Steam footage fetcher

**Files:**
- Create: `scripts/footage-core.mts`, `scripts/footage-core.test.mts`, `scripts/fetch-footage.mts`
- Modify: `package.json` (script `"footage": "tsx scripts/fetch-footage.mts"`)

**Interfaces:**
- Produces:
  - `type SteamMovie = { id: number; name: string; highlight: boolean; hls: string }`
  - `parseSteamMovies(json: unknown, appId: string): SteamMovie[]` — throws `Error` mentioning the app id when `success` is false or no movie has `hls_h264`; highlights first.
  - `type ClipPlan = { trailer: number; start: number; dur: number }`
  - `planClips(cuts: number[], trailerDur: number, trailer: number, opts?: { trimHead?: number; trimTail?: number; minDur?: number; maxDur?: number }): ClipPlan[]` — defaults `trimHead 3, trimTail 6, minDur 1.5, maxDur 4`. Segments between consecutive scene cuts inside `[trimHead, trailerDur − trimTail]`; drop `< minDur`; cap at `maxDur`.
  - `parseSceneCuts(ffmpegStderr: string): number[]` — `pts_time:` values from `showinfo`.
  - CLI: `npm run footage -- <slug> --appid <id> [--min <n=8>]` writes `public/<slug>/clips/NN.mp4` (1080-wide, H.264, `-an`) and `public/<slug>/clips.json` = `[{ file: "NN.mp4", dur, trailer, start }]`; exits 1 (writing nothing into `public/<slug>/clips`) if fewer than `--min` clips.

- [ ] **Step 1: Write failing tests** in `footage-core.test.mts`:
  - `parseSteamMovies` on a fixture `{ "<id>": { success: true, data: { movies: [{id:1,name:"a",highlight:false,hls_h264:"u1"},{id:2,name:"b",highlight:true,hls_h264:"u2"}] } } }` → ids `[2,1]`.
  - `parseSteamMovies` on `{ "<id>": { success: false } }` and on data without `movies` → throws `/<id>/`.
  - `planClips([2, 5, 5.8, 9, 14, 120], 126, 0)` → no clip starts before 3 or ends after 120; the 5→5.8 segment is dropped; 9→14 becomes `{start:9,dur:4}`.
  - `parseSceneCuts("…pts_time:28.24 …\n…pts_time:29.41 …")` → `[28.24, 29.41]`.
- [ ] **Step 2:** `npx tsx --test scripts/footage-core.test.mts` → FAIL.
- [ ] **Step 3:** Implement `footage-core.mts`, then `fetch-footage.mts`: fetch `https://store.steampowered.com/api/appdetails?appids=<id>&filters=movies`; for up to 3 movies: `ffmpeg -i <hls> -map 0:v:0 -an -c copy` to a tmp dir, `ffprobe` duration, scene detect `-vf "select='gt(scene,0.3)',showinfo" -f null -` (parse stderr), `planClips`, then cut each with `-ss start -t dur -an -vf scale=1080:-2 -c:v libx264 -crf 20 -pix_fmt yuv420p`. Stage in tmp, move into `public/<slug>/clips` only on success.
- [ ] **Step 4:** Tests PASS; manual smoke: `npm run footage -- footage-smoke --appid 2947440` → ≥ 8 clips, `ffprobe` shows no audio stream; delete `public/footage-smoke`.
- [ ] **Step 5:** Commit `feat(upwayyy): Steam trailer footage fetcher`.

### Task 3: `mode: "footage"` in the engine

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/Explainer.tsx`, `src/engine/math.ts`
- Test: `scripts/footage-mode.test.mts` (create)

**Interfaces:**
- Produces:
  - `type FootageShotDef = { label: string; title: string; tag?: string; chip?: (t: number) => ChipState | null; clip: string /* path in public/, e.g. "<slug>/clips/03.mp4" */; from?: number /* default 0 */; clipDur: number /* from clips.json */ }`
  - `type VideoDefFootage = BaseVideoDef & { mode: "footage"; shots: (ctx: Ctx) => Record<string, FootageShotDef> }`; `VideoDef` union includes it.
  - `clipTimeAt(t: number, spanStart: number, from: number, clipDur: number): number` in `math.ts` — `min(from + (t − spanStart), clipDur − 1/30)`, never below `from`.
  - `footageZoom(t: number, span: ShotSpan): number` in `math.ts` — `1.05 + 0.08·progress` (the approved sample's zoom).

- [ ] **Step 1: Failing tests**: `clipTimeAt(5, 4, 0.5, 3)` = `1.5`; `clipTimeAt(10, 4, 0, 3)` ≈ `3 − 1/30` (hold last frame); `footageZoom` = `1.05` at `span.s`, `1.13` at `span.e`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**: types + helpers; `FootageExplainer` as in the approved spike: black background; per shot a `<Sequence from={round(s·fps)} durationInFrames={…+1}>` with `<Video src={staticFile(clip)} muted objectFit="cover" trimBefore={round(from·fps)} />` inside an `AbsoluteFill` scaled by `footageZoom` and faded in over 0.15 s; a bottom gradient `linear-gradient(rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)`; then `<Overlays …theme={themeOf(video)}>` and audio. If a shot outlasts its clip, freeze via `<Freeze>` at `clipDur·fps − 1` from the hold point (use `clipTimeAt` to decide). Dispatch in `Explainer` before the motion branch. Publisher logo corner (spec): `objectFit="cover"` on a 16:9 source already crops the outer ~68 % of width, which removed "KONAMI" in the approved sample — verify in Task 7 stills; no extra crop code unless a logo survives.
- [ ] **Step 4:** `npm run lint && npm test` → PASS.
- [ ] **Step 5:** Commit `feat(engine): footage mode plays one clip per shot`.

### Task 4: `"upwayyy"` overlay theme (red/white)

**Files:**
- Modify: `src/engine/types.ts` (`OverlayTheme` adds `"upwayyy"`), `src/engine/overlays/Overlays.tsx`
- Test: `scripts/overlays.test.mts`

**Interfaces:**
- Produces: `themeOf` returns `"upwayyy"` when set explicitly; footage mode with no theme defaults to `"upwayyy"`. Exported `accentOf(theme: OverlayTheme): string` → `"#ff2a2a"` for `upwayyy`, `"#7fe3c4"` for `dark-tech`.

- [ ] **Step 1: Failing tests**: `themeOf({...base, mode:"footage"})` = `"upwayyy"`; existing defaults unchanged; `accentOf("upwayyy")` = `"#ff2a2a"`, `accentOf("dark-tech")` = `"#7fe3c4"`; the caption-box test loop includes `"upwayyy"` (inline-block, lineHeight 1.32).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Treat `upwayyy` as dark layout (`const dark = theme === "dark-tech" || theme === "upwayyy"`) and route every `MINT` use and the mint/cyan rgba borders (header label, title highlight, caption active word, brand accent, CTA/chip/badge borders) through `accentOf(theme)` / an rgba of it. `dark-tech` output must be byte-identical in behaviour.
- [ ] **Step 4:** `npm run lint && npm test` → PASS.
- [ ] **Step 5:** Commit `feat(overlays): upwayyy red/white theme`.

### Task 5: Gates accept footage videos

**Files:**
- Modify: `scripts/account-core.mts`, `scripts/account-gate.mts`, `scripts/check-motion.mts`, `scripts/motion-gate-core.mts` (only if needed)
- Test: `scripts/account-core.test.mts`, `scripts/motion-gate.test.mts`

**Interfaces:**
- Produces: `upwayyyVideoProblems(opts: { indexSource: string; hasWorldFile: boolean; clipPaths: string[]; clipExists: (p: string) => boolean; publishJson: { description?: unknown } | null }): string[]`.

- [ ] **Step 1: Failing tests** (`account-core.test.mts`):
  - valid input (`mode: "footage"`, no world, distinct existing clips, description contains `Cuplikan: trailer resmi` and `Suara: AI`) → `[]`.
  - missing `mode: "footage"` or `hasWorldFile: true` → problem `/footage/`.
  - duplicate entry in `clipPaths` → problem `/dipakai dua kali/`.
  - `clipExists` false for one path → problem naming that path.
  - description without the `Cuplikan:` line → problem `/Cuplikan/`.
  - `accountMusicProblems({music:"misteri"},"upwayyy")` → `[]`.
  - `motion-gate.test.mts`: `motionProblems({ account: "footage", source with L(1..n), lineCount, world: [], motion: [] })` → only line-coverage / forbidden-call problems apply.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `upwayyyVideoProblems` (comment-strip `indexSource` like `sastraMesinVideoProblems`); in `account-gate.mts` for `upwayyy`, load the registered video's shots (as `check-motion` does via `VIDEOS`) to get `clipPaths`, check existence under `public/`. `motionProblems.account` accepts `"footage"`; `check-motion.mts` passes `"footage"` with empty world/motion samples and prints shots count instead of "bergerak".
- [ ] **Step 4:** `npm run lint && npm test` → PASS.
- [ ] **Step 5:** Commit `feat(gates): accept upwayyy footage videos`.

### Task 6: Channel brief, topics, CI prompt, docs

**Files:**
- Create: `ops/accounts/upwayyy.md`, `ops/topics/upwayyy.md`
- Modify: `ops/ci-prompt.md`, `AGENTS.md`, `ops/README.md`, `scripts/topics.test.mts`

- [ ] **Step 1: Failing tests** in `topics.test.mts` (new `describe("Upwayyy brief")`): brief exists and has sections `## Brand`, `## Suara dan nada`, `## Format`, `## Topik`, `## Footage`, `## Batas isi`, `## Naskah`, `## publish.json`; contains literal `brand: { prefix: "Up", accent: "wayyy" }`, `mode: "footage"`, `npm run footage`, `--account upwayyy`, `Cuplikan: trailer resmi`. Topics file: every entry line matches `/^- ([a-z0-9-]+): (.+) — appid (\d+) — rilis (\d{4}-\d{2}) — (https:\/\/\S+)( https:\/\/\S+)*$/` and has ≥ 10 entries.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Write the brief** from the spec's "Content rules" and §6: tone B (serious story, aside in hook + one honest mid-video reaction, "gue/kamu"), spoiler warning, "recent" = Steam release within 12–18 months, facts only from WebFetch'd sources, theories labelled, atmosphere not gore; workflow order: pick game+angle → `npm run footage -- <slug> --appid <id>` **before** writing the script → if it fails or sources are thin, next game (max 3) else stop non-zero; one game may yield several videos with different angles; discover new releases via Steam store pages with WebFetch; stop and report when no unused game+angle remains; clip assignment: read `public/<slug>/clips.json`, distinct clip per shot, longer clips for longer lines, set `clipDur`; music mood per video; `tail ≤ 0.3`; `publish.json` description line. **Topics**: ≥ 10 Steam horror games released 2025-05 or later with app id and 1–2 lore sources, each verified by fetching the Steam appdetails API and the source URL while writing the plan's execution (no invented app ids).
  - `ops/ci-prompt.md`: add Upwayyy to the per-account file list and to deliverable 3 (`mode: "footage"`: `index.ts` + `shots.ts`, no `world.ts`/`state.ts`, plus `public/<slug>/clips/`).
  - `AGENTS.md`: mention Upwayyy + footage mode + `npm run footage` in the overview/commands/architecture; note clips are gitignored.
  - `ops/README.md`: Upwayyy setup steps (Buffer YouTube+TikTok ids into `src/accounts.ts`, GitHub Environment `upwayyy`, Suno tracks into `public/upwayyy/music/`, `workflow_dispatch -f account=upwayyy -f dry_run=true`, only then add to `wrangler.toml`).
- [ ] **Step 4:** `npm run lint && npm test` → PASS.
- [ ] **Step 5:** Commit `docs(upwayyy): channel brief, topics, CI prompt`.

### Task 7: End-to-end local proof

- [ ] **Step 1:** In a scratch slug (gitignored), run the real flow with `--account upwayyy`: `npm run footage` → write a ~5-line `naskah.txt`, `config.json` (`music: "misteri"`, `tail: 0.3`), `index.ts` + `shots.ts` per the brief → `npm run tts -- <slug> --account upwayyy` → `npm run timeline` → `npm run check-motion` → `npx tsx scripts/account-gate.mts --account upwayyy --slug <slug>` (expect only the missing-music-file problem if Suno tracks aren't in yet — drop a temporary silent `misteri.mp3` to finish, then delete it).
- [ ] **Step 2:** `npx remotion bundle --out-dir /tmp/rbundle`, `npx remotion still … --gl=swangle` one frame per shot; eyeball: footage full-bleed, red accents, captions inside SAFE area. Render once with `--gl=swangle` to confirm footage decodes in the CI renderer.
- [ ] **Step 3:** Delete the scratch slug and its `public/` folder; `git status` clean apart from committed work.
