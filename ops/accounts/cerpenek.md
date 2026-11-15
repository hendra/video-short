# Cerpenek — brief channel

Brief ini **bagian dari instruksi kamu** di CI. Baca sebelum menulis naskah.
`AGENTS.md` dan `ops/ci-prompt.md` mengatur pipeline; file ini mengatur **isi** channel. Kalau aturan di sini berbeda dari `ops/ci-prompt.md` (panjang naskah, scene, CTA, deskripsi), **file ini yang berlaku**.

Channel: **Cerpenek** (*Cerita Pendek Nenek*) — dongeng untuk anak **5–10 tahun** yang ditonton bersama orang tua.
Isi: sejarah, legenda, dan asal-usul yang **semuanya dari Indonesia**. Tujuan: hiburan yang mendidik.
Satu cerita per video.

## Brand

Di `src/videos/<slug>/index.ts` tulis **persis**:

```ts
brand: { prefix: "Cerpe", accent: "nek" },
```

Jangan pakai brand channel lain. Gate CI menolak video yang brand-nya beda.

## Suara dan gaya bercerita

- Naratornya **Nenek** yang sedang mendongeng: hangat, sabar, pelan. Nenek boleh menyapa ("Cucuku…", "Nah, dengarkan ya…") tetapi tidak di setiap kalimat.
- Kalimat pendek, satu gagasan per kalimat. Kata sehari-hari yang dipahami anak SD. Hindari kata serapan sulit dan istilah teknis.
- Pembuka **bervariasi** dari video ke video. Jangan selalu "Pada zaman dahulu". Boleh mulai dari tempat, dari pertanyaan, atau dari suara dan suasana.
- Angka ditulis dengan kata ("tujuh hari", "seribu candi").
- Suara dibuat otomatis oleh `npm run tts -- <slug>`; jangan mengganti suara atau provider.

## Format

1. Jalankan `npx tsx scripts/pick-format.mts --account cerpenek` → dapat satu kerangka cerita (acak, berbobot).
2. **Pakai kerangka itu** sebagai alur naskah; jangan ganti dengan kerangka lain.
3. Catat di `publish.json`: `catatan` diawali `format: <id>;`.
4. **Dilarang** gaya explainer: daftar bernomor, "tiga fakta", "mitos vs fakta", tutorial langkah demi langkah.

## Topik

1. Lihat `ops/topics/cerpenek.md` (backlog kurasi; tiap baris ada URL sumber dan daerah asal).
2. **Baca katalog video yang sudah tayang** (path ada di prompt run). Pilih cerita yang belum pernah tayang. Kalau mirip → ganti cerita, jangan "sedikit ubah judul".
3. **Baca sumbernya** dengan WebFetch sebelum menulis naskah. Ceritakan sesuai sumber; jangan menambah tokoh, tempat, atau kejadian yang tidak ada di sana. Sumber tidak terjangkau → ganti cerita atau berhenti.
4. **Sisa cerita yang belum terpakai < 3 → berhenti dan lapor** (jangan mengarang cerita, jangan pakai cerita lama).
5. Jangan panggil WebSearch — tool itu tidak ada di runner ini dan akan membatalkan run.

## Batas isi

Penontonnya anak 5–10 tahun. Ini aturan keras:

