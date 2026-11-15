# Design: Channel ketiga "Cerpenek" (YouTube + TikTok) — dongeng anak di pipeline video-short

**Date:** 2026-11-15
**Status:** Draft — menunggu persetujuan user.

## Intent / why

Pipeline ini sudah menerbitkan dua channel (Kali Aja Tau, AI Labs). User ingin channel ketiga, **Cerpenek** (singkatan *Cerita Pendek Nenek*), dengan tujuan: **hiburan yang mendidik untuk anak dan orang tua di Indonesia**.

- Penonton: anak **5–10 tahun** (usia SD), ditonton bersama orang tua.
- Isi: sejarah, legenda, dan asal-usul yang semuanya **lokal Indonesia**.
- Suara: **wanita, lembut, gaya mendongeng**, bahasa Indonesia.
- Jadwal tayang sama dengan dua channel yang ada (6 slot/hari).
- Secrets terpisah, diberikan user belakangan.

## Goals

1. Akun `cerpenek` berjalan di pipeline yang sama, dipilih per run seperti akun lain.
2. Video terasa seperti **dongeng**, bukan pelajaran: diorama mainan kayu, tokoh yang konsisten dari video ke video.
3. Suara per akun: Cerpenek memakai suara wanita; dua channel lama tetap persis seperti sekarang.
4. Akun tidak bisa tayang sebelum ID Buffer, secrets, dan suara terisi.

## Non-goals

- Mesin render atau komposisi baru. Engine 3D yang ada dipakai apa adanya.
- Jalur gambar 2D / ilustrasi AI.
- Musik baru (bed lo-fi yang ada dipakai dulu).
- Mengubah jadwal, format, atau brief channel lain.

## Anti-goals (gagal walau "jalan")

- Video menakutkan anak: darah, horor, kutukan yang digambarkan seram.
- Legenda disampaikan seolah fakta sejarah, atau sejarah yang tidak dicek ke sumber.
- Suara atau perilaku Kali Aja / AI Labs berubah.
- Tokoh yang bentuknya berbeda-beda dan kasar di tiap video.

## Constraints

- Agent CI adalah model kecil gratis (`opencode/inkling-2-small-free`); tidak ada WebSearch, hanya WebFetch. Karena itu topik berasal dari backlog kurasi, dan tokoh berasal dari prefab, bukan dirakit bebas.
- Biaya render (AGENTS.md § Look & render cost): tanpa environment map, bump map, VSM, post-processing. Prefab baru memakai `kit.mat` / `kit.box/cyl/ball` dan `kit.lights()`.
- Semua yang terlihat fungsi murni dari `t`.
- Tidak ada hasil generate yang masuk git.
- Environment GitHub `cerpenek` **harus ada** sebelum run pertama (environment yang tidak ada membatalkan run). Secret yang tidak di-set di environment jatuh ke repo secret.
- "Made for Kids": YouTube mewajibkan konten yang ditujukan untuk anak ditandai. Pipeline saat ini mengirim `madeForKids: false` di setiap post (`scripts/publish.mts`), jadi tanda ini harus per akun (lihat Desain §1). Akibat yang sudah disampaikan ke user: komentar dan notifikasi mati di video Cerpenek, jangkauan bisa lebih kecil. User juga menyetel audiens channel di YouTube Studio. TikTok tidak punya setelan setara.
- **6 video/hari ≈ 180 cerita/bulan** (keputusan user). Backlog dan kit harus dirancang untuk laju itu.

## Approaches

| Opsi | Trade-off | Keputusan |
|---|---|---|
| A. Konfigurasi saja | Entri akun, brief, backlog, format, suara per akun. Agent merakit tokoh dari bentuk dasar tiap run. Tercepat, tetapi tokoh berubah-ubah dan kasar karena modelnya kecil. | Ditolak |
| **B. A + kit diorama kecil** | Semua isi A, ditambah prefab tokoh mainan kayu dan beberapa latar di `src/engine/kit.ts`. Tokoh konsisten; pekerjaan awal lebih banyak dan tiap prefab dicek lewat still. | **Dipilih user** — tampilan yang dipilih bergantung pada tokoh yang enak dilihat. |
| C. Mesin terpisah khusus dongeng | Komposisi dan overlay sendiri. Dua mesin berarti dua kali perawatan; mesin yang ada cukup bila callout dan chip tidak dipakai. | Ditolak |

