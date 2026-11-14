import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FORMATS, TOTAL_WEIGHT, pickFormat } from "./pick-format.mts";

describe("pickFormat", () => {
  test("pool is non-empty, weighted, and spans popular formats", () => {
    assert.ok(FORMATS.length >= 7);
    assert.ok(TOTAL_WEIGHT > FORMATS.length);
    assert.ok(FORMATS.every((format) => format.weight > 0 && format.instruction.length > 20));
    assert.deepEqual(new Set(FORMATS.map((format) => format.id)).size, FORMATS.length);
  });

  test("roll boundaries select the first and last weighted buckets", () => {
    assert.equal(pickFormat(0).id, FORMATS[0].id);
    assert.equal(pickFormat(0.999999).id, FORMATS[FORMATS.length - 1].id);
  });
});
