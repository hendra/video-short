# AI Labs — brief channel

Brief ini **bagian dari instruksi kamu** di CI. Baca sebelum menulis naskah.
Brief lain (`AGENTS.md`, `ops/ci-prompt.md`) mengatur pipeline; file ini mengatur **isi** channel.

Channel: **AI Labs** — tips & trik AI untuk orang Indonesia: Claude, ChatGPT, Gemini, OpenCode.
Bidang: edit foto & video dengan AI, coding & debugging, agent & plugin, prompt, setting yang jarang orang tahu.
Bahasa: Indonesia santai-profesional. Satu ide per video.

## Brand

Di `src/videos/<slug>/index.ts` tulis **persis**:

```ts
brand: { prefix: "AI ", accent: "Labs" },
```

Jangan pakai brand channel lain. Gate CI menolak video yang brand-nya beda.

## Format

1. Jalankan `npx tsx scripts/pick-format.mts --account ai-labs` → dapat satu format (acak, berbobot).
2. **Pakai format itu verbatim** sebagai kerangka naskah; jangan ganti format lain.
3. Catat di `publish.json`: `catatan` diawali `format: <id>;`.
4. **Dilarang** kerangka "masalah → 3 langkah → kesalahan umum" — itu format channel lain dan bikin video ini terasa sama.
5. Variasikan sintaks hook dari run ke run: pertanyaan, klaim outrageous, before-after, demo, keluhan, angka. Hook dibayar dalam 2–3 detik pertama.
6. Bentuk kalimat varyasi: jangan opening "Halo, kali ini kita…" atau "Pernah nggak kamu…". Boleh buka dari hasil, dari scene, atau dari konsekuensi.

## Topik

1. Lihat `ops/topics/ai-labs.md` (backlog kurasi, tiap baris ada URL sumber resmi).
2. **Baca katalog video yang sudah tayang** (path ada di prompt run). Pilih topik yang judulnya belum pernah muncul di sana. Kalau mirip → ganti topik, jangan "sedikit ubah judul".
3. **Verifikasi** klaim ke URL sumbernya dengan WebFetch sebelum menulis naskah: fitur, nama model, batas, angka. Sumber tidak terjangkau → ganti topik atau berhenti.
4. **Sisa topik yang belum terpakai < 3 → berhenti dan lapor** (jangan mengarang topik, jangan pakai topik lama).
5. Jangan panggil WebSearch — tool itu tidak ada di runner ini dan akan membatalkan run.

## Naskah

- `src/videos/<slug>/naskah.txt`: 13–16 baris, format `NN  teks` (dua digit, dua spasi), total 1.100–1.400 karakter (±70–85 detik).
- Kalimat lisan: "nggak", "kayak", "gitu deh". Angka ditulis dengan kata ("empat belas gambar").
- Alur naskah: hook → isi → payoff → CTA. Tidak ada "Tapi tunggu… kok bisa…?".
- Boleh pakai istilah teknis (MCP, hook, context window) tapi jelaskan sekali dengan analogi sederhana.

## Scene 3D

- Bangun adegan dari `Kit` (`src/engine/kit.ts`): `kit.lights()` sekali di `createWorld`, `kit.box/cyl/ball`, `kit.mat(warna, "matte"|"gloss"|"metal"|"glass"|"water")`.
- Objek yang cocok untuk niche ini: panel chat, jendela terminal, file tree, gear plugin, kartu foto before-after, chip angka (jumlah file, ukuran context), konektor MCP.
- **Tidak boleh** screenshot UI asli (CI tidak bisa login ke akun mana pun) — gambar ulang bentuknya secara 3D.
- Diagram/panel skematis diberi `tag: "ILUSTRASI"`.
- Semua gerak fungsi murni dari `t` (`spring`, `drop`, `sway` dari `engine/math.ts`). Tidak boleh `Math.random()`.
- Callout maks 3 per shot, `orange` untuk fokus, `red` untuk bahaya; anchor di dalam zona antara bawah header dan y≈1240.
- Caption: satu potongan ≤ 5 token per saat, tidak pernah dua; `line-height: 1.8` jangan dikecilkan.

## publish.json

`src/videos/<slug>/publish.json` — bentuk persis:

```json
{
  "account": "ai-labs",
  "title": "…",
  "description": "…",
  "tiktokTitle": "…",
  "tiktokCaption": "…",
  "catatan": "format: <id>; …"
}
```

- `account` wajib `"ai-labs"` (kena gate CI kalau beda).
- `title` ≤ 100 karakter, tanpa `<` dan `>` (YouTube menolaknya).
- `description`: ringkasan 2–3 kalimat + `Sumber: <URL sumber resmi>` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + `#shorts` + 5–6 hashtag topik.
- `tiktokTitle` ≤ 90 karakter (hook saja), `tiktokCaption` seperti description + `Suara: AI (Google AI Studio)`.
- `catatan` diawali `format: <id>;` dari `pick-format`.

## Batas klaim

- Hanya boleh menyebut fitur/limitasi yang **ada di sumber resmi** yang kamu fetch. Kalau tidak ada di sumber → jangan sebut.
- Tidak mengarang angka benchmark, kuota, harga, atau kecepatan. Kalau angkanya tidak ada di sumber → bulatkan jadi kualitatif ("jauh lebih cepat").
- Tidak menyebut model/fitur yang belum rilis sebagai kalau sudah ada. Kalau sumbernya release-notes, sebut statusnya ("pratinjau", "umum").
- Tanpa nasihat medis, finansial, atau hukum. Tanpa klaim kesehatan/keuangan.
- Tidak menjatuhkan produk lain. Bandingkan fitur secara faktual, atau lewati perbandingan.
- credits: writing "Suara: AI (Google AI Studio)" dan `isAiGenerated` (sudah di set pipeline).

## Refill backlog

Backlog diisi manual oleh operator (on demand), bukan otomatis. Kalau sisa topik menipis dan refill belum datang, channel berhenti dengan laporan ke Slack, bukan mengarang konten. Isi ulang: operator meminta "isi backlog AI Labs", lalu assistant memverifikasi URL sumber resmi, menambah baris baru ke `ops/topics/ai-labs.md` (format sama, slug unik), lalu commit.
