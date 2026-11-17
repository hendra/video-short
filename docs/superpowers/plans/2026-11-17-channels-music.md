# AI Labs & Kali Aja Mood-Based Suno Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `scripts/music.mts` and `account-gate.mts` from Cerpenek to `ai-labs` (`build`, `debug`, `showcase`) and `kali-aja` (`teknik`, `misteri`, `fenomena`) using Suno MP3 tracks under `public/<account>/music/`.

**Architecture:** `scripts/music.mts` replaces its single-channel `CERPENEK_MOODS` list with `MOODS_BY_ACCOUNT: Record<AccountId, readonly string[]>` and `musicDirFor(accountId)`. In CLI mode, when `config.json.music` is set, it reads `publish.json.account` (falling back to `DEFAULT_ACCOUNT` if `publish.json` is absent), validates the mood against that account's list, and runs `ffmpeg` to produce `public/<slug>/music.wav`; when `config.json.music` is omitted, the existing procedural synth bed runs untouched. `account-gate.mts` enforces `config.json.music` for all accounts via `accountMusicProblems`, and `ops/accounts/ai-labs.md` + `docs/AUTOPILOT.md` document the moods.

**Tech Stack:** TypeScript (`tsx`), Node.js `node:test` + `node:assert/strict`, `ffmpeg` + `ffprobe`.

**Spec:** `docs/superpowers/specs/2026-11-17-channels-music-design.md`

## Global Constraints

- Node >= 20.19; no new npm dependencies.
- `./node_modules/.bin/eslint src && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/tsc -p scripts --noEmit` and `npm test` must pass.
- Account moods:
  - `cerpenek`: `"ceria"`, `"hangat"`, `"petualang"`, `"nusantara"`, `"ajaib"` (unchanged)
  - `ai-labs`: `"build"`, `"debug"`, `"showcase"`
  - `kali-aja`: `"teknik"`, `"misteri"`, `"fenomena"`
- Output `public/<id>/music.wav` remains 16-bit PCM stereo, 44.1 kHz, exact duration `timeline.dur`, with `loudnorm=I=-18:TP=-4.5:LRA=7`, `0.5s` fade-in, `2.0s` fade-out.
- Procedural synth fallback remains active whenever `config.json.music` is `undefined`.

## Review Focus

- Cross-channel mood mismatch (e.g. `ai-labs` video setting `"music": "ceria"` or `kali-aja` setting `"music": "build"`) → rejected by both `resolveMusicTrack` and `accountMusicProblems` with the account's valid mood list.
- Non-finite `dur` (`NaN`, `Infinity`, `<= 0`) passed to `ffmpegMusicArgs` → clamped safely to `0.1` instead of emitting `NaN` in `-t` or `afade`.
- Missing `publish.json` when running `npm run music -- <id>` locally → `readVideoAccount` falls back to `DEFAULT_ACCOUNT` (`"kali-aja"`), while invalid `publish.json.account` throws loudly.
- Missing MP3 file on disk for a valid `ai-labs` or `kali-aja` mood → `resolveMusicTrack` fails with the expected file path before spawning `ffmpeg`.
- Omitted `config.json.music` → `resolveMusicTrack(undefined, ...)` returns `null` so procedural synth continues to work for legacy/unconfigured videos.

---

### Task 1: Generalize `scripts/music.mts` for per-account moods and `NaN`-safe durations

**Files:**
- Modify: `scripts/music.mts:1-180`
- Modify: `scripts/music.test.mts:1-54`

**Interfaces:**
- Consumes: `AccountId`, `DEFAULT_ACCOUNT`, `accountById` from `../src/accounts.ts`
- Produces in `scripts/music.mts`:
  - `export const MOODS_BY_ACCOUNT: Record<AccountId, readonly string[]>`
  - `export const CERPENEK_MOODS = MOODS_BY_ACCOUNT.cerpenek`
  - `export const musicDirFor = (accountId: AccountId): string` (`path.join(ROOT, "public", accountId, "music")`)
  - `export const readVideoAccount = (id: string, dir?: string): AccountId`
  - `export const resolveMusicTrack = (mood: string | undefined, accountId?: AccountId, musicDir?: string, exists?: (p: string) => boolean): string | null`
  - `export const ffmpegMusicArgs = (inputMp3: string, outputWav: string, dur: number): string[]`

