# Autopilot: 3D Explainer Shorts → YouTube + TikTok

(Ada juga varian otomatis penuh via GitHub Actions — 3×/hari — lihat `ops/README.md`. Runbook ini berlaku untuk keduanya.)

Dibaca oleh scheduled task (Sen/Rab/Jum) dan oleh CI `video-run` (cron harian ×3: 08:00/11:30/16:30 WIB, lihat `ops/README.md`). Ikuti persis.

**Bahasa konten:** Indonesia santai-profesional.  
**Zona waktu:** WIB.

## 0. Konstanta

| | |
|---|---|
| Repo | `hendra/yt-video-short-generator` (branch `main`) |
| Channel | YouTube **Kali Aja Tau** `6aedb753e29c69a171803f6e` · TikTok **kaliajatau01** `6aedb7fee29c69a171804662` |
| Buffer org | `6aed53e7ec5c7c6d73f3e437` |
| Cloudinary | cloud `opqimovw`, folder `shorts/YYYY-MM-DD/<slug>` (resource type **video**) |
| Publish | Ikuti **`docs/PUBLISHING.md`** (upload → Buffer GraphQL → poll). Env keys wajib: `BUFFER_ACCESS_TOKEN` (scope posts:read + posts:write; tidak bisa list channels), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| TTS | **Gemini TTS** (`gemini-2.5-flash-preview-tts`, voice `Charon`) lewat Google AI Studio. Env `GEMINI_API_KEY`. Chain `auto`: gemini → gcloud → azure. ElevenLabs = legacy opsional (`--provider=elevenlabs`), bukan bagian dari chain |
| TTS voice identity | **LOCKED: one consistent natural-sounding male narrator voice.** Default voice: `Charon`. Gunakan voice identity, provider, model, dan konfigurasi suara yang sama untuk seluruh video. Jangan mengganti suara secara otomatis atau acak |
| Brand overlay | `{ prefix: "Kali Aja ", accent: "Tau" }` |
| Laporan | Slack **#social** `C0CDV7Y555K` (`slack_send_message`) |
| Contoh referensi | tidak ada — seluruh `src/videos/*/` digenerate di CI |

`GEMINI_API_KEY` diberikan oleh prompt scheduled task sebagai env var. **Jangan pernah** mencetak, meng-commit, atau menyertakannya di pesan/memory/Project.

Tulis ke `.env` (sudah di-.gitignore) dengan `umask 077`.

Keys lain (`BUFFER_ACCESS_TOKEN`, `CLOUDINARY_*`) tidak disuntik lewat prompt — di-copy manual oleh operator ke `.env` workspace sekali saja (lihat §1).

Operator juga wajib menambahkan `GEMINI_API_KEY` ke prompt scheduled task sebelum run berikutnya.

Jika tidak ada API key, `npm run tts` akan gagal dan run harus dihentikan.

---

## 1. Setup

```bash
# add_repo hendra/yt-video-short-generator (access: read — tidak ada yang di-push), lalu:
git clone https://github.com/hendra/yt-video-short-generator && cd yt-video-short-generator

npm ci

# workspace cloud: Node fetch harus lewat proxy + CA bundle
[ -n "$HTTPS_PROXY" ] && export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt

umask 077

printf 'GEMINI_API_KEY=%s\nGEMINI_TTS_VOICE=Charon\n' "$KEY_DARI_PROMPT" > .env

# Sekali saja per workspace baru (keys tidak dari prompt, jangan dicetak di log):
printf 'BUFFER_ACCESS_TOKEN=%s\nCLOUDINARY_CLOUD_NAME=opqimovw\nCLOUDINARY_API_KEY=%s\nCLOUDINARY_API_SECRET=%s\n' "$BUFFER_KEY" "$CLOUDINARY_KEY" "$CLOUDINARY_SECRET" >> .env
```

