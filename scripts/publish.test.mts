import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "node:test";
import { cloudinarySign, validatePublishJson, extractBufferError, youtubeSafe } from "./publish-lib.mts";

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
  const ok = { account: "kali-aja", title: "Judul", description: "desc", tiktokTitle: "tt", tiktokCaption: "tc" };
  test("valid metadata has no problems", () => assert.deepEqual(validatePublishJson(ok), []));
  test("missing required keys is reported", () => {
    assert.ok(validatePublishJson({ title: "x" }).length >= 4);
    assert.deepEqual(validatePublishJson(null), ["publish.json: not an object"]);
  });
  test("empty strings count as missing", () => {
    assert.ok(validatePublishJson({ ...ok, description: "   " }).join().includes("description"));
    assert.ok(validatePublishJson({ ...ok, account: "   " }).join().includes("account"));
  });
  test("account must be a known account id", () => {
    assert.ok(validatePublishJson({ ...ok, account: "bogus" }).join().includes("bogus"));
    assert.ok(validatePublishJson({ title: "Judul", description: "desc", tiktokTitle: "tt", tiktokCaption: "tc" }).join().includes("account"));
    assert.deepEqual(validatePublishJson({ ...ok, account: "ai-labs" }), []);
  });
  test("length caps enforced", () => {
    assert.ok(validatePublishJson({ ...ok, title: "x".repeat(101) }).join().includes("title > 100"));
    assert.ok(validatePublishJson({ ...ok, tiktokTitle: "x".repeat(91) }).join().includes("tiktokTitle > 90"));
    assert.ok(validatePublishJson({ ...ok, description: "x".repeat(5001) }).join().includes("description > 5000"));
    assert.ok(validatePublishJson({ ...ok, tiktokCaption: "x".repeat(2201) }).join().includes("tiktokCaption > 2200"));
    assert.deepEqual(validatePublishJson({ ...ok, description: "x".repeat(5000), tiktokCaption: "x".repeat(2200) }), []);
  });
  test("description cap counts UTF-8 bytes of the text YouTube receives", () => {
    assert.ok(validatePublishJson({ ...ok, description: "é".repeat(2501) }).join().includes("description > 5000"));
    // each "<" becomes a 3-byte full-width character before it is sent
    assert.ok(validatePublishJson({ ...ok, description: "<".repeat(1667) }).join().includes("description > 5000"));
    assert.deepEqual(validatePublishJson({ ...ok, description: "é".repeat(2500) }), []);
  });
});

describe("youtubeSafe", () => {
  test("replaces every < and > with full-width look-alikes", () => {
    assert.equal(youtubeSafe("Lidar (>4.400 km) <b>x</b>"), "Lidar (＞4.400 km) ＜b＞x＜/b＞");
  });
  test("leaves other text unchanged", () => {
    assert.equal(youtubeSafe("±183.000 km² — #shorts & co"), "±183.000 km² — #shorts & co");
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
