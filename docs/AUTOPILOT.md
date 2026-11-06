# Autopilot: 3D explainer Short → YouTube + TikTok

Dibaca oleh scheduled task (Sen/Rab/Jum). Ikuti persis. Bahasa konten: Indonesia santai-profesional. Zona waktu WIB.

## 0. Konstanta

| | |
|---|---|
| Repo | `hendra/video-short` (branch `main`) |
| Channel | YouTube **Kali Aja Tau** `6aedb753e29c69a171803f6e` · TikTok **kaliajatau01** `6aedb7fee29c69a171804662` |
| Buffer org | `6aed53e7ec5c7c6d73f3e437` |
| Cloudinary | cloud `opqimovw`, folder `shorts/YYYY-MM-DD/<slug>` (resource type **video**) |
| ElevenLabs | suara **Den – Expressive, Clear, Smooth** `HmwgE8AfbDbaZpgAi4Bn`, model **`eleven_flash_v2_5`**, 1 take |
| Brand overlay | `{ prefix: "Kali Aja ", accent: "Tau" }` |
| Contoh referensi | `src/videos/terowongan-mrt` (terbaru, paling lengkap) dan `src/videos/rumah-pompa` |

`ELEVENLABS_API_KEY` diberikan oleh prompt scheduled task sebagai env var. **Jangan pernah** mencetak, meng-commit, atau menyertakannya di pesan/memory/Project. Tulis ke `.env` (sudah di-.gitignore) dengan `umask 077`.

## 1. Setup

```bash
# add_repo hendra/video-short (access: push), lalu:
git clone https://github.com/hendra/video-short && cd video-short
npm ci
# workspace cloud: Node fetch harus lewat proxy + CA bundle (tanpa ini: ENOTFOUND api.elevenlabs.io)
[ -n "$HTTPS_PROXY" ] && export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
umask 077; printf 'ELEVENLABS_API_KEY=%s\nELEVENLABS_VOICE_ID=HmwgE8AfbDbaZpgAi4Bn\nELEVENLABS_MODEL_ID=eleven_flash_v2_5\n' "$KEY_DARI_PROMPT" > .env
npm run credits                      # cek kuota (lihat §2)
```
Render di workspace: `--browser-executable=/usr/bin/google-chrome --gl=swangle` (tanpa GPU, ±0,8 dtk/frame → 85 dtk video ≈ 35–40 menit; jalankan di background).

## 2. Gerbang kredit (wajib, dua kali)

1. Awal run: `npm run credits -- --need 800`. Exit code 2 → **berhenti**, jangan riset/render. Kirim laporan: "dilewati, kredit ElevenLabs tidak cukup (sisa X, reset tanggal Y)".
2. Setelah naskah final: `npm run credits -- --video <slug>` (harga persis naskah). Exit 2 → berhenti & laporkan.

Kuota Free 10k/bulan; flash = 0,5 kredit/karakter; naskah ±1.100–1.400 karakter ≈ 550–700 kredit.

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
npm run tts -- <slug>        # vo.mp3 + alignment.json (timestamp per karakter dari API)
npm run timeline -- <slug>   # caption + rentang shot
npm run music -- <slug>      # musik orisinal sesuai titik potong
```
Cek `timeline.json`: semua kata ter-match, durasi 60–90 dtk. Jika TTS gagal: jangan coba berulang-ulang (maks 1 kali ulang); laporkan.

## 6. Adegan 3D — salin pola `terowongan-mrt`

File: `config.json` (shot → baris pertama), `state.ts` (semua animasi = fungsi murni dari `t`, terikat `L(n)`), `world.ts` (diorama dibuat sekali, `update(t)` per frame), `shots.ts` (label, judul `*hijau*`, kamera keyframe, callout, chip), `index.ts`, lalu daftarkan di `src/videos/registry.ts`.

Standar kualitas (pelajaran dari video sebelumnya):
- **Potongan tanah (cut face) di z = 0**, tanah dalam (BOT ≈ −11) supaya separuh bawah frame tidak kosong; strata warna + titik air.
- Frame **potret**: FOV 44, objek utama mengisi ≥ 50% lebar; diorama yang memanjang diputar agar memanjang ke arah kamera.
- 1 shot ≈ 1–2 baris naskah (8–12 shot). Setiap shot punya gerak nyata (bukan still).
- Callout menunjuk objek 3D (anchor), maks 3 per shot, varian `orange` untuk fokus, `red` untuk bahaya.
- Partikel kecil (r ≤ 0,05) di close-up; sembunyikan yang menghalangi kamera.
- Diorama skematis (peta, jalur) diberi `tag: "ILUSTRASI"`.
- Shot terakhir: aerial/orbit hangat + CTA.

## 7. Verifikasi sebelum render penuh

```bash
npx tsc && npx tsc -p scripts && npx eslint src
npx remotion bundle --out-dir /tmp/rbundle
npx remotion still /tmp/rbundle <slug> /tmp/s_<f>.jpg --frame=<f> --browser-executable=/usr/bin/google-chrome --gl=swangle --image-format=jpeg
```
Render 1 still per shot di momen terpadat, gabung jadi contact sheet, **lihat dengan Read**: teks terbaca, tidak terpotong/bertabrakan dengan header/caption, objek utama jelas. Perbaiki maks 3 iterasi.

## 8. Render + finishing

```bash
npx remotion render /tmp/rbundle <slug> out/<slug>.mp4 --browser-executable=/usr/bin/google-chrome --gl=swangle --log=error   # background
ffmpeg -i out/<slug>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k -movflags +faststart out/<slug>-final.mp4
```
Cek: durasi ≈ `timeline.dur`, 1080×1920, ada audio, loudness ≈ −14 LUFS, 8–12 frame sampel terlihat benar.

## 9. Publish

1. Cloudinary: `sign-upload` `{public_id: "shorts/YYYY-MM-DD/<slug>"}` → POST ke `/video/upload` dengan semua `upload_params`; pastikan `bytes` = ukuran file.
2. Buffer YouTube (`mode: shareNow`, `schedulingType: automatic`):
   - `metadata.youtube`: `title` ≤ 100 karakter **diakhiri `| suara: elevenlabs.io`** (wajib, paket Free), `categoryId: "27"`, `privacy: "public"`, `madeForKids: false`, `isAiGenerated: true`, `notifySubscribers: true`.
   - `text` = deskripsi: ringkasan 2–3 kalimat, CTA, `Sumber: …`, "Animasi bersifat ilustrasi. Suara: elevenlabs.io", hashtag (`#shorts` + 5–6 topik).
3. Buffer TikTok: `text` caption (hook + CTA + sumber + `Suara: elevenlabs.io` + hashtag), `metadata.tiktok`: `{isAiGenerated: true, title: "<hook singkat> | suara: elevenlabs.io"}`.
4. `get_post` sampai `sent` (TikTok bisa beberapa menit). `error` → laporkan.

Jika ada keraguan kualitas/fakta tapi video lengkap → `saveToDraft: true` dan laporkan; jika tidak lengkap → jangan posting.

## 10. Simpan & laporan

- Tambah baris di `docs/ledger.md`.
- Commit (`src/videos/<slug>/*`, `public/<slug>/vo.mp3`, registry, ledger; bukan `out/` atau `music.wav`) dan push ke `main`.
- `SendUserMessage`: judul, link YouTube & TikTok, sumber, kredit terpakai/sisa (`npm run credits`).