**Penting:**
- Jangan mengubah `GEMINI_TTS_VOICE` tanpa persetujuan operator.
- Jangan menghapus atau mengganti konfigurasi suara yang sudah digunakan sebelumnya.
- Jangan membuat konfigurasi suara baru untuk setiap video.
- Pastikan konfigurasi TTS tetap konsisten di semua scheduled runs.

Render di workspace:

`--browser-executable=/usr/bin/google-chrome --gl=swangle`

Tanpa GPU, ±0,8 detik/frame → 85 detik video ≈ 35–40 menit. Jalankan di background.

---

## 2. Tidak Ada Gerbang Kuota

Tidak ada API kuota gratis untuk Gemini TTS.

Kuota AI Studio gratis ±10 request/hari per model — cukup untuk 1–3 video/minggu (1 request = 1 video).

Jika `npm run tts` gagal (429, kuota habis, semua provider gagal, atau analisis timing gagal):

**BERHENTI.**

Jangan riset, render, atau publish.

Laporkan ke Slack #social (§10):
- Langkah yang gagal.
- Provider yang dicoba.
- Error singkat.
- Apakah kegagalan disebabkan kuota atau konfigurasi.

Fallback gcloud/azure hanya aktif setelah key-nya dibuat (lihat AGENTS.md / `.env.example`).

**Voice consistency rule:** Jangan mengorbankan konsistensi suara hanya untuk menghindari kegagalan provider.

Jika Gemini gagal dan provider fallback menghasilkan suara berbeda, jangan lanjut menggunakan suara tersebut. Berhenti dan laporkan kegagalan.

---

## 3. Topik (Riset Hari Ini)

Cari topik "kok bisa?" sains/teknik/infrastruktur yang ramai di Indonesia dalam 1–3 hari terakhir.

Contoh:
- Proyek infrastruktur unik.
- Fenomena alam.
- Teknologi terbaru.
- Rekor dunia.
- Penemuan sains.
- Mekanisme teknologi yang jarang diketahui.
- Fakta menarik di balik benda atau sistem sehari-hari.
- Fenomena yang sedang ramai dibicarakan masyarakat Indonesia.

Gunakan WebSearch + WebFetch sumber asli.

### Kriteria pemilihan

1. Memiliki potensi viral dan menarik perhatian audiens Indonesia.
2. Memiliki unsur curiosity gap.
3. Bisa divisualkan sebagai diorama 3D potongan/cutaway.
4. Memiliki mekanisme yang bisa dijelaskan secara visual dan bertahap.
5. Memiliki fakta menarik yang membuat penonton ingin menonton sampai akhir.
6. Memiliki potensi mendapatkan komentar, share, dan diskusi.

Tidak mengulang:
- Cek `src/videos/*`.
- Cek post Buffer 30 hari terakhir di kedua channel.
- Hindari topik, sudut pandang, dan storytelling yang terlalu mirip dengan video sebelumnya.

**Aman:** tidak ada tragedi/korban, politik partisan, SARA, klaim medis/keuangan. Bencana boleh hanya sebagai sains netral tanpa korban.

Setiap angka harus dari sumber yang dibaca. Angka turunan dihitung dengan Python.

Fakta tak terverifikasi → buang atau ganti topik.

---

## 4. Naskah — Dynamic Trending Storytelling

File: `src/videos/<slug>/naskah.txt`

**TUJUAN UTAMA: Setiap video harus terasa seperti konten baru, bukan menggunakan template storytelling yang sama berulang kali.**

Jangan selalu menggunakan pola:
Hook → "Tapi tunggu..." → Langkah 1/2/3 → Analogi → Angka → "Jadi..." → CTA.

Pola tersebut boleh digunakan jika memang sedang relevan dan menarik, tetapi bukan format wajib.

### 4.1 Riset format storytelling yang sedang populer

Sebelum menulis naskah, lakukan riset format konten YouTube Shorts dan TikTok yang sedang populer dan banyak mendapatkan respons positif.

