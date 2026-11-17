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
      "## Visual: Motion Graphics",
      "## publish.json",
      "## Batas klaim",
      "## Refill backlog",
    ]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("states the exact brand line and motion/prompt rules", () => {
    const text = fs.readFileSync(briefPath, "utf8");
    assert.ok(text.includes('brand: { prefix: "AI ", accent: "Labs" }'), "brief must carry the literal brand line");
    assert.ok(text.includes('mode: "motion"'), 'brief must document mode: "motion"');
    assert.ok(text.includes("Prompt siap copy:"), 'brief must document "Prompt siap copy:" rule');
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

// ---------- Cerpenek
const cerpenekBrief = path.join(ROOT, "ops", "accounts", "cerpenek.md");
const cerpenekTopics = path.join(ROOT, "ops", "topics", "cerpenek.md");
/** `- <slug>: <judul> — <https source> (<daerah>)` */
const CERPENEK_ENTRY = /^- [a-z0-9]+(?:-[a-z0-9]+)*: .+ — https:\/\/\S+ \([^()]+\)$/;

describe("Cerpenek brief", () => {
  test("exists", () => assert.ok(fs.existsSync(cerpenekBrief), `missing ${cerpenekBrief}`));

  test("has every required section", () => {
    const text = fs.readFileSync(cerpenekBrief, "utf8");
    for (const heading of ["## Brand", "## Format", "## Topik", "## Naskah", "## Scene 3D", "## Batas isi", "## publish.json"]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("states the exact brand line and account id", () => {
    const text = fs.readFileSync(cerpenekBrief, "utf8");
    assert.ok(text.includes('brand: { prefix: "Cerpe", accent: "nek" },'), "brief must carry the literal brand line");
    assert.ok(text.includes('"account": "cerpenek"'), "brief must carry the account id");
  });

  test("forbids callouts and names the diorama prefabs", () => {
    const text = fs.readFileSync(cerpenekBrief, "utf8");
    for (const name of ["kit.figure(", "kit.island(", "kit.palm(", "kit.boat(", "kit.mountain(", "kit.hut(", "kit.animal(", "kit.bird(", "kit.swimmer("]) {
      assert.ok(text.includes(name), `brief must show ${name}`);
    }
    assert.match(text, /tanpa `callouts`/i);
  });
});

describe("Cerpenek topic entry format", () => {
  test("accepts a well-formed entry", () =>
    assert.ok(CERPENEK_ENTRY.test("- malin-kundang: Malin Kundang, anak yang lupa pada ibunya — https://example.go.id/malin (Sumatra Barat)")));
  test("rejects http sources, a missing daerah, and uppercase slugs", () => {
    assert.equal(CERPENEK_ENTRY.test("- malin-kundang: Malin Kundang — http://example.go.id/malin (Sumatra Barat)"), false);
    assert.equal(CERPENEK_ENTRY.test("- malin-kundang: Malin Kundang — https://example.go.id/malin"), false);
    assert.equal(CERPENEK_ENTRY.test("- Malin-Kundang: Malin Kundang — https://example.go.id/malin (Sumatra Barat)"), false);
  });
});

describe("Cerpenek topic backlog", () => {
  test("exists", () => assert.ok(fs.existsSync(cerpenekTopics), `missing ${cerpenekTopics}`));

  test("every dash line is a valid entry — nothing is silently skipped", () => {
    const lines = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/);
    const bad = lines.filter((l) => l.startsWith("- ") && !CERPENEK_ENTRY.test(l));
    assert.deepEqual(bad, [], `malformed dash lines: ${bad.join(" | ")}`);
  });

  test("has at least 180 entries (about a month at six videos a day) with unique slugs", () => {
    const slugs = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.slice(2).split(":")[0]);
    assert.ok(slugs.length >= 180, `backlog has ${slugs.length} entries, need >= 180`);
    assert.equal(new Set(slugs).size, slugs.length, "duplicate slugs in backlog");
  });

  test("covers at least 20 distinct daerah", () => {
    const daerah = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.slice(l.lastIndexOf("(") + 1, -1));
    assert.ok(new Set(daerah).size >= 20, `only ${new Set(daerah).size} daerah`);
  });

  test("no source is used twice", () => {
    const urls = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.match(/https:\/\/\S+/)![0]);
    assert.equal(new Set(urls).size, urls.length, "duplicate source urls in backlog");
  });

  test("stories whose core is an adult, violent, sectarian or health theme stay out", () => {
    const slugs = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.slice(2).split(":")[0]);
    const excluded = ["sangkuriang", "jaka-tarub", "rara-jonggrang", "rara-mendut", "nyi-roro-kidul", "nenek-pakande", "sureq-galigo", "asal-usul-danau-maninjau", "kisah-manik-angker", "putri-hijau", "angling-dharma", "tabuik", "pasola", "karapan-sapi", "jamu"];
    assert.deepEqual(slugs.filter((s) => excluded.includes(s)), []);
  });
});

describe("Cerpenek brief — review fixes", () => {
  const text = () => fs.readFileSync(cerpenekBrief, "utf8");
  test("tells the agent to voice with the account flag, not ambient env", () => assert.ok(text().includes("npm run tts -- <slug> --account cerpenek")));
  test("keeps the region out of the title template", () => assert.equal(/title.*Legenda dari Sumatra Barat/.test(text()), false));
  test("says how to stage object and building topics", () => assert.match(text(), /## Cerita tentang benda dan bangunan/));
  test("says what to do when no unused story fits the picked format", () => assert.match(text(), /jalankan `pick-format` sekali lagi/));
});
