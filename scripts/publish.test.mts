import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "node:test";
import {
  bufferChannelIds,
  cloudinarySign,
  extractBufferError,
  instagramInput,
  mapBufferPostNode,
  validatePublishJson,
  youtubeMetadata,
  youtubeSafe,
} from "./publish-lib.mts";
import { ACCOUNTS } from "../src/accounts.ts";

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

describe("youtubeMetadata", () => {
  test("existing accounts are unchanged", () => {
    for (const id of ["kali-aja", "ai-labs"] as const) {
      const m = youtubeMetadata(ACCOUNTS[id], "Judul <a>");
      assert.equal(m.madeForKids, false);
      assert.equal(m.notifySubscribers, true);
      assert.equal(m.isAiGenerated, true);
      assert.equal(m.privacy, "public");
      assert.equal(m.categoryId, ACCOUNTS[id].youtubeCategoryId);
      assert.equal(m.title, "Judul ＜a＞");
    }
  });

  test("follows the account flag", () =>
    assert.equal(youtubeMetadata({ ...ACCOUNTS["kali-aja"], madeForKids: true }, "x").madeForKids, true));
});

describe("instagramInput", () => {
  test("builds a Buffer Reel payload sharing to feed with AI flag", () => {
    const p = instagramInput("6afe07c2ece6dfde5f116be8", "https://cdn/v.mp4", "Caption #shorts");
    assert.deepEqual(p, {
      channelId: "6afe07c2ece6dfde5f116be8",
      mode: "shareNow",
      schedulingType: "automatic",
      needsApproval: false,
      text: "Caption #shorts",
      assets: [{ video: { url: "https://cdn/v.mp4" } }],
      metadata: { instagram: { type: "reel", shouldShareToFeed: true, isAiGenerated: true } },
    });
  });
});

describe("bufferChannelIds and mapBufferPostNode", () => {
  test("includes instagramChannelId only when configured", () => {
    assert.equal(bufferChannelIds(ACCOUNTS["kali-aja"].buffer).length, 2);
    assert.deepEqual(bufferChannelIds(ACCOUNTS["sastra-mesin"].buffer), [
      "6afdf52fece6dfde5f101631",
      "6afdf54bece6dfde5f101af0",
      "6afe07c2ece6dfde5f116be8",
    ]);
  });

  test("maps instagram, tiktok, and youtube nodes and drops incomplete nodes", () => {
    assert.equal(mapBufferPostNode({ id: "1", text: "x", channelService: "instagram" })?.platform, "instagram");
    assert.equal(mapBufferPostNode({ id: "2", text: "x", channelService: "tiktok" })?.platform, "tiktok");
    assert.equal(mapBufferPostNode({ id: "3", text: "x", channelService: "youtube" })?.platform, "youtube");
    assert.equal(mapBufferPostNode({ id: "4" }), null);
  });
});
