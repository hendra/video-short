import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CAPTION_SAFE_BOTTOM,
  TRANSITION_DUR,
  countValue,
  safeStageTop,
  stagger,
  transitionLayers,
  transitionStyles,
  typewriter,
  type TransitionKind,
} from "../src/engine/motion/math.ts";
import type { ShotSpan } from "../src/engine/types.ts";

describe("motion timing helpers", () => {
  test("stagger returns 0 before delay and hits 1 after dur", () => {
    assert.equal(stagger(0, 1.0, 2, 0.1, 0.4), 0);
    assert.equal(stagger(1.2, 1.0, 2, 0.1, 0.4), 0);
    assert.ok(stagger(1.3, 1.0, 2, 0.1, 0.4) > 0);
    assert.equal(stagger(1.6, 1.0, 2, 0.1, 0.4), 1);
    assert.equal(stagger(3.0, 1.0, 2, 0.1, 0.4), 1);
  });

  test("typewriter reveals characters proportionally from start", () => {
    assert.equal(typewriter("hello", 0, 1.0, 20), "");
    assert.equal(typewriter("hello", 1.0, 1.0, 20), "");
    assert.equal(typewriter("hello", 1.1, 1.0, 20), "he");
    assert.equal(typewriter("hello", 1.15, 1.0, 20), "hel");
    assert.equal(typewriter("hello", 5, 1.0, 20), "hello");
  });

  test("countValue clamps outside [start, start + dur] and interpolates smoothly inside", () => {
    assert.equal(countValue(0, 100, 1, 2, 1), 0);
    assert.equal(countValue(0, 100, 2, 2, 1), 0);
    assert.equal(countValue(0, 100, 2.5, 2, 1), 50);
    const quarter = countValue(0, 100, 2.25, 2, 1);
    assert.ok(quarter > 0 && quarter < 50);
    assert.equal(countValue(0, 100, 3, 2, 1), 100);
    assert.equal(countValue(0, 100, 5, 2, 1), 100);
  });
});

describe("safeStageTop", () => {
  test("accounts for multiline titles and elements under header while staying above caption safe bottom", () => {
    assert.equal(CAPTION_SAFE_BOTTOM, 1230);
    const singleNull = safeStageTop("Satu baris", null);
    const singleCta = safeStageTop("Satu baris", "cta");
    const twoChip = safeStageTop("Baris satu\nBaris dua", "chip");

    assert.equal(singleNull, 333);
    assert.equal(singleCta, 421);
    assert.equal(twoChip, 528);
    assert.ok(singleNull < twoChip);
    assert.ok(twoChip < CAPTION_SAFE_BOTTOM);
  });
});

describe("transitionLayers", () => {
  const shots: ShotSpan[] = [
    { id: "s1", s: 0, e: 4 },
    { id: "s2", s: 4, e: 8 },
    { id: "s3", s: 8, e: 12 },
  ];

  test("first shot at t = 0 has no previous layer and progress 1", () => {
    assert.deepEqual(transitionLayers(shots, 0), { activeIdx: 0, prevIdx: null, progress: 1 });
    assert.deepEqual(transitionLayers(shots, -1), { activeIdx: 0, prevIdx: null, progress: 1 });
  });

  test("mid-transition at shot[1].s + 0.18 yields activeIdx 1, prevIdx 0, progress ~0.5", () => {
    assert.equal(TRANSITION_DUR, 0.36);
    const mid = transitionLayers(shots, shots[1].s + 0.18);
    assert.equal(mid.activeIdx, 1);
    assert.equal(mid.prevIdx, 0);
    assert.ok(Math.abs(mid.progress - 0.5) < 1e-12);
  });

  test("after transition window finishes, prevIdx becomes null and progress is 1", () => {
    assert.deepEqual(transitionLayers(shots, shots[1].s + TRANSITION_DUR), {
      activeIdx: 1,
      prevIdx: null,
      progress: 1,
    });
  });

  test("short shot (< TRANSITION_DUR) clamps window cleanly without NaN", () => {
    const shortShots: ShotSpan[] = [
      { id: "s1", s: 0, e: 4 },
      { id: "s2", s: 4, e: 4.2 },
      { id: "s3", s: 4.2, e: 8 },
    ];
    const mid = transitionLayers(shortShots, 4.1);
    assert.equal(mid.activeIdx, 1);
    assert.equal(mid.prevIdx, 0);
    assert.equal(Number.isFinite(mid.progress), true);
    assert.ok(Math.abs(mid.progress - 0.5) < 1e-9);

    const atEnd = transitionLayers(
      [
        { id: "s1", s: 0, e: 4 },
        { id: "s2", s: 4, e: 4.2 },
      ],
      4.2,
    );
    assert.deepEqual(atEnd, { activeIdx: 1, prevIdx: null, progress: 1 });
  });

  test("t >= lastShot.e clamps to lastIdx with prevIdx null and progress 1", () => {
    assert.deepEqual(transitionLayers(shots, 12), { activeIdx: 2, prevIdx: null, progress: 1 });
    assert.deepEqual(transitionLayers(shots, 99), { activeIdx: 2, prevIdx: null, progress: 1 });
  });
});

describe("transitionStyles", () => {
  const kinds: TransitionKind[] = ["zoom-cross", "slide-up", "slide-left", "wipe", "scale-fade"];

  test("returns finite transforms and valid bounds for all 5 kinds at progress 0, 0.5, 1", () => {
    for (const kind of kinds) {
      for (const p of [0, 0.5, 1]) {
        const { incoming, outgoing } = transitionStyles(kind, p);
        for (const layer of [incoming, outgoing]) {
          for (const v of Object.values(layer)) {
            assert.equal(Number.isFinite(v), true, `${kind} at ${p} has non-finite value`);
          }
          assert.ok(layer.opacity >= 0 && layer.opacity <= 1, `${kind} opacity out of bounds at ${p}`);
          assert.ok(layer.clipInsetRight >= 0 && layer.clipInsetRight <= 100, `${kind} clipInsetRight out of bounds at ${p}`);
          assert.ok(layer.wipeGlowOpacity >= 0 && layer.wipeGlowOpacity <= 1, `${kind} wipeGlowOpacity out of bounds at ${p}`);
        }
      }

      const end = transitionStyles(kind, 1);
      assert.deepEqual(end.incoming, {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipInsetRight: 0,
        wipeGlowOpacity: 0,
      });
      assert.equal(end.outgoing.opacity, 0);

      const start = transitionStyles(kind, 0);
      assert.deepEqual(start.outgoing, {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipInsetRight: 0,
        wipeGlowOpacity: 0,
      });
    }
  });
});
