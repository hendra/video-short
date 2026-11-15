# Cerpenek Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah akun ketiga `cerpenek` (dongeng anak 5–10 tahun: sejarah, legenda, asal-usul lokal Indonesia) ke pipeline, dengan suara wanita per akun, tanda "made for kids" per akun, dan kit diorama mainan kayu.

**Architecture:** Satu jalur kode, config per akun di `src/accounts.ts` (pola AI Labs). Dua field baru di `Account` (`tts`, `madeForKids`) menggantikan konstanta global di TTS dan publish. Prefab tokoh/latar/hewan ditambah sebagai method di class `Kit`, sehingga agent CI menyusun adegan, bukan merakit tokoh.

**Tech Stack:** TypeScript, Remotion + React Three Fiber (three.js), `tsx`, `node:test`, GitHub Actions, Cloudflare Worker cron, Gemini TTS, Buffer GraphQL.

**Spec:** `docs/superpowers/specs/2026-11-15-cerpenek-channel-design.md`

## Global Constraints

- Verifikasi setiap task: `npm run lint` dan `npm test` harus lulus.
- Kali Aja dan AI Labs tidak boleh berubah perilaku: voice `id-id-podcaster-1`, style `"natural, warm, conversational"`, `madeForKids: false`, `notifySubscribers: true`, pool format, brand.
- Model TTS tetap `gemini-3.8-flash-tts`, `languageCode: "id-ID"`, tanpa fallback provider.
- Brand Cerpenek persis: `brand: { prefix: "Cerpe", accent: "nek" }`. Label `"Cerpenek"`. Id akun `"cerpenek"`. `youtubeCategoryId: "27"`. `madeForKids: true`.
- Render: tanpa environment map, bump map, VSM, post-processing. Prefab memakai `this.mat` / `this.box/cyl/ball`; benda bulat ≥ 16 segmen; `flatShading` hanya untuk batu/daun.
- Semua yang terlihat fungsi murni dari `t`; tanpa `Math.random()` / `Date.now()`; acak hanya lewat `rng(seed)` dari `src/engine/math.ts`.
- Tidak ada hasil generate yang di-commit (`src/videos/<id>/*`, `public/*/vo.mp3`, `out/`). **Jangan commit `src/videos/registry.ts`** — isinya lokal.
- Jangan menebak nama suara Gemini; ambil dari dokumentasi/API.
- Jangan pernah mencetak atau meng-commit kunci.
- Langkah bertanda **[USER]** butuh tindakan atau persetujuan user; berhenti dan tanyakan.

## Review Focus

1. `ACCOUNT` berisi id tidak dikenal atau string kosong saat `npm run tts` → harus gagal keras, bukan diam-diam memakai suara Kali Aja. (Task 1)
2. `npm run tts -- <id>` lokal tanpa `--account` dan tanpa `ACCOUNT` → tetap suara Kali Aja seperti sekarang. (Task 1)
3. Publish untuk `kali-aja` / `ai-labs` setelah refactor → tetap mengirim `madeForKids: false` dan `notifySubscribers: true`. (Task 2)
4. Cerpenek dengan suara sudah dipilih tetapi ID Buffer masih `TODO_` (atau sebaliknya) → tetap "belum dikonfigurasi", dan field yang kurang disebut namanya. (Task 4)
5. Baris backlog yang salah bentuk (URL `http://`, tanpa daerah, slug ganda) → ditolak tes, bukan dilewati diam-diam. (Task 4)

---

### Task 1: Suara per akun

**Files:**
- Modify: `src/accounts.ts` (type `Account`, dua entri yang ada)
- Modify: `scripts/account-core.mts` (helper baru), `scripts/account-env.mts` (pakai helper)
- Modify: `scripts/lib-tts.mts` (`synthesizeGemini`, `synthesizeAndPublish`), `scripts/tts.mts`
- Test: `scripts/accounts.test.mts`, `scripts/account-core.test.mts`, `scripts/lib-tts.test.mts`, `scripts/tts.test.mts`

