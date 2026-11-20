import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACCOUNTS } from "../src/accounts.ts";
import {
  accountMusicProblems,
  accountProblems,
  aiLabsVideoProblems,
  brandProblems,
  cerpenekMusicProblems,
  envLines,
  resolveAccountArg,
  sastraMesinVideoProblems,
  voiceProblem,
} from "./account-core.mts";

const ALL_ACCOUNTS = Object.values(ACCOUNTS);
const kaliAja = ACCOUNTS["kali-aja"];
const aiLabs = ACCOUNTS["ai-labs"];

describe("brandProblems", () => {
  test("accepts the account's own brand literal", () => {
    assert.deepEqual(brandProblems('brand: { prefix: "AI ", accent: "Labs" },', aiLabs, ALL_ACCOUNTS), []);
    assert.deepEqual(brandProblems('brand: { prefix: "Kali Aja ", accent: "Tau" },', kaliAja, ALL_ACCOUNTS), []);
  });

  test("rejects a missing brand literal", () => {
    const problems = brandProblems('brand: { prefix: "AI", accent: "Labs" },', aiLabs, ALL_ACCOUNTS);
    assert.ok(problems.some((p) => p.includes("prefix")), problems.join("; "));
  });

  test("rejects another account's brand", () => {
    const problems = brandProblems('brand: { prefix: "Kali Aja ", accent: "Tau" },', aiLabs, ALL_ACCOUNTS);
    assert.ok(problems.some((p) => p.includes("akun lain")), problems.join("; "));
    assert.ok(problems.some((p) => p.includes("kali-aja")), problems.join("; "));
  });
});

describe("accountProblems", () => {
  test("accepts a matching account", () => {
    assert.deepEqual(accountProblems({ account: "ai-labs" }, "ai-labs"), []);
  });

  test("rejects a missing account field", () => {
    assert.ok(accountProblems({}, "ai-labs").some((p) => p.includes("account")));
  });

  test("rejects an unknown account id", () => {
    assert.ok(accountProblems({ account: "bogus" }, "ai-labs").some((p) => p.includes("bogus")));
  });

  test("rejects a mismatch between video account and run account", () => {
    assert.ok(accountProblems({ account: "kali-aja" }, "ai-labs").some((p) => p.includes("ai-labs")));
  });
});

