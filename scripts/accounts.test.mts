import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ROOT } from "./lib.mts";
import { ACCOUNT_IDS, ACCOUNTS, DEFAULT_ACCOUNT, accountById, isAccountId, isConfigured, missingConfigFields } from "../src/accounts.ts";

const isPlaceholder = (v: string) => v.startsWith("TODO_");

describe("account registry", () => {
  test("holds exactly the two known accounts and defaults to Kali Aja", () => {
    assert.deepEqual([...ACCOUNT_IDS], ["kali-aja", "ai-labs"]);
    assert.equal(DEFAULT_ACCOUNT, "kali-aja");
  });

  test("Kali Aja keeps its current identity", () => {
    const k = ACCOUNTS["kali-aja"];
    assert.equal(k.label, "Kali Aja Tau");
    assert.deepEqual(k.brand, { prefix: "Kali Aja ", accent: "Tau" });
    assert.equal(k.youtubeCategoryId, "27");
    assert.equal(k.secretPrefix, "");
    assert.equal(k.buffer.orgId, "6aed53e7ec5c7c6d73f3e437");
    assert.equal(k.buffer.youtubeChannelId, "6aedb753e29c69a171803f6e");
    assert.equal(k.buffer.tiktokChannelId, "6aedb7fee29c69a171804662");
    assert.equal(k.agent.model, "opencode/inkling-2-small-free");
    assert.ok(k.agent.files.includes("AGENTS.md"));
    assert.ok(k.agent.files.includes("docs/AUTOPILOT.md"));
    assert.ok(k.agent.files.includes("ops/ci-prompt.md"));
  });

  test("AI Labs has its own identity", () => {
    const a = ACCOUNTS["ai-labs"];
    assert.equal(a.label, "AI Labs");
    assert.deepEqual(a.brand, { prefix: "AI ", accent: "Labs" });
    assert.equal(a.youtubeCategoryId, "30");
    assert.equal(a.secretPrefix, "AI_LABS_");
    assert.deepEqual(a.agent.files, ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/ai-labs.md", "ops/topics/ai-labs.md"]);
  });

  test("each account is either fully configured or fully placeholder", () => {
    for (const id of ACCOUNT_IDS) {
      const a = ACCOUNTS[id];
      const placeholders = [a.buffer.orgId, a.buffer.youtubeChannelId, a.buffer.tiktokChannelId].filter(isPlaceholder);
      const real = [a.buffer.orgId, a.buffer.youtubeChannelId, a.buffer.tiktokChannelId].filter((v) => !isPlaceholder(v));
      assert.ok(placeholders.length === 0 || real.length === 0, `account ${id} mixes placeholder and real buffer ids`);
      if (real.length > 0) {
        for (const v of real) assert.match(v, /^[0-9a-f]{24}$/, `account ${id} has a malformed buffer id`);
      }
    }
  });

  test("every agent instruction file exists on disk", () => {
    for (const id of ACCOUNT_IDS) {
      for (const file of ACCOUNTS[id].agent.files) {
        assert.ok(fs.existsSync(path.join(ROOT, file)), `account ${id} references missing file ${file}`);
      }
    }
  });

  test("isAccountId only accepts known ids", () => {
    assert.equal(isAccountId("ai-labs"), true);
    assert.equal(isAccountId("bogus"), false);
    assert.equal(isAccountId(undefined), false);
  });

  test("accountById rejects unknown ids and falls back to the default", () => {
    assert.throws(() => accountById("bogus"), (e: Error) => e.message.includes("bogus") && e.message.includes("ai-labs"));
    assert.equal(accountById(undefined).id, DEFAULT_ACCOUNT);
    assert.equal(accountById("ai-labs").id, "ai-labs");
  });

  test("missingConfigFields names the unconfigured buffer ids", () => {
    const missing = missingConfigFields(ACCOUNTS["ai-labs"]);
    assert.deepEqual(missing, ["buffer.orgId", "buffer.youtubeChannelId", "buffer.tiktokChannelId"]);
    assert.equal(isConfigured(ACCOUNTS["ai-labs"]), false);
    assert.deepEqual(missingConfigFields(ACCOUNTS["kali-aja"]), []);
    assert.equal(isConfigured(ACCOUNTS["kali-aja"]), true);
  });
});
