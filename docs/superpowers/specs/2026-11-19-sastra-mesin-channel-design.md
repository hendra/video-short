# SASTRA MESIN — channel design

**Date:** 2026-11-19
**Scope:** Project — 4th channel account + a 3rd overlay theme.

## Intent & why

A new channel, **SASTRA MESIN** ("Cerita di Balik Cara Kerja Benda"), with its own YouTube + TikTok accounts.
It explains how **everyday objects** work (rice cooker, zipper, kulkas, kunci pintu, …) for a general
Indonesian audience, through 3D cutaways built in code. It must have its **own identity**: it must not
look or sound like Kali Aja Tau, which also makes 3D cutaway science explainers.

## Goals

- A `sastra-mesin` account that runs through the existing CI pipeline (cron → build → render → publish),
  scoped like Cerpenek and AI Labs.
- Its own look: the light "blueprint" overlay theme (approved still: `/tmp/opencode/sm-blueprint.jpg`).
- Its own voice: Gemini `id-id-tutor-1` (female, warm, standard Indonesian).
- Its own narrative format pool, so scripts do not follow Kali Aja's structures.
- Strict niche: everyday objects only, every fact from a source that was read.

## Non-goals

- A separate engine or scene folder structure (`scenes/Scene01Hook.tsx`, `three/` …). The existing
  Three.js + Remotion engine already does this.
- Sound effects, Instagram publishing, 2-line captions, a fixed 6-scene arc (repository rules win over
  the original brief — see Constraints).
- Shared SASTRA MESIN 3D helpers in `kit.ts` (deferred until real renders show the look drifting).

## Anti-goals

- Looking like Kali Aja (cream overlay, green highlight, dark pill brand, rounded white callouts, cream flash).
- AI-generated images/video anywhere in the visuals.
- Topics outside everyday objects (industrial machines, aircraft, power plants, tech news).
- Invented component names, numbers or mechanisms.

## Constraints (repository rules that override the original brief)

- 60–90 s per video, ≤ 5 tokens per caption chunk, single caption chunk at a time, caption at y≈1270,
  SAFE areas unchanged, callout anchors between header bottom and y≈1240, max 3 callouts per shot.
