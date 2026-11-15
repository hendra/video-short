import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { synthesizeAndPublish, type SynthByProvider } from "./lib-tts.mts";
import { ACCOUNTS } from "../src/accounts.ts";

const TMP = (n: string) => path.join(os.tmpdir(), n);
const RATE = 24000;

const wavOf = (pcm: Buffer): Buffer => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
const tone = (seconds: number, freq = 440): Buffer => {
  const buf = Buffer.alloc(Math.floor(seconds * RATE) * 2);
  for (let i = 0; i < buf.length / 2; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / RATE) * 32767 * 0.3), i * 2);
  return buf;
};
const silence = (seconds: number): Buffer => Buffer.alloc(Math.floor(seconds * RATE) * 2);
const bursts = () => wavOf(Buffer.concat([tone(1.0, 440), silence(0.4), tone(1.0, 440)]));
const constantTone = () => wavOf(tone(2.4, 440)); // no silences → analysis must throw

const FIXTURE = "src/videos/test-tts-tmp";
const FIXTURE_PUB = "public/test-tts-tmp";
const writeFixture = (sentinel?: Buffer) => {
  fs.mkdirSync(FIXTURE, { recursive: true });
  fs.writeFileSync(`${FIXTURE}/naskah.txt`, "01  satu dua tiga empat lima\n02  enam tujuh delapan\n");
  if (sentinel) {
    fs.mkdirSync(FIXTURE_PUB, { recursive: true });
    fs.writeFileSync(`${FIXTURE_PUB}/vo.mp3`, sentinel);
  }
};
const sha1 = (p: string) => crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex");
const cleanup = () => {
  fs.rmSync(FIXTURE, { recursive: true, force: true });
  fs.rmSync(FIXTURE_PUB, { recursive: true, force: true });
  for (const f of [`vo-test-tts-tmp-staging.mp3`, `vo-test-tts-tmp-failed.mp3`]) fs.rmSync(TMP(f), { force: true });
};

const realEnv = { ...process.env };
beforeEach(() => {
  for (const k of ["GEMINI_API_KEY", "GCLOUD_TTS_KEY", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]) delete process.env[k];
  cleanup();
});
after(() => {
  process.env = { ...realEnv };
  cleanup();
});

