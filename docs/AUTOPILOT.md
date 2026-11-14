# Autopilot: 3D explainer Short → YouTube + TikTok

(Ada juga varian otomatis penuh via GitHub Actions — 3×/hari — lihat `ops/README.md`. Runbook ini berlaku untuk keduanya.)

Dibaca oleh scheduled task (Sen/Rab/Jum) dan oleh CI `video-run` (cron harian ×3: 08:00/11:30/16:30 WIB, lihat `ops/README.md`). Ikuti persis. Bahasa konten: Indonesia santai-profesional. Zona waktu WIB.

## 0. Konstanta

| | |
|---|---|
| Repo | `hendra/yt-video-short-generator` (branch `main`) |
| Channel | YouTube **Kali Aja Tau** `6aedb753e29c69a171803f6e` · TikTok **kaliajatau01** `6aedb7fee29c69a171804662` |
| Buffer org | `6aed53e7ec5c7c6d73f3e437` |
| Cloudinary | cloud `opqimovw`, folder `shorts/YYYY-MM-DD/<slug>` (resource type **video**) |
| Publish | Ikuti **`docs/PUBLISHING.md`** (upload → Buffer GraphQL → poll). Env keys wajib: `BUFFER_ACCESS_TOKEN` (scope posts:read + posts:write; tidak bisa list channels), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — kalau .env tidak punya ini, video tidak bisa di-upload/post |
| TTS | **Gemini TTS** (`gemini-2.5-flash-preview-tts`, voice `Charon`) lewat Google AI Studio — gratis, tanpa billing; env `GEMINI_API_KEY`. Chain `auto`: gemini → gcloud (gratis ≤ 4 jt karakter/bln) → azure (F0, 0,5 jt karakter/bln). Saat ini chain efektif gemini-only sampai `GCLOUD_TTS_KEY`/`AZURE_SPEECH_KEY` dibuat. ElevenLabs = legacy opsional (`--provider=elevenlabs`), tidak termasuk chain. Ganti suara bebas via env `GEMINI_TTS_VOICE` — dengar 1 take dulu |
| Brand overlay | `{ prefix: "Kali Aja ", accent: "Tau" }` |
| Laporan | Slack **#social** `C0CDV7Y555K` (`slack_send_message`) |
| Contoh referensi | tidak ada — seluruh `src/videos/*/` digenerate di CI |

`GEMINI_API_KEY` diberikan oleh prompt scheduled task sebagai env var. **Jangan pernah** mencetak, meng-commit, atau menyertakannya di pesan/memory/Project. Tulis ke `.env` (sudah di-.gitignore) dengan `umask 077`. Keys lain (`BUFFER_ACCESS_TOKEN`, `CLOUDINARY_*`) **tidak** disuntik lewat prompt — di-copy manual oleh operator ke `.env` workspace sekali saja (lihat §1). **Operator juga wajib menambahkan `GEMINI_API_KEY` ke prompt scheduled task** (di luar repo ini) sebelum run berikutnya — kalau tidak, `npm run tts` akan gagal (semua provider skip) dan run berhenti.

## 1. Setup

```bash
# add_repo hendra/yt-video-short-generator (access: read — tidak ada yang di-push), lalu:
git clone https://github.com/hendra/yt-video-short-generator && cd yt-video-short-generator
npm ci
# workspace cloud: Node fetch harus lewat proxy + CA bundle (tanpa ini: ENOTFOUND untuk API TTS)
[ -n "$HTTPS_PROXY" ] && export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
umask 077; printf 'GEMINI_API_KEY=%s\nGEMINI_TTS_VOICE=Charon\n' "$KEY_DARI_PROMPT" > .env
# Sekali saja per workspace baru (keys tidak dari prompt, jangan dicetak di log):
printf 'BUFFER_ACCESS_TOKEN=%s\nCLOUDINARY_CLOUD_NAME=opqimovw\nCLOUDINARY_API_KEY=%s\nCLOUDINARY_API_SECRET=%s\n' "$BUFFER_KEY" "$CLOUDINARY_KEY" "$CLOUDINARY_SECRET" >> .env
# (BUFFER_ACCESS_TOKEN scope: posts:read+posts:write — tanpa account:read, channels tidak bisa di-list; channel ID di §0 / docs/PUBLISHING.md)
```
Render di workspace: `--browser-executable=/usr/bin/google-chrome --gl=swangle` (tanpa GPU, ±0,8 dtk/frame → 85 dtk video ≈ 35–40 menit; jalankan di background).