- Narrative format is drawn per run by `scripts/pick-format.mts`; CTA always at the end.
- YouTube + TikTok only, via Buffer. No new dependencies.
- Render cost rules from `AGENTS.md` (no env maps, bump maps, post-processing).
- Background music is required per account (`config.json.music` from the account's mood list).

## Approaches

1. **New account on the existing 3D engine + a new overlay theme** — *picked.* Same mechanism as Cerpenek /
   AI Labs; the identity lives in one theme, one brief, one format pool. Episode models are still built
   per run, so 3D detail can vary between videos.
2. Same as 1 plus SASTRA MESIN 3D helpers in `kit.ts` (cutaway shell, flow arrows, palette materials) —
   more consistent, but designs engine API before any real episode exists. Deferred.
3. A separate scene architecture as in the original brief — duplicates the engine. Rejected.

## Design

### Account (`src/accounts.ts`)

```ts
"sastra-mesin": {
  id: "sastra-mesin",
  label: "Sastra Mesin",
  brand: { prefix: "Sastra ", accent: "Mesin" },
  buffer: { orgId: "TODO_…", youtubeChannelId: "TODO_…", tiktokChannelId: "TODO_…" },
  youtubeCategoryId: "27", // Education
  madeForKids: false,
  tts: { voice: "id-id-tutor-1", style: "ramah, jelas, penasaran; seperti teman pintar yang menjelaskan sesuatu yang seru; tempo sedang" },
  agent: { model: "opencode/inkling-2-small-free", prompt: "…brief + topics, AUTOPILOT does NOT apply…",
           files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/sastra-mesin.md", "ops/topics/sastra-mesin.md"] },
}
```

Buffer ids stay `TODO_` until the operator creates the channels; `--require-configured` already blocks
any run (and therefore publishing) for an unconfigured account. Added to `ACCOUNT_IDS`.

### Overlay theme `blueprint` (engine)

- `OverlayTheme` gains `"blueprint"`; `theme?` moves from `VideoDefMotion` to the shared base so 3D videos
  can pick it (3D default stays `cream`, motion default stays `dark-tech` — existing videos unchanged).
- `ThreeExplainer` uses the theme's background (drafting paper `#F4F5F6` + faint cyan grid) and passes
  `theme` to `Overlays`.
- `Overlays.tsx` renders the blueprint frame (implementation = the spike diff
  `/tmp/opencode/sm-blueprint-spike.diff`, cleaned up):
  - brand row top-left: gear icon + `SASTRA` navy + `MESIN` cyan (mono); shot label top-right as a part number;
  - title navy, highlighted word cyan, orange underline bar;
  - chip as a drawing title block (thin navy frame, vertical key, orange unit);
  - callouts numbered ①②③, dashed leader, coloured left bar (cyan default, orange focus, red danger);
  - captions white box + navy frame, active word underlined cyan (same position, size, chunking);
  - shot cut = cyan scan line sweeping down for 0.45 s (no cream flash);
  - callout top bound shifted down by the brand row height.
- Palette: navy `#101820` (text), cyan `#20C9C3` (flow/energy/water/air/electric), orange `#FF8A36`
  (heat/moving parts), steel `#81909C` (structure/inactive), paper `#F4F5F6`.

### Format pool (`scripts/pick-format.mts`)

`SASTRA_MESIN` pool, weighted, every format ends with CTA and opens with a 2–3 s hook:
- `bongkar-pasang` (3) — open the object layer by layer, outside → core part → how it moves.
- `satu-komponen` (3) — one surprising part is the whole secret; what happens without it.
- `ikuti-alirannya` (2) — follow energy/water/air from button to result.
- `mitos-benda` (2) — a common belief about the object → the mechanism → why it's wrong.
- `dulu-vs-sekarang` (1) — older mechanism vs today's, same job.
- `kenapa-bunyi` (1) — start from a sound/click/smell users notice → what part makes it.

### Channel brief `ops/accounts/sastra-mesin.md`

Like Cerpenek, the brief **overrides `ops/ci-prompt.md` where they differ** (length, scenes, CTA,
description), and the account's agent prompt says so. Content: brand line, voice command (`npm run tts -- <slug> --account sastra-mesin`), allowed / excluded categories
(from the original brief), research rules (read sources with WebFetch, no invented numbers, say
"umumnya" when designs differ by model), script rules (plain Indonesian, explain each technical term
right away with an analogy, numbers spelled out), 3D rules (`theme: "blueprint"`, palette semantics,
cutaway/exploded views, mechanically linked motion, `ILUSTRASI` tag for simplified internals), music
moods, `publish.json` shape (description with `Sumber:` + AI voice line + hashtags), backlog refill.

### Niche (from the user's original brief)

Allowed categories — the brief and backlog use exactly these six:
- **A. Peralatan rumah tangga:** kulkas, AC, mesin cuci, vacuum cleaner, kipas angin, televisi, dispenser.
- **B. Dapur:** rice cooker, microwave, blender, ketel listrik, mesin kopi, pemanggang roti, filter air.
- **C. Benda pribadi:** jam tangan mekanik, kacamata, ritsleting, payung, pulpen, kunci pintu, gunting.
- **D. Elektronik sehari-hari:** smartphone, baterai, charger, earphone, remote TV, mouse, keyboard, lampu LED.
- **E. Utilitas rumah:** toilet, keran air, shower, bel pintu, saklar lampu, pompa air, stopkontak.
- **F. Transportasi sehari-hari:** rem sepeda, gigi sepeda, helm, sabuk pengaman, speedometer, kaca spion.

Excluded: industrial/factory machines, heavy equipment, aircraft engines, power plants, ships/submarines,
large engineering projects, tech news, abstract science without an everyday object. Off-niche topic →
pick another backlog item.

Script rules from the brief: plain everyday Indonesian, short sentences, one concept at a time; a
technical term is named, explained immediately, then given an analogy; no exaggeration; distinguish
verified fact, simplification, and illustration; if designs differ by model, explain the general
mechanism ("umumnya…"). Visual rule: every mechanism the narration mentions is shown at that moment;
mechanically linked parts move together; no decorative motion that misrepresents the mechanism.

### Topic backlog `ops/topics/sastra-mesin.md`

~30 everyday objects across the six allowed categories, one line each with a source URL, same line format
as the other backlogs so `topics.test.mts` can check slugs/URLs.

### Music

New mood list `sastra-mesin: [...]` in `scripts/music.mts`, tracks committed under
`public/sastra-mesin/music/<mood>.mp3`. **Open: the tracks themselves** (see below).

### Wiring

- `ops/cloudflare-cron/wrangler.toml` `ACCOUNTS` + `.github/workflows/video.yml` account input description.
- A GitHub Environment `sastra-mesin` with the Buffer token (operator, outside the repo).
- `scripts/duplicate-core.mts` stopwords for the brand words.
- `ops/ci-prompt.md` per-account list + "3D channels" list.
- Docs: `AGENTS.md`, `README.md`, `ops/README.md`, `docs/PUBLISHING.md` mention the 4th account.

### Account gate (`scripts/account-gate.mts` / `account-core.mts`)

A `sastraMesinVideoProblems` check like `aiLabsVideoProblems`: the video must be 3D (has `world.ts`, not
`mode: "motion"`) and `index.ts` must set `theme: "blueprint"`. Music mood is already checked per account.
A missing line therefore fails the run instead of quietly publishing Kali Aja's look.

### Tests

- `accounts.test.mts`: account present, voice/style locked, Buffer ids may be TODO (unconfigured).
- `pick-format.test.mts`: pool exists, ids unique, weights positive.
- `topics.test.mts`: brief exists and carries the account id + tts command; backlog lines well-formed,
  unique slugs, https sources.
- `music.test.mts`: mood list resolves.
- `account-core.test.mts`: gate rejects missing `theme: "blueprint"` and motion mode; accepts a valid video.
- Overlay: existing `layoutLabels` tests unchanged; verification of the theme is a rendered still.

## Left to the builder

Exact gear icon path, the scan-line easing, per-theme callout top offset value, backlog contents, the
final mood names.

## Decisions (user, 2026-11-19)

- **Duplicates:** checked against SASTRA MESIN's own catalog only (no cross-channel lookup).
- **Schedule:** same 6 daily slots as the other channels (`ACCOUNTS` in `wrangler.toml`).
- **Music:** the user generates the MP3s on Suno from the prompts below and commits them to
  `public/sastra-mesin/music/<mood>.mp3`. The account must not go live (Buffer ids are still `TODO_`)
  before all three files exist; `account-gate` already fails a run whose mood file is missing.

Moods — `rakit`, `aliran`, `rahasia`:

- `rakit` (take apart / build): *Instrumental, no vocals. Light playful mechanical pop, 100 BPM, plucked
  marimba and muted guitar, soft clock-tick percussion, warm bass, curious and bright, sparse mid-range so a
  female voiceover stays clear, loopable, no drops, no build-ups.*
- `aliran` (flow of water / air / energy): *Instrumental, no vocals. Calm flowing electronic, 90 BPM, soft
  arpeggiated synth pluck, gentle pad, light brushed drums, clean and airy, steady energy, leaves room for
  narration, loopable, no drops.*
- `rahasia` (surprising hidden part / myth): *Instrumental, no vocals. Curious light suspense, 95 BPM,
  pizzicato strings and celesta, soft low pulse, a hint of wonder rather than tension, uncluttered
  mid-range for voiceover, loopable, no drops.*