Gaya visual dipilih user dari tiga mockup (diorama mainan kayu / explainer / buku cerita 2D): **diorama mainan kayu**.

## Keputusan user (dari percakapan)

- Nama akun: Cerpenek. Penonton 5–10 tahun bersama orang tua.
- Niche: sejarah, legenda, asal-usul lokal Indonesia.
- Suara wanita lembut gaya mendongeng.
- Jadwal sama; secrets terpisah (menyusul).
- Tampilan: diorama mainan kayu — adegan + teks karaoke, tanpa callout dan chip angka.
- Cara bangun: opsi B.
- **Tetap 6 video per hari**, sama dengan channel lain (user memilih ini setelah diberi tahu artinya ±180 cerita/bulan dan tinjauan backlog rutin; alternatif 2/hari ditolak).

## Desain

### 1. Akun (`src/accounts.ts`)

- `AccountId` dan `ACCOUNT_IDS` ditambah `"cerpenek"`.
- Entri baru:
  - `label: "Cerpenek"`, `brand: { prefix: "Cerpe", accent: "nek" }` *(pilihan saya)*.
  - `buffer`: tiga nilai `TODO_…` sampai user memberi ID; `--require-configured` yang ada sudah menolak run.
  - `youtubeCategoryId: "27"` (Education) *(pilihan saya; alternatif 24 Entertainment)*.
  - Field baru di `Account`: `madeForKids: boolean` — `false` untuk `kali-aja` dan `ai-labs` (perilaku sekarang), `true` untuk `cerpenek` *(pilihan saya, sudah diajukan ke user beserta akibatnya; user tidak mengubahnya)*. `scripts/publish.mts` memakai nilai ini menggantikan konstanta; `notifySubscribers` tidak diubah. Tes publish memastikan dua akun lama tetap mengirim `false`. `docs/PUBLISHING.md` diperbarui.
  - `agent.files`: `AGENTS.md`, `ops/ci-prompt.md`, `ops/accounts/cerpenek.md`, `ops/topics/cerpenek.md`; prompt meniru AI Labs (AUTOPILOT tidak berlaku).

### 2. Suara per akun

- `Account` mendapat field baru `tts: { voice: string; style: string }`.
  - `kali-aja` dan `ai-labs`: `id-id-podcaster-1` + `"natural, warm, conversational"` (nilai sekarang, tidak berubah).
  - `cerpenek`: suara wanita (lihat di bawah) + gaya mendongeng lembut dan pelan untuk anak.
- `scripts/lib-tts.mts`: `synthesizeGemini` menerima voice dan style, bukan konstanta. Model tetap `gemini-3.8-flash-tts`; tetap tanpa fallback provider.
- `scripts/tts.mts`: akun dibaca dari `--account`, lalu env `ACCOUNT` (sudah di-export langkah *Resolve account* di CI), lalu default `kali-aja`. Id tidak dikenal gagal keras. Dengan begitu CI memakai suara yang benar tanpa bergantung pada agent.
- **Pemilihan suara:** builder mencari suara wanita id-ID yang tersedia untuk model itu (dokumentasi/API Gemini — jangan menebak nama), membuat 2–3 contoh dari satu paragraf dongeng yang sama, dan **user memilih dengan telinga**. Sampai dipilih, `tts.voice` Cerpenek berisi `TODO_…` dan ikut dihitung `missingConfigFields`, sehingga akun belum bisa tayang.

### 3. Kit diorama (`src/engine/kit.ts`)

