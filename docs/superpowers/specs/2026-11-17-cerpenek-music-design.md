# Cerpenek Mood-Based Suno Background Music — Design

**Date:** 2026-11-17
**Scope:** Small change (Cerpenek automated pipeline only)

## Intent & Why

Replace the generic procedural lo-fi synth bed (`scripts/music.mts`) for Cerpenek videos with curated instrumental Suno AI tracks that match both the channel's warm Indonesian children's storytelling niche (ages 5–10, wooden-toy diorama) and the emotional tone of each story.

## Goals, Non-Goals & Anti-Goals

- **Goals:**
  - Support 5 mood tracks stored in `public/cerpenek/music/`: `ceria.mp3`, `hangat.mp3`, `petualang.mp3`, `nusantara.mp3`, `ajaib.mp3`.
  - Let the CI agent choose the fitting mood per story via `config.json` (`"music": "<mood>"`).
  - Automatically loop/trim the chosen track to `timeline.dur` with smooth fade-in (`0.5s`) and fade-out (`2.0s`) into `public/<slug>/music.wav` via `scripts/music.mts`.
- **Non-Goals:**
  - Changing background music for `kali-aja` or `ai-labs` (both keep the procedural synth bed unless `config.json.music` is set).
  - Calling external music APIs at CI runtime.
  - Modifying `src/engine/Explainer.tsx` or `.github/workflows/video.yml`.
- **Anti-Goals:**
  - Vocals or lyrics colliding with Indonesian narration.
  - Abrupt hard-cuts at the end of a video or silent tails when a track is shorter than `timeline.dur`.

## Constraints

- `ffmpeg` is installed on the CI runner (`ubuntu-latest`) and handles MP3 decoding, looping, fading, and 44.1 kHz stereo WAV output.
- Track loudness must be consistent with the existing `0.14` mix volume in `VideoDef.music.volume` so narration remains clearly intelligible.
- Generated `public/<slug>/music.wav` remains gitignored and cleaned up by `scripts/publish.mts`; committed `public/cerpenek/music/*.mp3` assets stay intact.

## Approaches Considered

- **Approach A (Chosen):** Store 5 Suno MP3s in `public/cerpenek/music/<mood>.mp3`, declare `"music": "<mood>"` in `src/videos/<slug>/config.json`, and have `scripts/music.mts` process the MP3 via `ffmpeg` (`-stream_loop -1`, trim to `timeline.dur`, fade-in/fade-out, normalized level) into `public/<slug>/music.wav`. Safe for variable 60–90s durations and zero changes to Remotion engine or CI workflow.
- **Approach B (Rejected):** Point `VideoDef.music.src` directly to `cerpenek/music/<mood>.mp3`. Hard-cuts at video end without fade-out and goes silent if track duration < `timeline.dur`.
- **Approach C (Rejected):** Host MP3s externally and download in CI. Breaks offline `npm run dev` and adds unnecessary failure modes.

## Design Summary

1. **Audio assets:** `public/cerpenek/music/{ceria,hangat,petualang,nusantara,ajaib}.mp3` (instrumental, committed to git).
2. **Video config:** `VideoConfig` in `scripts/lib.mts` gains optional `music?: string` (mood name or relative path under `public/cerpenek/music/`).
3. **Music builder (`scripts/music.mts`):** When `config.json` has `music`, resolve `public/cerpenek/music/<mood>.mp3`. If missing or unknown, fail clearly when explicitly requested on Cerpenek (or fall back to procedural synth when `config.music` is omitted). Use `ffmpeg` to loop/trim to `timeline.dur`, apply `afade=t=in:st=0:d=0.5` and `afade=t=out:st=<dur-2>:d=2`, normalize output gain to match the procedural bed (`-18 LUFS` / `-4.5 dBFS` peak ceiling), and write 16-bit 44.1 kHz stereo `public/<slug>/music.wav`.
4. **Agent instructions (`ops/accounts/cerpenek.md`):** Document the 5 mood choices and require `"music": "<mood>"` in `config.json` for every Cerpenek video.
5. **Account gate (`scripts/account-core.mts` / `scripts/account-gate.mts`):** Keep Cerpenek gate optional or validate `config.json.music` when present so invalid mood names fail fast before render.

## Left to the Builder

- Exact `ffmpeg` filter flags for consistent perceived loudness across the 5 Suno exports.
- Unit tests in `scripts/music.test.mts` covering mood resolution and `ffmpeg` argument construction.
