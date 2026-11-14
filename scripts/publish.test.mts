import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "node:test";
import { cloudinarySign, validatePublishJson, extractBufferError } from "./publish-lib.mts";

describe("cloudinary signature (shipped helper)", () => {
  test("sorts params alphabetically", () => {
    // keys deliberately out of order; sorted -> overwrite, public_id, timestamp
    assert.equal(
      cloudinarySign({ public_id: "shorts/x", timestamp: 123, overwrite: "true" }, "s3cr3t"),
      crypto.createHash("sha1").update("overwrite=true&public_id=shorts/x&timestamp=123s3cr3t").digest("hex"),
    );
  });
  test("sign is independent of key order", () => {
    assert.equal(cloudinarySign({ a: "1", b: "2" }, "k"), cloudinarySign({ b: "2", a: "1" }, "k"));
  });
});

describe("validatePublishJson", () => {
  const ok = { title: "Judul", description: "desc", tiktokTitle: "tt", tiktokCaption: "tc" };
  test("valid metadata has no problems", () => assert.deepEqual(validatePublishJson(ok), []));
  test("missing required keys is reported", () => {
    assert.ok(validatePublishJson({ title: "x" }).length >= 3);
    assert.deepEqual(validatePublishJson(null), ["publish.json: not an object"]);
  });
  test("empty strings count as missing", () => {
    assert.ok(validatePublishJson({ ...ok, description: "   " }).join().includes("description"));
  });
  test("length caps enforced", () => {
    assert.ok(validatePublishJson({ ...ok, title: "x".repeat(101) }).join().includes("title > 100"));
    assert.ok(validatePublishJson({ ...ok, tiktokTitle: "x".repeat(91) }).join().includes("tiktokTitle > 90"));
  });
});

describe("extractBufferError", () => {
  test("returns empty string for a successful createPost", () => {
    assert.equal(extractBufferError({ data: { createPost: { __typename: "PostActionSuccess", post: { id: "p1" } } } }), "");
  });
  test("extracts HTTP-level errors array", () => {
    assert.equal(extractBufferError({ errors: [{ message: "bad token" }] }), "bad token");
  });
  test("extracts typed error union member message", () => {
    assert.equal(
      extractBufferError({ data: { createPost: { __typename: "LimitReachedError", message: "daily limit" } } }),
      "LimitReachedError: daily limit",
    );
  });
  test("reports null payload instead of crashing", () => {
    assert.match(extractBufferError(null), /no createPost payload/);
    assert.match(extractBufferError({}), /no createPost payload/);
  });
});