**Interfaces:**
- Produces:
  - `Account["tts"]: { voice: string; style: string }`
  - `resolveAccountArg(flag: string | undefined, envValue: string | undefined): Account` di `scripts/account-core.mts` — `flag` menang atas `envValue`; keduanya `undefined` → akun default; string kosong atau id tidak dikenal → `throw` dengan pesan `Unknown account "<v>". Valid accounts: …`.
  - `synthesizeGemini(text: string, tts: Account["tts"]): Promise<SynthResult>`
  - `synthesizeAndPublish({ videoId, lines, provider, tts, synthByProvider? })` — `tts: Account["tts"]` wajib; diteruskan ke `synthesizeGemini`.

- [ ] **Step 1: Tes gagal** — tambahkan:

```ts
// accounts.test.mts
test("existing accounts keep the locked male voice", () => {
  for (const id of ["kali-aja", "ai-labs"] as const)
    assert.deepEqual(ACCOUNTS[id].tts, { voice: "id-id-podcaster-1", style: "natural, warm, conversational" });
});

// account-core.test.mts
describe("resolveAccountArg", () => {
  test("no flag and no env → default account", () => assert.equal(resolveAccountArg(undefined, undefined).id, "kali-aja"));
  test("env picks the account", () => assert.equal(resolveAccountArg(undefined, "ai-labs").id, "ai-labs"));
  test("flag wins over env", () => assert.equal(resolveAccountArg("kali-aja", "ai-labs").id, "kali-aja"));
  test("unknown id throws", () => assert.throws(() => resolveAccountArg(undefined, "nope"), /Unknown account "nope"/));
  test("empty string throws instead of defaulting", () => assert.throws(() => resolveAccountArg(undefined, ""), /Unknown account ""/));
});

// lib-tts.test.mts — ubah happy path agar memanggil dengan voice eksplisit, dan tambah:
test("sends the voice and style it is given", async () => {
  // mock fetch seperti happy path
  await synthesizeGemini("halo", { voice: "voice-x", style: "style-y" });
  assert.equal(body.generationConfig.speechConfig.voiceConfig.voice, "voice-x");
  assert.equal(body.contents[0].parts[0].speechMetadata.style, "style-y");
});

// tts.test.mts — CLI validation
test("unknown ACCOUNT exits 1 before any provider work", () => { /* spawn dengan env ACCOUNT=nope → status 1, stderr /Unknown account "nope"/ */ });
test("placeholder voice exits 1", () => { /* lihat Step 3; diaktifkan di Task 4 saat akun cerpenek ada */ });
```

- [ ] **Step 2:** `npm test` → gagal (field/func belum ada).
- [ ] **Step 3: Implementasi.**
  - `Account.tts` diisi nilai sekarang untuk dua akun; hapus `GEMINI_TTS_VOICE` / `GEMINI_TTS_STYLE` dari `lib-tts.mts`.
  - `tts.mts`: baca `--account` / `--account=`, lalu `process.env.ACCOUNT`, lewat `resolveAccountArg`; error → `console.error` + `exit(1)`. Bila `account.tts.voice.startsWith("TODO_")` → `exit(1)` dengan pesan `suara akun <id> belum dipilih`. Perbarui komentar header berkas.
  - `account-env.mts`: ganti logika inline `arg("account") ?? process.env.ACCOUNT` dengan `resolveAccountArg`; keluaran dan exit code tidak berubah.
  - Perbarui pemanggil `synthesizeAndPublish` di tes yang ada dengan `tts: ACCOUNTS["kali-aja"].tts`.
- [ ] **Step 4:** `npm run lint && npm test` → lulus.
- [ ] **Step 5:** Commit `feat(tts): voice and style per account`.

---

### Task 2: Tanda "made for kids" per akun

**Files:**
- Modify: `src/accounts.ts`, `scripts/publish-lib.mts`, `scripts/publish.mts:133-138`
- Modify: `docs/PUBLISHING.md`
- Test: `scripts/accounts.test.mts`, `scripts/publish.test.mts`

