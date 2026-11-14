# Publishing: Cloudinary → Buffer (YouTube + TikTok)

Tested end-to-end 2026-11-11. Read this before any upload; `git log --oneline docs/PUBLISHING.md` shows changes since.

## Env keys (`.env`, always gitignored)

```
BUFFER_ACCESS_TOKEN=      # Buffer API token. Scopes in use: posts:read + posts:write ONLY.
                          # It CANNOT list channels or account (those need account:read) — use the fixed channel IDs below.
CLOUDINARY_CLOUD_NAME=    # e.g. opqimovw
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Channel IDs (same as docs/AUTOPILOT.md §0)

| Channel | ID |
|---|---|
| YouTube — **Kali Aja Tau** | `6aedb753e29c69a171803f6e` |
| TikTok — **kaliajatau01** | `6aedb7fee29c69a171804662` |
| Buffer organization | `6aed53e7ec5c7c6d73f3e437` |

## Step 1 — Host the MP4 (Cloudinary signed upload)

Shorts go to `shorts/YYYY-MM-DD/<slug>`, resource type **video**.

```bash
set -a; source .env; set +a
TS=$(date +%s)
PUB="shorts/2026-11-11/<slug>"
SIG=$(printf 'public_id=%s&timestamp=%s%s' "$PUB" "$TS" "$CLOUDINARY_API_SECRET" | sha1sum | cut -d' ' -f1)   # params sorted alphabetical, joined by &, NO trailing &
curl -sS -m 300 -X POST "https://api.cloudinary.com/v1_1/$CLOUDINARY_CLOUD_NAME/video/upload" \
  -F "file=@out/<slug>-final.mp4" -F "public_id=$PUB" -F "timestamp=$TS" \
  -F "api_key=$CLOUDINARY_API_KEY" -F "signature=$SIG"
```

Checks: response `bytes` must equal the file size (`ls -la out/<slug>-final.mp4 | awk '{print $5}'`); `resource_type` must be `video`. URL format: `https://res.cloudinary.com/<cloud>/video/upload/v<version>/<public_id>.mp4`.

## Step 2 — Create the post(s) (Buffer **GraphQL**)

⚠️ Do NOT use `api.bufferapp.com` / the v1 REST API: it rejects these tokens (`Public API tokens are not accepted for REST API access`; retired 2027-02-01). ⚠️ Do NOT try `{ me }` or `channels(...)`: the token lacks `account:read`; both fail with "Insufficient scope". Verification happens via the post object and `post(input:)` polling instead.

```bash
curl -sS -m 60 -X POST https://api.buffer.com/graphql \
  -H "Authorization: Bearer $BUFFER_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d @payload.json
```

`payload.json` for YouTube (adjust `text`, `title`):

```json
{
  "query": "mutation($input: CreatePostInput!) {\n  createPost(input: $input) {\n    __typename\n    ... on PostActionSuccess { post { id status channelService sharedNow externalLink } }\n    ... on NotFoundError { message }\n    ... on UnauthorizedError { message }\n    ... on UnexpectedError { message }\n    ... on InvalidInputError { message }\n    ... on LimitReachedError { message }\n    ... on RestProxyError { message }\n  }\n}",
  "variables": { "input": {
    "channelId": "6aedb753e29c69a171803f6e",
    "mode": "shareNow",
    "schedulingType": "automatic",
    "needsApproval": false,
    "text": "<deskripsi>",
    "assets": [{ "video": { "url": "<cloudinary-url>" } }],
    "metadata": { "youtube": {
      "title": "<judul ≤ 100 karakter — Tanpa \"| 11.ai\" untuk VO Gemini; WAJIB diakhiri \"| 11.ai\" untuk VO ElevenLabs-Free>",
      "categoryId": "27",
      "privacy": "public",
      "madeForKids": false,
      "isAiGenerated": true,
      "notifySubscribers": true
    } }
  } }
}
```

TikTok — same mutation with:
- `channelId`: `6aedb7fee29c69a171804662`
- `metadata`: `{ "tiktok": { "isAiGenerated": true, "title": "<hook singkat>" } }`
- `text`: caption hook + CTA + sumber + "Suara: AI (Google AI Studio)" + hashtags

Publish-now vs draft: `mode: "shareNow"` + `schedulingType: "automatic"` publishes immediately. To hold for review: drop `mode` (or `saveToDraft` — see enums `ShareMode`: `shareNow | shareNext | addToQueue | customScheduled`) and set `"saveToDraft": true`.
- Error union (`PostActionPayload`): `PostActionSuccess | NotFoundError | UnauthorizedError | UnexpectedError | RestProxyError | LimitReachedError | InvalidInputError` — every error branch carries **one** `message` field. Non-200 → stop and report; do not retry blindly.
- Success path returns `post { id status channelService sharedNow externalLink }`. `status: "sent"` for YouTube usually comes back immediately with the link; TikTok sits at `"sending"` for minutes.

## Step 3 — Verify

```json
{ "query": "{ post(input: { id: \"<post-id>\" }) { id status externalLink sharedNow channelService } }" }
```

IMPORTANT: `Query.post` takes an **input object** (`PostInput { id: PostId! }`), NOT a bare `id:` argument — `post(id: "...")` fails with "Unknown argument \"id\"". Poll until `status == "sent"` (externalLink filled) or `"error"`. For TikTok this typically takes 1–5 minutes.

## Step 3.5 — Notify Slack (optional but usual)

Autopilot uses the `slack_send_message` MCP tool when available. Without it, the Web API works with `SLACK_BOT_TOKEN` (xoxb-…, `chat:write`) and `SLACK_SOCIAL_CHANNEL_ID` (#social, `C0CDV7Y555K`):

```bash
curl -sS -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"channel":"'"$SLACK_SOCIAL_CHANNEL_ID"'","text":"<ringkasan + YouTube + TikTok links>","unfurl_links":false}'
```

Success: `{ "ok": true, "channel": "C0CDV7Y555K", "ts": "..." }` (a harmless `missing_charset` warning may appear).

## Step 4 — Done — committed catalog

Video source is not committed: source lives only in the CI VM and is discarded when the job ends. The only git-tracked record is `data/published-videos.json` (minimal public metadata and links). The publish step updates it; the CI publish job commits and pushes only that file after the posts settle. The catalog also makes re-running a slug a no-op; off-catalog/manual publishes must still be checked on YouTube/TikTok.

## Content requirements (not negotiable for this channel)

- Title ≤ 100 chars; `| 11.ai` suffix ONLY for ElevenLabs-Free VO (its ToS). Gemini/other VO: no suffix.
- Description (YouTube): 2–3 kalimat ringkasan + CTA `Mau dibongkar apa lagi? Tulis di komentar.` + `Sumber: …` + "Animasi bersifat ilustrasi. Suara: AI (Google AI Studio)" + hashtag (`#shorts` + 5–6 topik). CategoryId `27` (Education). `isAiGenerated: true`, `madeForKids: false`, `notifySubscribers: true`, `privacy: "public"`.
- Caption (TikTok): hook + CTA + sumber + `Suara: AI (Google AI Studio)` + hashtag yang sama.
- Video file: 1080×1920, 30 fps, h264 + AAC, durasi ≈ `timeline.dur`; loudness −14 LUFS (sudah termasuk di `-af loudnorm=I=-14:TP=-1.5:LRA=11`); `notification` scheduling hanya kalau halaman upload sengaja menunggu approval.
- If in doubt on quality/facts but the video is complete: `saveToDraft: true` + report. If not complete: do NOT post.
