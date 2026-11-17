# Cerpenek Mood-Based Suno Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Cerpenek's automated video pipeline to use the 5 mood-matched Suno MP3 tracks in `public/cerpenek/music/` via `config.json.music` and `scripts/music.mts`.

**Architecture:** `VideoConfig` in `scripts/lib.mts` gains an optional `music?: string` mood key (`ceria | hangat | petualang | nusantara | ajaib`). When `config.json.music` is set, `scripts/music.mts` resolves `public/cerpenek/music/<mood>.mp3` and invokes `ffmpeg` to loop/trim to `timeline.dur`, apply fade-in/fade-out and loudness normalization, and write `public/<slug>/music.wav`; when omitted (`kali-aja`, `ai-labs`), `scripts/music.mts` keeps the procedural synth bed unchanged. `ops/accounts/cerpenek.md` instructs the CI agent to pick the matching mood, and `account-gate.mts` validates it for `cerpenek`.

**Tech Stack:** TypeScript (`tsx`), Node.js `node:test` + `node:assert/strict`, `ffmpeg` (already installed in CI).

**Spec:** `docs/superpowers/specs/2026-11-17-cerpenek-music-design.md`

## Global Constraints

- Node >= 20.19; no new npm dependencies.
- `npm run lint` (`eslint src && tsc && tsc -p scripts`) and `npm test` (`tsx --test scripts/*.test.mts`) must pass.
- Valid Cerpenek mood names are exact lowercase strings: `"ceria"`, `"hangat"`, `"petualang"`, `"nusantara"`, `"ajaib"`.
- Output `public/<id>/music.wav` must be 16-bit PCM stereo, 44.1 kHz, exact duration `timeline.dur` seconds, with `0.5s` fade-in and `2.0s` fade-out.
- `kali-aja` and `ai-labs` behavior (no `music` field in `config.json`) must remain unchanged.

## Review Focus

- Unknown `config.json.music` mood string (e.g. `"seram"` or `""`) → throws an explicit error listing the 5 valid moods instead of silently falling back to synth or passing an unvalidated path to `ffmpeg`.
- Missing MP3 asset on disk for a valid mood → throws an explicit error containing the missing MP3 path before spawning `ffmpeg`.
- Very short `timeline.dur` (e.g. `1.5s`, shorter than `0.5s + 2.0s` fades) → clamps fade durations and `fadeOutStart` to `>= 0` so `ffmpeg` never receives a negative `afade` `st`.
- Absent `config.json.music` (Kali Aja / AI Labs) → `resolveMusicTrack(undefined, ...)` returns `null` so the procedural synth path runs untouched.
- Cerpenek `account-gate.mts` check when `config.json` is missing `"music"` or has an invalid mood → `cerpenekMusicProblems` reports a clear Indonesian error before render.

---

### Task 1: Add `music` config type & `scripts/music.mts` Suno MP3 renderer

**Files:**
- Modify: `scripts/lib.mts:14-19`
- Modify: `scripts/music.mts:1-106`
- Create: `scripts/music.test.mts`

**Interfaces:**
- Produces in `scripts/lib.mts`: `VideoConfig = { shots: [string, number][]; tail: number; music?: string }`
- Produces in `scripts/music.mts`:
  - `export const CERPENEK_MOODS = ["ceria", "hangat", "petualang", "nusantara", "ajaib"] as const;`
  - `export type CerpenekMood = (typeof CERPENEK_MOODS)[number];`
  - `export const CERPENEK_MUSIC_DIR: string` (`path.join(ROOT, "public", "cerpenek", "music")`)
  - `export const resolveMusicTrack = (mood: string | undefined, musicDir?: string, exists?: (p: string) => boolean): string | null`
  - `export const ffmpegMusicArgs = (inputMp3: string, outputWav: string, dur: number): string[]`

- [ ] **Step 1: Write the failing tests in `scripts/music.test.mts`**