Prioritaskan:
- Format storytelling yang sedang tren dalam 7–30 hari terakhir.
- Video dengan engagement tinggi dibandingkan jumlah views.
- Format dengan banyak komentar positif dan interaksi.
- Gaya storytelling yang sering digunakan oleh kreator sukses di niche edukasi, sains, teknologi, fakta unik, dan explainer.
- Format yang mendorong watch time, completion rate, rewatch, dan curiosity.
- Struktur penyampaian yang mendapatkan banyak respons dari audiens Indonesia maupun internasional.

Gunakan:
- YouTube Shorts.
- TikTok.
- Kreator edukasi dan science explainer.
- Konten teknologi dan interesting facts.
- Format storytelling yang sedang populer di platform tersebut.

Jangan hanya melihat jumlah views. Perhatikan juga:
- Engagement rate jika datanya tersedia.
- Rasio likes terhadap views.
- Komentar dan kualitas diskusi.
- Share dan save jika tersedia.
- Respons audiens terhadap cara penyampaian cerita.

**Penting:** Jangan mengarang angka engagement, likes, favorites, saves, atau popularitas. Jika data tersebut tidak tersedia, gunakan sinyal yang benar-benar bisa diverifikasi dan jangan mengklaim suatu format sebagai yang paling populer.

Fokus pada mengidentifikasi FORMAT STORYTELLING, bukan menyalin isi video kreator lain.

### 4.2 Variasi format naskah

Gunakan variasi format berikut sebagai inspirasi. Ini bukan daftar tertutup.

**A. Mystery / Curiosity Storytelling**
- Mulai dengan misteri.
- Berikan petunjuk secara bertahap.
- Ungkap mekanisme sebenarnya di bagian akhir.

**B. Unexpected Facts**
- Mulai dengan fakta yang terdengar mustahil.
- Jelaskan mengapa hal tersebut bisa terjadi.
- Berikan penjelasan yang mengubah perspektif penonton.

**C. Reverse Storytelling**
- Tunjukkan hasil akhir terlebih dahulu.
- Mundur untuk menjelaskan bagaimana hal tersebut terjadi.
- Akhiri dengan penjelasan yang mengejutkan.

**D. Problem → Solution**
- Mulai dari masalah yang relatable.
- Jelaskan kesulitan atau tantangannya.
- Bongkar teknologi atau mekanisme solusinya.

**E. Myth vs Reality**
- Mulai dengan kepercayaan umum.
- Tunjukkan fakta yang berbeda.
- Jelaskan bukti dan mekanismenya.

**F. What If Scenario**
- Mulai dengan pertanyaan hipotetis.
- Gambarkan apa yang akan terjadi.
- Jelaskan berdasarkan prinsip sains atau teknik yang relevan.

**G. Behind the Scenes**
- Mulai dengan sesuatu yang sering dilihat orang.
- Bongkar bagian tersembunyi yang jarang diketahui.
- Visualisasikan mekanisme di baliknya.

**H. Countdown / Ranking**
- Susun beberapa fakta atau tahapan berdasarkan urutan menarik.
- Bangun antisipasi menuju fakta paling mengejutkan.
- Gunakan hanya jika topik memang cocok.

**I. Direct Question & Answer**
- Mulai dengan pertanyaan yang sering muncul.
- Berikan jawaban singkat yang memancing rasa penasaran.
- Bongkar penjelasan secara bertahap.

**J. Mini Documentary**
- Ceritakan kejadian atau penemuan.
- Bangun konteks dan konflik teknis.
- Jelaskan proses dan dampaknya.

**K. Comparison Storytelling**
- Bandingkan dua teknologi, kondisi, atau mekanisme.
- Tunjukkan perbedaan yang tidak terlihat.
- Jelaskan mengapa hasilnya berbeda.