- [ ] **Step 1: Update `scripts/music.test.mts` with failing multi-account & non-finite `dur` tests**

```ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { CERPENEK_MOODS, MOODS_BY_ACCOUNT, ffmpegMusicArgs, musicDirFor, readVideoAccount, resolveMusicTrack } from "./music.mts";

describe("resolveMusicTrack", () => {
  test("returns null when config.music is omitted for any account", () => {
    assert.equal(resolveMusicTrack(undefined, "ai-labs", "/tmp/m", () => true), null);
    assert.equal(resolveMusicTrack(undefined, "kali-aja", "/tmp/m", () => true), null);
  });

  test("resolves each valid mood per account to its MP3 path", () => {
    for (const [account, moods] of Object.entries(MOODS_BY_ACCOUNT) as [keyof typeof MOODS_BY_ACCOUNT, readonly string[]][]) {
      for (const mood of moods) {
        const p = resolveMusicTrack(mood, account, `/tmp/${account}`, () => true);
        assert.equal(p, path.join(`/tmp/${account}`, `${mood}.mp3`));
      }
    }
    assert.deepEqual(CERPENEK_MOODS, MOODS_BY_ACCOUNT.cerpenek);
    assert.ok(musicDirFor("ai-labs").endsWith(path.join("public", "ai-labs", "music")));
  });

  test("rejects unknown, empty, or cross-channel mood strings with the account mood list", () => {
    assert.throws(() => resolveMusicTrack("seram", "cerpenek", "/tmp/m", () => true), /ceria, hangat, petualang, nusantara, ajaib/);
    assert.throws(() => resolveMusicTrack("ceria", "ai-labs", "/tmp/m", () => true), /build, debug, showcase/);
    assert.throws(() => resolveMusicTrack("build", "kali-aja", "/tmp/m", () => true), /teknik, misteri, fenomena/);
    assert.throws(() => resolveMusicTrack("", "ai-labs", "/tmp/m", () => true), /build, debug, showcase/);
  });

  test("rejects valid mood when MP3 file does not exist", () => {
    assert.throws(() => resolveMusicTrack("build", "ai-labs", "/tmp/m", () => false), /build\.mp3/);
  });
});

describe("readVideoAccount", () => {
  test("reads publish.json.account when present, falls back to kali-aja when absent, and throws on invalid account", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "music-acct-"));
    try {
      assert.equal(readVideoAccount("v", tmp), "kali-aja");
      fs.writeFileSync(path.join(tmp, "publish.json"), JSON.stringify({ account: "ai-labs" }));
      assert.equal(readVideoAccount("v", tmp), "ai-labs");
      fs.writeFileSync(path.join(tmp, "publish.json"), JSON.stringify({ account: "unknown" }));
      assert.throws(() => readVideoAccount("v", tmp), /Unknown account/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
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

  test("clamps fade durations safely when video duration is shorter than 2.5s or non-finite", () => {
    const shortArgs = ffmpegMusicArgs("/in/ceria.mp3", "/out/music.wav", 1.5);
    const shortAf = shortArgs[shortArgs.indexOf("-af") + 1];
    assert.match(shortAf, /afade=t=in:st=0:d=0\.500/);
    assert.match(shortAf, /afade=t=out:st=0\.500:d=1\.000/);

    const nanArgs = ffmpegMusicArgs("/in/ceria.mp3", "/out/music.wav", Number.NaN);
    assert.equal(nanArgs[nanArgs.indexOf("-t") + 1], "0.100");
    assert.doesNotMatch(nanArgs[nanArgs.indexOf("-af") + 1], /NaN/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/tsx --test scripts/music.test.mts`
Expected: FAIL because `MOODS_BY_ACCOUNT`, `musicDirFor`, and `readVideoAccount` are not exported from `scripts/music.mts`, and `resolveMusicTrack` has the old signature.

