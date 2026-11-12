/**
 * Pure helpers for publish.mts — exported so publish.test.mts can unit-test the
 * shipped code instead of a re-implementation. No I/O, no env access.
 */
import crypto from "node:crypto";

/** Ledger presence check: a markdown table row whose slug cell (2nd) matches exactly. */
export const ledgerHas = (ledger: string, slug: string): boolean =>
  new RegExp(`^\\|[^\\n]*\\|\\s*${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|`, "m").test(ledger);

/** Cloudinary signed-upload signature: sha1 of the alphabetically sorted "k=v&…" param string + <secret>. */
export const cloudinarySign = (params: Record<string, string | number>, secret: string): string =>
  crypto.createHash("sha1")
    .update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + secret)
    .digest("hex");

export type PublishMeta = { title: string; description: string; tiktokTitle: string; tiktokCaption: string; catatan?: string };

/** Minimal schema for publish.json: required non-empty strings, title caps. Returns a list of problems ([] = valid). */
export const validatePublishJson = (obj: unknown): string[] => {
  const problems: string[] = [];
  if (!obj || typeof obj !== "object") return ["publish.json: not an object"];
  const PUB = obj as Record<string, unknown>;
  for (const k of ["title", "description", "tiktokTitle", "tiktokCaption"] as const) {
    if (typeof PUB[k] !== "string" || !(PUB[k] as string).trim()) problems.push(`missing/empty "${k}"`);
  }
  if (typeof PUB.title === "string" && PUB.title.length > 100) problems.push(`title > 100 chars (${PUB.title.length})`);
  if (typeof PUB.tiktokTitle === "string" && PUB.tiktokTitle.length > 90) problems.push(`tiktokTitle > 90 chars (${PUB.tiktokTitle.length})`);
  return problems;
};

/** Extract Buffer GraphQL error detail: HTTP errors[] messages, or the createPost union member's message. */
export const extractBufferError = (body: any): string => {
  if (body?.errors?.length) {
    return body.errors.map((e: any) => e?.message ?? JSON.stringify(e)).join("; ");
  }
  const d = body?.data?.createPost;
  if (!d) return `no createPost payload: ${JSON.stringify(body)}`;
  if (d.__typename === "PostActionSuccess") return "";
  return `${d.__typename ?? "unknown"}: ${d.message ?? JSON.stringify(d)}`;
};