**L. POV / Immersive Storytelling**
- Ajak penonton membayangkan berada dalam suatu situasi.
- Ceritakan mekanisme dari sudut pandang pengalaman tersebut.
- Gunakan visual 3D untuk membuat penonton merasa terlibat.

Format baru yang ditemukan dari tren terbaru juga boleh digunakan.

### 4.3 Randomized Format Selection

Setiap video wajib memilih format storytelling yang berbeda atau memiliki pendekatan narasi yang berbeda dari video sebelumnya.

Proses pemilihan:

1. Riset format yang sedang populer.
2. Buat shortlist 3–5 format yang relevan dengan topik.
3. Hilangkan format yang tidak cocok dengan topik.
4. Periksa format yang digunakan dalam 10 video terakhir.
5. Pilih satu format secara acak dari shortlist yang tersisa.
6. Berikan prioritas lebih tinggi kepada format yang sedang menunjukkan tren positif.
7. Hindari format yang sama dalam dua video berturut-turut.
8. Jangan menggunakan format yang sama lebih dari dua kali dalam lima video terakhir, kecuali tidak ada alternatif yang sesuai.

Random bukan berarti asal memilih.

Format harus:
- Relevan dengan topik.
- Mudah dipahami.
- Menarik secara emosional atau intelektual.
- Memiliki potensi retention tinggi.
- Cocok untuk visualisasi 3D.

### 4.4 Dynamic Writing Style

Selain struktur, variasikan juga cara penyampaian:

- Kadang mulai dengan pertanyaan.
- Kadang mulai dengan fakta mengejutkan.
- Kadang mulai dengan situasi sehari-hari.
- Kadang mulai dengan pernyataan kontroversial yang aman dan faktual.
- Kadang mulai dengan hasil akhir.
- Kadang mulai dengan perbandingan.
- Kadang menggunakan storytelling seperti mini dokumenter.
- Kadang menggunakan analogi yang relatable.
- Kadang menggunakan pendekatan investigasi.

Variasikan juga:
- Panjang kalimat.
- Tempo storytelling.
- Posisi fakta paling menarik.
- Cara membangun curiosity.
- Transisi antarbagiannya.
- Penggunaan pertanyaan retoris.
- Cara mengungkap fakta.
- Jenis ending.

Jangan selalu menggunakan:
- "Tapi tunggu..."
- "Kok bisa?"
- "Nah, sekarang..."
- "Jadi..."
- "Ternyata..."
- "Bayangkan..."

Frasa tersebut boleh digunakan secara natural, tetapi jangan menjadi kebiasaan yang selalu muncul di setiap video.

### 4.5 Struktur dan durasi naskah

- Format baris: `NN  teks`.
- Target 13–16 baris sebagai panduan, bukan aturan storytelling.
- Total 1.100–1.400 karakter.
- Durasi target 70–85 detik.
- Kalimat harus terdengar natural saat dibacakan.
- Gunakan bahasa Indonesia santai-profesional.
- Gunakan kata sehari-hari seperti "nggak", "kayak", dan "ternyata" secara natural.
- Angka ditulis dengan kata, misalnya "dua puluh delapan meter".
- Hindari bahasa terlalu formal, kaku, atau seperti membaca artikel.
- Hindari kalimat panjang yang sulit diucapkan TTS.
- Berikan jeda alami pada bagian yang membutuhkan penekanan.
- Jangan memasukkan fakta yang tidak memiliki sumber.
- Kata hati-hati untuk temuan awal ("diduga", "menurut…").

### 4.6 Retention dan storytelling quality

Setiap naskah harus memiliki:

**Opening**
- Hook kuat dalam 1–3 detik pertama.
- Jangan menggunakan intro generik seperti "Halo teman-teman".
- Jangan langsung memperkenalkan channel.
- Bangun curiosity sejak kalimat pertama.