**Interfaces:**
- Produces:
  - `Account["madeForKids"]: boolean`
  - `youtubeMetadata(account: Account, title: string)` di `publish-lib.mts`, mengembalikan `{ title: string; categoryId: string; privacy: "public"; madeForKids: boolean; isAiGenerated: true; notifySubscribers: true }` — `title` sudah melalui `youtubeSafe`.

- [ ] **Step 1: Tes gagal**

```ts
// publish.test.mts
describe("youtubeMetadata", () => {
  test("existing accounts are unchanged", () => {
    for (const id of ["kali-aja", "ai-labs"] as const) {
      const m = youtubeMetadata(ACCOUNTS[id], "Judul <a>");
      assert.equal(m.madeForKids, false);
      assert.equal(m.notifySubscribers, true);
      assert.equal(m.isAiGenerated, true);
      assert.equal(m.privacy, "public");
      assert.equal(m.categoryId, ACCOUNTS[id].youtubeCategoryId);
      assert.equal(m.title, "Judul ＜a＞");
    }
  });
  test("follows the account flag", () =>
    assert.equal(youtubeMetadata({ ...ACCOUNTS["kali-aja"], madeForKids: true }, "x").madeForKids, true));
});
```

- [ ] **Step 2:** `npm test` → gagal.
- [ ] **Step 3:** Tambah `madeForKids: false` ke dua akun; implementasi `youtubeMetadata`; `publish.mts` memakai `metadata: { youtube: youtubeMetadata(account, PUB.title) }`.
- [ ] **Step 4:** `docs/PUBLISHING.md`: satu paragraf — tanda per akun di `src/accounts.ts`, akibat `true` (komentar & notifikasi mati), audiens channel juga disetel di YouTube Studio.
- [ ] **Step 5:** `npm run lint && npm test` → lulus. Commit `feat(publish): madeForKids per account`.

---

### Task 3: Kit diorama

**Files:**
- Modify: `src/engine/kit.ts` (method baru di class `Kit`; `house`, `tree`, `worker` tidak diubah)
- Lokal saja, tidak di-commit: `src/videos/kit-demo/` + entri di `src/videos/registry.ts`

**Interfaces:**
- Produces (semua method `Kit`, semua menambahkan ke `this.root` seperti `house`):

```ts
type FigureOpts = {
  age?: "anak" | "dewasa" | "lansia";          // default "dewasa"; skala ±0.7 / 1 / 0.92, lansia beruban
  top?: string; bottom?: string;               // warna baju / kain
  skin?: string; hair?: string;
  headwear?: "none" | "caping" | "mahkota" | "ikat" | "kerudung";
};
figure(x: number, z: number, ry: number, o?: FigureOpts): { root: Group; head: Object3D; armL: Object3D; armR: Object3D };

island(x: number, z: number, r: number, ground?: "pasir" | "rumput"): Group;   // alas diorama bulat, tepi membulat
palm(x: number, z: number, s: number): Group;
boat(x: number, z: number, s: number, ry: number, sail?: boolean): Group;
mountain(x: number, z: number, s: number, volcano?: boolean): Group;
hut(x: number, z: number, s: number, ry: number): Group;                       // rumah panggung beratap rumbia

type AnimalOpts = { s?: number; color?: string; ears?: "bulat" | "runcing" | "panjang"; horns?: boolean; tail?: "pendek" | "panjang"; stripes?: boolean };
animal(x: number, z: number, ry: number, o?: AnimalOpts): { root: Group; head: Object3D };       // berkaki empat generik
bird(x: number, y: number, z: number, ry: number, o?: { s?: number; color?: string }): { root: Group; wingL: Object3D; wingR: Object3D };
swimmer(x: number, z: number, ry: number, o?: { s?: number; color?: string; kind?: "ikan" | "buaya" }): { root: Group; tail: Object3D };
```

