import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chunksOf } from "./timeline-core.mts";

const words = (s: string) => s.split(/\s+/).map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.35 }));
const joinChunks = (cs: ReturnType<typeof chunksOf>) => cs.map((c) => c.map((w) => w.w).join(" "));

describe("chunksOf", () => {
  test("keeps a long spelled-out number intact in its own chunk, other chunks at most 3 words", () => {
    const res = joinChunks(chunksOf(words("Russell Hobbs K1 tahun seribu sembilan ratus lima puluh lima.")));
    assert.ok(res.includes("seribu sembilan ratus lima puluh lima."), res.join(" | "));
    assert.ok(res.filter((c) => !c.startsWith("seribu")).every((c) => c.split(" ").length <= 3), res.join(" | "));
    assert.equal(res.join(" "), "Russell Hobbs K1 tahun seribu sembilan ratus lima puluh lima.");
  });

  test("keeps short number phrases together without creating a 1-word orphan chunk", () => {
    const res = joinChunks(chunksOf(words("Hanya dua puluh delapan meter.")));
    assert.deepEqual(res, ["Hanya dua puluh delapan meter."]);
  });

  test("splits long non-number phrases into balanced chunks of at most 3 tokens", () => {
    const res = joinChunks(chunksOf(words("Air panas mengalir ke atas melewati pipa kecil itu.")));
    assert.deepEqual(res, ["Air panas mengalir", "ke atas melewati", "pipa kecil itu."]);
  });

  test("a long paragraph without numbers never shows more than 3 words at once", () => {
    const para = Array.from({ length: 40 }, (_, i) => (i % 11 === 10 ? "kata," : "kata")).join(" ") + ".";
    for (const c of chunksOf(words(para))) assert.ok(c.length <= 3, c.map((w) => w.w).join(" "));
  });
});