**Middle**
- Setiap beberapa detik harus ada informasi baru.
- Jangan mengulang informasi yang sama.
- Gunakan storytelling progression.
- Berikan alasan kepada penonton untuk terus menonton.
- Bangun curiosity tanpa menahan informasi secara berlebihan.

**Payoff**
- Berikan jawaban atau penjelasan yang memuaskan.
- Fakta paling menarik harus memiliki posisi strategis.
- Jangan membuat ending terasa dipaksakan.
- Pastikan judul dan hook benar-benar terjawab.

**CTA**

CTA boleh bervariasi agar tidak monoton, tetapi harus tetap mengundang komentar.

Contoh:
- "Menurut kamu, teknologi apa lagi yang harus kita bongkar?"
- "Kalau kamu baru tahu, tulis di komentar."
- "Mau tahu cara kerja teknologi lainnya? Tulis idenya di komentar."
- "Bagian mana yang paling bikin kamu penasaran?"

Gunakan CTA yang paling cocok dengan konteks video. Hindari CTA yang selalu sama.

### 4.7 Script originality

- Jangan menyalin naskah kreator lain.
- Jangan menggunakan kalimat viral orang lain secara verbatim.
- Ambil inspirasi dari struktur dan teknik storytelling saja.
- Setiap naskah harus dibuat secara original berdasarkan hasil riset topik.
- Jangan memaksakan format trending jika membuat penjelasan menjadi tidak akurat.

### 4.8 Script metadata

Sebelum TTS, simpan metadata format yang dipilih di lokasi yang sesuai dengan struktur project.

Minimal catat:
- Topic.
- Storytelling format.
- Source of format inspiration.
- Research date.
- Opening style.
- Narrative structure.
- CTA style.
- Previous format history.

Jika project memiliki ledger atau metadata tracking, gunakan yang sudah ada. Jangan membuat sistem duplikat yang tidak diperlukan.

Tujuannya agar sistem dapat mempelajari format mana yang sudah digunakan dan terus meningkatkan variasi konten.

---

## 5. Suara TTS + Timing

**PRIORITAS UTAMA: Suara narator harus terdengar seperti pria sungguhan, natural, hangat, jelas, dan profesional. Bukan suara robot.**

Suara adalah identitas audio channel Kali Aja Tau. Identitas ini harus konsisten di semua video.

### 5.1 Locked Male Voice Identity

Konfigurasi default:

- Provider: Gemini TTS.
- Model: `gemini-2.5-flash-preview-tts`.
- Voice: `Charon`.
- Environment: `GEMINI_TTS_VOICE=Charon`.

Gunakan voice yang sama untuk seluruh video.

Jangan mengganti voice berdasarkan:
- Topik video.
- Mood naskah.
- Jenis storytelling.
- Panjang video.
- Scheduled run.
- Random selection.
- Keinginan membuat suara lebih dramatis.

**Satu channel = satu identitas suara narator.**

Jangan menggunakan suara pria yang berbeda-beda di antara video.

Jangan berganti antara suara pria dan wanita.

Jangan menggunakan suara yang terdengar seperti robot, text-to-speech lama, atau voice assistant sintetis.

### 5.2 Natural Human Male Voice

Karakter suara yang diinginkan:

- Natural adult male voice.
- Warm and friendly.
- Clear Indonesian pronunciation.
- Conversational delivery.
- Medium to medium-low pitch.
- Natural breathing and pauses.
- Smooth intonation.
- Expressive but not exaggerated.
- Confident and engaging.
- Professional documentary/explainer narrator.

Gaya pembacaan seperti presenter dokumenter teknologi modern yang sedang menjelaskan sesuatu kepada teman.

Bukan:
- Robot voice.
- Monoton.
- Flat intonation.
- Artificially deep voice.
- Overly dramatic announcer.
- Radio advertisement voice.
- Excessively energetic influencer voice.
- Unnatural pronunciation.
- Excessively fast delivery.

### 5.3 Consistent Voice Across All Videos