- [ ] **Step 3: Implement multi-account mood resolution and `Number.isFinite` guard in `scripts/music.mts`**

In `scripts/music.mts`:
- Import `type AccountId`, `DEFAULT_ACCOUNT`, `accountById` from `../src/accounts.ts`.
- Define `MOODS_BY_ACCOUNT`:
  - `cerpenek`: `["ceria", "hangat", "petualang", "nusantara", "ajaib"]`
  - `ai-labs`: `["build", "debug", "showcase"]`
  - `kali-aja`: `["teknik", "misteri", "fenomena"]`
- Keep `export const CERPENEK_MOODS = MOODS_BY_ACCOUNT.cerpenek;` and `export const musicDirFor = (accountId: AccountId) => path.join(ROOT, "public", accountId, "music");`.
- Add `readVideoAccount(id: string, dir = videoDir(id)): AccountId`: if `publish.json` exists in `dir`, parse it and return `accountById(parsed.account).id`; if absent, return `DEFAULT_ACCOUNT`.
- Update `resolveMusicTrack(mood, accountId = DEFAULT_ACCOUNT, musicDir = musicDirFor(accountId), exists = fs.existsSync)` to validate against `MOODS_BY_ACCOUNT[accountId]`.
- In `ffmpegMusicArgs`, guard `safeDur = Math.max(0.1, Number.isFinite(dur) ? dur : 0.1)`.
- In the CLI entry block, pass `readVideoAccount(id)` to `resolveMusicTrack(cfg.music, accountId)`.

- [ ] **Step 4: Run tests and direct lint**

Run: `./node_modules/.bin/tsx --test scripts/music.test.mts && ./node_modules/.bin/eslint src && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/tsc -p scripts --noEmit`
Expected: PASS (all tests green, static checks clean).

- [ ] **Step 5: Commit**

```bash
git add scripts/music.mts scripts/music.test.mts
git commit -m "feat(music): generalize mood music beds across all channel accounts"
```

---

### Task 2: Enforce per-account mood selection in `account-gate` and document in channel briefs

**Files:**
- Modify: `scripts/account-core.mts`
- Modify: `scripts/account-gate.mts`
- Modify: `scripts/account-core.test.mts`
- Modify: `ops/accounts/ai-labs.md`
- Modify: `docs/AUTOPILOT.md`

**Interfaces:**
- Consumes: `MOODS_BY_ACCOUNT` from `./music.mts`
- Produces in `scripts/account-core.mts`:
  - `export const accountMusicProblems = (configJson: { music?: unknown } | null, accountId: AccountId): string[]`
  - `export const cerpenekMusicProblems = (configJson: { music?: unknown } | null): string[]` (delegates to `accountMusicProblems(configJson, "cerpenek")`)

- [ ] **Step 1: Add failing tests for `accountMusicProblems` in `scripts/account-core.test.mts`**

```ts
describe("accountMusicProblems", () => {
  test("accepts valid moods for each account and rejects cross-account or empty values", () => {
    for (const music of ["build", "debug", "showcase"]) {
      assert.deepEqual(accountMusicProblems({ music }, "ai-labs"), []);
    }
    for (const music of ["teknik", "misteri", "fenomena"]) {
      assert.deepEqual(accountMusicProblems({ music }, "kali-aja"), []);
    }
    assert.ok(accountMusicProblems({ music: "ceria" }, "ai-labs").some((p) => p.includes("build, debug, showcase")));
    assert.ok(accountMusicProblems({ music: "" }, "kali-aja").some((p) => p.includes("teknik, misteri, fenomena")));
    assert.ok(accountMusicProblems({ music: 123 }, "cerpenek").some((p) => p.includes("ceria, hangat, petualang, nusantara, ajaib")));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/tsx --test scripts/account-core.test.mts`
Expected: FAIL because `accountMusicProblems` is not exported from `scripts/account-core.mts`.

- [ ] **Step 3: Generalize `accountMusicProblems`, wire into `account-gate.mts`, and update `ops/accounts/ai-labs.md` + `docs/AUTOPILOT.md`**

