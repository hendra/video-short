# Shorts Retention Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce 130-word scripts (not Cerpenek), trimmed VO silences, ≤ 3-token captions, a hook-tempo style hint, eased 3D shot cuts, and drop the AI Labs "deskripsi" CTA gate.

**Architecture:** Each rule lives where its owner already is: word cap in `scripts/account-core.mts` (called by `tts.mts`), silence trim in `scripts/lib-tts.mts` before alignment, chunk size in `scripts/timeline-core.mts`, camera blend in `src/engine/math.ts` used by `Explainer.tsx`.

**Tech Stack:** TypeScript, `tsx --test` (node:test), FFmpeg 8 `silenceremove`, Remotion + R3F.

**Spec:** `docs/superpowers/specs/2026-11-21-shorts-retention-rules-design.md`

## Global Constraints
- Word cap 130, whitespace tokens across all `readScript` lines; account `cerpenek` exempt.
- Inner silences ≤ 0.2 s, no leading silence, trailing silence 0.05 s; threshold −38 dB (matches `align-core` silencedetect).
- Caption chunks ≤ 3 tokens; spelled-out number runs stay one token.
- Camera blend window 0.3 s, `smooth` easing; motion mode untouched.
- Verification: `npm run lint` + `npm test`. No 60 fps, no SSML, no motion blur.

## Review Focus
- Script of exactly 130 words passes, 131 fails → pinned in Task 1.
- Audio with no silence at all must not be shortened or emptied → pinned in Task 2.
- First 3D shot (no previous shot) must not blend → pinned in Task 4.
- Shot shorter than 0.3 s: blend must still end at the new pose by the next shot → `blendPose(u≥1)` test in Task 4.
- Number run longer than 3 words still stays intact → existing Russell Hobbs test kept in Task 3.

---

### Task 1: 130-word cap in `npm run tts`

**Files:** Modify `scripts/account-core.mts`, `scripts/tts.mts`; Test `scripts/account-core.test.mts`

**Interfaces:** Produces `export const MAX_SCRIPT_WORDS = 130` and `export const scriptWordProblem = (account: Account, lines: string[]): string | null`.

- [ ] **Step 1: Failing tests** in `account-core.test.mts`, `describe("scriptWordProblem")`:
  - `kali-aja` with 130 words (`Array(130).fill("kata").join(" ")` split over 2 lines) → `null`.
  - `kali-aja` with 131 words → string containing `"131"` and `"130"`.
  - `cerpenek` with 200 words → `null`.
- [ ] **Step 2:** `npm test` → FAIL (not exported).
- [ ] **Step 3: Implement** in `account-core.mts`: count `lines.join(" ").split(/\s+/).filter(Boolean).length`; `account.id === "cerpenek"` → `null`; message in Indonesian like the other problems: `naskah ${n} kata, maksimal ${MAX_SCRIPT_WORDS} — pendekkan sebelum TTS`. In `tts.mts`, after the empty-script check and before `synthesizeAndPublish`: print the problem and `process.exit(1)`.
- [ ] **Step 4:** `npm test` → PASS; `npm run lint` → clean.
- [ ] **Step 5:** `git commit -m "feat(tts): reject scripts over 130 words (cerpenek exempt)"`

### Task 2: Trim VO silences before alignment

**Files:** Modify `scripts/lib-tts.mts`; Test `scripts/lib-tts.test.mts`

**Interfaces:** Produces `export const trimSilence = (srcPath: string, destPath: string): void` (MP3 in, MP3 out). `synthesizeAndPublish` calls it on `staging` right after `stageToMp3`, before `analyzeAlignment`, for every provider except the `elevenlabs`+`result.words` path (its timestamps would drift).