Konsistensi suara wajib dijaga pada level:

1. TTS provider.
2. TTS model.
3. Voice ID/name.
4. Speaker configuration.
5. Speaking style.
6. Pitch characteristics.
7. Speed.
8. Audio processing.

Gunakan konfigurasi yang sama setiap kali menjalankan TTS.

Jika API mendukung speaker/style instructions, gunakan konfigurasi tetap yang sama untuk semua video.

Jangan membuat prompt suara baru berdasarkan setiap naskah.

Perubahan kecil dalam ekspresi dan intonasi diperbolehkan selama identitas dasar narator tetap sama.

**Jangan mengubah voice ID hanya karena hasil satu take terdengar kurang bagus.**

Jika konfigurasi voice yang terkunci tidak tersedia, hentikan proses dan laporkan. Jangan memilih voice pengganti secara otomatis.

### 5.4 Voice Quality Check

Setiap kali menghasilkan TTS:

- Dengarkan hasil audio jika memungkinkan.
- Periksa kejelasan pengucapan Bahasa Indonesia.
- Periksa apakah suara terdengar natural.
- Pastikan tidak ada pengucapan yang terpotong.
- Pastikan tidak ada jeda aneh.
- Pastikan tidak ada perubahan pitch yang ekstrem.
- Pastikan tidak terdengar seperti robot.
- Pastikan voice identity sama dengan konfigurasi sebelumnya.

Jika tersedia audio referensi dari video sebelumnya, gunakan sebagai pembanding konsistensi.

Jangan mengubah voice hanya untuk memperbaiki masalah pengucapan. Perbaiki teks atau pengaturan prosody terlebih dahulu.

### 5.5 Audio generation

```bash
npm run tts -- <slug>
npm run timeline -- <slug>
npm run music -- <slug>
```

Output:
- `vo.mp3`
- `alignment.json`
- `timeline.json`

Timing harus diperiksa:
- Semua kata ter-match.
- Durasi 60–90 detik.
- Tidak ada bagian audio yang terpotong.
- Tidak ada jeda yang terlalu panjang atau tidak natural.

Jika TTS gagal di semua provider atau analisis timing gagal:

**BERHENTI DAN LAPORKAN.**

Jangan mencoba berulang-ulang.

Audio gagal menyimpan take segar di `os.tmpdir()/vo-<slug>-failed.mp3`; `vo.mp3`/`alignment.json` lama tidak tersentuh.

---

## 6. Adegan 3D — Pola Scene

File:
- `config.json` (shot → baris pertama).
- `state.ts` (semua animasi = fungsi murni dari `t`, terikat `L(n)`).
- `world.ts` (diorama dibuat sekali, `update(t)` per frame).
- `shots.ts` (label, judul `*hijau*`, kamera keyframe, callout, chip).
- `index.ts`.
- Daftarkan di `src/videos/registry.ts`.

Standar kualitas:

- Potongan tanah (cut face) di z = 0, tanah dalam (BOT ≈ −11) supaya separuh bawah frame tidak kosong; strata warna + titik air.
- Frame potret: FOV 44, objek utama mengisi ≥ 50% lebar; diorama yang memanjang diputar agar memanjang ke arah kamera.
- 1 shot ≈ 1–2 baris naskah (8–12 shot).
- Setiap shot punya gerak nyata (bukan still).
- Callout menunjuk objek 3D (anchor), maksimal 3 per shot, varian `orange` untuk fokus, `red` untuk bahaya.
- Tidak boleh ada teks bertumpuk.

`Overlays.tsx` otomatis:
- Label dijauhkan satu sama lain (jarak ≥ 16 px).
- Tetap di bawah header/chip/CTA dan di atas zona caption (y < 1242).
- Anchor di luar zona dipin ke tepi tanpa titik.
- Label yang tetap tak muat disembunyikan.

