import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildReportText } from "./report-lib.mts";

describe("buildReportText (Slack payload, shipped helper)", () => {
  test("error report mentions step and truncates message", () => {
    const t = buildReportText({ slug: "x", step: "gates", error: "e".repeat(400) });
    assert.match(t, /run gagal di \*gates\*/);
    assert.equal(t.includes("e".repeat(301)), false);
  });
  test("error report without step says unknown step", () => {
    assert.match(buildReportText({ slug: "x", error: "boom" }), /\*unknown step\*/);
  });
  test("success report embeds both links and slug", () => {
    const t = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2" });
    assert.match(t, /https:\/\/yt\/1/);
    assert.match(t, /https:\/\/tt\/2/);
    assert.match(t, /`video-id`/);
  });
  test("success report does not claim a self-hosted runner", () => {
    const t = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2" });
    assert.doesNotMatch(t, /self-hosted/);
  });
  test("empty links and no error yields the informational fallback", () => {
    assert.match(buildReportText({ slug: "x" }), /tidak ada links\/error/);
  });
});
