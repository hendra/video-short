# ops — CI: Cloudflare cron → GitHub Actions (hosted) → pipeline video

Chain: **Cloudflare Worker** (cron 08:00/11:30/16:30 WIB) → `repository_dispatch` → **GitHub-hosted `ubuntu-latest`** → workflow `.github/workflows/video.yml` → agent (opencode, free model) → gates (lint/test/bundle/still-per-shot) → render (`--gl=swangle`) → loudnorm → publish (Cloudinary → Buffer YouTube + TikTok) → ledger commit → push ke `main` → Slack #social.

Repo **public** (wajib untuk free hosted minutes; unlimited). Tidak ada runner self-hosted — PC lokal bebas.

## Komponen

| Apa | Di mana |
|---|---|
| Worker (weker) | `ops/cloudflare-cron/worker.js` — ter-deploy di akun CF; crons di `wrangler.toml` |
| Runner | GitHub-hosted `ubuntu-latest` (swangle-only, ~35–45 min/video; tidak ada GPU) |
| Workflow | `.github/workflows/video.yml` — `repository_dispatch[video-run]` + `workflow_dispatch` (manual, opsional input `slug`) |
| Publish | `scripts/publish.mts` (`npm run publish -- <slug>`; CI sets `PUBLISH_COMMIT=1`) — Cloudinary signed upload → Buffer GraphQL → ledger row; publish.mts commits+pushes the ledger itself (rebase retry) so the idempotency record survives the job |
| Report | `scripts/report.mts` (`npm run report -- <slug>`) — Slack #social; otomatis membaca links dari `docs/ledger.md` bila `--links` kosong |
| Agent | `ops/ci-prompt.md` — opencode, `--model opencode/inkling-2-small-free` |

## Setup sekali jalan (baru)

1. **Repo → public** (Settings → Danger Zone). Jangan di-public-kan bila ada secret di tree/history — cek dulu: `git ls-files | grep -E '(^|/)\.env($|\.)|\.key$|secret|service-account'` harus bersih.
2. **Secrets GitHub Actions** (Settings → Secrets and variables → Actions): `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BUFFER_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SOCIAL_CHANNEL_ID`.
3. **`VIDEO_SHORT_PAT`** (fine-grained, repo `hendra/video-short`, minimal **Contents: write**) → Cloudflare Worker secret (`npx wrangler secret put VIDEO_SHORT_PAT`) — dipakai Worker untuk memicu dispatch.
4. **Worker deploy**: `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml` (butuh `CF_ACCOUNT_ID` + `CF_API_TOKEN` dengan izin Workers Scripts:Edit).
5. opencode tidak perlu dipasang manual — workflow meng-install sendiri via `https://opencode.ai/v2/install` pada path autopilot.

## Trigger manual

Autopilot (agent bikin video baru):

```bash
gh workflow run video-run --ref main
```

Render+publish video yang **sudah di-commit & push ke main** (mis. video yang kamu bangun sendiri, tanpa agent):

```bash
gh workflow run video-run --ref main -f slug=<slug>
```

Prasyarat manual path: `src/videos/<slug>/` ter-commit (termasuk `timeline.json`, `publish.json`), `public/<slug>/vo.mp3` ter-commit, slug **belum** ada di `docs/ledger.md` (kalau ada → job gagal sebelum render, tidak akan re-publish). Jalankan gates lokal dulu (`npm run lint && npm test`). Manual path tetap publish **for real** ke YouTube + TikTok — tidak ada mode dry-run.

Tidak ada dry-run untuk `repository_dispatch` juga: **cron berikutnya adalah live run**.

## Kalau gagal

- **Agent/no-video**: step "Agent builds the video" selesai tapi folder video tidak ada → job gagal di "Discover slug"; Slack #social melaporkan. Tidak ada commit, tidak ada upload.
- **Agent install gagal**: step "Install opencode" gagal → failure report ke Slack, publish tidak jalan. Installer upstream `opencode.ai/v2/install` berubah/mati → pin ulang URL atau pasang via npm `@opencode/cli`.
- **Quota**: opencode free model menolak/rate-limit → publish tidak terjadi; coba lagi lewat `workflow_dispatch` nanti.
- **Render swangle lambat** (~35–45 min) — normal; job timeout 240 min.
- **Publish gagal di tengah job setelah video live** (rare): publish.mts menulis + mem-push baris ledger (`PUBLISH_COMMIT=1`) sebelum job bisa berlanjut; bila belum sempat, Slack failure report menyertakan baris ledger persisnya — commit manual sebelum cron berikutnya. Re-run aman; publish.mts skip bila ledger sudah berisi slug.
- **Rollback**: hapus baris ledger + `git revert` commit CI; out/ tidak tercommit.

## Regenerate

| Yang habis | Cara |
|---|---|
| `VIDEO_SHORT_PAT` | GitHub → Settings → Developer settings → Fine-grained PAT → generate (Contents: write) → `npx wrangler secret put VIDEO_SHORT_PAT --config ops/cloudflare-cron/wrangler.toml` |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey → set GitHub secret `GEMINI_API_KEY` kembali |
| Buffer/Cloudinary/Slack keys | → GitHub secrets; `.env` kalau untuk run manual |
