import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mergePublishedDb, parseFormat, type PublishedVideo } from "./published-db.mts";

const record = (id: string, text = "isi"): PublishedVideo => ({
  id, slug: "demo", date: "2026-11-14", platform: "youtube", title: "judul", text,
  link: null, format: null, source: "publish",
});

describe("parseFormat", () => {
  test("reads the format prefix from publish.json catatan", () => {
    assert.equal(parseFormat("format: myth-buster; sesuatu"), "myth-buster");
    assert.equal(parseFormat("  format: Expert-Explainer"), "expert-explainer");
    assert.equal(parseFormat("metadata only"), null);
  });
});

describe("mergePublishedDb", () => {
  test("is idempotent by id", () => {
    const merged = mergePublishedDb({ schema: 1, videos: [record("demo:youtube")] }, [record("demo:youtube", "baru"), record("demo:tiktok")]);
    assert.equal(merged.added, 1);
    assert.equal(merged.replaced, 1);
    assert.equal(merged.db.videos.find((v) => v.id === "demo:youtube")?.text, "baru");
    assert.equal(merged.db.videos.length, 2);
  });
});
