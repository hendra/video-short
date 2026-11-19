import assert from "node:assert/strict";
import { test } from "node:test";
import { pairPhrases, wordsFromSpans } from "./align-core.mts";

const span = (segs: [number, number][]) => ({ s: segs[0][0], e: segs[segs.length - 1][1], segs });

test("pauses are pinned to punctuation when phrases and segments line up", () => {
  // first phrase is spoken a little slowly: without anchoring "tiga" would start before the pause ends
  const words = wordsFromSpans(["satu dua, tiga empat lima enam"], [span([[0, 1.2], [1.7, 4]])]);
  assert.ok(Math.abs(words[1].end - 1.2) < 1e-9);
  assert.ok(Math.abs(words[2].start - 1.7) < 1e-3);
  assert.equal(words[5].end, 4);
});

test("a lone dash takes no time and still ends its phrase", () => {
  const words = wordsFromSpans(["bukan gas — tapi karbon"], [span([[0, 1], [1.4, 2.4]])]);
  assert.equal(words[2].start, words[2].end);
  assert.ok(Math.abs(words[3].start - 1.4) < 1e-3);
});

test("fewer pauses than punctuation marks: phrases merge, timing stays monotonic and inside the speech", () => {
  const ws = "fokus awal: pembangkit surya, termasuk baterai, begitu katanya".split(" ");
  const segs: [number, number][] = [[0, 0.9], [1.3, 2.6], [2.8, 4.2]];
  const blocks = pairPhrases(ws, segs);
  assert.ok(blocks.length <= 3);
  assert.deepEqual([blocks[0][0], blocks[blocks.length - 1][1]], [0, ws.length]);
  const words = wordsFromSpans([ws.join(" ")], [span(segs)]);
  words.forEach((w, i) => {
    assert.ok(w.start <= w.end && w.start >= 0 && w.end <= 4.2);
    if (i) assert.ok(w.start >= words[i - 1].end - 1e-3);
  });
});

test("an unpunctuated line with an inner pause splits at the pause instead of straddling it", () => {
  const words = wordsFromSpans(["satu dua tiga empat"], [span([[0, 1.0], [1.45, 2.45]])]);
  assert.ok(words[1].end <= 1.0 + 1e-6);
  assert.ok(words[2].start >= 1.45 - 1e-6);
});

test("mid-phrase pause wins over wrong comma when speech lengths show which half paused", () => {
  const ws = "Perjanjian karbon pertama, diteken di Antalya".split(" ");
  const segs: [number, number][] = [[0, 0.48], [0.98, 2.95]];
  const blocks = pairPhrases(ws, segs);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], [0, 1, 0, 1]);
  assert.deepEqual(blocks[1], [1, 6, 1, 2]);
});