- Gaya: mainan kayu — bentuk membulat (capsule/sphere/cylinder), warna hangat dari `this.mat(color, "matte")`, wajah hanya dua titik mata. Lengan dan kepala dipivot di sendi supaya `rotation` menggerakkannya secara wajar. `armL`/`armR`/`head`/`wing*`/`tail` adalah objek yang aman diputar di `update(t)`.
- Variasi kecil (mis. posisi daun) memakai `rng(seed)` dari posisi, seperti `tree`.

- [ ] **Step 1:** Implementasi sembilan method di atas.
- [ ] **Step 2:** `npm run lint` → lulus.
- [ ] **Step 3:** Buat video demo lokal `kit-demo` (naskah 3 baris boleh, tanpa VO asli — pakai `timeline.json` tulis tangan) dengan tiga shot: (a) tiga `figure` beda `age` + semua `headwear`; (b) `island` + `palm` + `boat` + `mountain` + `hut`; (c) `animal` empat varian (kerbau bertanduk, harimau belang, kancil, anjing) + `bird` + `swimmer` dua `kind`. Gerakkan lengan/sayap/ekor dengan `sway()`.
- [ ] **Step 4:** `npx remotion bundle --out-dir <scratch>/rbundle`, lalu `npx remotion still <bundle> kit-demo <scratch>/kit-<shot>.jpg --frame=<f>` untuk tiap shot; lihat gambarnya. Perbaiki sampai tiap prefab terbaca jelas pada 1080×1920 dan tidak ada bagian yang menembus/mengambang.
- [ ] **Step 5: [USER]** Tunjukkan tiga still. Lanjut hanya setelah user menyetujui tampilan tokoh.
- [ ] **Step 6:** Hapus `src/videos/kit-demo/` dan entri registry-nya. Commit hanya `src/engine/kit.ts`: `feat(kit): wooden-toy diorama prefabs`.

---

### Task 4: Akun, brief, format, kerangka backlog

**Files:**
- Modify: `src/accounts.ts`, `scripts/pick-format.mts`
- Create: `ops/accounts/cerpenek.md`, `ops/topics/cerpenek.md`
- Modify: `ops/ci-prompt.md:11`, `.github/workflows/video.yml:18,36` (teks saja)
- Test: `scripts/accounts.test.mts`, `scripts/pick-format.test.mts`, `scripts/topics.test.mts`, `scripts/tts.test.mts`

**Interfaces:**
- Consumes: `Account.tts`, `Account.madeForKids` (Task 1–2); nama method `Kit` (Task 3).
- Produces: `AccountId` mencakup `"cerpenek"`; `missingConfigFields` juga mengembalikan `"tts.voice"` bila `tts.voice` diawali `TODO_`; pool `CERPENEK` di `FORMATS_BY_ACCOUNT`.

- [ ] **Step 1: Tes gagal**

