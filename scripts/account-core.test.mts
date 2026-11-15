import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACCOUNTS } from "../src/accounts.ts";
import { accountProblems, brandProblems, envLines, resolveAccountArg } from "./account-core.mts";

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
    assert.equal(env.get("AGENT_MODEL"), "opencode/inkling-2-small-free");
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
