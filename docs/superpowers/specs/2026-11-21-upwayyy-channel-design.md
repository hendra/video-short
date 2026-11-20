# Upwayyy — horror game lore Shorts (design)

Date: 2026-11-21 · Status: draft, awaiting approval

## Intent

Revive **Upwayyy**, an existing YouTube gaming channel (≈18,000 subscribers, dormant for a long time; previously gameplay-with-commentary, funny-moment compilations, reviews) as the pipeline's 5th account. New content: vertical Shorts telling the **lore/story of recent horror games**, cut over **official Steam trailer footage**, narrated in Indonesian in Upwayyy's personal gamer voice.

Why: the 18k subscribers are the channel's biggest asset and they came for a personality. The format must feel like "Upwayyy is back", not "the channel was sold to a lore farm".

## Goals

- Fully automated, same CI flow as the other accounts (cron → build → render shards → publish via Buffer).
- Each video: one recent horror game, its story/lore told accurately, over real game footage.
- Narration tone **B**: story told seriously, plus 1–2 personal gamer asides (in the hook and one honest reaction mid-video), e.g. *"Jujur, gue kira ini cuma game vampir biasa. Ternyata…"*.

## Non-goals

- No 3D diorama / motion graphics for this account.
- No games outside Steam (console/mobile exclusives are skipped).
- No old games; no unreleased games as the main format.
- No contact-sheet / vision-model clip picking (approach B — can be layered on later).
- No user-supplied clip folders.

## Anti-goals (failure even if it "works")

- Copyright strikes / channel risk: never download from YouTube or third-party uploads; never use trailer audio.
- Invented lore: names, events, endings not in a fetched source. Fan theories presented as fact.
- Gore-heavy narration that gets videos limited-ads.
- Asides so frequent the horror mood disappears.

## Constraints (from the repo)

- Account config in `src/accounts.ts`; one CI run = one account; `publish.json.account` routes publishing.
- All visuals must be a pure function of `t`; timing bound to script lines via `L(n)`.
- Caption, SAFE-area, ≤130-word script, loop-line ending, `tail ≤ 0.3 s` rules from `AGENTS.md` apply.
- Agent model in CI is text-only (`deepseek-v4.1-flash-free`); WebSearch is unavailable, WebFetch is.
- `public/<slug>/…` is copied into the Remotion bundle, which is what render shards download — clips need no extra artifact.

## Content rules (go into `ops/accounts/upwayyy.md`)

- **"Recent game"**: released on Steam within the last 12–18 months, with a complete story summary available (wiki/Fandom, story-recap/"explained" articles from game media, official pages).
- Facts only from sources the agent fetched; theories labelled as theories ("teorinya…").
- Short spoiler warning in Upwayyy voice near the start ("spoiler dikit ya").
- Horror through atmosphere; no detailed blood/violence descriptions.
- Length per existing rules: 45–55 s, ≤130 words, ends with a loop line.
- Narrator: AI male voice, casual (`id-id-podcaster-1`, style "santai, akrab, seperti teman gamer bercerita; serius saat cerita seram").
- Description line: `Cuplikan: trailer resmi <Game> (Steam). Suara: AI (Google AI Studio).` + source + hashtags.
- Topic backlog `ops/topics/upwayyy.md`: game name, Steam app id, release date, lore source URLs. Agent may also add a newly released game if it has a Steam page and fetchable story sources.
- Own `pick-format` pool (e.g. lore-recap, ending-explained, villain-origin, hidden-detail, timeline) — all story arcs, not listicles.

## Approaches considered

- **A. New `footage` mode in the existing engine — chosen.** Fetch Steam trailers, split into clips, play one clip per shot via Remotion `Video`, reuse overlays/captions/audio/publish. Smallest change, keeps every existing rule, renders far faster than 3D. Trade-off: clip choice is automatic, so footage matches the mood, not necessarily the exact sentence.
- **B. A + agent picks clips from a thumbnail contact sheet.** Better sentence/clip match, but the CI model is text-only; would need a (likely paid) vision model. Deferred.
- **C. Separate ffmpeg assembly, Remotion only for overlays.** Duplicates the render/overlay path and loses line-sync, gates and sharding. Rejected.

## Design (approach A)

### 1. Account
- `src/accounts.ts`: add `"upwayyy"` to `AccountId`/`ACCOUNT_IDS`/`ACCOUNTS`. Brand `{ prefix: "Up", accent: "wayyy" }`, `youtubeCategoryId: "20"` (Gaming), `madeForKids: false`, tts as above, agent files `AGENTS.md`, `ops/ci-prompt.md`, `ops/accounts/upwayyy.md`, `ops/topics/upwayyy.md`. Buffer ids start as `TODO_` placeholders (the existing `--require-configured` guard blocks publishing until filled). TikTok channel id required by the type → TODO until the user connects one.
- `video.yml`: add `upwayyy` to the account input description/options; a GitHub Environment `upwayyy` with the Buffer secrets.
- `scripts/music.mts`: `MOODS_BY_ACCOUNT.upwayyy` (see §6).
- `pick-format.mts`: `UPWAYYY` pool.
- `ops/ci-prompt.md`: list the Upwayyy files and the footage-mode deliverables.