Rancang anchor agar berada di dalam zona (antara bawah header dan y ≈ 1240).

Caption:
- Satu potongan (≤ 5 token; rangkaian angka tertulis yang dieja tidak dipecah, jadi bisa lebih dari 5 kata) per saat.
- Tidak pernah dua sekaligus.
- Caption dua baris harus punya jarak antarbaris yang jelas (line-height 1.8 di `Overlays.tsx`, jangan dikecilkan).

Partikel kecil (r ≤ 0,05) di close-up; sembunyikan yang menghalangi kamera.

Diorama skematis (peta, jalur) diberi `tag: "ILUSTRASI"`.

Shot terakhir: aerial/orbit hangat + CTA.

### Visual storytelling must follow the selected script format

Scene composition harus mendukung format naskah yang dipilih.

Contoh:
- Mystery: tampilkan petunjuk secara bertahap.
- Reverse storytelling: mulai dari hasil akhir, kemudian visualisasikan proses mundur.
- Problem → Solution: tampilkan masalah sebelum mekanisme solusinya.
- Myth vs Reality: tampilkan perbandingan visual yang jelas.
- Countdown: setiap item memiliki visual yang berbeda.
- POV: kamera dan objek harus membuat penonton merasa terlibat.
- Mini Documentary: gunakan transisi visual yang terasa seperti perjalanan cerita.

Jangan selalu menggunakan urutan scene yang sama.

Visual storytelling harus mengikuti narasi, bukan memaksakan narasi mengikuti template scene.

---

## 7. Verifikasi Sebelum Render Penuh

```bash
npm run lint && npm test

npx remotion bundle --out-dir /tmp/rbundle

npx remotion still /tmp/rbundle <slug> /tmp/s_<f>.jpg \
  --frame=<f> \
  --browser-executable=/usr/bin/google-chrome \
  --gl=swangle \
  --image-format=jpeg
```

Render 1 still per shot di momen terpadat, gabung jadi contact sheet, lihat dengan Read.

Periksa:
- Teks terbaca.
- Tidak ada label/caption/header yang saling menimpa.
- Tidak ada label yang hilang karena anchor di luar zona.
- Objek utama jelas.
- Komposisi visual sesuai dengan narasi.
- Setiap shot memiliki variasi visual.
- Tidak ada scene yang terasa repetitif atau membosankan.
- Storytelling visual sesuai dengan format naskah.

Perbaiki maksimal 3 iterasi.

---

## 8. Render + Finishing

```bash
npx remotion render /tmp/rbundle <slug> out/<slug>.mp4 \
  --browser-executable=/usr/bin/google-chrome \
  --gl=swangle \
  --log=error
```

Jalankan di background.

Finishing:

```bash
ffmpeg -i out/<slug>.mp4 \
  -c:v copy \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 \
  -ar 48000 \
  -c:a aac \
  -b:a 192k \
  -movflags +faststart \
  out/<slug>-final.mp4
```

Cek:
- Durasi ≈ `timeline.dur`.
- Resolusi 1080×1920.
- Ada audio.
- Loudness ≈ −14 LUFS.
- 8–12 frame sampel terlihat benar.
- Suara narator terdengar natural dan konsisten.
- Musik tidak menutupi suara narator.
- Tidak ada clipping atau distorsi.
- Tidak ada perubahan identitas suara.

---

## 9. Publish — Ikuti `docs/PUBLISHING.md`

Detail jalur publishing sudah teruji 2026-11-11.

1. Upload MP4 final ke Cloudinary (signed upload, `shorts/YYYY-MM-DD/<slug>`); cek `bytes` == ukuran file.

2. Buffer GraphQL `createPost` (bukan REST — token di .env hanya berlaku GraphQL).

Channel:
- YouTube: `6aedb753e29c69a171803f6e`.
- TikTok: `6aedb7fee29c69a171804662`.

