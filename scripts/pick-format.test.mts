import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACCOUNT_IDS } from "../src/accounts.ts";
import { formatsFor, pickFormat } from "./pick-format.mts";

describe("per-account format pools", () => {
  test("every account has a non-empty, weighted, unique-id pool", () => {
    for (const id of ACCOUNT_IDS) {
      const pool = formatsFor(id);
      assert.ok(pool.length >= 7, `${id} pool too small: ${pool.length}`);
      assert.ok(pool.every((format) => format.weight > 0 && format.instruction.length > 20), `${id}: bad weight/instruction`);
      assert.equal(new Set(pool.map((f) => f.id)).size, pool.length, `${id}: duplicate ids`);
      assert.ok(pool.reduce((sum, f) => sum + f.weight, 0) > pool.length, `${id}: weights do not outweigh the count`);
    }
  });

  test("the Kali Aja pool is unchanged", () => {
    const ids = formatsFor("kali-aja").map((f) => f.id);
    assert.deepEqual(ids, [
      "expert-explainer",
      "numbered-listicle",
      "myth-buster",
      "mystery-story",
      "before-after",
      "how-to-tutorial",
      "storytime",
      "qa-rapid",
      "viewer-challenge",
      "problem-solution",
      "mini-documentary",
    ]);
  });

  test("the AI Labs pool avoids the forbidden 3-steps framework", () => {
    assert.equal(formatsFor("ai-labs").some((f) => f.id === "how-to-tutorial"), false);
    assert.ok(formatsFor("ai-labs").length >= 8);
  });
});

describe("Cerpenek pool", () => {
  test("is a story pool: no explainer or tutorial frameworks", () => {
    const ids = formatsFor("cerpenek").map((f) => f.id);
    assert.deepEqual(ids, ["dongeng-klasik", "asal-usul-tempat", "tokoh-sejarah", "tebak-dulu", "kenapa-begitu", "sahabat-hewan", "asal-usul-benda"]);
  });
});

describe("pickFormat", () => {
  test("roll boundaries select the first and last weighted bucket per account", () => {
    for (const id of ACCOUNT_IDS) {
      assert.equal(pickFormat(id, 0).id, formatsFor(id)[0].id);
      assert.equal(pickFormat(id, 0.999999).id, formatsFor(id)[formatsFor(id).length - 1].id);
    }
  });

  test("no account selected returns a Kali Aja format", () => {
    assert.equal(formatsFor("kali-aja").includes(pickFormat()), true);
  });

  test("roll outside [0,1) throws", () => {
    assert.throws(() => pickFormat("kali-aja", 1));
    assert.throws(() => pickFormat("kali-aja", Number.NaN));
  });
});
