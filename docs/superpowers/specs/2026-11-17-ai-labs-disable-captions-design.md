# Disable On-Screen Captions on AI Labs — design

Date: 2026-11-17. Size: small change.

## Intent

AI Labs (`ai-labs`) uses 2D Dark Tech motion graphics where slides already display dense text (terminal cards, prompt cards, bento grids, comparisons). Burned-in karaoke captions at the bottom add visual clutter and duplicate text viewers can enable via platform auto-captions. Disabling on-screen captions for `ai-labs` keeps motion cards clean and frees vertical space, without changing `kali-aja` or `cerpenek`.

## Goals

- Suppress burned-in `<Captions>` for `ai-labs` videos while keeping `kali-aja` and `cerpenek` unchanged.
- Expand the `MotionStage` bottom safe bound from `y = 1230` to `y = 1480` when captions are disabled, staying clear of YouTube Shorts / TikTok bottom UI.
- Enforce `captions: false` on `ai-labs` videos in CI via `account-gate.mts` and document it in `ops/accounts/ai-labs.md`.

Non-goals: changing TTS, alignment, `timeline.json` schema (`chunks`), 3D `Callouts` bounds, or platform-level TikTok/YouTube post captions (`tiktokCaption`).

## Constraints

- `src/engine/` remains video-agnostic and must not import `src/accounts.ts`.
- Remotion renders frames out-of-order across shards; caption visibility and stage bounds must remain pure and deterministic.
- YouTube Shorts / TikTok bottom UI overlays occupy roughly `y = 1520..1920` (and right-edge action icons on the lower right).

## Approaches

1. **Per-video `captions?: boolean` flag + CI gate for `ai-labs` (picked).** `BaseVideoDef` adds optional `captions?: boolean` (default `true`). `Overlays` skips `<Captions>` when `video.captions === false`, `MotionStage` uses `NO_CAPTION_SAFE_BOTTOM = 1480` when `video.captions === false`, and `aiLabsVideoProblems` + `ops/accounts/ai-labs.md` require `captions: false`. Keeps `src/engine/` decoupled from `src/accounts.ts`.
2. **Hardcode caption hiding on `mode: "motion"` or read `src/accounts.ts` inside `Explainer`/`Overlays`.** Rejected: couples the video-agnostic engine to account config or prevents future motion videos from using captions.

## Design

- `src/engine/types.ts`: add `captions?: boolean` to `BaseVideoDef` (defaults to `true` when omitted).
- `src/engine/overlays/Overlays.tsx`: render `<Captions ... />` only when `video.captions !== false`.
- `src/engine/motion/math.ts` & `src/engine/motion/MotionStage.tsx`: export `NO_CAPTION_SAFE_BOTTOM = 1480` alongside `CAPTION_SAFE_BOTTOM = 1230`, and pass `video.captions === false ? NO_CAPTION_SAFE_BOTTOM : CAPTION_SAFE_BOTTOM` for `MotionStage` bottom clearance.
- `ops/accounts/ai-labs.md`: document `captions: false` in `src/videos/<slug>/index.ts` and update the vertical safe zone note from `y = 1230` to `y = 1480` (no burned-in captions).
- `scripts/account-core.mts`: extend `aiLabsVideoProblems` to require `captions: false` in `indexSource`.
- `scripts/motion.test.mts` & `scripts/account-core.test.mts`: add unit tests covering `NO_CAPTION_SAFE_BOTTOM`, `Overlays` caption suppression, and `aiLabsVideoProblems` rejecting missing `captions: false`.

## Left to the builder

- Exact wording of the updated `ops/accounts/ai-labs.md` lines and whether `Overlays` caption toggle is tested via React element check or helper extraction.

## Risks

- Bottom-right action buttons on YouTube Shorts / TikTok sit near the lower-right edge around `y = 1400..1520`; wide centered motion blocks that stretch down to `y = 1480` could have their bottom-right corner lightly grazed by platform icons. Verified on the first rendered still.

## Verification

`npm run lint`, `npm test`, and `npx remotion bundle`.
