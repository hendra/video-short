import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { findDuplicate, significantTokens } from "./duplicate-core.mts";

const candidate = {
  title: "Kenapa PLN target 70 gigawatt energi bersih",
  tiktokTitle: "PLN kejar 70 GW energi bersih",
  description: "PLN memasang PLTS dan target RUPTL 70 gigawatt. Sumber: RUPTL 2025-2034.",
  tiktokCaption: "PLN kejar 70 GW energi bersih. Sumber: RUPTL.",
};

describe("significantTokens", () => {
  test("drops boilerplate and keeps distinctive words and numbers", () => {
    assert.deepEqual([...significantTokens("Sumber: https://x.com/a PLN 70 GW energi bersih. Mau dibongkar apa lagi? Tulis di komentar.")], ["pln", "70", "energi", "bersih"]);
  });
});

describe("findDuplicate", () => {
  test("blocks near-match to a recent post", () => {
    const match = findDuplicate(candidate, [{ text: "PLN target 70 gigawatt energi bersih dalam RUPTL 2025-2034 #shorts", title: "PLN kejar 70 GW energi bersih", platform: "youtube" }]);
    assert.ok(match);
    assert.equal(match.field, "title");
  });

  test("allows a different topic with shared channel words", () => {
    assert.equal(findDuplicate(candidate, [{ text: "Kali Aja Tau: kenapa jembatan Suramadu punya bentuk melengkung. #shorts", title: "Kenapa jembatan Suramadu melengkung" }]), null);
  });

  test("ignores empty recent posts", () => {
    assert.equal(findDuplicate(candidate, [{ text: "", title: null }]), null);
  });
});
