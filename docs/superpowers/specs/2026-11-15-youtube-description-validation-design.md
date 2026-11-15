# YouTube description validation — design

Date: 2026-11-15. Size: small change.

## Intent

CI run 43658512203 rendered `geoglif-amazon-lidar`, uploaded it to Cloudinary, then failed at Buffer:
`InvalidInputError: Invalid post: YouTube description cannot contain < or > characters.`
The agent had written `(>4.400 km penerbangan)` in `publish.json`. Nothing checks the text before
the Buffer call, so a full run was wasted. A stray `<` or `>` must never cost a run again.

## Goals

- A `<` or `>` in the YouTube title or description no longer fails the publish.
- Over-long YouTube description or TikTok caption fails before the Cloudinary upload, not after.
- The agent is told not to write `<` / `>` in the first place.

Non-goals: rescuing the `geoglif-amazon-lidar` run; changing TikTok text; a build-job gate.

## Constraints

- YouTube: title ≤ 100 chars, description ≤ 5,000 chars, neither may contain `<` or `>`.
- TikTok: caption ≤ 2,200 chars, title ≤ 90 chars; no banned characters.
- These limits come from platform knowledge, not a fresh read of the Buffer/YouTube docs.

## Approaches

1. **Sanitize at publish time (picked).** Replace `<` / `>` with full-width `＜` / `＞` in the
   YouTube title and description just before the Buffer call. Deterministic; a rendered video is
   never lost to this again.
2. **Fail early in the build job.** Rejected: the agent is gone by then, so the run is still wasted.
3. **Prompt rule only.** Rejected: unreliable with the free model. Kept as a supplement to 1.

## Design

- `scripts/publish-lib.mts`: new pure helper `youtubeSafe(text)` — `<` → `＜`, `>` → `＞`.
  `validatePublishJson` gains two caps: `description` > 5,000 chars, `tiktokCaption` > 2,200 chars.
- `scripts/publish.mts`: apply `youtubeSafe` to `PUB.description` (post `text`) and `PUB.title`
  (`metadata.youtube.title`) in `ytInput` only. TikTok input and the duplicate check use the
  original text.
- `ops/ci-prompt.md`: one line under the `publish.json` shape — no `<` or `>` in `title` or
  `description`; write "lebih dari" / "kurang dari".
- `scripts/publish.test.mts`: tests for the helper and both caps.

## Unverified

Buffer accepting the full-width characters is not confirmed; the first live publish containing one
proves it. Fallback if it rejects them: replace with the words "lebih dari" / "kurang dari".

## Verification

`npm run lint` and `npm test`.