describe("synthesizeAndPublish", () => {
  test("auto stays on the locked Gemini voice and does not fall through to gcloud", async () => {
    process.env.GCLOUD_TTS_KEY = "k";
    process.env.GEMINI_API_KEY = "k";
    const calls: string[] = [];
    const synthByProvider = {
      gemini: async () => { calls.push("gemini"); throw new Error("gemini 429: quota"); },
      gcloud: async () => { calls.push("gcloud"); return { audio: bursts(), ext: "wav" as const }; },
      azure: async () => { calls.push("azure"); return { audio: bursts(), ext: "wav" as const }; },
      elevenlabs: async () => { calls.push("elevenlabs"); return { audio: bursts(), ext: "wav" as const }; },
    } satisfies SynthByProvider;
    writeFixture();
    const res = await synthesizeAndPublish({ videoId: "test-tts-tmp", lines: ["satu dua tiga", "empat lima"], provider: "auto", tts: ACCOUNTS["kali-aja"].tts, synthByProvider });
    assert.deepEqual(calls, ["gemini"]);
    assert.equal(res.ok, false);
  });

  test("all providers skipped: ok:false, zero synth calls, nothing written", async () => {
    const calls: string[] = [];
    const synthByProvider = Object.fromEntries(["gemini", "gcloud", "azure", "elevenlabs"].map((p) => [p, async () => { calls.push(p); return { audio: Buffer.from([1]), ext: "mp3" as const }; }])) as unknown as SynthByProvider;
    writeFixture();
    const res = await synthesizeAndPublish({ videoId: "test-tts-tmp", lines: ["satu dua"], provider: "auto", tts: ACCOUNTS["kali-aja"].tts, synthByProvider });
    assert.equal(res.ok, false);
    assert.deepEqual(calls, []);
    assert.equal(fs.existsSync(`${FIXTURE_PUB}/vo.mp3`), false);
    if (!res.ok) assert.ok(res.attempts.every((a) => /skipped/.test(a)));
  });

  test("auto never invokes elevenlabs even when its key is set", async () => {
    process.env.ELEVENLABS_API_KEY = "k";
    process.env.ELEVENLABS_VOICE_ID = "v";
    const calls: string[] = [];
    const synthByProvider = Object.fromEntries(["gemini", "gcloud", "azure", "elevenlabs"].map((p) => [p, async () => { calls.push(p); throw new Error(`${p} boom`); }])) as unknown as SynthByProvider;
    writeFixture();
    const res = await synthesizeAndPublish({ videoId: "test-tts-tmp", lines: ["satu dua"], provider: "auto", tts: ACCOUNTS["kali-aja"].tts, synthByProvider });
    assert.equal(res.ok, false);
    assert.ok(!calls.includes("elevenlabs"));
  });

  test("analysis failure: committed vo.mp3 untouched, fresh audio at vo-<id>-failed.mp3, no fall-through", async () => {
    process.env.GEMINI_API_KEY = "k";
    writeFixture(Buffer.from("sentinel-old-audio"));
    const before = sha1(`${FIXTURE_PUB}/vo.mp3`);
    const calls: string[] = [];
    const synthByProvider = {
      gemini: async () => { calls.push("gemini"); return { audio: constantTone(), ext: "wav" as const }; },
      gcloud: async () => { calls.push("gcloud"); return { audio: constantTone(), ext: "wav" as const }; },
      azure: async () => { calls.push("azure"); return { audio: constantTone(), ext: "wav" as const }; },
      elevenlabs: async () => { calls.push("elevenlabs"); return { audio: constantTone(), ext: "wav" as const }; },
    } satisfies SynthByProvider;
    const res = await synthesizeAndPublish({ videoId: "test-tts-tmp", lines: ["satu dua tiga", "empat lima"], provider: "auto", tts: ACCOUNTS["kali-aja"].tts, synthByProvider });
    assert.equal(res.ok, false);
    assert.deepEqual(calls, ["gemini"], "no fall-through on analysis failure");
    assert.equal(sha1(`${FIXTURE_PUB}/vo.mp3`), before, "committed vo.mp3 unchanged");
    assert.equal(fs.existsSync(TMP("vo-test-tts-tmp-failed.mp3")), true, "fresh audio preserved");
    if (!res.ok) assert.ok(res.analysisFailure && res.analysisFailure.failedPath.endsWith("vo-test-tts-tmp-failed.mp3"));
    // no alignment.json written/overwritten
    assert.equal(fs.existsSync(`${FIXTURE}/alignment.json`), false);
  });

  test("success path: vo.mp3 replaced and alignment.json written together", async () => {
    process.env.GEMINI_API_KEY = "k";
    writeFixture(Buffer.from("sentinel-old-audio"));
    const before = sha1(`${FIXTURE_PUB}/vo.mp3`);
    const synthByProvider = {
      gemini: async () => ({ audio: bursts(), ext: "wav" as const }),
      gcloud: async () => ({ audio: bursts(), ext: "wav" as const }),
      azure: async () => ({ audio: bursts(), ext: "wav" as const }),
      elevenlabs: async () => ({ audio: bursts(), ext: "wav" as const }),
    } satisfies SynthByProvider;
    const res = await synthesizeAndPublish({ videoId: "test-tts-tmp", lines: ["satu dua tiga empat lima", "enam tujuh delapan"], provider: "auto", tts: ACCOUNTS["kali-aja"].tts, synthByProvider });
    assert.equal(res.ok, true);
    assert.notEqual(sha1(`${FIXTURE_PUB}/vo.mp3`), before, "vo.mp3 replaced");
    const alignment = JSON.parse(fs.readFileSync(`${FIXTURE}/alignment.json`, "utf8"));
    assert.equal(alignment.source, "estimated");
    assert.ok(alignment.words.length >= 5);
    if (res.ok) assert.equal(res.wordCount, alignment.words.length);
  });
});

describe("CLI validation", () => {
  test("unknown ACCOUNT exits 1 before any provider work", () => {
    writeFixture();
    const r = spawnSync("npx", ["tsx", "scripts/tts.mts", "test-tts-tmp"], { encoding: "utf8", env: { ...process.env, ACCOUNT: "nope" } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown account "nope"/);
    assert.equal(fs.existsSync(`${FIXTURE_PUB}/vo.mp3`), false);
  });

  test("empty ACCOUNT exits 1 instead of using the default voice", () => {
    writeFixture();
    const r = spawnSync("npx", ["tsx", "scripts/tts.mts", "test-tts-tmp"], { encoding: "utf8", env: { ...process.env, ACCOUNT: "" } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown account ""/);
  });

  test("bad --provider exits 1 with valid list", () => {
    writeFixture();
    const r = spawnSync("npx", ["tsx", "scripts/tts.mts", "test-tts-tmp", "--provider=gemiini"], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Valid:/);
    assert.match(r.stderr, /gemiini/);
  });

  test("empty naskah exits 1 before any provider work and writes nothing", () => {
    fs.mkdirSync(FIXTURE, { recursive: true });
    fs.writeFileSync(`${FIXTURE}/naskah.txt`, "no line markers here\n");
    const r = spawnSync("npx", ["tsx", "scripts/tts.mts", "test-tts-tmp"], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /No script lines/);
    assert.equal(fs.existsSync(`${FIXTURE_PUB}/vo.mp3`), false);
  });
});