```ts
// accounts.test.mts — ganti "exactly the two known accounts" menjadi tiga, lalu:
test("Cerpenek has its own identity", () => {
  const a = ACCOUNTS.cerpenek;
  assert.equal(a.label, "Cerpenek");
  assert.deepEqual(a.brand, { prefix: "Cerpe", accent: "nek" });
  assert.equal(a.youtubeCategoryId, "27");
  assert.equal(a.madeForKids, true);
  assert.deepEqual(a.agent.files, ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/cerpenek.md", "ops/topics/cerpenek.md"]);
});
test("a placeholder voice counts as unconfigured and is named", () => {
  const a = { ...ACCOUNTS["kali-aja"], tts: { voice: "TODO_VOICE", style: "x" } };
  assert.deepEqual(missingConfigFields(a), ["tts.voice"]);
  assert.equal(isConfigured(a), false);
});
test("voice chosen but buffer ids missing is still unconfigured", () => {
  const a = { ...ACCOUNTS["kali-aja"], buffer: { orgId: "TODO_A", youtubeChannelId: "TODO_B", tiktokChannelId: "TODO_C" } };
  assert.deepEqual(missingConfigFields(a), ["buffer.orgId", "buffer.youtubeChannelId", "buffer.tiktokChannelId"]);
});
```

  - Tes yang ada "each account is either fully configured or fully placeholder": persempit ke tiga field `buffer` saja (suara boleh terisi lebih dulu).
  - `pick-format.test.mts`: pool Cerpenek punya 5–6 format, id unik, bobot > 0; pool Kali Aja dan AI Labs tidak berubah (tes yang ada).
  - `topics.test.mts`: `describe("Cerpenek brief")` — berkas ada; memuat bagian `## Brand`, `## Format`, `## Topik`, `## Naskah`, `## Scene 3D`, `## Batas isi`, `## publish.json`; memuat baris brand persis `brand: { prefix: "Cerpe", accent: "nek" },`; memuat `"account": "cerpenek"`. `describe("Cerpenek topic backlog")` — berkas ada; setiap baris `- ` cocok dengan `^- [a-z0-9]+(?:-[a-z0-9]+)*: .+ — https:\/\/\S+ \([^()]+\)$`; slug unik. (Tanpa jumlah minimum di task ini.) Tambah satu tes regex dengan tiga contoh buruk: `http://`, tanpa `(daerah)`, slug berhuruf besar.
  - `tts.test.mts`: aktifkan tes "placeholder voice exits 1" dengan `ACCOUNT=cerpenek`.

- [ ] **Step 2:** `npm test` → gagal.
- [ ] **Step 3: `src/accounts.ts`** — entri `cerpenek`: nilai dari Global Constraints; `buffer` tiga `TODO_…`; `tts: { voice: "TODO_VOICE", style: "lembut, hangat, pelan; seperti nenek mendongeng untuk anak" }`; `agent.model` sama dengan akun lain; `agent.prompt` meniru AI Labs dengan nama berkas Cerpenek. `missingConfigFields` ditambah cek `tts.voice`.
- [ ] **Step 4: `scripts/pick-format.mts`** — pool `CERPENEK`, instruksi dalam bahasa Inggris seperti pool lain:
  - `dongeng-klasik` (3): tokoh dan tempat → keinginan/masalah → pilihan yang diambil → akibat → pesan.
  - `asal-usul-tempat` (3): tempat nyata hari ini → "kata orang dulu…" → legendanya → kembali ke tempat itu → pesan.
  - `tokoh-sejarah` (2): satu momen keberanian/kebaikan tokoh nyata; hanya fakta dari sumber.
  - `tebak-dulu` (2): Nenek bertanya satu teka-teki → cerita menjawabnya → pesan.
  - `asal-usul-benda` (1): makanan/permainan/kain/alat musik daerah → dari mana asalnya → cara dipakai sekarang.
- [ ] **Step 5: `ops/accounts/cerpenek.md`** — struktur `ops/accounts/ai-labs.md`, isi dari spec §4. Wajib memuat:
  - Persona Nenek; kalimat pendek; kosakata anak SD; larangan pembuka seragam.
  - `## Batas isi`: tanpa darah/horor/detail kekerasan; kutukan tidak digambarkan seram; tanpa tema dewasa; tanpa merendahkan suku/agama/daerah; satu pesan moral di akhir; legenda disebut "legenda dari [daerah]"; klaim sejarah harus ada di sumber yang di-WebFetch.
  - `## Scene 3D`: daftar method Task 3 dengan satu contoh pemanggilan masing-masing; "jangan merakit tokoh dari bentuk dasar"; maksimal 3 tokoh per shot; **tanpa `callouts` dan tanpa chip**; header = judul cerita; peta skematis diberi `tag: "ILUSTRASI"`.
  - `## Naskah`: 13–16 baris `NN  teks`, 60–90 detik; target karakter ditulis `TODO setelah suara dipilih` (diisi di Task 6).
  - CTA: ajak menonton cerita berikutnya bersama ayah/ibu; jangan meminta komentar.
  - `## publish.json`: `account: "cerpenek"`; deskripsi memuat `Legenda dari <daerah>` atau `Kisah sejarah dari <daerah>`, `Sumber: <URL>`, `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, `#shorts`.
  - Format: `npx tsx scripts/pick-format.mts --account cerpenek`.
