import assert from "node:assert/strict";
import { test } from "node:test";
import type { Timeline } from "../src/engine/types";
import { checkTimelineSync } from "./sync-core.mts";

const mkTl = (words: { w: string; s: number; e: number }[], dur = 5): Timeline => ({
  dur,
  lines: [{ n: 1, s: words[0]?.s ?? 0, e: words[words.length - 1]?.e ?? 0, text: words.map((x) => x.w).join(" ") }],
  chunks: [{ s: words[0]?.s ?? 0, e: words[words.length - 1]?.e ?? 0, words }],
  shots: [{ id: "s1", s: 0, e: dur }],
});

test("clean synchronized timeline passes with zero problems", () => {
  const tl = mkTl([
    { w: "satu", s: 0.2, e: 0.6 },
    { w: "dua", s: 0.6, e: 1.0 },
    { w: "tiga", s: 1.5, e: 2.0 },
  ], 3.0);
  tl.chunks = [
    { s: 0.2, e: 1.0, words: tl.chunks[0].words.slice(0, 2) },
    { s: 1.5, e: 2.0, words: tl.chunks[0].words.slice(2) },
  ];
  assert.deepEqual(checkTimelineSync(tl, [[0.2, 1.0], [1.5, 2.0]], 2.2), []);
});

test("rejects a caption chunk starting more than 0.15s inside silence", () => {
  const tl = mkTl([
    { w: "Perjanjian", s: 8.86, e: 9.79 },
    { w: "karbon", s: 9.79, e: 10.2 },
  ], 12);
  const errs = checkTimelineSync(tl, [[8.1, 8.86], [9.35, 11.18]], 11.2);
  assert.ok(errs.some((e) => e.includes("chunk 0") && e.includes("silence")));
});

test("rejects a word straddling more than 0.15s of silence", () => {
  const tl = mkTl([
    { w: "satu", s: 0.2, e: 0.9 },
    { w: "dua", s: 0.9, e: 1.9 },
  ], 3);
  const errs = checkTimelineSync(tl, [[0.2, 1.0], [1.5, 2.2]], 2.3);
  assert.ok(errs.some((e) => e.includes("straddles silence")));
});

test("rejects non-monotonic or out-of-bounds word timestamps", () => {
  const tl = mkTl([
    { w: "satu", s: 1.0, e: 0.8 },
    { w: "dua", s: 0.7, e: 2.6 },
  ], 3);
  const errs = checkTimelineSync(tl, [[0.2, 2.2]], 2.2);
  assert.ok(errs.length >= 2);
});

test("allows short natural pause <= 0.15s without false positive", () => {
  const tl = mkTl([
    { w: "satu", s: 0.2, e: 0.95 },
    { w: "dua", s: 0.95, e: 1.5 },
  ], 2.5);
  assert.deepEqual(checkTimelineSync(tl, [[0.2, 0.9], [1.02, 1.5]], 1.6), []);
});
