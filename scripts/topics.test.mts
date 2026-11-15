import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ROOT } from "./lib.mts";

const briefPath = path.join(ROOT, "ops", "accounts", "ai-labs.md");
const topicsPath = path.join(ROOT, "ops", "topics", "ai-labs.md");

const ENTRY = /^- ([a-z0-9-]+): (.+) — (https:\/\/\S+) \((Claude|ChatGPT|Gemini|OpenCode)\)$/;
/** An entry line starts with a slug; the file may also contain prose lines. */
const ENTRY_LINE = /^- [a-z0-9-]+: /;

const entryLines = (text: string): string[] => text.split(/\r?\n/).filter((l) => ENTRY_LINE.test(l));

describe("AI Labs brief", () => {
  test("exists", () => assert.ok(fs.existsSync(briefPath), `missing ${briefPath}`));

  test("has every required section", () => {
    const text = fs.readFileSync(briefPath, "utf8");
    for (const heading of [
      "## Brand",
      "## Format",
      "## Topik",
      "## Naskah",
      "## Scene 3D",
      "## publish.json",
      "## Batas klaim",
      "## Refill backlog",
    ]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("states the exact brand line the video source must contain", () => {
    const text = fs.readFileSync(briefPath, "utf8");
    assert.ok(text.includes('brand: { prefix: "AI ", accent: "Labs" }'), "brief must carry the literal brand line");
  });
});

describe("AI Labs topic backlog", () => {
  test("exists", () => assert.ok(fs.existsSync(topicsPath), `missing ${topicsPath}`));

  test("has at least 40 entries", () => {
    const entries = entryLines(fs.readFileSync(topicsPath, "utf8"));
    assert.ok(entries.length >= 40, `backlog has ${entries.length} entries, need >= 40`);
  });

  test("every entry has a slug, a title, an https source url and a tool", () => {
    for (const line of entryLines(fs.readFileSync(topicsPath, "utf8"))) {
      assert.ok(ENTRY.test(line), `malformed entry: ${line}`);
    }
  });

  test("every dash line is a valid entry — nothing is silently skipped", () => {
    const lines = fs.readFileSync(topicsPath, "utf8").split(/\r?\n/);
    const bad = lines.filter((l) => l.startsWith("- ") && !ENTRY.test(l));
    assert.deepEqual(bad, [], `malformed dash lines: ${bad.join(" | ")}`);
  });

  test("slugs are unique", () => {
    const slugs = entryLines(fs.readFileSync(topicsPath, "utf8")).map((l) => l.slice(2).split(":")[0].trim());
    assert.equal(new Set(slugs).size, slugs.length, "duplicate slugs in backlog");
  });
});