## 2. Tidak ada gerbang kuota

Tidak ada API kuota gratis untuk Gemini TTS. Kuota AI Studio gratis ±10 request/hari per model — cukup untuk 1–3 video/minggu (1 request = 1 video). Jika `npm run tts` gagal (429, kuota habis, semua provider gagal, atau analisis timing gagal): **berhenti**, jangan riset/render/publish. Laporkan ke Slack #social (§10): langkah gagal + provider yang dicoba + error singkat. Fallback gcloud/azure aktif hanya setelah key-nya dibuat (lihat AGENTS.md / `.env.example`).

## 3. Topik (riset hari ini)

- Cari topik "**kok bisa?**" sains/teknik/infrastruktur yang **ramai di Indonesia 1–3 hari terakhir** (berita proyek, fenomena alam, teknologi, rekor). WebSearch + WebFetch sumber asli.
- Bisa divisualkan sebagai **diorama 3D potongan/cutaway** dengan mekanisme bertahap (langkah 1-2-3).
- Tidak mengulang: cek `src/videos/*` dan post Buffer 30 hari terakhir di kedua channel.
- **Aman:** tidak ada tragedi/korban, politik partisan, SARA, klaim medis/keuangan. Bencana boleh hanya sebagai sains netral tanpa korban.
- Setiap angka harus dari sumber yang dibaca; angka turunan dihitung dengan Python. Fakta tak terverifikasi → buang atau ganti topik.

## 4. Naskah — `src/videos/<slug>/naskah.txt`

- Format baris `NN  teks` (13–16 baris), total 1.100–1.400 karakter (≈ 70–85 detik).
- Pola: **hook berita** (angka/kejadian) → **"Tapi tunggu… kok bisa…?"** → **langkah 1/2/3** → **analogi** sehari-hari → **angka** → penutup "Jadi…" → CTA persis: `Mau dibongkar apa lagi? Tulis di komentar.`
- Kalimat lisan, santai ("nggak", "kayak"), angka ditulis dengan kata ("dua puluh delapan meter"). Kata hati-hati untuk temuan awal ("diduga", "menurut…").

## 5. Suara + timing

```bash
npm run tts -- <slug>        # vo.mp3 + alignment.json (Gemini; timing dari aligner offline, ±0,2 dtk/kata)
npm run timeline -- <slug>   # caption + rentang shot
npm run music -- <slug>      # musik orisinal sesuai titik potong
```
Cek `timeline.json`: semua kata ter-match, durasi 60–90 dtk. Jika TTS gagal di semua provider (atau analisis timing gagal): **berhenti dan laporkan** (§10) — jangan coba berulang-ulang. Audio gagal menyimpan take segar di `os.tmpdir()/vo-<slug>-failed.mp3`; `vo.mp3`/`alignment.json` lama tidak tersentuh.

## 6. Adegan 3D — pola scene

File: `config.json` (shot → baris pertama), `state.ts` (semua animasi = fungsi murni dari `t`, terikat `L(n)`), `world.ts` (diorama dibuat sekali, `update(t)` per frame), `shots.ts` (label, judul `*hijau*`, kamera keyframe, callout, chip), `index.ts`, lalu daftarkan di `src/videos/registry.ts`.

Standar kualitas (pelajaran dari video sebelumnya):
- **Potongan tanah (cut face) di z = 0**, tanah dalam (BOT ≈ −11) supaya separuh bawah frame tidak kosong; strata warna + titik air.
- Frame **potret**: FOV 44, objek utama mengisi ≥ 50% lebar; diorama yang memanjang diputar agar memanjang ke arah kamera.
- 1 shot ≈ 1–2 baris naskah (8–12 shot). Setiap shot punya gerak nyata (bukan still).
- Callout menunjuk objek 3D (anchor), maks 3 per shot, varian `orange` untuk fokus, `red` untuk bahaya.
- **Tidak boleh ada teks bertumpuk.** `Overlays.tsx` otomatis: label dijauhkan satu sama lain (jarak ≥ 16 px), tetap di bawah header/chip/CTA dan di atas zona caption (y < 1242); anchor di luar zona dipin ke tepi tanpa titik; label yang tetap tak muat disembunyikan. Jadi rancang anchor agar berada **di dalam zona** (antara bawah header dan y ≈ 1240) — kalau tidak, label bisa hilang atau garisnya menunjuk ke tepi. Caption: satu potongan (≤ 5 token; rangkaian angka tertulis yang dieja tidak dipecah, jadi bisa lebih dari 5 kata) per saat, tidak pernah dua sekaligus. Caption dua baris harus punya jarak antarbaris yang jelas (line-height 1.8 di `Overlays.tsx`, jangan dikecilkan).
- Partikel kecil (r ≤ 0,05) di close-up; sembunyikan yang menghalangi kamera.
- Diorama skematis (peta, jalur) diberi `tag: "ILUSTRASI"`.
- Shot terakhir: aerial/orbit hangat + CTA.