- [ ] **Step 6: `ops/topics/cerpenek.md`** — judul, aturan pakai (sama dengan AI Labs: cek katalog, WebFetch, berhenti bila sisa < 3), format baris `- <slug>: <judul> — <URL sumber> (<daerah>)`, dan 5 entri contoh nyata dengan sumber yang sudah di-WebFetch dan terbukti terjangkau.
- [ ] **Step 7:** Perbarui teks `ops/ci-prompt.md:11` dan deskripsi input/komentar di `video.yml` agar menyebut tiga akun.
- [ ] **Step 8:** `npm run lint && npm test` → lulus. `npx tsx scripts/account-env.mts --account cerpenek --require-configured` → exit 1 menyebut `buffer.orgId, buffer.youtubeChannelId, buffer.tiktokChannelId, tts.voice`.
- [ ] **Step 9:** Commit `feat(accounts): Cerpenek account, brief and format pool (unconfigured)`.

---

### Task 5: Backlog ±180 cerita

**Files:**
- Modify: `ops/topics/cerpenek.md`
- Test: `scripts/topics.test.mts`

- [ ] **Step 1:** Tambah tes `has at least 180 entries` dan `covers at least 20 distinct daerah`. `npm test` → gagal.
- [ ] **Step 2:** Susun entri. Aturan tiap entri:
  - Sumber `https://` dari lembaga (Badan Bahasa/Kemendikbud, pemerintah daerah, museum, perpustakaan); di-WebFetch dan terbukti memuat ceritanya. Sumber tak terjangkau → entri tidak masuk.
  - Lolos `## Batas isi` brief; cerita yang intinya tema dewasa atau kekerasan tidak masuk.
  - Bisa digambar dengan prefab Task 3. Bila banyak cerita bagus terhalang satu bentuk yang sama, catat bentuk itu untuk user alih-alih menambah prefab sendiri.
  - Campuran legenda, asal-usul, dan sejarah; tidak menumpuk di satu pulau.
- [ ] **Step 3:** `npm test` → lulus.
- [ ] **Step 4: [USER]** User meninjau backlog (boleh mencoret). Terapkan coretan; bila jumlah jatuh di bawah 180, isi lagi.
- [ ] **Step 5:** Commit `feat(topics): Cerpenek backlog`.

---

### Task 6: Memilih suara

**Files:**
- Modify: `src/accounts.ts` (`cerpenek.tts.voice`, bila perlu `style`), `ops/accounts/cerpenek.md` (target karakter)
- Lokal saja: `out/voice-samples/`

**Interfaces:**
- Consumes: `synthesizeGemini(text, tts)`, `stageToMp3` (Task 1).

- [ ] **Step 1:** Ambil daftar suara yang didukung `gemini-3.8-flash-tts` untuk `id-ID` dari dokumentasi resmi Gemini speech generation (WebFetch) atau API. Pilih 2–3 suara wanita. Bila tidak ada suara wanita id-ID → **berhenti dan lapor ke user** (risiko terbuka di spec).
- [ ] **Step 2:** Dengan `GEMINI_API_KEY` dari `.env`, sintesis satu paragraf dongeng yang sama (±400 karakter, gaya brief) untuk tiap kandidat ke `out/voice-samples/<voice>.mp3` lewat skrip `tsx` sekali pakai di scratchpad yang memanggil `synthesizeGemini` + `stageToMp3`.
- [ ] **Step 3: [USER]** User mendengar dan memilih satu (atau meminta gaya diubah → ulangi Step 2 dengan `style` lain).
- [ ] **Step 4:** Isi `tts.voice`. Ukur durasi contoh terpilih (`ffprobe`) → karakter/detik → tulis target karakter naskah untuk 60–90 detik di `## Naskah` brief, menggantikan `TODO`.
- [ ] **Step 5:** Perbarui tes "placeholder voice exits 1" agar memakai akun sintetis (bukan `cerpenek`). `npm run lint && npm test` → lulus. Commit `feat(accounts): Cerpenek voice`.

