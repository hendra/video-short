/**
 * Pure helpers for publish.mts — exported so publish.test.mts can unit-test the
 * shipped code instead of a re-implementation. No I/O, no env access.
 */
import crypto from "node:crypto";

/** Cloudinary signed-upload signature: sha1 of the alphabetically sorted "k=v&…" param string + <secret>. */
export const cloudinarySign = (params: Record<string, string | number>, secret: string): string =>
  crypto.createHash("sha1")
    .update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + secret)
    .digest("hex");

export type PublishMeta = { title: string; description: string; tiktokTitle: string; tiktokCaption: string; catatan?: string };

/** YouTube rejects "<" and ">" in titles and descriptions; swap them for full-width look-alikes. */
export const youtubeSafe = (text: string): string => text.replaceAll("<", "＜").replaceAll(">", "＞");

/** Minimal schema for publish.json: required non-empty strings, platform length caps. Returns a list of problems ([] = valid). */
export const validatePublishJson = (obj: unknown): string[] => {
  const problems: string[] = [];
  if (!obj || typeof obj !== "object") return ["publish.json: not an object"];
  const PUB = obj as Record<string, unknown>;
  for (const k of ["title", "description", "tiktokTitle", "tiktokCaption"] as const) {
    if (typeof PUB[k] !== "string" || !(PUB[k] as string).trim()) problems.push(`missing/empty "${k}"`);
  }
  if (typeof PUB.title === "string" && PUB.title.length > 100) problems.push(`title > 100 chars (${PUB.title.length})`);
  if (typeof PUB.tiktokTitle === "string" && PUB.tiktokTitle.length > 90) problems.push(`tiktokTitle > 90 chars (${PUB.tiktokTitle.length})`);
  if (typeof PUB.description === "string") {
    // YouTube caps the description in UTF-8 bytes, measured on the text it actually receives.
    const bytes = Buffer.byteLength(youtubeSafe(PUB.description));
    if (bytes > 5000) problems.push(`description > 5000 bytes (${bytes})`);
  }
  if (typeof PUB.tiktokCaption === "string" && PUB.tiktokCaption.length > 2200) problems.push(`tiktokCaption > 2200 chars (${PUB.tiktokCaption.length})`);
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