```ts
import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { CERPENEK_MOODS, ffmpegMusicArgs, resolveMusicTrack } from "./music.mts";

describe("resolveMusicTrack", () => {
  test("returns null when config.music is omitted", () => {
    assert.equal(resolveMusicTrack(undefined, "/tmp/m", () => true), null);
  });

  test("resolves each valid Cerpenek mood to its MP3 path", () => {
    for (const mood of CERPENEK_MOODS) {
      const p = resolveMusicTrack(mood, "/tmp/m", () => true);
      assert.equal(p, path.join("/tmp/m", `${mood}.mp3`));
    }
  });

  test("rejects unknown or empty mood strings with valid mood list", () => {
    assert.throws(() => resolveMusicTrack("seram", "/tmp/m", () => true), /ceria, hangat, petualang, nusantara, ajaib/);
    assert.throws(() => resolveMusicTrack("", "/tmp/m", () => true), /ceria, hangat, petualang, nusantara, ajaib/);
  });

  test("rejects valid mood when MP3 file does not exist", () => {
    assert.throws(() => resolveMusicTrack("hangat", "/tmp/m", () => false), /hangat\.mp3/);
  });
});

describe("ffmpegMusicArgs", () => {
  test("loops, trims to dur, normalizes, fades in 0.5s and out 2.0s, and outputs 44.1kHz stereo WAV", () => {
    const args = ffmpegMusicArgs("/in/hangat.mp3", "/out/music.wav", 72.5);
    assert.equal(args.includes("-stream_loop"), true);
    assert.equal(args[args.indexOf("-stream_loop") + 1], "-1");
    assert.equal(args[args.indexOf("-t") + 1], "72.500");
    const af = args[args.indexOf("-af") + 1];
    assert.match(af, /afade=t=in:st=0:d=0\.500/);
    assert.match(af, /afade=t=out:st=70\.500:d=2\.000/);
    assert.match(af, /loudnorm=/);
    assert.equal(args[args.indexOf("-ar") + 1], "44100");
    assert.equal(args[args.indexOf("-ac") + 1], "2");
    assert.equal(args[args.length - 1], "/out/music.wav");
  });

  test("clamps fade durations safely when video duration is shorter than 2.5s", () => {
    const args = ffmpegMusicArgs("/in/ceria.mp3", "/out/music.wav", 1.5);
    const af = args[args.indexOf("-af") + 1];
    assert.match(af, /afade=t=in:st=0:d=0\.500/);
    assert.match(af, /afade=t=out:st=0\.500:d=1\.000/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test scripts/music.test.mts`
Expected: FAIL because `CERPENEK_MOODS`, `resolveMusicTrack`, and `ffmpegMusicArgs` are not exported from `scripts/music.mts`.

- [ ] **Step 3: Update `VideoConfig` in `scripts/lib.mts` and refactor `scripts/music.mts`**

In `scripts/lib.mts`, add `music?: string;` to `VideoConfig`.
In `scripts/music.mts`:
- Export `CERPENEK_MOODS`, `CerpenekMood`, `CERPENEK_MUSIC_DIR`, `resolveMusicTrack(mood, musicDir = CERPENEK_MUSIC_DIR, exists = fs.existsSync)`, and `ffmpegMusicArgs(inputMp3, outputWav, dur)`.
  - `resolveMusicTrack` returns `null` when `mood === undefined`; throws if `!CERPENEK_MOODS.includes(mood)` (listing all 5 valid moods); throws if `!exists(targetPath)` (naming the missing path).
  - `ffmpegMusicArgs` sets `-y -v error -stream_loop -1 -i <inputMp3> -t <dur.toFixed(3)> -vn -af <filter> -ar 44100 -ac 2 -c:a pcm_s16le <outputWav>`, where `fadeIn = Math.min(0.5, dur / 2)`, `fadeOut = Math.min(2, Math.max(0, dur - fadeIn))`, `fadeOutStart = Math.max(0, dur - fadeOut)`, and `<filter>` applies `loudnorm=I=-18:TP=-4.5:LRA=7`, `afade=t=in:st=0:d=...`, and (when `fadeOut > 0`) `afade=t=out:st=...:d=...`.
- Guard the CLI entry block with `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)` so importing `scripts/music.mts` in tests never runs the CLI.
- Inside the CLI block, read `cfg = readConfig(id)` and call `const track = resolveMusicTrack(cfg.music)`. If `track !== null`, ensure `publicDir(id)` exists and run `execFileSync("ffmpeg", ffmpegMusicArgs(track, outWav, DUR), { stdio: "inherit" })`; otherwise run the existing procedural synth code unchanged.

- [ ] **Step 4: Run tests and lint to verify Task 1**