- [ ] **Step 1: Failing tests** in `describe("trimSilence")` (skip with a log if ffmpeg missing, like `stageToMp3`'s test). Build WAV with `wavOf` = 1 s silence + 1 s `pcmTone` + 1 s silence + 1 s tone + 1 s silence, stage to MP3, trim, then probe with `ffmpeg silencedetect=n=-38dB:d=0.03` (use `ffmpeg` from `align-core.mts`):
  - `trims inner pauses to ≤ 0.2 s and the tail to ~0.05 s`: no `silence_duration` > 0.25; output duration between 2.1 and 2.4 s; no silence starting at 0.
  - `leaves audio without pauses untouched`: 2 s continuous tone → duration within 0.1 s of input.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement** with one ffmpeg call, filter (verified locally on FFmpeg 8 → inner 0.20 s, tail 0.05 s):
  `silenceremove=start_periods=1:start_threshold=-38dB:stop_periods=-1:stop_duration=0.18:stop_threshold=-38dB,areverse,silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.05,areverse`
  (`stop_duration=0.18` because the 0.02 s detection window adds ~0.02 s.) Encode `libmp3lame -b:a 128k` like `stageToMp3`; throw if output missing. In `synthesizeAndPublish`, trim to a sibling temp file then rename over `staging`; a trim failure is recorded in `attempts` like a staging failure.
- [ ] **Step 4:** `npm test` → PASS (existing `tts.test.mts` publish tests must still pass on trimmed audio); `npm run lint`.
- [ ] **Step 5:** `git commit -m "feat(tts): trim VO pauses to 0.2s and tail to 0.05s before alignment"`

### Task 3: Captions ≤ 3 tokens

**Files:** Modify `scripts/timeline-core.mts` (`MAXW = 3`, header comment); Test `scripts/timeline-core.test.mts`

- [ ] **Step 1: Update tests first:**
  - Russell Hobbs: `["Russell Hobbs K1", "tahun", "seribu sembilan ratus lima puluh lima."]` — confirm by running; any split is acceptable only if every chunk ≤ 3 tokens and the number stays whole. Assert those two properties rather than an exact list if the packer gives a different but valid split.
  - `"Hanya dua puluh delapan meter."` → 3 tokens (`Hanya`, number, `meter.`) → stays one chunk.
  - `"Air panas mengalir ke atas melewati pipa kecil itu."` (9 tokens) → `["Air panas mengalir", "ke atas melewati", "pipa kecil itu."]`; rename test to "at most 3 tokens".
  - New: every chunk of a 40-word paragraph without numbers has ≤ 3 words.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** `MAXW = 3`; update comment "max 3 tokens".
- [ ] **Step 4:** `npm test` → PASS; `npm run lint`.
- [ ] **Step 5:** `git commit -m "feat(captions): max 3 tokens per caption chunk"`

### Task 4: Hook tempo hint + eased 3D shot cuts

**Files:** Modify `scripts/lib-tts.mts`, `src/engine/math.ts`, `src/engine/Explainer.tsx`; Test `scripts/lib-tts.test.mts`, `scripts/beat.test.mts`

**Interfaces:** Produces `export const HOOK_HINT: string` (lib-tts) and `export const blendPose = (from: CamPose, to: CamPose, u: number): CamPose` plus `export const CUT_BLEND = 0.3` (engine/math).

- [ ] **Step 1: Failing tests:**
  - `lib-tts.test.mts`: the two existing style assertions become `` `${style}; ${HOOK_HINT}` ``.
  - `beat.test.mts`, `describe("blendPose")`: `u=0` → `from`; `u=1` and `u=2` → `to`; `u=0.5` → position exactly midway (smooth(0.5)=0.5).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement:**
  - `HOOK_HINT = "kalimat pertama sedikit lebih cepat dan bertenaga; tekankan angka dan kata kunci"`; `speechMetadata.style` = `` `${tts.style}; ${HOOK_HINT}` ``.
  - `blendPose`: `lerp3` both position and target by `smooth(u)`.
  - `ThreeExplainer`: find `idx = video.timeline.shots.findIndex(s => s.id === span.id)`; if `idx > 0` and `t - span.s < CUT_BLEND`, `pose = blendPose(shots[prev.id].camera(span.s), shot.camera(t), (t - span.s) / CUT_BLEND)`; else `shot.camera(t)`. Pure in `t` (previous shot's pose is sampled at the fixed time `span.s`).
- [ ] **Step 4:** `npm test` → PASS; `npm run lint`.
- [ ] **Step 5: Eyeball** (only if a registered 3D video exists locally): `npx remotion bundle --out-dir /tmp/rbundle`, stills at shot start +0, +0.15 s, +0.3 s for one cut; camera mid-move, no blank/inside-geometry frame. Otherwise note "not eyeballed — no local video".
- [ ] **Step 6:** `git commit -m "feat: hook tempo style hint and 0.3s eased camera blend at 3D cuts"`

### Task 5: Drop AI Labs deskripsi gate + docs

**Files:** Modify `scripts/account-core.mts` (remove `lastThreeLines` + mentionsDeskripsi block; drop `naskahText` param if now unused, and its pass-through in `scripts/account-gate.mts`), `scripts/account-core.test.mts`, `ops/accounts/ai-labs.md`, `ops/accounts/sastra-mesin.md`, `ops/accounts/cerpenek.md`, `docs/AUTOPILOT.md`, `AGENTS.md`

- [ ] **Step 1: Tests:** delete the "rejects PromptCard when neither CTA nor … deskripsi" test; in remaining PromptCard tests drop the deskripsi setup; add `accepts PromptCard without any deskripsi mention when description has Prompt siap copy` → `[]`.
- [ ] **Step 2:** remove the gate code; `npm test` → PASS; `npm run lint`.
- [ ] **Step 3: Docs** (wording free, values fixed):
  - `AGENTS.md`: caption rule "≤ 3 tokens per chunk"; "verify 45–55 s" (Cerpenek: its own brief); mention 130-word cap (not Cerpenek), VO pause trim, and 0.3 s 3D cut blend.
  - `docs/AUTOPILOT.md` (Kali Aja): duration 45–55 s, ≤ 130 words, 4-act structure (hook 0–4 s, context + re-hook, twist + re-hook, seamless-loop ending whose last sentence flows into the first), no end CTA (§ line 57, shot-terakhir line 116 "+ CTA" removed), captions ≤ 3 tokens (line 113), keep description CTA in metadata (line 140) as-is.
  - `ops/accounts/ai-labs.md`: remove both deskripsi-CTA rules (lines 43, 122 tail); flow `hook → isi → payoff → loop ending`; 45–55 s, ≤ 130 words (replace 1.100–1.400 karakter).
  - `ops/accounts/sastra-mesin.md`: 45–55 s, ≤ 130 words (replace 900–1.300 karakter / 60–90), loop ending instead of end CTA, captions ≤ 3.
  - `ops/accounts/cerpenek.md`: only caption line 135 → ≤ 3 tokens; length/CTA unchanged.
- [ ] **Step 4:** `npm run lint && npm test` → clean.
- [ ] **Step 5:** `git commit -m "feat: drop ai-labs deskripsi CTA gate; docs for 45-55s loop-ending shorts"`