---

### Task 7: Video percobaan dengan model CI

**Files:** tidak ada yang di-commit kecuali perbaikan brief / gate.

- [ ] **Step 1:** Jalankan agent secara lokal seperti langkah CI (`video.yml:145-160`): `npx tsx scripts/account-env.mts --account cerpenek` (tanpa `--require-configured`) untuk mendapat `AGENT_MODEL`, `AGENT_FILES`, `AGENT_PROMPT`; katalog kosong `[]` di `CATALOG_PATH`; lalu `opencode run --auto --standalone --model "$AGENT_MODEL" --file … "$AGENT_PROMPT"` dengan `ACCOUNT=cerpenek`. Bila opencode lokal tidak bisa dipakai, catat dan pindahkan percobaan ini ke dry run Task 8.
- [ ] **Step 2:** `npx tsx scripts/account-gate.mts --account cerpenek --slug <slug>` → lulus. Periksa `timeline.json`: durasi 60–90 detik.
- [ ] **Step 3:** Still frame tersibuk tiap shot; lihat. Periksa: memakai prefab (bukan tokoh rakitan), tanpa callout/chip, caption di area aman, tidak ada yang menyeramkan.
- [ ] **Step 4:** Render penuh lokal (`npm run render -- <slug> out/<slug>.mp4`).
- [ ] **Step 5: [USER]** User menonton. Catat keluhan.
- [ ] **Step 6:** Perbaiki brief sesuai temuan dan ulangi bila perlu. Bila agent memakai `callouts` walau dilarang: tambah cek di `scripts/account-gate.mts` — untuk akun `cerpenek`, sumber `src/videos/<slug>/shots.ts` yang memuat `callouts` ditolak — dengan tes di `scripts/account-core.test.mts`. Commit perbaikan.
- [ ] **Step 7:** Hapus `src/videos/<slug>/`, `public/<slug>/`, entri registry lokal.

---

### Task 8: Peluncuran

**Files:**
- Modify: `src/accounts.ts` (ID Buffer), `ops/cloudflare-cron/wrangler.toml`, `ops/cloudflare-cron/worker.js` (komentar)
- Modify: `AGENTS.md`, `README.md`, `ops/README.md`, `docs/PUBLISHING.md`

- [ ] **Step 1: [USER]** User: buat GitHub Environment `cerpenek` berisi `BUFFER_ACCESS_TOKEN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`; beri tiga ID Buffer (org, channel YouTube, channel TikTok); setel audiens channel YouTube "untuk anak" di YouTube Studio.
- [ ] **Step 2:** Isi ID Buffer di `src/accounts.ts`. `npx tsx scripts/account-env.mts --account cerpenek --require-configured` → exit 0.
- [ ] **Step 3:** Dokumen: tiga akun, suara per akun (bukan lagi "terkunci global" — perbarui AGENTS.md § Commands dan § Pipeline), `madeForKids`, environment `cerpenek`, isi ulang backlog bulanan lewat PR yang ditinjau user.
- [ ] **Step 4:** `npm run lint && npm test` → lulus. Commit, buka PR, **[USER]** merge.
- [ ] **Step 5:** `gh workflow run video-run --ref main -f account=cerpenek -f dry_run=true` → ketiga job hijau; periksa still dan video di artifact.
- [ ] **Step 6: [USER]** Minta izin untuk tayang. Setelah ya: `ACCOUNTS = "kali-aja,ai-labs,cerpenek"` di `wrangler.toml`, perbarui komentar `worker.js`, commit, lalu `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`.
- [ ] **Step 7:** Setelah slot cron pertama: cek run Cerpenek hijau, post muncul di YouTube + TikTok, dan video di YouTube bertanda "untuk anak". Laporkan ke user.
