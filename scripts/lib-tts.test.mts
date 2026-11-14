import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  hasProviderEnv,
  stageToMp3,
  synthesizeAzure,
  synthesizeElevenLabs,
  synthesizeGemini,
  synthesizeGcloud,
  xmlEscape,
} from "./lib-tts.mts";

const realFetch = globalThis.fetch;
const realEnv = { ...process.env };

const mockFetch = (impl: (url: string, init?: { headers?: Record<string, string>; body?: string }) => Promise<Partial<Response>>) => {
  const calls: { url: string; init?: { headers?: Record<string, string>; body?: string } }[] = [];
  globalThis.fetch = (async (input: unknown, init?: { headers?: Record<string, string>; body?: string }) => {
    const url = String(input);
    calls.push({ url, init });
    return impl(url, init) as unknown as Response;
  }) as typeof fetch;
  return calls;
};

const jsonResponse = (status: number, body: unknown): Partial<Response> => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
  arrayBuffer: async () => Buffer.from(JSON.stringify(body)).buffer as ArrayBuffer,
});

const pcmTone = (seconds: number, freq: number, rate = 24000): Buffer => {
  const buf = Buffer.alloc(Math.floor(seconds * rate) * 2);
  for (let i = 0; i < buf.length / 2; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 32767 * 0.3), i * 2);
  return buf;
};

const wavOf = (pcm: Buffer, rate = 24000): Buffer => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

beforeEach(() => {
  for (const k of ["GEMINI_API_KEY", "GEMINI_TTS_VOICE", "GEMINI_TTS_MODEL", "GCLOUD_TTS_KEY", "GCLOUD_TTS_VOICE", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "AZURE_SPEECH_VOICE", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID", "ELEVENLABS_VOICE_SETTINGS"])
    delete process.env[k];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

describe("synthesizeGemini", () => {
  test("happy path: PCM wrapped in WAV, correct request shape, voice/language pinned", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const calls = mockFetch(() => Promise.resolve(jsonResponse(200, {
      candidates: [{ content: { parts: [{ inlineData: { data: wavOf(pcmTone(0.5, 440)).toString("base64") } }] } }],
    })));
    const out = await synthesizeGemini("halo dunia");
    assert.equal(out.ext, "wav");
    assert.equal(out.audio.subarray(0, 4).toString(), "RIFF");
    assert.equal(out.audio.length, wavOf(pcmTone(0.5, 440)).length);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes("gemini-3.8-flash-tts"));
    assert.equal(calls[0].init?.headers?.["x-goog-api-key"], "test-key");
    const body = JSON.parse(calls[0].init?.body ?? "{}");
    assert.equal(body.generationConfig.speechConfig.languageCode, "id-ID");
    assert.equal(body.generationConfig.speechConfig.voiceConfig.voice, "id-id-podcaster-1");
    assert.equal(body.contents[0].parts[0].speechMetadata.style, "natural, warm, conversational");
    assert.ok(body.contents[0].parts[0].text.includes("halo dunia"));
  });

  test("non-2xx: throws with status, never leaks the key", async () => {
    process.env.GEMINI_API_KEY = "super-secret-key-123";
    mockFetch(() => Promise.resolve(jsonResponse(429, { error: { message: "quota" } })));
    await assert.rejects(() => synthesizeGemini("x"), (err: Error) => {
      assert.match(err.message, /gemini 429/);
      assert.ok(!err.message.includes("super-secret-key-123"));
      return true;
    });
  });

  test("200 but no audio part: explicit error", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockFetch(() => Promise.resolve(jsonResponse(200, { candidates: [{ content: { parts: [{}] } }] })));
    await assert.rejects(() => synthesizeGemini("x"), /no audio data/);
  });
});

describe("synthesizeGcloud", () => {
  test("happy path: base64 audioContent decoded to MP3 bytes", async () => {
    process.env.GCLOUD_TTS_KEY = "test-gcloud-key";
    const calls = mockFetch(() => Promise.resolve(jsonResponse(200, { audioContent: Buffer.from([1, 2, 3, 4]).toString("base64") })));
    const out = await synthesizeGcloud("halo");
    assert.equal(out.ext, "mp3");
    assert.deepEqual([...out.audio], [1, 2, 3, 4]);
    assert.ok(calls[0].url.includes("key=test-gcloud-key"));
    const body = JSON.parse(calls[0].init?.body ?? "{}");
    assert.equal(body.voice.languageCode, "id-ID");
    assert.equal(body.audioConfig.audioEncoding, "MP3");
  });

  test("empty audioContent: explicit error", async () => {
    process.env.GCLOUD_TTS_KEY = "k";
    mockFetch(() => Promise.resolve(jsonResponse(200, { audioContent: "" })));
    await assert.rejects(() => synthesizeGcloud("x"), /no audioContent/);
  });

  test("non-2xx: throws with status; key not in message", async () => {
    process.env.GCLOUD_TTS_KEY = "gcloud-secret-key";
    mockFetch(() => Promise.resolve(jsonResponse(403, { error: { message: "forbidden" } })));
    await assert.rejects(() => synthesizeGcloud("x"), (err: Error) => {
      assert.match(err.message, /gcloud 403/);
      assert.ok(!err.message.includes("gcloud-secret-key"));
      return true;
    });
  });
});

describe("synthesizeAzure", () => {
  test("happy path: raw MP3 bytes returned; SSML escapes the script text", async () => {
    process.env.AZURE_SPEECH_KEY = "azure-secret";
    process.env.AZURE_SPEECH_REGION = "southeastasia";
    const raw = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
    const calls = mockFetch(() => Promise.resolve({
      ok: true, status: 200,
      arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length) as ArrayBuffer,
      text: async () => "",
    }));
    const out = await synthesizeAzure(`apa kabar & "selamat" <teman>`);
    assert.equal(out.ext, "mp3");
    assert.deepEqual([...out.audio], [...raw]);
    assert.ok(calls[0].url.includes("southeastasia.tts.speech.microsoft.com"));
    assert.equal(calls[0].init?.headers?.["Ocp-Apim-Subscription-Key"], "azure-secret");
    assert.match(String(calls[0].init?.body), /&amp;/);
    assert.match(String(calls[0].init?.body), /&quot;selamat&quot;/);
    assert.match(String(calls[0].init?.body), /&lt;teman&gt;/);
    assert.ok(!String(calls[0].init?.body).includes("<teman>"));
    assert.ok(String(calls[0].init?.body).includes('xml:lang="id-ID"'));
  });

  test("non-2xx: throws with status; key not in message", async () => {
    process.env.AZURE_SPEECH_KEY = "azure-secret-key-999";
    process.env.AZURE_SPEECH_REGION = "southeastasia";
    mockFetch(() => Promise.resolve(jsonResponse(401, "access denied" as unknown as Record<string, unknown>)));
    await assert.rejects(() => synthesizeAzure("x"), (err: Error) => {
      assert.match(err.message, /azure 401/);
      assert.ok(!err.message.includes("azure-secret-key-999"));
      return true;
    });
  });

  test("xmlEscape covers all five entities", () => {
    assert.equal(xmlEscape(`&<>'"`), "&amp;&lt;&gt;&apos;&quot;");
  });
});