- In `scripts/account-core.mts`: import `MOODS_BY_ACCOUNT` from `./music.mts`, export `accountMusicProblems(configJson, accountId)`, and keep `cerpenekMusicProblems` delegating to `accountMusicProblems(configJson, "cerpenek")`.
- In `scripts/account-gate.mts`: validate `config.json` with `accountMusicProblems(configJson, account.id)` unconditionally for every account (`kali-aja`, `ai-labs`, `cerpenek`) instead of `if (account.id === "cerpenek")`.
- In `ops/accounts/ai-labs.md`: add `## Musik latar` documenting `"music": "<suasana>"` in `config.json` (`"build"`, `"debug"`, `"showcase"`) and keeping `music: { src: "<slug>/music.wav", volume: 0.14 }` in `index.ts`.
- In `docs/AUTOPILOT.md`: document `"music": "<suasana>"` in `config.json` (`"teknik"`, `"misteri"`, `"fenomena"`) under §5/§6.

- [ ] **Step 4: Run full test suite and direct lint**

Run: `npm test && ./node_modules/.bin/eslint src && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/tsc -p scripts --noEmit`
Expected: PASS (all tests green, static checks clean).

- [ ] **Step 5: Commit**

```bash
git add scripts/account-core.mts scripts/account-gate.mts scripts/account-core.test.mts ops/accounts/ai-labs.md docs/AUTOPILOT.md
git commit -m "feat(music): validate mood selection for ai-labs and kali-aja in gate and briefs"
```

---

### Task 3: Add the 6 Suno MP3 tracks and verify audio generation with `ffmpeg`

**Files:**
- Add (user-provided): `public/ai-labs/music/build.mp3`
- Add (user-provided): `public/ai-labs/music/debug.mp3`
- Add (user-provided): `public/ai-labs/music/showcase.mp3`
- Add (user-provided): `public/kali-aja/music/teknik.mp3`
- Add (user-provided): `public/kali-aja/music/misteri.mp3`
- Add (user-provided): `public/kali-aja/music/fenomena.mp3`

- [ ] **Step 1: Confirm all 6 MP3 files exist and are valid MP3 streams**

Run: `ls -lh public/ai-labs/music/{build,debug,showcase}.mp3 public/kali-aja/music/{teknik,misteri,fenomena}.mp3 && for f in public/ai-labs/music/*.mp3 public/kali-aja/music/*.mp3; do echo -n "$f: "; ffprobe -v error -show_entries format=format_name,duration -of csv=p=0 "$f"; done`
Expected: 6 non-empty `mp3` files with valid durations.

- [ ] **Step 2: Smoke-test `ffmpegMusicArgs` on one AI Labs track and one Kali Aja track into `/tmp/opencode`**

Run: `mkdir -p /tmp/opencode && ./node_modules/.bin/tsx -e 'import("./scripts/music.mts").then(async m => { const { execFileSync } = await import("node:child_process"); for (const [name, src] of [["ai", "public/ai-labs/music/build.mp3"], ["ka", "public/kali-aja/music/teknik.mp3"]]) { const out = `/tmp/opencode/smoke-${name}.wav`; execFileSync("ffmpeg", m.ffmpegMusicArgs(src, out, 75), { stdio: "inherit" }); execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels,duration", "-of", "default=nw=1", out], { stdio: "inherit" }); } })' && rm -f /tmp/opencode/smoke-ai.wav /tmp/opencode/smoke-ka.wav`
Expected: Both WAVs report `codec_name=pcm_s16le`, `sample_rate=44100`, `channels=2`, `duration=75.000000`.

- [ ] **Step 3: Commit the 6 MP3 tracks and design/plan docs**

```bash
git add public/ai-labs/music/*.mp3 public/kali-aja/music/*.mp3 docs/superpowers/specs/2026-11-17-channels-music-design.md docs/superpowers/plans/2026-11-17-channels-music.md
git commit -m "assets(music): add Suno mood tracks for ai-labs and kali-aja"
```