describe("envLines", () => {
  const lines = envLines(aiLabs, "/tmp/published-videos-ai-labs.json");

  test("emits the CI environment the workflow needs", () => {
    const env = new Map(lines.map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    assert.equal(env.get("ACCOUNT"), "ai-labs");
    assert.equal(env.get("ACCOUNT_LABEL"), "AI Labs");
    assert.equal(env.get("BRAND_LINE"), 'brand: { prefix: "AI ", accent: "Labs" }');
    assert.equal(env.get("YOUTUBE_CATEGORY_ID"), "28");
    assert.equal(env.get("AGENT_MODEL"), "opencode/deepseek-v4.1-flash-free");
    assert.equal(env.get("AGENT_FILES"), "AGENTS.md ops/ci-prompt.md ops/accounts/ai-labs.md ops/topics/ai-labs.md");
    assert.equal(env.get("CATALOG_PATH"), "/tmp/published-videos-ai-labs.json");
  });

  test("the agent prompt carries the brand line, the catalog and the stop rule", () => {
    const prompt = lines.find((l) => l.startsWith("AGENT_PROMPT="))!.slice("AGENT_PROMPT=".length);
    assert.ok(prompt.includes('brand: { prefix: "AI ", accent: "Labs" }'), prompt);
    assert.ok(prompt.includes("/tmp/published-videos-ai-labs.json"), prompt);
    assert.ok(prompt.includes("Stop before any publish/upload/render step."), prompt);
  });

  test("no value contains a newline (GITHUB_ENV is line based)", () => {
    for (const line of lines) assert.equal(line.includes("\n"), false, line);
  });
});

describe("resolveAccountArg", () => {
  test("no flag and no env → default account", () => assert.equal(resolveAccountArg(undefined, undefined).id, "kali-aja"));
  test("env picks the account", () => assert.equal(resolveAccountArg(undefined, "ai-labs").id, "ai-labs"));
  test("flag wins over env", () => assert.equal(resolveAccountArg("kali-aja", "ai-labs").id, "kali-aja"));
  test("unknown id throws", () => assert.throws(() => resolveAccountArg(undefined, "nope"), /Unknown account "nope"/));
  test("empty string throws instead of defaulting", () => assert.throws(() => resolveAccountArg(undefined, ""), /Unknown account ""/));
});

describe("voiceProblem", () => {
  test("a chosen voice has no problem", () => assert.equal(voiceProblem(kaliAja), null));
  test("a placeholder voice is reported with the account id", () => {
    const problem = voiceProblem({ ...kaliAja, id: "cerpenek", tts: { voice: "TODO_VOICE", style: "x" } });
    assert.match(problem ?? "", /suara akun cerpenek belum dipilih/);
  });
});

describe("aiLabsVideoProblems", () => {
  test("accepts valid motion video without PromptCard", () => {
    assert.deepEqual(
      aiLabsVideoProblems({
        indexSource: 'export const VIDEO = { mode: "motion", captions: false, cta: { text: "Follow!" } };',
        shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
        hasWorldFile: false,
        publishJson: { description: "Penjelasan AI CLI tools." },
        naskahText: "01  Line one\n02  Line two\n03  Follow akun ini.",
      }),
      [],
    );
  });

  test('rejects missing mode: "motion" in indexSource', () => {
    const problems = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { cta: { text: "Follow!" } };',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: false,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(problems.some((p) => p.includes('mode: "motion"')), problems.join("; "));
  });

  test("rejects world.ts when hasWorldFile is true", () => {
    const problems = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { mode: "motion" };',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: true,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(problems.some((p) => p.includes("world.ts")), problems.join("; "));
  });

  test("accepts PromptCard when description has Prompt siap copy and naskah/CTA mentions deskripsi", () => {
    assert.deepEqual(
      aiLabsVideoProblems({
        indexSource: 'export const VIDEO = { mode: "motion", captions: false, cta: { text: "Simpan!" } };',
        shotsSource: 'export const shots = () => <PromptCard prompt="Act as..." />;',
        hasWorldFile: false,
        publishJson: { description: 'Ringkasan.\n\nPrompt siap copy:\n"Act as a senior engineer"' },
        naskahText: "01  Intro\n02  Middle\n03  Cek deskripsi buat copy prompt-nya.",
      }),
      [],
    );
    assert.deepEqual(
      aiLabsVideoProblems({
        indexSource: 'export const VIDEO = { mode: "motion", captions: false, cta: { text: "Copy prompt di deskripsi!" } };',
        shotsSource: 'export const shots = () => <PromptCard prompt="Act as..." />;',
        hasWorldFile: false,
        publishJson: { description: 'Prompt siap copy:\n"Act as a senior engineer"' },
        naskahText: "01  Intro\n02  Middle\n03  Gas cobain sekarang.",
      }),
      [],
    );
  });

  test('rejects PromptCard when description lacks "Prompt siap copy:"', () => {
    const problems = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { mode: "motion", captions: false, cta: { text: "Cek deskripsi" } };',
      shotsSource: 'export const shots = () => <PromptCard prompt="Act as..." />;',
      hasWorldFile: false,
      publishJson: { description: "Prompt ini bagus banget." },
      naskahText: "01  Cek deskripsi ya.",
    });
    assert.ok(problems.some((p) => p.includes("Prompt siap copy:")), problems.join("; "));
  });

  test('rejects PromptCard when neither CTA nor last 3 lines of naskah mentions "deskripsi"', () => {
    const problems = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { mode: "motion", captions: false, cta: { text: "Follow!" } };',
      shotsSource: 'export const shots = () => <PromptCard prompt="Act as..." />;',
      hasWorldFile: false,
      publishJson: { description: 'Prompt siap copy:\n"Act as a senior engineer"' },
      naskahText: "01  Di deskripsi ada bahannya\n02  Langkah satu\n03  Langkah dua\n04  Follow sekarang!",
    });
    assert.ok(problems.some((p) => p.includes("deskripsi")), problems.join("; "));
  });

  test("ignores PromptCard in imports or comments when <PromptCard is not rendered", () => {
    assert.deepEqual(
      aiLabsVideoProblems({
        indexSource: 'export const VIDEO = { mode: "motion", captions: false, cta: { text: "Follow!" } };',
        shotsSource: [
          'import { TerminalCard, PromptCard } from "../../engine/motion/index.ts";',
          "// Not using PromptCard here",
          'export const shots = () => <TerminalCard title="CLI" />;',
        ].join("\n"),
        hasWorldFile: false,
        publishJson: { description: "Penjelasan AI CLI tools tanpa prompt block." },
        naskahText: "01  Intro\n02  Middle\n03  Follow akun ini.",
      }),
      [],
    );
  });

  test("rejects missing captions: false or captions: true in indexSource", () => {
    const missing = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { mode: "motion", cta: { text: "Follow!" } };',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: false,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(missing.some((p) => p.includes("captions: false")), missing.join("; "));

    const enabled = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = { mode: "motion", captions: true };',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: false,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(enabled.some((p) => p.includes("captions: false")), enabled.join("; "));

    const commented = aiLabsVideoProblems({
      indexSource: 'export const VIDEO = {\n  mode: "motion",\n  // captions: false,\n};',
      shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
      hasWorldFile: false,
      publishJson: { description: "Penjelasan AI CLI tools." },
      naskahText: "01  Line one",
    });
    assert.ok(commented.some((p) => p.includes("captions: false")), commented.join("; "));
  });

  test("accepts multiline captions: false in indexSource", () => {
    assert.deepEqual(
      aiLabsVideoProblems({
        indexSource: 'export const VIDEO = {\n  mode: "motion",\n  captions: false,\n};',
        shotsSource: 'export const shots = () => <TerminalCard title="CLI" />;',
        hasWorldFile: false,
        publishJson: { description: "Penjelasan AI CLI tools." },
        naskahText: "01  Line one",
      }),
      [],
    );
  });
});