- **Tidak menakutkan.** Tanpa darah, luka, horor, hantu yang seram, atau detail kekerasan. Kalau cerita aslinya punya bagian seperti itu, lewati atau sampaikan dengan satu kalimat lembut ("lalu raksasa itu pun kalah").
- **Kutukan boleh, tetapi tidak seram.** Sampaikan sebagai akibat, bukan tontonan ("dan ia pun berubah menjadi batu"). Jangan menggambarkan rasa sakit atau ketakutan.
- **Tanpa tema dewasa.** Tanpa percintaan yang jadi inti cerita, tanpa pernikahan paksa, tanpa hal yang tidak pantas untuk anak. Cerita yang intinya tema dewasa tidak boleh dipakai walau ada di backlog — ganti cerita.
- **Tidak merendahkan** suku, agama, daerah, atau orang miskin. Tokoh jahat salah karena perbuatannya, bukan karena asalnya.
- **Satu pesan moral** yang jelas di akhir, dengan kata-kata anak ("Jadi, sayangi ibumu ya.").
- **Jujur soal jenis cerita.** Legenda disebut legenda: "ini legenda dari [daerah]" atau "begitulah cerita orang [daerah]". Jangan menyampaikan legenda sebagai kejadian nyata.
- **Sejarah harus benar.** Nama, tahun, dan tempat hanya boleh disebut kalau ada di sumber yang kamu fetch. Tidak ada di sumber → jangan disebut. Perang dan kematian tokoh disampaikan singkat dan tenang.
- Tanpa nasihat medis, finansial, atau hukum. Tanpa iklan.

## Naskah

- `src/videos/<slug>/naskah.txt`: 13–16 baris, format `NN  teks` (dua digit, dua spasi).
- Durasi 60–90 detik. Target jumlah karakter: TODO setelah suara dipilih (suara Nenek lebih pelan daripada channel lain).
- Alur: pembuka yang menarik → cerita → akibat → pesan moral → ajakan.
- **Ajakan penutup (CTA):** ajak menonton cerita berikutnya bersama ayah atau ibu ("Besok Nenek cerita lagi, ya. Ajak ayah dan ibu."). **Jangan meminta komentar, like, atau subscribe** — komentar mati di video anak.
- Di `index.ts`, `cta.text` berisi ajakan yang sama.

## Scene 3D

Tampilannya **diorama mainan kayu**: adegan kecil di atas alas bulat, tokoh seperti boneka kayu. Hangat dan sederhana.

**Pakai prefab di bawah ini. Jangan merakit tokoh atau hewan sendiri dari `kit.box/cyl/ball`.** `kit.box/cyl/ball` hanya untuk benda kecil pendukung (batu, peti, meja, candi dari balok).

```ts
const kit = new Kit(root);
kit.lights();                                    // sekali saja di createWorld

// Alas dan latar
kit.island(0, 0, 3, "pasir");                    // alas diorama: "pasir" atau "rumput"; permukaan di y = 0
kit.palm(2.2, 1.0, 1.6);                         // pohon kelapa (x, z, skala)
kit.tree(-1.5, -0.8, 1.4);                       // pohon biasa
kit.mountain(1.5, -2.6, 2.4);                    // gunung; argumen ke-4 true = gunung berapi
kit.hut(1.2, 0.6, 1.5, -0.3);                    // rumah panggung (x, z, skala, putaran)
kit.boat(-2.4, 3.2, 1.4, 0.3);                   // perahu layar di permukaan air; argumen ke-5 false = tanpa layar
const laut = kit.box(-8, 8, -0.5, -0.02, -8, 8, kit.mat("#4aa3b8", "water"));  // air di sekeliling pulau

// Tokoh: age "anak" | "dewasa" | "lansia"; headwear "none" | "caping" | "mahkota" | "ikat" | "kerudung"
const ibu = kit.figure(0.3, 1.2, 0.2, { age: "lansia", top: "#b5523f", bottom: "#8f3d30", headwear: "kerudung" });
const anak = kit.figure(-0.6, 1.4, 0.1, { age: "anak", top: "#e0a23a", bottom: "#3f6a8a" });
const raja = kit.figure(1.0, 0.4, -0.2, { top: "#7a2f2f", bottom: "#3a2a4a", headwear: "mahkota" });

// Hewan
const kerbau = kit.animal(-1.2, 0.2, 1.0, { s: 1.8, color: "#5c5650", horns: true, tail: "panjang" });
const harimau = kit.animal(0.8, 1.0, 0.9, { s: 1.4, color: "#e08a2e", tail: "panjang", stripes: true });
const kancil = kit.animal(0.2, 1.3, -0.9, { s: 0.9, color: "#b98a5a", ears: "runcing" });
const burung = kit.bird(0.4, 1.6, 0.2, 0.3, { s: 1.3 });            // (x, y, z, putaran)
const ikan = kit.swimmer(-0.5, 2.6, 1.2, { s: 1.2 });               // kind "ikan" (default) atau "buaya"
const buaya = kit.swimmer(1.0, 2.8, -1.0, { kind: "buaya" });
```

