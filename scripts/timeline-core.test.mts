import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { chunksOf } from "./timeline-core.mts";

const words = (s: string) => s.split(/\s+/).map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.35 }));
const joinChunks = (cs: ReturnType<typeof chunksOf>) => cs.map((c) => c.map((w) => w.w).join(" "));

describe("chunksOf", () => {
  test("splits before a long spelled-out number so each chunk stays within 2 lines and keeps the number intact", () => {
    const res = joinChunks(chunksOf(words("Russell Hobbs K1 tahun seribu sembilan ratus lima puluh lima.")));
    assert.deepEqual(res, ["Russell Hobbs K1 tahun", "seribu sembilan ratus lima puluh lima."]);
  });

  test("keeps short number phrases together without creating a 1-word orphan chunk", () => {
    const res = joinChunks(chunksOf(words("Hanya dua puluh delapan meter.")));
    assert.deepEqual(res, ["Hanya dua puluh delapan meter."]);
  });

  test("splits long non-number phrases into balanced chunks of at most 5 tokens", () => {
    const res = joinChunks(chunksOf(words("Air panas mengalir ke atas melewati pipa kecil itu.")));
    assert.deepEqual(res, ["Air panas mengalir ke atas", "melewati pipa kecil itu."]);
  });
});