Prefab baru, gaya mainan kayu (bentuk membulat, warna hangat, mata dua titik, tanpa detail wajah lain):

- `figure(x, z, ry, opts)` — tokoh manusia. `opts`: `age: "anak" | "dewasa" | "lansia"` (skala dan rambut/uban), warna baju, warna kain/bawahan, penutup kepala opsional (mis. caping, mahkota, ikat kepala). Mengembalikan `Group` dengan bagian lengan/kepala bernama supaya `update(t)` bisa menggerakkannya (lambai, angguk).
- Latar: `island` (alas diorama pasir/rumput), `palm`, `boat`, `mountain`, `hut` (rumah panggung sederhana). `house` dan `tree` yang ada tetap dipakai.
- Hewan: karena laju 180 cerita/bulan, kit harus mencakup hewan sejak awal — satu prefab hewan berkaki empat yang generik (ukuran, warna, telinga/tanduk/ekor sebagai opsi; cukup untuk kerbau, rusa, kancil, harimau, anjing), satu burung, satu ikan/buaya (badan panjang). Prefab generik berparameter, bukan satu prefab per hewan.
- Daftar final prefab diturunkan dari backlog pertama: tiap topik di backlog harus bisa digambar dengan prefab yang ada. Topik yang tidak bisa digambar tidak masuk backlog.
- `worker` dan prefab lama tidak diubah.
- Verifikasi: still tiap prefab (dan satu adegan gabungan) dilihat sebelum dipakai; user melihat adegan gabungan itu.

### 4. Brief channel (`ops/accounts/cerpenek.md`)

Struktur meniru `ops/accounts/ai-labs.md`. Isi khusus:

- **Persona:** narator adalah "Nenek" yang mendongeng. Kalimat pendek, kata sehari-hari yang dipahami anak SD, hangat. Pembuka bervariasi (tidak selalu "Pada zaman dahulu").
- **Batas isi (5–10 tahun):** tanpa darah, horor, atau detail kekerasan; kutukan boleh muncul tetapi tidak digambarkan seram; tanpa tema dewasa (cerita yang intinya tema dewasa tidak masuk backlog); tanpa merendahkan suku, agama, atau daerah. Setiap video berakhir dengan satu pesan moral yang jelas.
- **Kejujuran:** legenda disebut "legenda/cerita rakyat dari [daerah]" di naskah dan deskripsi. Klaim sejarah (nama, tahun, tempat) wajib ada di sumber yang di-WebFetch; kalau tidak ada, jangan disebut.
- **Naskah:** 13–16 baris `NN  teks`; durasi 60–90 detik. Tempo suara lebih pelan, jadi target karakter lebih rendah dari AI Labs — angka pastinya ditetapkan builder setelah mengukur contoh suara terpilih.
- **Scene:** hanya prefab kit diorama + `kit.lights()`; maksimal ±3 tokoh per shot; **tanpa callout dan chip**; header dipakai sebagai judul cerita; peta skematis (bila ada) diberi `tag: "ILUSTRASI"`. Aturan caption dan SAFE area tetap.
- **CTA:** ajakan lembut menonton cerita berikutnya bersama ayah/ibu; tidak meminta komentar (komentar mati di konten anak).
- **publish.json:** `account: "cerpenek"`; deskripsi memuat asal daerah, `Sumber: <URL>`, `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, `#shorts` + hashtag.

### 5. Topik dan format