Run: `npx tsx --test scripts/music.test.mts && npm run lint`
Expected: PASS (all tests green, `eslint` + `tsc` + `tsc -p scripts` clean).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib.mts scripts/music.mts scripts/music.test.mts
git commit -m "feat(music): support mood-based MP3 beds via ffmpeg in scripts/music.mts"
```

---

### Task 2: Document mood selection in `ops/accounts/cerpenek.md` and validate in `account-gate`

**Files:**
- Modify: `ops/accounts/cerpenek.md`
- Modify: `scripts/account-core.mts`
- Modify: `scripts/account-gate.mts`
- Modify: `scripts/account-core.test.mts`

**Interfaces:**
- Consumes: `CERPENEK_MOODS` from `./music.mts` (or defines/shares the tuple cleanly without side-effect imports — `scripts/music.mts` is safe to import once guarded by `import.meta.url` in Task 1).
- Produces in `scripts/account-core.mts`: `export const cerpenekMusicProblems = (configJson: { music?: unknown } | null): string[]`

- [ ] **Step 1: Write the failing tests in `scripts/account-core.test.mts`**

```ts
describe("cerpenekMusicProblems", () => {
  test("accepts all 5 valid Cerpenek mood names", () => {
    for (const music of ["ceria", "hangat", "petualang", "nusantara", "ajaib"]) {
      assert.deepEqual(cerpenekMusicProblems({ music }), []);
    }
  });

  test("rejects missing config or missing music field", () => {
    assert.ok(cerpenekMusicProblems(null).some((p) => p.includes("config.json") && p.includes("music")));
    assert.ok(cerpenekMusicProblems({}).some((p) => p.includes("config.json") && p.includes("music")));
  });

  test("rejects unknown mood names with valid choices", () => {
    const problems = cerpenekMusicProblems({ music: "seram" });
    assert.ok(problems.some((p) => p.includes("ceria, hangat, petualang, nusantara, ajaib")), problems.join("; "));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test scripts/account-core.test.mts`
Expected: FAIL because `cerpenekMusicProblems` is not exported from `scripts/account-core.mts`.

- [ ] **Step 3: Implement `cerpenekMusicProblems`, wire into `scripts/account-gate.mts`, and update `ops/accounts/cerpenek.md`**

- In `scripts/account-core.mts`: export `cerpenekMusicProblems(configJson: { music?: unknown } | null): string[]` checking that `configJson?.music` is a string in `["ceria", "hangat", "petualang", "nusantara", "ajaib"]`.
- In `scripts/account-gate.mts`: when `account.id === "cerpenek"`, read `path.join(dir, "config.json")`, parse JSON (or report missing/invalid JSON), and push `...cerpenekMusicProblems(configJson)` into `problems`.
- In `ops/accounts/cerpenek.md`: add a short `## Musik latar` section instructing the agent to set `"music": "<suasana>"` in `src/videos/<slug>/config.json` choosing from the 5 moods (`ceria`, `hangat`, `petualang`, `nusantara`, `ajaib`) with 1-line guidance on which story types fit each mood, and keep `volume: 0.14` in `index.ts`.

- [ ] **Step 4: Run full test suite and lint**

Run: `npm run lint && npm test`
Expected: PASS (all unit test files pass, lint clean).

- [ ] **Step 5: Commit**

```bash
git add ops/accounts/cerpenek.md scripts/account-core.mts scripts/account-gate.mts scripts/account-core.test.mts
git commit -m "feat(cerpenek): require mood music selection in config.json and gate"
```

---

### Task 3: Add the 5 Suno MP3 tracks and verify end-to-end audio generation with `ffmpeg`

**Files:**
- Add (user-provided): `public/cerpenek/music/ceria.mp3`
- Add (user-provided): `public/cerpenek/music/hangat.mp3`
- Add (user-provided): `public/cerpenek/music/petualang.mp3`
- Add (user-provided): `public/cerpenek/music/nusantara.mp3`
- Add (user-provided): `public/cerpenek/music/ajaib.mp3`

- [ ] **Step 1: Confirm all 5 MP3 files exist in `public/cerpenek/music/`**

Run: `ls -lh public/cerpenek/music/{ceria,hangat,petualang,nusantara,ajaib}.mp3`
Expected: 5 non-empty `.mp3` files listed.

- [ ] **Step 2: Smoke-test `ffmpegMusicArgs` output against one real MP3 into `/tmp/opencode`**

Run: `node -e 'import("./scripts/music.mts").then(async m => { const { execFileSync } = await import("node:child_process"); const out = "/tmp/opencode/smoke-music.wav"; execFileSync("ffmpeg", m.ffmpegMusicArgs("public/cerpenek/music/ceria.mp3", out, 75), { stdio: "inherit" }); execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels,duration", "-of", "default=nw=1", out], { stdio: "inherit" }); })'`
Expected: `codec_name=pcm_s16le`, `sample_rate=44100`, `channels=2`, `duration=75.000000`.

- [ ] **Step 3: Commit the 5 MP3 tracks**

```bash
git add public/cerpenek/music/*.mp3
git commit -m "assets(cerpenek): add 5 Suno mood background music tracks"
```