Konfigurasi:
- `mode: "shareNow"`.
- `schedulingType: "automatic"`.
- `needsApproval: false`.

3. `metadata.youtube`:

- `title` ≤ 100 karakter.
- Tanpa `| 11.ai` untuk VO Gemini.
- Diakhiri `| 11.ai` untuk VO ElevenLabs-Free.
- `categoryId: "27"`.
- `privacy: "public"`.
- `madeForKids: false`.
- `isAiGenerated: true`.
- `notifySubscribers: true`.

`text` = deskripsi:
- Ringkasan 2–3 kalimat.
- CTA yang relevan.
- `Sumber: …`.
- `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio)`.
- Hashtag (`#shorts` + 5–6 hashtag topik).

4. `metadata.tiktok`:

```json
{
  "isAiGenerated": true,
  "title": "<hook singkat>"
}
```

Caption:
- Hook.
- CTA.
- Sumber.
- `Suara: AI (Google AI Studio)`.
- Hashtag yang relevan.

5. Verifikasi:

`post(input: { id: … })` sampai `status == "sent"`.

Argumen menggunakan `input`, bukan `id` langsung — detail di PUBLISHING.md.

TikTok bisa beberapa menit.

`error` → laporkan, jangan retry buta.

Jika ada keraguan kualitas/fakta tetapi video lengkap → `saveToDraft: true` dan laporkan.

Jika tidak lengkap → jangan posting.

---

## 10. Simpan & Laporan

Tidak ada commit/push.

Source video + ledger VM-local (gitignored) hilang saat job selesai; repo tetap bersih dari file generated. Kalau mau arsip, simpan di luar repo.

Laporan ke Slack **#social** (`slack_send_message`, channel `C0CDV7Y555K`) untuk setiap hasil run:
- Sukses.
- Dilewati.
- Draft.
- Gagal.

Isi laporan sukses:
- Judul.
- Link YouTube.
- Link TikTok.
- Sumber.
- Provider TTS.
- Model TTS.
- Voice ID/name.
- Status kualitas suara.
- Storytelling format yang digunakan.
- Sumber inspirasi format.
- Catatan singkat mengenai pendekatan storytelling.

Jika gagal:
- Langkah yang gagal.
- Error singkat.
- Provider yang dicoba.
- Apakah ada masalah kuota, voice consistency, atau konfigurasi.

Jangan pernah menyertakan API key.

Jika Slack gagal, gunakan `SendUserMessage` sebagai cadangan.

---

## 11. Final Quality Principles

Setiap video Kali Aja Tau harus memenuhi prinsip berikut:

1. **Natural Voice:** Narator pria harus terdengar natural seperti manusia sungguhan, bukan robot.
2. **Consistent Voice:** Identitas suara tidak boleh berubah antarvideo.
3. **Fresh Storytelling:** Jangan menggunakan format naskah yang sama secara terus-menerus.
4. **Trending Formats:** Gunakan inspirasi format storytelling yang sedang populer dan mendapatkan respons positif di YouTube dan TikTok.
5. **Randomized Variety:** Pilih format secara dinamis dengan tetap memperhatikan relevansi dan histori penggunaan.
6. **Strong Retention:** Setiap video harus memiliki hook, perkembangan cerita, dan payoff yang kuat.
7. **Visual Excellence:** Visual 3D harus menarik, bergerak, dan mendukung storytelling.
8. **Factual Accuracy:** Semua fakta harus bisa dipertanggungjawabkan.
9. **Original Content:** Jangan menyalin konten kreator lain.
10. **Consistent Branding:** Semua video harus terasa sebagai bagian dari channel Kali Aja Tau.

**Prinsip terpenting: Jangan membuat video yang terasa seperti hasil produksi template otomatis. Setiap video harus mempunyai cara bercerita, pembukaan, alur, dan pengalaman visual yang berbeda, tetapi tetap memiliki identitas suara dan branding Kali Aja Tau yang konsisten.**