Menggerakkan tokoh di `update(t)` (semua fungsi murni dari `t`, pakai `sway`, `spring`, `ramp` dari `engine/math.ts`):

```ts
ibu.armR.rotation.z = 2.3 + sway(t, 1) * 0.25;   // melambai (armL: nilai negatif)
anak.head.rotation.x = 0.25;                     // menunduk; rotation.y = menoleh
raja.root.position.x = lerp(1.0, 0.2, ramp(t, L(4).s, L(4).e));   // berjalan
burung.wingL.rotation.z = -0.5 + Math.sin(t * 9) * 0.5;
burung.wingR.rotation.z = 0.5 - Math.sin(t * 9) * 0.5;
ikan.tail.rotation.y = Math.sin(t * 5) * 0.5;
```

Aturan scene:

- Paling banyak **3 tokoh** (orang atau hewan besar) per shot, supaya anak tahu siapa yang sedang diceritakan.
- Tokoh yang sama memakai **warna dan `headwear` yang sama** di semua shot.
- **Tanpa `callouts` dan tanpa `chip`** di `shots.ts`. Layar hanya berisi adegan, judul, dan teks cerita. Cerita disampaikan lewat gerak tokoh, bukan label.
- `label` = jenis cerita dan daerah (mis. `"LEGENDA · SUMATRA BARAT"`); `title` = judul cerita.
- Warna cerah dan hangat. Latar langit terang; jangan gelap atau suram, juga di adegan sedih.
- Peta skematis (kalau perlu menunjukkan pulau) diberi `tag: "ILUSTRASI"`.
- Tidak boleh `Math.random()` atau `Date.now()`.
- Caption: satu potongan ≤ 5 token per saat, tidak pernah dua; `line-height: 1.8` jangan dikecilkan.
- Kamera pelan dan tenang (`keyframes` dengan dua atau tiga posisi); jangan berputar cepat.

## publish.json

`src/videos/<slug>/publish.json` — bentuk persis:

```json
{
  "account": "cerpenek",
  "title": "…",
  "description": "…",
  "tiktokTitle": "…",
  "tiktokCaption": "…",
  "catatan": "format: <id>; …"
}
```

- `account` wajib `"cerpenek"` (kena gate CI kalau beda).
- `title` ≤ 100 karakter, tanpa `<` dan `>`. Judul cerita + daerah, mis. "Malin Kundang, Legenda dari Sumatra Barat".
- `description`: ringkasan 2–3 kalimat untuk orang tua + `Legenda dari <daerah>.` atau `Kisah sejarah dari <daerah>.` + `Sumber: <URL sumber>` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + `#shorts` + 5–6 hashtag (mis. `#dongenganak #ceritarakyat`).
- `tiktokTitle` ≤ 90 karakter, `tiktokCaption` seperti description + `Suara: AI (Google AI Studio)`.
- `catatan` diawali `format: <id>;` dari `pick-format`.
- Tidak ada ajakan berkomentar di judul atau deskripsi.

## Refill backlog

Backlog diisi manual, kira-kira sebulan sekali, lewat PR yang ditinjau pemilik channel — konten anak tidak diisi otomatis. Kalau sisa cerita menipis dan isi ulang belum datang, channel berhenti dengan laporan ke Slack, bukan mengarang cerita.
