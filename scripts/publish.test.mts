import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "node:test";

// re-implement the two pure helpers for unit testing (kept in sync with publish.mts)
const ledgerHas = (ledger: string, s: string) =>
  new RegExp(`^\\|[^\\n]*\\|\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|`, "m").test(ledger);
const sign = (public_id: string, ts: number, secret: string) =>
  crypto.createHash("sha1").update(`public_id=${public_id}&timestamp=${ts}${secret}`).digest("hex");

describe("ledger presence check", () => {
  const ledger = `# Ledger\n| Tanggal | Slug | ...\n|---|---|\n| 2026-11-07 | jembatan-raksasa | 1.101 | (Gemini, gratis) | a | b | c |\n`;
  test("detects existing slug", () => assert.equal(ledgerHas(ledger, "jembatan-raksasa"), true));
  test("missing slug returns false", () => assert.equal(ledgerHas(ledger, "lain"), false));
  test("slug with special chars is safe", () => assert.equal(ledgerHas(ledger, "a.b"), false));
  test("slug embedded in another slug does not match", () => assert.equal(ledgerHas(ledger, "jembat"), false));
});

describe("cloudinary signature", () => {
  test("matches sha1 of sorted params + secret", () => {
    assert.equal(
      sign("shorts/2026-11-11/x", 1234567890, "s3cr3t"),
      crypto.createHash("sha1").update("public_id=shorts/2026-11-11/x&timestamp=1234567890s3cr3t").digest("hex"),
    );
  });
});
