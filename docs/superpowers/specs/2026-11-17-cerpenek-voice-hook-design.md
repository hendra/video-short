# Cerpenek — suara kakak perempuan, hook 3 detik, naskah lebih cepat

## Intent

Video Cerpenek terasa datar: naratornya Nenek yang sengaja dibuat pelan (`style: "lembut, hangat, pelan…"`), pembuka boleh berbentuk apa saja (brief hanya bilang "bervariasi"), dan tempo ~9 karakter/detik membuat cerita merambat. Tujuannya membuat video lebih menarik di 3 detik pertama dan sepanjang 60–90 detik, tanpa mengubah pipeline render.

## Goals

- Narator = **kakak perempuan muda** yang bercerita ke adik kecil. Suara `id-id-storyteller-1`.
- Gaya bicara hidup: ceria, bersemangat, intonasi naik-turun (terukur 13.2 karakter/detik, dari 9).
- **Hook 3 detik**: baris pertama wajib pertanyaan, suara, atau aksi. Dilarang sapaan dan "Pada zaman dahulu".
- Sapaan "adik-adik", **maksimal sekali** per naskah dan **tidak di baris pertama**.
- Naskah lebih padat: budget **800–1000 karakter** = 61–76 detik pada tempo baru.

## Non-goals

- Nama channel "Cerpenek (Cerita Pendek Nenek)" **tidak** diubah — merek sudah jalan, dan gate brand tidak menyentuhnya.
- Tidak mengganti provider TTS, model, atau menambah voice library lain.
- Tidak menyentuh engine render, aligner, caption, kit diorama, atau aturan batas isi anak.

## Constraints

- `npm run tts` hanya bisa memakai voice `id-ID` dari library Gemini; tidak ada fallback provider.
- Semua aturan naskah ditegakkan lewat brief channel (`ops/accounts/cerpenek.md`), karena naskah video lama tidak tersimpan di git (CI membuangnya) — agent tidak bisa membandingkan dengan pembuka video sebelumnya, jadi larangan bentuk hook adalah satu-satunya cara menegakkan "jangan membosankan".
- Brief channel menang atas `ops/ci-prompt.md` di mana berbeda (sudah tertulis di kedua file).

## Approaches

1. **Ganti voice saja, persona tetap Nenek** — murah, tapi suara muda dengan sapaan "Cucuku" tidak nyambung. Ditolak.
2. **Voice `id-id-podcaster-2` + style baru** — paling cepat (12.3 kar/dtk) dan paling dewasa; user mendengar sampelnya dan memilih storyteller.
3. **Voice `id-id-storyteller-1` + style baru + persona kakak perempuan** — dipilih. Paling muda dan paling "hidup" dari tiga voice perempuan yang ada; persona, sapaan, CTA, dan satu kerangka cerita ikut disesuaikan.

## Decisions

- `src/accounts.ts`: `cerpenek.tts = { voice: "id-id-storyteller-1", style: "hangat, ceria, bersemangat; intonasi naik-turun seperti bercerita" }`.
- Brief §Suara: narator kakak perempuan muda; sapaan "adik-adik" maks. sekali, bukan di baris 1; "Cucuku" dan persona Nenek dilarang.
- Brief §Naskah: aturan hook (pertanyaan/suara/aksi; larangan sapaan dan "Pada zaman dahulu" di baris 1); budget 800–1000 karakter; kalimat pendek satu gagasan.
- Brief CTA: "Besok kakak cerita lagi ya. Ajak ayah dan ibu." Larangan minta komentar/like/subscribe tetap.
- `scripts/pick-format.mts`: `tebak-dulu` tidak lagi menyebut "Nenek".
- Test `scripts/accounts.test.mts` mengunci voice + style baru.
- `docs/PUBLISHING.md`, `README.md`, `AGENTS.md`: sebutan voice Cerpenek diperbarui.

## Left to the builder

- Susunan kata aturan hook di brief (satu paragraf, gaya bahasa brief yang sudah ada).
- Apakah angka budget perlu disetel setelah run produksi pertama mengukur durasi nyata (kalau di luar 60–90 detik, setel sekali).

## Risks

- 800–1000 karakter adalah ekstrapolasi dari pengukuran satu paragraf; run pertama bisa keluar 55 atau 85 detik. Murah disetel.
- Suara storyteller beraksen "Jakarta Gaul"; kalau di telinga pendengar terlalu kota untuk cerita daerah, voice bisa dikembalikan satu baris.
