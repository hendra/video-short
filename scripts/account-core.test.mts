import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACCOUNTS } from "../src/accounts.ts";
import { accountProblems, brandProblems, envLines, missingSecrets, secretNameFor } from "./account-core.mts";

const ALL_ACCOUNTS = Object.values(ACCOUNTS);
const kaliAja = ACCOUNTS["kali-aja"];
const aiLabs = ACCOUNTS["ai-labs"];

describe("missingSecrets", () => {
  const fill = (account: (typeof ACCOUNTS)["kali-aja"] | (typeof ACCOUNTS)["ai-labs"]) =>
    Object.fromEntries(
      ["GEMINI_API_KEY", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "BUFFER_ACCESS_TOKEN"]
        .map((k) => [secretNameFor(account, k), "value"]),
    );

  test("AI Labs reports every missing AI_LABS_* secret by the secret name", () => {
    assert.deepEqual(missingSecrets(aiLabs, {}), [
      "AI_LABS_GEMINI_API_KEY",
      "AI_LABS_CLOUDINARY_CLOUD_NAME",
      "AI_LABS_CLOUDINARY_API_KEY",
      "AI_LABS_CLOUDINARY_API_SECRET",
      "AI_LABS_BUFFER_ACCESS_TOKEN",
    ]);
  });

  test("AI Labs passes when all five AI_LABS_* secrets are present", () => {
    assert.deepEqual(missingSecrets(aiLabs, fill(aiLabs)), []);
  });

  test("Kali Aja reads the canonical names", () => {
    assert.deepEqual(missingSecrets(kaliAja, {}), [
      "GEMINI_API_KEY",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "BUFFER_ACCESS_TOKEN",
    ]);
    assert.deepEqual(missingSecrets(kaliAja, fill(kaliAja)), []);
  });

  test("ordering is canonical, not insertion order", () => {
    const partial = fill(aiLabs);
    delete partial.AI_LABS_BUFFER_ACCESS_TOKEN;
    assert.deepEqual(missingSecrets(aiLabs, partial), ["AI_LABS_BUFFER_ACCESS_TOKEN"]);
  });
});

describe("secretNameFor", () => {
  test("Kali Aja keeps the canonical secret name", () => {
    assert.equal(secretNameFor(kaliAja, "GEMINI_API_KEY"), "GEMINI_API_KEY");
    assert.equal(secretNameFor(kaliAja, "BUFFER_ACCESS_TOKEN"), "BUFFER_ACCESS_TOKEN");
  });

  test("AI Labs prefixes the canonical secret name", () => {
    assert.equal(secretNameFor(aiLabs, "GEMINI_API_KEY"), "AI_LABS_GEMINI_API_KEY");
    assert.equal(secretNameFor(aiLabs, "CLOUDINARY_API_SECRET"), "AI_LABS_CLOUDINARY_API_SECRET");
  });
});

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
    assert.equal(env.get("YOUTUBE_CATEGORY_ID"), "30");
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
