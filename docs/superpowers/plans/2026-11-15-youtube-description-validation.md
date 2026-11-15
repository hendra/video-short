# YouTube Description Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `<` or `>` in the YouTube title/description no longer fails a publish, and over-long text fails before the Cloudinary upload.

**Architecture:** One pure helper and two extra caps in `scripts/publish-lib.mts`; `scripts/publish.mts` applies the helper to the YouTube input only; one prompt line tells the agent not to write the characters.

**Tech Stack:** TypeScript (`tsx`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-15-youtube-description-validation-design.md`

## Global Constraints

- YouTube description ≤ 5,000 chars; TikTok caption ≤ 2,200 chars (existing: title ≤ 100, tiktokTitle ≤ 90).
- Replacement characters: `<` → `＜` (U+FF1C), `>` → `＞` (U+FF1E).
- TikTok text and the duplicate check keep the original, unsanitized text.
- Verification is `npm run lint` + `npm test`.

## Review Focus

- Several `<`/`>` in one string: all replaced, not just the first (tested below).
- Text with no angle brackets: returned unchanged (tested below).
- Description exactly 5,000 / caption exactly 2,200 chars: valid, the caps are strict `>` (tested below).
- Buffer rejecting the full-width characters: not testable offline; first live publish proves it (spec "Unverified").

---

### Task 1: Sanitize YouTube text and cap lengths

**Files:**
- Modify: `scripts/publish-lib.mts` (`validatePublishJson`, new export)
- Modify: `scripts/publish.mts:108-113` (`ytInput`)
- Modify: `ops/ci-prompt.md:21-22` (publish.json shape bullets)
- Test: `scripts/publish.test.mts`

**Interfaces:**
- Produces: `export const youtubeSafe = (text: string): string` in `scripts/publish-lib.mts`.

- [ ] **Step 1: Write the failing tests** in `scripts/publish.test.mts` (add `youtubeSafe` to the import)

```ts
describe("youtubeSafe", () => {
  test("replaces every < and > with full-width look-alikes", () => {
    assert.equal(youtubeSafe("Lidar (>4.400 km) <b>x</b>"), "Lidar (＞4.400 km) ＜b＞x＜/b＞");
  });
  test("leaves other text unchanged", () => {
    assert.equal(youtubeSafe("±183.000 km² — #shorts & co"), "±183.000 km² — #shorts & co");
  });
});
```

Inside the existing `describe("validatePublishJson")`, in the `length caps enforced` test:

```ts
assert.ok(validatePublishJson({ ...ok, description: "x".repeat(5001) }).join().includes("description > 5000"));
assert.ok(validatePublishJson({ ...ok, tiktokCaption: "x".repeat(2201) }).join().includes("tiktokCaption > 2200"));
assert.deepEqual(validatePublishJson({ ...ok, description: "x".repeat(5000), tiktokCaption: "x".repeat(2200) }), []);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx --test scripts/publish.test.mts`
Expected: FAIL (`youtubeSafe` is not exported).

- [ ] **Step 3: Implement in `scripts/publish-lib.mts`**

Add `youtubeSafe` with a one-line doc comment saying YouTube rejects `<`/`>` in title and description. Add the two caps to `validatePublishJson` in the same message style as the existing ones: `description > 5000 chars (N)`, `tiktokCaption > 2200 chars (N)`. Update its doc comment.

- [ ] **Step 4: Apply in `scripts/publish.mts`**

In `ytInput` only: `text: youtubeSafe(PUB.description)` and `title: youtubeSafe(PUB.title)`. Add `youtubeSafe` to the `./publish-lib.mts` import.

- [ ] **Step 5: Add the prompt rule in `ops/ci-prompt.md`**

Under the `description` bullet of the `publish.json` shape, add:
`- No `<` or `>` in `title` or `description` (YouTube rejects them) — write "lebih dari" / "kurang dari".`

- [ ] **Step 6: Verify**

Run: `npm run lint && npm test`
Expected: lint clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/publish-lib.mts scripts/publish.mts scripts/publish.test.mts ops/ci-prompt.md docs/superpowers/plans/2026-11-15-youtube-description-validation.md
git commit -m "fix(publish): sanitize < > for YouTube, cap description lengths"
```