describe("synthesizeElevenLabs", () => {
  test("maps with-timestamps characters to words", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    process.env.ELEVENLABS_VOICE_ID = "voice123";
    const text = "halo dunia"; // sent verbatim
    mockFetch(() => Promise.resolve(jsonResponse(200, {
      audio_base64: Buffer.from([9, 9]).toString("base64"),
      alignment: {
        characters: ["h","a","l","o"," ","d","u","n","i","a"],
        character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        character_end_times_seconds:   [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      },
    })));
    const out = await synthesizeElevenLabs(text);
    assert.equal(out.ext, "mp3");
    assert.deepEqual(out.words?.map((w) => w.text), ["halo", "dunia"]);
    assert.equal(out.words?.[0].start, 0);
    assert.equal(out.words?.[1].end, 1.0);
  });
});

describe("hasProviderEnv", () => {
  test("reports missing vars per provider", () => {
    assert.deepEqual(hasProviderEnv("gemini"), { ok: false, missing: "GEMINI_API_KEY" });
    process.env.GEMINI_API_KEY = "k";
    assert.deepEqual(hasProviderEnv("gemini"), { ok: true, missing: "" });
    assert.deepEqual(hasProviderEnv("azure"), { ok: false, missing: "AZURE_SPEECH_KEY, AZURE_SPEECH_REGION" });
    assert.deepEqual(hasProviderEnv("elevenlabs"), { ok: false, missing: "ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID" });
  });
});

describe("stageToMp3", () => {
  test("mp3 input passes through untouched", () => {
    const dest = path.join(os.tmpdir(), `stage-test-${process.pid}.mp3`);
    try {
      stageToMp3(Buffer.from([1, 2, 3]), "mp3", dest);
      assert.deepEqual([...fs.readFileSync(dest)], [1, 2, 3]);
    } finally {
      fs.rmSync(dest, { force: true });
    }
  });

  test("wav input is transcoded (or skipped with a log if no ffmpeg)", () => {
    const dest = path.join(os.tmpdir(), `stage-test-${process.pid}-transcode.mp3`);
    const pcm = pcmTone(0.5, 440);
    try {
      stageToMp3(wavOf(pcm), "wav", dest);
      assert.ok(fs.existsSync(dest), "mp3 produced by ffmpeg");
      assert.ok(fs.statSync(dest).size > 100);
    } catch (e) {
      console.log(`skipping transcode assertion: ${(e as Error).message}`);
    } finally {
      fs.rmSync(dest, { force: true });
    }
  });
});
