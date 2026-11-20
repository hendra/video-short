import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { beat, between, blendPose, focusOffset, pulse, stepIndex } from "../src/engine/math.ts";
import type { CamPose, Line } from "../src/engine/types.ts";

describe("blendPose", () => {
  const from: CamPose = { position: [0, 0, 0], target: [0, 0, -10] };
  const to: CamPose = { position: [10, 4, 2], target: [2, 0, 0] };
  test("starts at the previous shot's pose", () => assert.deepEqual(blendPose(from, to, 0), from));
  test("ends at the new shot's pose and stays there past u=1", () => {
    assert.deepEqual(blendPose(from, to, 1), to);
    assert.deepEqual(blendPose(from, to, 2), to);
  });
  test("is halfway at u=0.5", () => assert.deepEqual(blendPose(from, to, 0.5), { position: [5, 2, 1], target: [1, 0, -5] }));
});

const line = (n: number, s: number, e: number): Line => ({ n, s, e, text: `baris ${n}` });

describe("beat", () => {
  test("is 0 before the line starts and 1 shortly after", () => {
    const l = line(1, 2, 5);
    assert.equal(beat(1.9, l), 0);
    assert.equal(beat(2, l), 0);
    assert.equal(beat(2 + 0.28, l), 1);
    assert.equal(beat(9, l), 1);
  });
  test("rises monotonically inside the lead window", () => {
    const l = line(1, 2, 5);
    const a = beat(2.05, l), b = beat(2.1, l), c = beat(2.2, l);
    assert.ok(a < b && b < c, `${a} ${b} ${c}`);
  });
});

describe("pulse", () => {
  const l = line(2, 4, 8);
  test("is 0 outside the line and 1 in the middle", () => {
    assert.equal(pulse(3.9, l), 0);
    assert.equal(pulse(4, l), 0);
    assert.equal(pulse(6, l), 1);
    assert.equal(pulse(8, l), 0);
    assert.equal(pulse(8.1, l), 0);
  });
  test("stays within [0,1] for a line shorter than two fade windows", () => {
    const short = line(3, 4, 4.1);
    for (const t of [4, 4.03, 4.05, 4.08, 4.1]) {
      const v = pulse(t, short);
      assert.ok(v >= 0 && v <= 1, `pulse(${t}) = ${v}`);
    }
  });
});

describe("between", () => {
  const a = line(1, 2, 4), b = line(2, 4, 6), c = line(3, 6, 9);
  test("spans several lines and fades at both ends", () => {
    assert.equal(between(1.5, a, c), 0);
    assert.equal(between(2, a, c), 0);
    assert.equal(between(5, a, c), 1);
    assert.equal(between(9, a, c), 0);
  });
  test("b is unused by the signature but keeps the window linear", () => {
    assert.equal(between(5, a, b), 1);
  });
});

describe("stepIndex", () => {
  const lines = [line(1, 1, 2), line(2, 3, 4), line(3, 5, 6)];
  test("returns -1 before the first line and the latest reached index after", () => {
    assert.equal(stepIndex(0.5, lines), -1);
    assert.equal(stepIndex(1, lines), 0);
    assert.equal(stepIndex(3.5, lines), 1);
    assert.equal(stepIndex(99, lines), 2);
  });
  test("returns -1 for an empty list", () => assert.equal(stepIndex(5, []), -1));
});

describe("focusOffset", () => {
  const base = { position: [0, 5, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  test("returns the base pose before any cue", () => {
    assert.deepEqual(focusOffset(base, 0, [{ at: 2, offset: [1, 0, 0] }]), base);
  });
  test("has fully applied the latest cue after its transition window", () => {
    const pose = focusOffset(base, 3, [{ at: 2, offset: [1, 0, 0], targetOffset: [0, 1, 0] }]);
    assert.deepEqual(pose.position, [1, 5, 10]);
    assert.deepEqual(pose.target, [0, 1, 0]);
  });
  test("blends from the previous cue towards the current one", () => {
    const cues = [
      { at: 1, offset: [2, 0, 0] as [number, number, number] },
      { at: 4, offset: [4, 0, 0] as [number, number, number] },
    ];
    const mid = focusOffset(base, 4.175, cues, 0.35).position[0];
    assert.ok(mid > 2 && mid < 4, `mid = ${mid}`);
  });
});
