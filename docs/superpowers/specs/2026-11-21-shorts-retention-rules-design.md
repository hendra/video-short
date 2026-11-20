# Shorts retention rules — design (small change)

**Why:** raise APV / viewed-vs-swiped on all four channels with tighter scripts, no dead air, and shorter captions.

## Goals
- `npm run tts` refuses a script over **130 words** before any Gemini call (no quota burned). **Cerpenek exempt.**
- Voiceover silences trimmed automatically: inner pauses ≤ **0.2 s**, no leading silence, trailing silence **0.05 s** (clean loop seam). All channels.
- Caption chunks ≤ **3 tokens** (was 5). Spelled-out number runs stay one token (may exceed 3 words). All channels.
- AI Labs: drop the PromptCard "CTA must mention deskripsi" gate.
- Docs: Kali Aja / AI Labs / Sastra Mesin target 45–55 s and a seamless-loop ending instead of an end CTA; caption rule ≤ 3.

- Hook tempo (SSML substitute): Gemini TTS takes no SSML, only a style prompt. `synthesizeGemini` appends one shared hint to every account's style: first sentence slightly faster and punchier, stress numbers and key words. Best effort, not measurable.
- Smooth cuts (motion-blur substitute): 3D shots currently hard-cut. Over the first 0.3 s of a shot the camera blends from the previous shot's end pose to the new shot's pose with `smooth` easing (same world, so this reads as a fast camera move, zero extra render cost). Motion mode already has 0.36 s eased transitions — unchanged.

## Non-goals
60 fps (doubles CI render time), BGM ducking/SFX, real SSML (Gemini rejects it; Azure is locked out), real motion blur (5–10× render time, breaks the GitHub job limit), per-account config in `src/accounts.ts`, changing Cerpenek's story length/ending rules.

## Approaches
- **A (picked):** each rule where its owner already lives — word cap in `account-core.mts` (`scriptWordProblem(account, lines)`, called from `tts.mts`), trim in `lib-tts.mts` before `analyzeAlignment`, `MAXW = 3` in `timeline-core.mts`.
- B: per-account limits in `accounts.ts` — config for values that are identical today. Rejected.
- C: trim in CI publish — audio would drift from `timeline.json`. Rejected.

## Design
- **Trim (as built):** `silencedetect` (−38 dB, matches `align-core`) finds pauses > 0.2 s; they're cut with `atrim`+`concat` (head dropped, inner pauses → 0.2 s, tail → 0.05 s). The aligner runs on the **raw** take (line breaks are still the longest pauses there) and word times are mapped onto the trimmed file with the returned time map. Account gate also caps `config.json` `tail` at 0.3 s (not Cerpenek) so the video itself loops.
- **Word cap:** count whitespace tokens across `readScript` lines; over 130 and account ≠ cerpenek → exit 1 with the count.
- **Captions:** `MAXW` 5→3; update `timeline-core.test.mts` expectations; `MAX_NUM_WORDS`/char budget unchanged.
- **AI Labs:** remove the deskripsi check + its tests; update `ops/accounts/ai-labs.md`.
- **Hook tempo:** constant `HOOK_HINT` in `lib-tts.mts`, sent as `${tts.style}; ${HOOK_HINT}`; update the style assertions in `lib-tts.test.mts`.
- **Camera blend:** in `Explainer.tsx` 3D path, if the active shot isn't the first and `t - span.s < 0.3`, pose = lerp of `prevShot.camera(span.s)` → `shot.camera(t)` by `smooth(u)`. Helper `blendPose` in `engine/math.ts` with a unit test (u=0 → prev pose, u≥1 → new pose).
- **Docs:** `AGENTS.md`, `docs/AUTOPILOT.md`, `ops/ci-prompt.md` (60–90 s → 45–55 s, end CTA → loop ending, captions ≤ 3). Cerpenek's file overrides as today.

## Left to builder
Exact trim threshold if −38 dB eats soft word endings (verify on one real take), wording of doc edits.

## Proof
`npm run lint`, `npm test`, unit tests for word cap and 3-token chunks, one trim test on a synthetic WAV with long silences (ffprobe duration).
