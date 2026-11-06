# explainer-3d

Template video **explainer 3D vertikal** (YouTube Shorts / Reels / TikTok, 1080×1920) dengan **Remotion + React Three Fiber**:
animasi 3D low-poly, voiceover **ElevenLabs** dengan timing per kata, caption karaoke, callout berlabel, chip angka, dan musik latar orisinal.

Berbasis [`remotion-dev/template-three`](https://github.com/remotion-dev/template-three). Contoh bawaan: **"Kota lebih rendah dari sungai, kok bisa nggak tenggelam?"** (`src/videos/rumah-pompa`).

## Mulai cepat

```bash
npm install
npm run dev          # Remotion Studio: preview + scrub timeline
npm run render -- rumah-pompa out/rumah-pompa.mp4
```

Butuh Node ≥ 20.19. `predev`/`prerender` otomatis membuat `public/<id>/music.wav` kalau belum ada.

## Alur membuat video

```
naskah.txt ──► npm run tts      (ElevenLabs with-timestamps: suara + timing sekaligus)
          └──► npm run align    (sudah punya mp3 dari web ElevenLabs? Forced Alignment)
                     │
                     ▼
              alignment.json ──► npm run timeline ──► timeline.json ──► npm run dev / render
```

1. Tulis naskah di `src/videos/<id>/naskah.txt`, satu baris per kalimat, format `NN  teks` (baris lain diabaikan).
2. Isi `.env` (salin dari `.env.example`): `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
3. Pilih salah satu:
   ```bash
   npm run tts   -- <id>                 # generate suara + timing
   npm run align -- <id> path/ke/vo.mp3  # audio sudah ada -> timing per kata
   ```
4. `npm run timeline -- <id>` → caption, timing baris, dan rentang shot.
5. `npm run music -- <id>` (opsional, kalau durasi berubah) → musik baru sesuai titik potong shot.
6. `npm run dev` untuk cek, lalu `npm run render -- <id> out/<id>.mp4`.

## Struktur

```
src/
  engine/                 # generik, dipakai semua video
    Explainer.tsx         # komposisi: ThreeCanvas + overlay + audio
    overlays/Overlays.tsx # header, callout, chip, caption karaoke, CTA, flash antar-shot
    kit.ts                # balok bangunan low-poly: box, level air, rumah, pohon, pekerja, partikel
    math.ts               # ramp/smooth, PRNG deterministik, kamera keyframe/orbit, proyeksi 3D→2D
    types.ts              # VideoDef, ShotDef, Timeline
  videos/
    registry.ts           # daftar video (id → VideoDef)
    rumah-pompa/
      naskah.txt          # naskah voiceover
      config.json         # urutan shot + baris pertama tiap shot
      alignment.json      # timing kata (hasil tts/align)
      timeline.json       # hasil build-timeline (di-commit)
      state.ts            # cerita sebagai fungsi waktu: level air, pintu, pompa…
      world.ts            # dunia 3D (dibuat sekali, diupdate tiap frame)
      shots.ts            # judul, kamera, callout, chip per shot
scripts/                  # tts.ts, align.ts, build-timeline.ts, music.ts
public/fonts              # Inter + DejaVu Sans Mono (OFL / Bitstream Vera), dibundel supaya render identik offline
```

## Video baru

1. Salin `src/videos/rumah-pompa` → `src/videos/<id-baru>`, lalu ganti `naskah.txt` dan `config.json` (`shots: [["A", 1], ["B", 4], …]`).
2. Ubah `state.ts`, `world.ts`, dan `shots.ts`. Ikat semua waktu ke baris naskah lewat `L(n).s` / `L(n).e`, bukan detik mentah. Dengan begitu, kalau VO di-generate ulang, animasi otomatis ikut.
3. Daftarkan di `src/videos/registry.ts`.
4. Jalankan alur di atas.

### Aturan supaya render benar

- **Deterministik:** semua yang terlihat harus fungsi murni dari `t` (detik). Jangan pakai `Math.random()`, `Date.now()`, atau state antar-frame. Pakai `rng(seed)` dari `engine/math.ts`. Remotion merender frame **paralel dan tidak berurutan**.
- Partikel yang kecepatannya berubah: integralkan lajunya dari 0 sampai `t` (lihat `flowPhase` di `world.ts`), jangan `t * speed`.
- Teks di layar: area aman Shorts sudah diatur (`SAFE` di `Overlays.tsx`). Caption di y≈1270, tidak tertutup UI YouTube.

## Render

- Laptop/desktop dengan GPU: default `--gl=angle` (lihat `remotion.config.ts`).
- Server/CI tanpa GPU: `npm run render -- <id> out/<id>.mp4 --gl=swangle` (WebGL software, jauh lebih lambat: ±0,8 detik/frame/core).
- Loudness standar YouTube (−14 LUFS), opsional:
  ```bash
  ffmpeg -i out/<id>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/<id>-final.mp4
  ```

## Catatan

- **YouTube:** suara AI → centang *Altered or synthetic content* saat upload.
- **Lisensi:** kode template MIT (lihat `LICENSE.md`). **Remotion** gratis untuk individu, tapi perusahaan tertentu wajib lisensi berbayar: [remotion.dev/license](https://www.remotion.dev/license). Font: OFL (Inter) dan Bitstream Vera (DejaVu), lisensi ada di `public/fonts`. Musik di-synthesize dari nol oleh `scripts/music.ts`, jadi bebas royalti.
- Fakta di contoh rumah pompa bersumber dari Suara Surabaya (6 Nov 2026), CNN Indonesia, dan Antara Jatim. Diorama peta bersifat ilustrasi.
