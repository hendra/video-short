# ops — CI: Cloudflare cron → GitHub Actions (hosted) → pipeline video

Chain: **Cloudflare Worker** (cron 08:00/11:30/16:30 WIB) → `repository_dispatch` → **GitHub-hosted `ubuntu-latest`** → workflow `.github/workflows/video.yml` → agent (opencode, free model) + duplicate gate dari `data/published-videos.json` → gates (lint/test/bundle/still-per-shot) → render (`--gl=swangle`, 4 runner paralel) → gabung + audio + loudnorm → publish (Cloudinary → Buffer YouTube + TikTok) → commit `data/published-videos.json` → Slack #social. Video source tidak di-commit; hanya katalog metadata publik yang disengaja di-track.

Repo **public** (wajib untuk free hosted minutes; unlimited). Tidak ada runner self-hosted — PC lokal bebas.

## Susunan job

| Job | Isi | Secret |
|---|---|---|
| `build` | agent membuat video, duplicate gate dari `data/published-videos.json`, gates, still per shot, bundle → artifact `bundle` (situs Remotion lengkap + `public/`) dan `meta` (`publish.json`, `naskah.txt`) | hanya `GEMINI_API_KEY` |
| `render` ×4 (matrix `shard`) | tiap runner merender seperempat frame, **tanpa audio** (`--frames=a-b --muted`) → artifact `chunk-<i>` | tidak ada |
| `publish` | render audio sekali (`audioOnly`, < 1 menit), sambung chunk tanpa encode ulang + audio + loudnorm, cek jumlah frame, publish, commit `data/published-videos.json`, lalu laporan sukses | Cloudinary, Buffer, Slack; `GITHUB_TOKEN` job scoped `contents: write` untuk commit katalog |
| `report-failure` | jalan hanya kalau ada job gagal; checkout bersih → Slack #social dengan nama step/job yang gagal | Slack |

Kenapa dipecah: render CPU sudah memakai semua core (`--concurrency` tidak berpengaruh), jadi satu-satunya cara mempercepat adalah menambah mesin. Jumlah shard = `env.SHARDS` **dan** daftar `matrix.shard` di workflow — ubah keduanya bersamaan. Audio dirender terpisah karena potongan AAC tidak bisa disambung tanpa celah.

## Komponen

| Apa | Di mana |
|---|---|
| Worker (weker) | `ops/cloudflare-cron/worker.js` — ter-deploy di akun CF; crons di `wrangler.toml` |
| Runner | GitHub-hosted `ubuntu-latest` (swangle-only, tidak ada GPU); render dibagi ke 4 runner paralel |
| Workflow | `.github/workflows/video.yml` — `repository_dispatch[video-run]` + `workflow_dispatch` (manual, opsional input `slug` dan `dry_run`) |
| Publish | `scripts/publish.mts` (`npm run publish -- <slug>`) — Cloudinary signed upload → Buffer GraphQL → update `data/published-videos.json`; CI job commit/push file ini setelah publish berhasil |
| Report | `scripts/report.mts` (`npm run report -- <slug>`) — Slack #social; otomatis membaca links dari `data/published-videos.json` bila `--links` kosong |
| Published catalog | `data/published-videos.json` — database publik berisi `slug` (kalau ada dari publish), platform, tanggal, judul, teks caption publik, link, format, dan sumber; dipakai duplicate gate + anti re-publish |
| Buffer backfill | `scripts/sync-published-videos.mts` — merge seluruh post Buffer sent ke `data/published-videos.json` secara idempotent; dipakai manual bila katalog perlu disinkronkan |
| Agent | `ops/ci-prompt.md` — opencode, `--model opencode/inkling-2-small-free` |

## Setup sekali jalan (baru)

1. **Repo → public** (Settings → Danger Zone). Jangan di-public-kan bila ada secret di tree/history — cek dulu: `git ls-files | grep -E '(^|/)\.env($|\.)|\.key$|secret|service-account'` harus bersih.
2. **Secrets GitHub Actions** (Settings → Secrets and variables → Actions): `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BUFFER_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SOCIAL_CHANNEL_ID`.
3. **`VIDEO_SHORT_PAT`** (fine-grained, repo `hendra/yt-video-short-generator`, minimal **Contents: write**) → Cloudflare Worker secret (`npx wrangler secret put VIDEO_SHORT_PAT`) — dipakai Worker untuk memicu dispatch.
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

Prasyarat manual path: video source `src/videos/<slug>/` harus ada di tree (tidak di-commit — generated di CI; untuk manual path kamu tambahkan sendiri sementara, boleh lewat `git add -f`, lalu hapus lagi), `public/<slug>/vo.mp3` ada di tree, `data/published-videos.json` ideally sudah berisi semua publish sebelumnya. Duplicate gate dan re-publish guard memakai file itu; publikasi di luar pipeline/Buffer sebelum katalog di-backfill tidak terdeteksi, jadi tetap cek YouTube/TikTok sebelum publish. Jalankan gates lokal dulu (`npm run lint && npm test`). Manual path tetap publish **for real** ke YouTube + TikTok kecuali `dry_run` dinyalakan; commit katalog tetap di-push ke branch target bila berjalan lewat Actions.

Dry-run (semua langkah kecuali Publish + laporan sukses; MP4 final disimpan sebagai artifact `final-video` selama 3 hari):

```bash
gh workflow run video-run --ref <branch> -f dry_run=true
```

Pakai ini untuk menguji perubahan workflow sebelum merge. `repository_dispatch` (cron) tidak punya dry-run: **cron berikutnya adalah live run**.

## Kalau gagal

- **Agent/no-video**: step "Agent builds the video" selesai tapi folder video tidak ada → job gagal di "Discover slug"; Slack #social melaporkan. Tidak ada commit, tidak ada upload.
- **Duplicate gate gagal**: kandidat terlalu mirip dengan post YouTube/TikTok yang tercatat di Buffer; ganti topik/angle/title dan jalankan ulang. Jangan cukup ubah beberapa kata.
- **Agent install gagal**: step "Install opencode" gagal → failure report ke Slack, publish tidak jalan. Installer upstream `opencode.ai/v2/install` berubah/mati → pin ulang URL atau pasang via npm `@opencode/cli`.
- **Quota**: opencode free model menolak/rate-limit → publish tidak terjadi; coba lagi lewat `workflow_dispatch` nanti.
- **Satu shard render gagal** → shard lain dibatalkan (fail-fast), `publish` dilewati, Slack melaporkan `render`. Re-run job yang gagal saja dari UI Actions selama artifact `bundle` masih ada (1 hari).
- **`assemble` gagal dengan "assembled video has N frames, expected M"** → ada chunk yang tidak lengkap; jangan publish manual, re-run job `render`.
- **Catalog push gagal setelah publish live**: video sudah tayang tetapi `data/published-videos.json` tidak ter-persist. Jangan re-run manual sampai `data/published-videos.json` diperbaiki (pakai `scripts/sync-published-videos.mts`) atau link/status di YouTube/TikTok diperiksa.

## Regenerate

| Yang habis | Cara |
|---|---|
| `VIDEO_SHORT_PAT` | GitHub → Settings → Developer settings → Fine-grained PAT → generate (Contents: write) → `npx wrangler secret put VIDEO_SHORT_PAT --config ops/cloudflare-cron/wrangler.toml` |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey → set GitHub secret `GEMINI_API_KEY` kembali |
| Buffer/Cloudinary/Slack keys | → GitHub secrets; `.env` kalau untuk run manual |
