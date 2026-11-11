# ops — CI: Cloudflare cron → self-hosted runner → pipeline video

Chain: **Cloudflare Worker** (cron 08:00/11:30/16:30 WIB) → `repository_dispatch` → **self-hosted runner** (PC ini) → workflow `.github/workflows/video.yml` → agent (opencode, free model) → gates (lint/test/bundle/still-per-shot) → render (`--gl=vulkan`, fallback swangle) → loudnorm → publish (Cloudinary → Buffer YouTube + TikTok) → ledger commit → push ke `main` → Slack #social.

## Komponen

| Apa | Di mana |
|---|---|
| Worker (weker) | `ops/cloudflare-cron/worker.js` — ter-deploy di akun CF; crons di `wrangler.toml` |
| Runner | `ops/runner-install.sh` — install sekali di PC ini |
| Workflow | `.github/workflows/video.yml` — `repository_dispatch[video-run]` + `workflow_dispatch` (manual) |
| Publish | `scripts/publish.mts` (`npm run publish -- <slug>`) — Cloudinary signed upload → Buffer GraphQL → ledger row (idempotent via ledger presence) |
| Report | `scripts/report.mts` (`npm run report -- <slug>`) — Slack #social; otomatis membaca links dari `docs/ledger.md` bila `--links` kosong |
| Agent | `ops/ci-prompt.md` — opencode, `--model opencode/inkling-2-small-free` |

## Setup sekali jalan (baru)

1. **`.env`** sudah berisi: `GEMINI_API_KEY`, `CLOUDINARY_*`, `BUFFER_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SOCIAL_CHANNEL_ID` — salin dari `.env.example`.
2. **`VIDEO_SHORT_PAT`** (fine-grained, repo `hendra/video-short`, minimal **Contents: write**) → Cloudflare Worker secret (`npx wrangler secret put VIDEO_SHORT_PAT`) — dipakai Worker untuk memicu dispatch.
3. **Worker deploy**: `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml` (butuh `CF_ACCOUNT_ID` + `CF_API_TOKEN` dengan izin Workers Scripts:Edit).
4. **Runner**: ambil registration token (Settings → Actions → Runners → New self-hosted runner → Linux x64), lalu:
   ```bash
   RUNNER_REGISTRATION_TOKEN=<token> bash ops/runner-install.sh
   ```
5. **Secrets GitHub Actions** (Settings → Secrets and variables → Actions): `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BUFFER_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SOCIAL_CHANNEL_ID`.

## Regenerate

| Yang habis | Cara |
|---|---|
| `VIDEO_SHORT_PAT` | GitHub → Settings → Developer settings → Fine-grained PAT → generate (Contents: write) → `npx wrangler secret put VIDEO_SHORT_PAT --config ops/cloudflare-cron/wrangler.toml` |
| Runner registration token | Settings → Actions → Runners → Remove & new → `RUNNER_REGISTRATION_TOKEN=<t> bash ops/runner-install.sh` (re-register) |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey → `npx wrangler secret put` tidak perlu; set GitHub secret `GEMINI_API_KEY` kembali |
| Buffer/Cloudinary/Slack keys | → GitHub secrets; `.env` kalau untuk run manual |

## Trigger manual

```bash
gh workflow run video-run --ref main
```
atau dari UI: Actions → video-run → Run workflow.

## Kalau gagal

- **Agent/no-video**: step "Agent builds the video" selesai tapi folder video tidak ada → job gagal di "Discover slug"; Slack #social melaporkan. Tidak ada commit, tidak ada upload.
- **Quota**: opencode free model menolak/rate-limit → publish tidak terjadi; coba lagi lewat `workflow_dispatch` nanti.
- **Render gagal vulkan**: fallback swangle otomatis (lebih lambat). Render dipatok `--concurrency=2` karena PC runner juga dipakai kerja normal — default Remotion (½ core) bikin Chrome tabs menumpuk dan kena OOM killer (run 2026-11-11, megathrust-jakarta).
- **Runner kena OOM killer saat render**: job dibatalkan GitHub ("runner received a shutdown signal"), langkah sesudahnya (termasuk Slack report) tidak jalan. Cek `journalctl --user -u video-runner.service` untuk konfirmasi `oom-kill`; kosongkan memori (tutup Chrome) lalu re-run. Folder video yang setengah jadi tertinggal di `_work/video-short/video-short` — hapus manual sebelum re-run agar "Discover slug" tidak mengambil folder basi.
- **Publish gagal setelah buffer terpost** (rare): ledger TIDAK akan ditulis (publish.mts baru menulis setelah semua sukses) — re-run aman; ledger presence check mencegah double-post.
- **Rollback**: hapus baris ledger + `git revert` commit CI; out/ tidak tercommit.
