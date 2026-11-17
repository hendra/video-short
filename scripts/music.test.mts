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
