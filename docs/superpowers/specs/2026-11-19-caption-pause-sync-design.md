# Caption / audio sync: pauses anchor word boundaries — design

## Why
Captions and karaoke highlights run ahead of the voice on every channel (kali-aja, cerpenek, ai-labs, sastra-mesin).
Measured on the Sastra Mesin "mouse" reel (Instagram Df6Czw7kzjP) and on `karbon-norwegia`: video/audio streams
are clean (30 fps, both start at 0, durations match, shard frame count verified in CI), but chunks start up to
0.5 s inside a silence (e.g. "jadi kursor tersendat dan" lit at 35.27 s, speech starts 35.80 s) and 26 words
in karbon-norwegia straddle a real pause.

## Root cause
`scripts/align-core.mts` `pairPhrases` only lets a pause land at a punctuation mark and charges nothing for a
pause left inside a block. Gemini also pauses mid-phrase, and with several commas the duration-only DP can pin a
pause to the wrong comma. Words are then spread by syllables across the pause → they start in silence (early) or
a whole run of words shifts (late, then early). Render, shards, FFmpeg and loudnorm are not involved.

## Approaches
- **A (picked):** every word boundary may take a pause; punctuation earns a bonus; a pause left inside a block
  costs its length. Fixes both failure modes, ~same code, no dependency.
- B: only snap word starts out of silences. Fixes early starts, not mis-pinned pauses. Rejected.
- C: model-based forced alignment. Best word accuracy, heavy new CI dependency. Rejected for now.

## Design
- `pairPhrases(ws, segs)` keeps its signature/return (blocks `[w0, w1, s0, s1]`). Candidate block ends = every
  word boundary. Block cost = `(speech - expected)^2 / expected + GAP_COST * (silence inside the block)`;
  cut reward `CUT_REWARD` only when the word before the cut ends a phrase. `GAP_COST = 1` (per second).
- Speech segmentation moves out of `analyzeAlignment` into `speechSegments(audioPath)` (same silencedetect
  settings), reused by the check.
- New gate `scripts/check-sync.mts <id>`: from `vo.mp3` + `timeline.json`, fail when a caption chunk starts
  > 0.15 s before its speech resumes, or a word spans > 0.15 s of silence. Runs in CI `Gates` for every account.
- Line-level DP, `build-timeline`, Remotion, shards, FFmpeg unchanged. The 0.05 s caption lead stays.

## Non-goals
Canonical WAV master, FFmpeg/shard changes, new aligner dependency, re-publishing old videos.

## Left to the builder
Exact log wording of the gate.
