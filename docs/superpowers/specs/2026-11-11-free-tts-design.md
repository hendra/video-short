# Design: Replace ElevenLabs with free, API-based TTS (Gemini-first)

**Date:** 2026-11-11
**Status:** Approved 2026-11-11

## Intent / why

The channel's voiceover pipeline (`npm run tts`) is ElevenLabs-only. The free ElevenLabs tier doesn't provide usable API access, so voiceovers are made by hand in the web app and credits gate production (`scripts/credits.mts` before every scheduled batch). The user wants the pipeline on free TTS services that **do provide an API**, so `npm run tts -- <id>` works unattended again.

## Decision summary (made in conversation)

- **Primary:** Gemini TTS via Google AI Studio (`gemini-2.5-flash-preview-tts`) — official REST API, free AI Studio key, no billing account, Indonesian-capable, expressive voices. Raw PCM output (24 kHz/16-bit/mono) is wrapped to WAV, then transcoded to MP3 with FFmpeg.
- **Backup 1:** Google Cloud Text-to-Speech (`texttospeech.googleapis.com/v1/text:synthesize`) — API key, 4M WaveNet chars/month free, `id-ID-Wavenet-*` voices, direct MP3. Requires a billing-enabled GCP project (free within quota).
- **Backup 2:** Azure AI Speech F0 REST — subscription key + region, 0.5M chars/month free, `id-ID-ArdiNeural` / `id-ID-GadisNeural`, `audio-24khz-48kbitrate-mono-mp3`.
- **Timing:** no provider returns ElevenLabs-style per-word timestamps. `align:local` (line boundaries exact, words ±0.2 s) runs automatically after synthesis. Captions behave exactly as before.
- **ElevenLabs:** kept as an optional provider (`--provider=elevenlabs`); `align.mts`, `credits.mts` stay for it. Not part of the automatic fallback chain. The `| 11.ai` title-attribution rule (free-ElevenLabs ToS) is dropped from docs for the new providers.
- **Fallback order (my call):** `--provider=auto` (default) tries **gemini → gcloud → azure**, stops at first success, and reports which provider was used. `--provider=elevenlabs` does one-shot ElevenLabs. Auto fallback is primarily for the unattended autopilot; interactive users get the same behavior with zero flags. **Today the chain is effectively Gemini-only** (backup keys don't exist yet); docs must say so, and the backups get exercised on first real use.

## Goals / non-goals

**Goals**
- `npm run tts -- <id>` produces `public/<id>/vo.mp3` **and** `src/videos/<id>/alignment.json` in one command (parity with today's ElevenLabs with-timestamps UX).
- Zero-billing default path; backups stay within free quotas; clear error when all providers fail.
- No new heavy dependencies — REST via `fetch` (matching `tts.mts` style); WAV header built inline (like `music.mts`); MP3 via the FFmpeg already used by `align-local`.
- Docs updated: `README.md`, `AGENTS.md`, `docs/AUTOPILOT.md` (voice constants, quota gates), `.env.example`.

**Non-goals**
- No SSML authoring toolchain, no word-boundary SDKs, no voice cloning, no multi-speaker.
- No changes to `timeline.json` format, captions, or rendering.
- Committed `vo.mp3` files of existing videos are not regenerated.

## Approach (picked): A — single dispatcher

`scripts/tts.mts` becomes a thin provider-dispatching CLI; provider clients live in `scripts/lib-tts.mts`. Rejected: one script per provider (approach B) — duplicates the synthesis→align chain and drifts, against repo norms.

## Design

### `scripts/lib-tts.mts` (new)
- `synthesizeGemini(text, { voice, model })` → `Buffer` (WAV). POST `https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TTS_MODEL:-gemini-2.5-flash-preview-tts}:generateContent`, headers `x-goog-api-key`, body `{ contents: [{ parts: [{ text: PROMPT }]}], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { languageCode: "id-ID", voiceConfig: { prebuiltVoiceConfig: { voiceName } } } } }` (default voice `GEMINI_TTS_VOICE:-Charon`). Decode `candidates[0].content.parts[0].inlineData.data` (base64 PCM), wrap PCM in WAV header (24000 Hz/mono/16-bit). PROMPT = style instruction prefix, e.g. "Say in a warm, clear, conversational Indonesian voice: " + naskah — Gemini TTS takes the transcript as user text. On non-2xx: throw with status + body snippet (never log the key).
- `synthesizeGcloud(text, { voice })` → `Buffer` (MP3). POST `https://texttospeech.googleapis.com/v1/text:synthesize?key={GCLOUD_TTS_KEY}`; `{ input: { text }, voice: { languageCode: "id-ID", name: GCLOUD_TTS_VOICE ?? "id-ID-Wavenet-B" }, audioConfig: { audioEncoding: "MP3" } }`; base64 `audioContent` → buffer.
- `synthesizeAzure(text, { voice })` → `Buffer` (MP3). POST `https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`; headers `Ocp-Apim-Subscription-Key`, `Content-Type: application/ssml+xml`, `X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3`; SSML `<speak version="1.0" xml:lang="id-ID"><voice name="...">…escaped…</voice></speak>` (XML-escape the text). Default voice `AZURE_SPEECH_VOICE ?? "id-ID-ArdiNeural"`.
- `synthesizeElevenLabs(...)` — move the existing code path from `tts.mts` unchanged (keeps `with-timestamps` behavior: its words are used directly for `alignment.json` when this provider is chosen, instead of running the aligner).
- Each provider returns `{ audio: Buffer, ext: "wav"|"mp3", words?: TimedWord[] }`; the Gemini WAV buffer is transcoded to the staging MP3 via FFmpeg (pipe `-f wav -i -` → `-codec:a libmp3lame -b:a 128k`; reuse the `ffmpeg()` helper pattern from `align-local.mts`) so `vo.mp3` naming and `<Audio>` stay consistent everywhere. GCloud/Azure return MP3 directly.

### `scripts/align-core.mts` (new, extracted from `align-local.mts`)
Exports `analyzeAlignment(audioPath, lines): { words: TimedWord[]; spans: … }` (silencedetect + DP + syllable spread) and `estimateAlignment(lines)`. Used by both `align-local.mts` (thin wrapper, behavior unchanged) and `tts.mts`.

### `scripts/tts.mts` (rewritten)
- Args: `-- <id> [--provider=auto|gemini|gcloud|azure|elevenlabs]` (default `auto`, or `$TTS_PROVIDER`).
- Reads `naskah.txt` as today, joins with `\n\n` (natural pauses).
- Provider chain: for `auto`, try gemini → gcloud → azure; skip a provider whose env keys are missing **silently** (log one line "skipping azure: no AZURE_SPEECH_KEY"), try the next; on 429/5xx/network failure, log and fall through; on total failure exit 1 with a per-provider summary. `--provider=elevenlabs` is one-shot with the legacy behavior.
- **Write order (hard guarantee):** synthesis → the provider audio is staged to `os.tmpdir()/vo-<id>-staging.mp3` and `analyzeAlignment` runs on that file; `public/<id>/vo.mp3` and `alignment.json` are written together **only on full success** (staging is renamed into place). **If analysis fails** (e.g. Gemini's pauses defeat `silencedetect`'s `S ≥ N` check): the committed `vo.mp3`/`alignment.json` pair stays untouched, the staging file is moved to `os.tmpdir()/vo-<id>-failed.mp3` (path printed), and the command exits 1 loudly. No fallback to the next provider on analysis failure (a different voice does not deterministically fix pacing, and retrying burns quota). No blind-estimate timing is ever written silently.
- On success: rename `vo-<id>-staging.mp3` → `public/<id>/vo.mp3` and write `alignment.json` in the same step. For `elevenlabs`: analysis is skipped (with-timestamps used); words → `source: "tts"`, `vo.mp3` still written only after a successful synthesis (this provider had no analysis gate before and keeps its legacy behavior).
- Prints provider used, vo.mp3 size, word count; hint: `npm run timeline -- <id>` (unchanged).
- Never logs keys; on failure prints status + provider, not headers.

### Env / config
`.env.example` gains (all optional; absence just skips the provider):
```
GEMINI_API_KEY=            # AI Studio key, free, no billing (primary)
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts   # optional
GEMINI_TTS_VOICE=Charon    # optional
GCLOUD_TTS_KEY=            # backup 1 (billing-enabled GCP project, free within quota)
GCLOUD_TTS_VOICE=id-ID-Wavenet-B
AZURE_SPEECH_KEY=          # backup 2
AZURE_SPEECH_REGION=southeastasia
AZURE_SPEECH_VOICE=id-ID-ArdiNeural
TTS_PROVIDER=auto          # optional default; flag wins
```
`ELEVENLABS_*` retained, marked optional/legacy.

### Docs
- `README.md` "Alur membuat video": `npm run tts` description updated (Gemini-first, `--provider`), remove ElevenLabs-only wording; `.env` section updated.
- `AGENTS.md` — pipeline line, `.env` line, ElevenLabs-specific gotchas → provider-agnostic, note `align:local` is the timing source for gemini/gcloud/azure.
- `docs/AUTOPILOT.md` — §0 constants (voice table → Gemini Charon, `gemini-2.5-flash-preview-tts`, no attribution rule; **note that the operator must add `GEMINI_API_KEY` to the scheduled task's prompt before the next run** — it lives outside this repo), §1 setup (`GEMINI_API_KEY`; note the chain is effectively Gemini-only until `GCLOUD_TTS_KEY`/`AZURE_SPEECH_KEY` are created later), §2 credit gate → replaced by "no preflight quota API; rely on provider fallback + 429 reporting" (honest for a Gemini-only setup: on failure, skip + report), §5 same, §9 publish metadata: YouTube title no longer needs trailing `| 11.ai` (ElevenLabs-only ToS); TikTok text drops "Suara: 11.ai"; §10 Slack report: "report provider used + any quota error" instead of `npm run credits`. Voice flips to Gemini **now** (docs merged before voice listen is heard — Charon default, owner adjusts `GEMINI_TTS_VOICE` after hearing one take). This is the biggest doc delta; keep edits surgical.
- `docs/ledger.md` — no change (historical).

### Verification
- `npm run lint`.
- Unit-ish dry check without network: node-mock fetch on a fixture video (`test-tts-tmp`, removed after) — providers parse responses, wrong keys exit 1, `auto` falls through when env missing.
- **One real synthesis needs a `GEMINI_API_KEY` in `.env`** (free AI Studio key the user must create) — one naskah line render → check `vo.mp3` duration ≈ expected, then `npm run timeline --` works, then delete fixture artifacts. This is the only networked verification and can't be done without the key.
- Full render smoke: not required (audio path only feeds existing pipeline).

## Risks / tradeoffs

- **Free-tier rate limits:** Gemini TTS free tier is limited (observed ~10 requests/day/model). One request per video → fine for 3 videos/week. 429 → falls back to gcloud automatically.
- **Free-tier data use:** Google may use AI Studio free-tier content to improve products (per pricing page). Acceptable for this use case (user's call, implicit in choosing it).
- **Model churn:** `*-preview-tts` models may change/deprecate; `GEMINI_TTS_MODEL` env keeps this a one-line change.
- **Quality:** Gemini voices are strong on Indonesian but unproven for this channel; user should A/B one generated video against the ElevenLabs web-app VO before switching all future work.
- **Timing accuracy** ±0.2 s inside a line (vs. ElevenLabs exact): karaoke chunks may land slightly off the consonant — cosmetic, and `align.mts` remains for `elevenlabs` if exact timing is ever needed.
- **`auto` fallback surprises:** an autopilot run could land on gcloud/azure (still within free quotas) — silent provider switch is logged, and the ledger/report can note it. `--provider=gemini` hard-pins if ever needed.

## Approaches considered

- **A — single dispatcher `npm run tts [--provider]`** (picked). One entry point, shared synthesis→align chain, minimal docs.
- **B — one script per provider.** Rejected: duplicated chain logic, drift, doubled docs.
- **C — keep ElevenLabs primary, add backups.** Rejected by user (quota + no free API).
- **D — Edge TTS (unofficial endpoint).** Rejected: not an official API; unstable; user required providers that "provide API" officially.

## Calls made (my discretion, correct me)

1. Default chain `auto = gemini → gcloud → azure` (user: "Both, Gcloud first" — read as: both backups enabled, **GCloud ahead of Azure**; gemini stays zero-billing primary per "The primary is must zero billing"). ElevenLabs excluded from `auto`.
1b. **Analysis-failure semantics (user ruling):** synthesis → staging file → `analyzeAlignment`; `public/<id>/vo.mp3` + `alignment.json` are replaced only together on full success. On analysis failure the committed pair stays untouched, fresh audio lands in `os.tmpdir()/vo-<id>-failed.mp3`, exit 1, no provider fall-through, no silent blind estimate.
1c. **Voice/docs gating (user ruling):** AUTOPILOT flips to Gemini/Charon **now**, with a §0 note to listen to one take and adjust `GEMINI_TTS_VOICE` freely.
2. `vo.mp3` naming preserved via WAV→MP3 transcode; no change to `VideoDef.voice` or existing videos.
3. Gemini default voice `Charon` (informative, männlich leaning, close to current Den); overridable via env. User should approve the voice AFTER hearing it.
4. Alignment source stays `"estimated"` for gemini/gcloud/azure (not `"tts"`); `tts` reserved for ElevenLabs with-timestamps.
5. `align.mts`/`credits.mts` untouched (ElevenLabs-optional). `align-local.mts` refactored to share `align-core.mts`.
6. Drop the `| 11.ai` title rule in AUTOPILOT §9/ledger only for new videos; past uploads unaffected.

## Open items needing the user

1. Create the free AI Studio key (`aistudio.google.com` → Get API key, no card) and put it in `.env` — needed for the one real test synthesis and any future run. It must **also** be added to the external scheduled-task prompt (outside this repo) before the next Mon/Wed/Fri run, or the autopilot will fail at the TTS step. GCloud/Azure keys are optional until first fallback exercise — **today the fallback chain is Gemini-only in practice**, and the docs will say so.
2. Approval of this document (this is the gate).
3. After first real synthesis, pick the Gemini voice you actually like (Charon default; change `GEMINI_TTS_VOICE` in `.env` anytime).

## Verification honesty note

The mocked dry run validates only provider response parsing, flag/env plumbing, and the keep-old-files guarantee — it **cannot** validate Gemini/GCloud/Azure auth, region, rate limits, or `id-ID-*`/Gemini voice availability. Real verification requires the keys and happens on first actual use (the one test synthesis for Gemini; backup providers only when their keys are created).