## 7. Verifikasi sebelum render penuh

```bash
npm run lint && npm test
npx remotion bundle --out-dir /tmp/rbundle
npx remotion still /tmp/rbundle <slug> /tmp/s_<f>.jpg --frame=<f> --browser-executable=/usr/bin/google-chrome --gl=swangle --image-format=jpeg
```
Render 1 still per shot di momen terpadat, gabung jadi contact sheet, **lihat dengan Read**: teks terbaca, **tidak ada label/caption/header yang saling menimpa**, tidak ada label yang hilang karena anchor di luar zona, objek utama jelas. Perbaiki maks 3 iterasi.

## 8. Render + finishing

```bash
npx remotion render /tmp/rbundle <slug> out/<slug>.mp4 --browser-executable=/usr/bin/google-chrome --gl=swangle --log=error   # background
ffmpeg -i out/<slug>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k -movflags +faststart out/<slug>-final.mp4
```
Cek: durasi ≈ `timeline.dur`, 1080×1920, ada audio, loudness ≈ −14 LUFS, 8–12 frame sampel terlihat benar.

## 9. Publish — ikuti `docs/PUBLISHING.md`

Ringkas jalurnya (detail di file itu, sudah teruji 2026-11-11):
1. Upload MP4 final ke Cloudinary (signed upload, `shorts/YYYY-MM-DD/<slug>`); cek `bytes` == ukuran file.
2. Buffer **GraphQL** `createPost` (bukan REST — token di .env hanya berlaku GraphQL): YouTube channel `6aedb753e29c69a171803f6e`, TikTok `6aedb7fee29c69a171804662`. `mode: "shareNow"`, `schedulingType: "automatic"`, `needsApproval: false`.
3. `metadata.youtube`: `title` ≤ 100 karakter (tanpa `| 11.ai` untuk VO Gemini; **diakhiri** `| 11.ai` untuk VO ElevenLabs-Free), `categoryId: "27"`, `privacy: "public"`, `madeForKids: false`, `isAiGenerated: true`, `notifySubscribers: true`. `text` = deskripsi: ringkasan 2–3 kalimat, CTA, `Sumber: …`, "Animasi bersifat ilustrasi. Suara: AI (Google AI Studio)", hashtag (`#shorts` + 5–6 topik).
4. `metadata.tiktok`: `{isAiGenerated: true, title: "<hook singkat>"}`. Caption: hook + CTA + sumber + `Suara: AI (Google AI Studio)` + hashtag sama.
5. Verifikasi: `post(input: { id: … })` sampai `status == "sent"` (argumen `input`, bukan `id` langsung — detail di PUBLISHING.md). TikTok bisa beberapa menit. `error` → laporkan, jangan retry buta.

Jika ada keraguan kualitas/fakta tapi video lengkap → `saveToDraft: true` dan laporkan; jika tidak lengkap → jangan posting.

## 10. Simpan & laporan

- Tidak ada commit/push. Source video + ledger VM-local (gitignored) hilang saat job selesai; repo tetap bersih dari file generated. Kalau mau arsip, simpan di luar repo.
- Laporan ke Slack **#social** (`slack_send_message`, channel `C0CDV7Y555K`) untuk **setiap** hasil run — sukses, dilewati, draft (ragu), atau gagal (langkah + error singkat). Isi sukses: judul, link YouTube & TikTok, sumber, provider yang dipakai (dari output `npm run tts`) + error kuota kalau gagal. Jangan pernah menyertakan API key. Jika Slack gagal, pakai `SendUserMessage` sebagai cadangan.