### 2. Footage fetcher — `scripts/fetch-footage.mts`
`npx tsx scripts/fetch-footage.mts <slug> --appid <steamAppId>`
1. GET `https://store.steampowered.com/api/appdetails?appids=<id>&filters=movies` (public, no key). Fail clearly if `success:false` or no movies.
2. Take up to N trailers (prefer `highlight`), download the HLS/DASH H.264 stream with `ffmpeg`, **no audio** (`-an`).
3. Drop the first/last few seconds of each (logos, ratings, title cards).
4. Split on scene changes (`ffmpeg` `select='gt(scene,…)'`), keep clips ≥ ~1.5 s, re-encode 1080-wide H.264, write `public/<slug>/clips/NN.mp4` plus `public/<slug>/clips.json` (`[{file, dur, trailer}]`).
5. Fail (non-zero) if fewer clips than the video needs.
Pure parsing/selection logic in a `-core.mts` with node:test tests (mocked API JSON, scene-cut list → clip list).
`public/*/clips/` gitignored like `vo.mp3`.

### 3. Engine — `mode: "footage"`
- `types.ts`: `VideoDefFootage = BaseVideoDef & { mode: "footage"; shots: (ctx) => Record<string, FootageShotDef> }`, `FootageShotDef = { label, title, tag?, clip: string /* path in public */, from?: number /* s into clip */, zoom?: [number, number], chip?, callouts? }` — mirrors `MotionShotDef` so `Overlays` works unchanged.
- `Explainer.tsx`: a `FootageExplainer` that renders the current shot's clip with `@remotion/media` `Video` (muted, `objectFit: cover`, center-cropped to 9:16, slow zoom from `zoom` as a pure function of `t`), clip time = `from + (t − span.s)`; loops/holds the last frame if the shot outlasts the clip. Short cross-fade at cuts reusing the existing cut timing. Then `<Overlays>` + audio as the other modes. Theme: **new `"upwayyy"` overlay theme = `dark-tech` layout with Upwayyy's red-and-white identity** (user decision after the sample): every mint/cyan accent (label, title highlight, active caption word + underline, brand accent, CTA/badge borders) becomes red `#ff2a2a`; text stays white. Approved look: sample render `/tmp/opencode/upw/upwayyy-sample.mp4` (spike branch `spike/upwayyy-sample`). Also crop out the publisher logo corner (e.g. "KONAMI") when the trailer has one.
- `audioOnly` path unchanged.

### 4. Gates
- `account-core.mts` / `account-gate.mts`: `upwayyyVideoProblems` — must be `mode: "footage"`, no `world.ts`, every shot `clip` exists under `public/<slug>/clips/`, description contains the `Cuplikan: trailer resmi` + `Suara: AI` line. Tests alongside the existing account-core tests.
- `check-motion` / `check-sync`: confirm they accept or skip footage mode; extend minimally if they assume 3D/motion.

### 5. Docs
`AGENTS.md` (accounts list, footage mode, footage fetch step), `ops/README.md` runbook, `docs/PUBLISHING.md` if category/Buffer notes change.

### 6. Decisions from the user (after builder check)
- **Platforms: YouTube + TikTok** (both required, as for other accounts; no "optional TikTok" change). Account stays blocked by the existing `--require-configured` guard until both ids are filled.
- **Music: user-made Suno tracks.** `MOODS_BY_ACCOUNT.upwayyy = ["mencekam", "misteri", "klimaks"]`; files at `public/upwayyy/music/<mood>.mp3`, committed like other accounts' tracks. The brief tells the agent to pick the mood per video. Suno prompts are supplied to the user separately. Licence note: monetized use needs a paid Suno plan at generation time.
- **Cadence: YouTube 2×/day, TikTok 3×/day** — this is exactly the existing slot system (3 slots; pagi has no YouTube post). No scheduler change; add `upwayyy` to `ops/cloudflare-cron/wrangler.toml` `ACCOUNTS` only after Buffer ids + GitHub Environment exist. Before that: manual `workflow_dispatch` with `dry_run=true`.
- **Backlog depth (consequence of cadence, my call):** 3 runs/day exhausts "recent Steam horror games" quickly, so one game may yield several videos with different angles (format pool: lore recap, ending explained, villain origin, hidden detail, timeline, character story). Duplicate gate still rejects same game + same angle. The brief tells the agent to also discover newly released Steam horror games (Steam store search / tag pages via WebFetch) and add them to its working list, and to stop and report when no unused game+angle with sources remains.
- **Short footage / sources (my call, user did not object):** agent runs `fetch-footage` *before* writing the script; if clips or lore sources are insufficient, switch game (max 3 tries), else stop non-zero. No clip used twice in one video (gate rule).

## Left to the builder

- Exact scene threshold, trim seconds, number of trailers, min clip length.
- Clip-to-shot assignment heuristic the agent follows (e.g. distinct clips per shot, no repeats, prefer longer clips for longer lines).
- Whether `Video` or `OffthreadVideo` renders more reliably under `--gl=swangle` shards (measure).
- Format pool wording.

## Open items for the user

- Connect Upwayyy YouTube + TikTok to Buffer, create GitHub Environment `upwayyy`, supply org/channel ids.
- Generate the 3 Suno tracks and drop them at `public/upwayyy/music/{mencekam,misteri,klimaks}.mp3`.
- Initial backlog: any must-have games.