- `ops/topics/cerpenek.md`: **±180 topik awal** (±1 bulan pada 6/hari), tersebar antar daerah, format baris `- <slug>: <judul> — <URL sumber> (<daerah>)`. Sumber diutamakan dari lembaga resmi (mis. Badan Bahasa / Kemendikbud, situs pemerintah daerah, museum). Satu cerita panjang boleh dipecah menjadi beberapa topik hanya bila tiap bagian utuh sebagai cerita sendiri. Builder menyusun, **user meninjau sebelum akun diaktifkan**. Aturan pakai sama dengan AI Labs (cek katalog tayang, verifikasi WebFetch, berhenti bila sisa < 3).
- **Isi ulang:** manual, sekitar sebulan sekali, lewat PR yang ditinjau user (konten anak tidak diisi otomatis). Saat backlog habis akun berhenti dan melapor ke Slack seperti AI Labs; itu perilaku yang diterima, bukan kegagalan *(pilihan saya)*.
- `scripts/pick-format.mts`: pool `CERPENEK` berisi 5–6 kerangka cerita, mis. dongeng klasik (tokoh → masalah → akibat → pesan), asal-usul tempat (tempat nyata hari ini → legendanya → pesan), kisah tokoh sejarah (satu momen keberanian), tebak dulu (Nenek bertanya → cerita menjawab). Susunan dan bobot final keputusan builder.

### 6. CI, jadwal, secrets

- `video.yml`: hanya teks deskripsi input `account`/komentar; mekanisme environment per akun sudah ada.
- Cron: `ACCOUNTS = "kali-aja,ai-labs,cerpenek"` di `ops/cloudflare-cron/wrangler.toml` + redeploy worker. **Langkah terakhir**, setelah semua syarat di bawah terpenuhi.
- Secrets di environment `cerpenek` (dari user): `BUFFER_ACCESS_TOKEN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`. Slack boleh jatuh ke repo secret (laporan berlabel akun).
- Beban: 3 akun × 6 slot = 18 run/hari di runner GitHub-hosted; concurrency group sudah per akun.

### 7. Tes dan dokumen

- Tes (node:test, offline): akun baru di `accounts.test`, pool format di `pick-format.test`, format backlog di `topics.test`, suara per akun di `lib-tts.test` / `tts.test` (termasuk: dua akun lama tetap mengirim voice + style yang sekarang; `ACCOUNT` tidak dikenal gagal), placeholder `tts.voice` dihitung belum terkonfigurasi.
- Dokumen yang menyebut daftar akun atau suara terkunci diperbarui: `AGENTS.md`, `README.md`, `ops/README.md`, `ops/ci-prompt.md`, `docs/PUBLISHING.md`, komentar `worker.js`.
- Verifikasi: `npm run lint` + `npm test`.

### 8. Urutan peluncuran

1. Kode, brief, backlog, kit, tes — dengan placeholder ID Buffer dan suara. Dua channel lama tidak terpengaruh.
2. Contoh suara → user memilih → `tts.voice` diisi.
3. Still prefab → user melihat. Lalu satu video percobaan lokal end-to-end yang **ditulis model CI yang sama** (opencode lokal + file brief Cerpenek), bukan ditulis tangan — ini yang menguji mutu cerita dan kepatuhan larangan callout *(pilihan saya)*. Bila opencode lokal tidak bisa dipakai, percobaan ini pindah ke dry run di langkah 5.
4. User: buat environment `cerpenek` + secrets, beri ID Buffer (org, YouTube, TikTok), set audiens channel di YouTube Studio, tinjau backlog.
5. `workflow_dispatch -f account=cerpenek -f dry_run=true`.
6. Tambah ke `ACCOUNTS` cron dan redeploy.

## Diserahkan ke builder

- Nama dan parameter persis prefab; palet warna mainan kayu.
- Teks final brief dan pool format; target jumlah karakter naskah.
- Isi backlog (ditinjau user).
- Apakah larangan callout/chip cukup di brief atau perlu gate kecil di `account-gate` (disarankan gate bila video percobaan menunjukkan agent melanggarnya).

## Risiko terbuka

- Belum diketahui apakah model TTS punya suara wanita id-ID yang cukup lembut; bila tidak ada yang layak, kembali ke user sebelum melanjutkan.
- Model CI kecil mungkin menulis cerita yang datar; video percobaan (langkah 3) adalah titik ceknya.
- 18 run/hari menambah pemakaian menit runner dan kuota Gemini (kunci terpisah mengurangi yang kedua).
