# AI Labs & Kali Aja Mood-Based Suno Background Music — Design

**Date:** 2026-11-17
**Scope:** Small change (extend `scripts/music.mts` + `account-gate` from Cerpenek to `ai-labs` and `kali-aja`)

## Intent & Why

Replace the generic procedural lo-fi synth bed in `scripts/music.mts` for **AI Labs** and **Kali Aja Tau** with curated instrumental Suno AI tracks tailored to each channel's niche and video topic mood, matching the existing Cerpenek pipeline.

## Goals, Non-Goals & Anti-Goals

- **Goals:**
  - Support 3 mood MP3s per channel:
    - `public/ai-labs/music/`: `build.mp3`, `debug.mp3`, `showcase.mp3`
    - `public/kali-aja/music/`: `teknik.mp3`, `misteri.mp3`, `fenomena.mp3`
  - Keep `"music": "<mood>"` in `src/videos/<slug>/config.json`.
  - Resolve the account via `publish.json.account` (or fallback to `DEFAULT_ACCOUNT` if `publish.json` is absent) inside `scripts/music.mts`, and keep the procedural synth fallback only when `config.json.music` is omitted.
  - Validate `config.json.music` in `account-gate.mts` for `ai-labs` and `kali-aja` (matching `cerpenek`).
  - Document `## Musik latar` in `ops/accounts/ai-labs.md` and `docs/AUTOPILOT.md`.
- **Non-Goals:**
  - Changing `cerpenek` moods, `src/engine/Explainer.tsx`, or `.github/workflows/video.yml`.
  - Calling external music APIs at CI runtime.
- **Anti-Goals:**
  - Vocals, harsh high-frequency synths, or sub-heavy drops competing with the male voiceover (`id-id-podcaster-1`).

## Constraints

- `ffmpeg` handles looping/trimming (`-stream_loop -1`, `-t <dur>`), `loudnorm=I=-18:TP=-4.5:LRA=7`, `0.5s` fade-in, `2.0s` fade-out, and 44.1 kHz stereo WAV output.
- In CI, `publish.json` is written by the agent before `account-gate` and `scripts/music.mts --missing`, so `publish.json.account` is always available during builds.

## Approaches Considered

- **Approach 1 (Chosen):** Per-account folders `public/<account>/music/<mood>.mp3` (`MOODS_BY_ACCOUNT` map in `scripts/music.mts`), resolved using `publish.json.account` (defaulting to `DEFAULT_ACCOUNT` only when `publish.json` does not exist). Keeps `config.json` clean (`"music": "<mood>"`) and preserves Cerpenek untouched.
- **Approach 2 (Rejected):** Prefixing `config.json.music` with `<account>/<mood>`. Redundant with `publish.json.account` and inconsistent with Cerpenek.
- **Approach 3 (Rejected):** Shared `public/music/` folder across channels. Blurs channel identity and loosens per-channel mood gating.

## Design Summary

1. **Mood registry (`scripts/music.mts`):** Replace `CERPENEK_MOODS` single-channel resolution with `MOODS_BY_ACCOUNT: Record<AccountId, readonly string[]>` (`cerpenek`: 5 existing moods; `ai-labs`: `build`, `debug`, `showcase`; `kali-aja`: `teknik`, `misteri`, `fenomena`), plus `musicDirFor(accountId)` → `public/<accountId>/music`. Keep `CERPENEK_MOODS` exported (or derived) so existing callers/tests don't break.
2. **Account lookup in `scripts/music.mts`:** Read `publish.json` in `videoDir(id)` when `config.music !== undefined`; pass `accountById(pub?.account)` to `resolveMusicTrack(cfg.music, accountId)`. Also guard `safeDur` with `Number.isFinite(dur)`.
3. **Gate (`scripts/account-core.mts`, `scripts/account-gate.mts`):** Generalize `cerpenekMusicProblems` → `accountMusicProblems(configJson, accountId)` (keep `cerpenekMusicProblems` or update its callers/tests) and enforce `config.json.music` for all 3 accounts in `account-gate.mts`.
4. **Instructions:** Add `## Musik latar` to `ops/accounts/ai-labs.md` and update `docs/AUTOPILOT.md` §5/§6 with the 3 moods for Kali Aja Tau.

## Left to the Builder

- Exact test cases in `scripts/music.test.mts` and `scripts/account-core.test.mts` covering all 3 accounts and non-finite `dur`.