describe("cerpenekMusicProblems", () => {
  test("accepts all 5 valid Cerpenek mood names", () => {
    for (const music of ["ceria", "hangat", "petualang", "nusantara", "ajaib"]) {
      assert.deepEqual(cerpenekMusicProblems({ music }), []);
    }
  });

  test("rejects missing config or missing music field", () => {
    assert.ok(cerpenekMusicProblems(null).some((p) => p.includes("config.json") && p.includes("music")));
    assert.ok(cerpenekMusicProblems({}).some((p) => p.includes("config.json") && p.includes("music")));
  });

  test("rejects unknown mood names with valid choices", () => {
    const problems = cerpenekMusicProblems({ music: "seram" });
    assert.ok(problems.some((p) => p.includes("ceria, hangat, petualang, nusantara, ajaib")), problems.join("; "));
  });
});

describe("accountMusicProblems", () => {
  test("accepts valid moods for each account and rejects cross-account or empty values", () => {
    for (const music of ["build", "debug", "showcase"]) {
      assert.deepEqual(accountMusicProblems({ music }, "ai-labs"), []);
    }
    for (const music of ["teknik", "misteri", "fenomena"]) {
      assert.deepEqual(accountMusicProblems({ music }, "kali-aja"), []);
    }
    for (const music of ["rakit", "aliran", "rahasia"]) {
      assert.deepEqual(accountMusicProblems({ music }, "sastra-mesin"), []);
    }
    assert.ok(accountMusicProblems({ music: "ceria" }, "ai-labs").some((p) => p.includes("build, debug, showcase")));
    assert.ok(accountMusicProblems({ music: "" }, "kali-aja").some((p) => p.includes("teknik, misteri, fenomena")));
    assert.ok(accountMusicProblems({ music: 123 }, "cerpenek").some((p) => p.includes("ceria, hangat, petualang, nusantara, ajaib")));
  });
});

describe("sastraMesinVideoProblems", () => {
  const ok = `export const video = { theme: "blueprint", fov: 40 };`;
  test("accepts a 3D blueprint video (either quote style)", () => {
    assert.deepEqual(sastraMesinVideoProblems({ indexSource: ok, hasWorldFile: true }), []);
    assert.deepEqual(sastraMesinVideoProblems({ indexSource: ok.replace(/"/g, "'"), hasWorldFile: true }), []);
  });
  test("rejects a missing theme, a commented-out theme, motion mode, and no world.ts", () => {
    assert.equal(sastraMesinVideoProblems({ indexSource: `const v = {};`, hasWorldFile: true }).length, 1);
    assert.equal(sastraMesinVideoProblems({ indexSource: `// theme: "blueprint"`, hasWorldFile: true }).length, 1);
    assert.ok(sastraMesinVideoProblems({ indexSource: `${ok} mode: "motion"`, hasWorldFile: true }).length >= 1);
    assert.equal(sastraMesinVideoProblems({ indexSource: ok, hasWorldFile: false }).length, 1);
  });
});
