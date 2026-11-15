# Design: Channel kedua "AI Labs" (YouTube + TikTok) di pipeline video-short

**Date:** 2026-11-15
**Status:** Approved 2026-11-15 (user) — semua keputusan di bawah sudah dikonfirmasi user

## Intent / why

Repo `yt-video-short-generator` adalah pipeline video 3D explainer Shorts yang saat ini punya **satu channel**: YouTube *Kali Aja Tau* + TikTok *kaliajatau01* (niche: "kok bisa?" sains/teknik Indonesia). User ingin **channel kedua: *AI Labs*** — niche tips & trik AI (Claude, ChatGPT, Gemini: edit foto & video, coding, debugging, plugin seperti superpowers), dengan **akun sendiri** (YouTube, TikTok, Cloudinary, Gemini, opencode), **jadwal tayang sama** (6 slot/hari: 07:30/09:30/11:30/12:30/16:30/19:30 WIB), dan **engine yang sama** — visual 3D diorama, caption karaoke, TTS, publish Cloudinary → Buffer.

Yang **tidak** boleh berubah: channel Kali Aja hari ini harus tetap jalan persis seperti sekarang (kredensial, ID channel, nada laporan, jadwal). Adding one channel must not risk the existing one.

## Decisions (made in conversation — user-approved)

- **Satu repo, satu jalur kode.** Config per akun, bukan repo terpisah (duplikasi seluruh pipeline tidak sepadan).
- **Visual:** pakai engine 3D yang ada. Yang berubah = isi/tema + brand + aturan topik. Tidak ada jalur render baru.
- **Aturan topik dinamis, bukan template statis.** Format naratif diacak berbobot tiap run (mekanisme `pick-format` yang sudah ada), dengan pool format khusus AI Labs. Larangan eksplisit: jangan pakai "masalah → 3 langkah → kesalahan umum".
- **Sumber topik:** backlog kurasi di repo (`ops/topics/ai-labs.md`, ~40 topik, refill manual on-demand + guard) + verifikasi fakta via `WebFetch` ke sumber resmi. **Bukan** WebSearch (tidak tersedia di runner CI; memanggilnya membatalkan run).
- **Buffer:** org terpisah untuk AI Labs, channel YouTube + TikTok AI Labs di dalamnya → token sendiri (`AI_LABS_BUFFER_ACCESS_TOKEN`).
- **Suara:** sama — Gemini 3.8 Flash TTS + `id-id-podcaster-1` (terkunci di `scripts/tts.mts`; nol perubahan kode).
- **Cadence:** slot yang sama persis → 2 run CI per slot (satu per akun), 12 video/hari total.
- **Model agent:** tetap `opencode/inkling-2-small-free` → akun opencode terpisah **tidak** dibutuhkan untuk jalur ini (backlog eliminates WebSearch).
- **Laporan:** channel Slack `#social` yang sama, teks diberi label akun ("[AI Labs]").
- **Bahasa:** Indonesia, santai-profesional (sama seperti channel lama).

## Approaches (considered, and why the chosen one)

| Opsi | Trade-off | Keputusan |
|---|---|---|
| **A. Satu repo, config per akun** (dipilih) | Channel IDs, brand, credential, aturan topik, dan backlog dipisah per akun; kode pipeline dipakai bersama. Risiko: satu commit bisa menyentuh kedua channel. | Dipilih — perubahan terkecil yang tetap menghasilkan dua channel independen. |
| B. Repo terpisah (copy) untuk AI Labs | Isolasi total, tapi seluruh pipeline (engine, scripts, CI, docs) diduplikasi; tiap fix engine harus di-apply 2×; dua repo publik = dua kaliनु Mountains of secrets. | Ditolak — duplikasiitis lebih besar dari risikonya. |
| C. Format visual baru (kartu 2D / mockup layar) untuk AI Labs | Konten AI lebih "screen-like", tapi butuh jalur render baru di `src/engine/` (bukan cuma isi) + aturan authoring baru. | Ditolak user — pakai engine 3D yang ada. |
| D. Satu run CI membuat 2 video (satu per akun) | Lebih sedikit run, tapi agent harus riset 2 niche berbeda dalam 1 sesi, artifact/matrix jadi rumit, 1 kegagalan = 2 video gagal. | Ditolak — 1 run = 1 akun, 2 dispatch per slot. |
| E. Format naratif statis untuk AI Labs ("3 langkah") | Paling murah ditulis, tapiBurgundy setiap video terasa sama → burnout + drop-off. | Ditolak user — format diacak + hook variety. |

## Goals / non-goals / anti-goals

**Goals**
- Channel AI Labs live dengan jadwal, kualitas, dan alur publish yang sama dengan Kali Aja.
- Menambah channel **tidak** mengubah perilaku Kali Aja (regresi = build/test gagal = rollback 1 commit).
- Semua ID channel/kredensial per akun berada di **satu** tempat yang mudah diisi user.
- Konten AI Labs tidak terasa templat: format diacak, hook divariasikan, topik dari backlog yang terus bertambah.

**Non-goals**
- Tidak mengubah engine 3D, renderer, TTS, timing, caption, atau alur publish.
- Tidak menambah provider AI baru (opencode paid model, ElevenLabs, dll.).
- Tidak membuat topik "breaking news" (niche = tutorial evergreen; backlog = sumber kurasi).
- Tidak membuat dashboard/UI multi-akun; cukup file config + CLI flag.
- Tidak mengubah jadwal cron yang sudah ada (6 slot, sama untuk kedua akun).

**Anti-goals**
- ❌ Video AI Labs dengan brand "Kali Aja Tau" atau sebaliknya (tidak ada overlay salah brand).
- ❌ Publish ke channel yang salah (penting: YouTube/TikTok post sulit ditarik tanpa jejak).
- ❌ Backlog habis → agent mengarang topik. (Backlog habis = stop + lapor, bukan bikin konten fiktif.)
- ❌ Klaim fitur AI yang tidak ada di sumber (mis. "Claude bisa edit video" tanpa bukti).

## Constraints

- Repo **public** (free hosted minutes). Branch `main` = trigger. CI tidak commit apa pun.
- Buffer token hanya punya scope `posts:read` + `posts:write` → **tidak bisa list channel** → ID channel harus hardcode di config.
- YouTube menolak `<`/`>` di judul/deskripsi; deskripsi maks 5.000 byte.
- Caption: satu potongan ≤ 5 token per saat, `line-height: 1.8`, tidak boleh di atas y≈1270.
- Agent di CI tidak boleh memanggil WebSearch (membatalkan run).
- Gemini TTS terkunci pada 1 voice/model; gagal = stop, jangan ganti provider.
- Semua yang tampil di frame harus fungsi murni dari `t` (render paralel).
- Tidak ada file video/VO/metadata publish yang di-commit.

## Design

### 1. Config akun — `src/accounts.ts` (sumber kebenaran tunggal)

```ts
export type AccountId = "kali-aja" | "ai-labs";

export type Account = {
  id: AccountId;
  label: string;                       // "Kali Aja Tau" | "AI Labs"
  brand: { prefix: string; accent: string };   // "Kali Aja "/"Tau" | "AI "/"Labs"
  buffer: { orgId: string; youtubeChannelId: string; tiktokChannelId: string };
  youtubeCategoryId: string;           // "27" (Education) | "30" (Science & Technology)
  secretPrefix: string;                // "" (Kali Aja) | "AI_LABS_"
  agent: { model: string; prompt: string; files: string[] };
  catalogFile: string;                 // "/tmp/published-videos-<id>.json"
};

export const ACCOUNTS: Record<AccountId, Account> = { /* ... */ };
export const DEFAULT_ACCOUNT: AccountId = "kali-aja";
export const accountById = (id?: string | null): Account => /* ... */;
export const isConfigured = (a: Account): boolean => /* no TODO_* left */;
```

- Nilai **Kali Aja = nilai yang sekarang** (org `6aed53e7ec5c7c6d73f3e437`, YT `6aedb753e29c69a171803f6e`, TT `6aedb7fee29c69a171804662`, brand "Kali Aja "/"Tau", categoryId "27").
- Nilai **AI Labs** = placeholder `TODO_...` (org/channel ID) sampai user mengisinya. `publish.mts` gagal **dengan pesan jelas** kalau masih placeholder (tidak diam-diam post ke channel Kali Aja).
- `src/accounts.ts` di-import oleh script (`../src/accounts`) — `scripts/tsconfig.json` sudah mengizinkan import dari luar `scripts/` (contoh: `../src/engine/types`), dan `moduleResolution: "Bundler"` + `resolveJsonModule` sudah aktif di root tsconfig. Jangan pakai `.json` untuk config (runtime import `.json` tanpa assertionFX rapuh di `.mts` ESM) — pakai modul `.ts`.
- Helper `accountById` menolak id tak dikenal dengan pesan yang menyebut id yang valid.

### 2. Penentuan akun per run

Sumber kebenaran = **isi `publish.json`** (field baru `account`), karena video "milik" sebuah channel. Akun run (dari trigger) dipakai untuk: fetch katalog, gate, dan validasi silang.

```
trigger (inputs.account | client_payload.account)
      │
      ├─→ resolve step → $GITHUB_ENV: ACCOUNT, ACCOUNT_LABEL, BRAND_*, AGENT_MODEL,
      │                   AGENT_FILES, AGENT_PROMPT, YT/TT channel IDs, CATEGORY_ID, CATALOG_PATH
      ├─→ fetch katalog Buffer (filter channel akun ini) → /tmp/published-videos-<akun>.json
      ├─→ agent (baca rules + brief + backlog akun ini, brand literal)
      ├─→ gate: publish.json.account === ACCOUNT  (kalau tidak → stop)
      └─→ publish.mts: publish.json.account → config → Buffer channel IDs
```

- `publish.json` **wajib** punya `account`; `validatePublishJson` tambahan memeriksa nilainya harus id akun yang dikenal.
- Default (lokal, tanpa flag): `kali-aja` — perilaku lama tidak berubah.
- Resolusi akun di CI: `inputs.account` (workflow_dispatch) → `github.event.client_payload.account` (repository_dispatch) → `kali-aja`.

### 2b. File instruksi per akun (jawaban atas pertanyaan reviewer #1)

Tiga file yang dibaca agent hari ini **semuanya menyebut facts Kali Aja** (`AGENTS.md:3` brand, `AUTOPILOT.md:12-17` channel ID + brand, `AUTOPILOT.md:44` aturan topik sains, `AUTOPILOT.md:54` pool format, `AUTOPILOT.md:110` channel ID + `categoryId 27` + CTA). Kalau file-file itu tetap masuk ke prompt AI Labs, agent-nya punya instruksi yang **bertentangan** (anti-goal: brand salah).

Keputusan:

| File | Status | Alasan |
|---|---|---|
| `AGENTS.md` | **dinetralkan** (satu baris brand → "per video; nilai per akun di `src/accounts.ts`") | aturan engine (scene, caption, callout, timing) memang dipakai kedua akun. |
| `ops/ci-prompt.md` | **dinetralkan** (path katalog + perintah `pick-format` jadi relatif ke env run) | pipeline generic; tidak boleh menyebut channel tertentu. |
| `docs/AUTOPILOT.md` | **tetap, tapi ditandai** "runbook akun **Kali Aja**"; AI Labs **tidak** membacanya | isinya 90% aturan niche sains + konstanta channel Kali Aja. |
| `ops/accounts/ai-labs.md` | **baru** — brief AI Labs (niche, struktur, brand literal, batas klaim, gaya copy) | sumber tunggal rules AI Labs. |
| `ops/topics/ai-labs.md` | **baru** — backlog topik | sumber topik AI Labs. |

`agent.files` di `src/accounts.ts`:

- `kali-aja`: `["AGENTS.md", "docs/AUTOPILOT.md", "ops/ci-prompt.md"]` (identik dengan hari ini).
- `ai-labs`: `["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/ai-labs.md", "ops/topics/ai-labs.md"]` — **tanpa `docs/AUTOPILOT.md`**.

Konsekuensi: AUTOPILOT.md (runbook scheduled task lokal Sen/Rab/Jum) **tetap khusus Kali Aja**. AI Labs berjalan lewat **CI cron saja**; menambah AI Labs ke scheduled task lokal berarti dobel posting di slot yang sama — tidak dilakukan. (Kalau nanti kamu mau task lokal ikut membuat AI Labs, brief `ops/accounts/ai-labs.md` tinggal dipakai sebagai pengganti AUTOPILOT.md.)

### 3. Perubahan script (semuanya kecil, satu sumber kebenaran)

| Script | Perubahan |
|---|---|
| `scripts/publish.mts` | Ambil `PUB.account` → `accountById` → YT/TT channel ID dari config (hapus const hardcode `6aedb...`). Fail-fast kalau placeholder. Panggil `fetchPublishedVideos(token, account)`. **Cross-check akun run** (lihat §3b). |
| `scripts/publish-lib.mts` | `validatePublishJson`: tambah `account` ke daftar wajib + harus id yang dikenal. |
| `scripts/fetch-published-videos.mts` | `fetchPublishedVideos(token, accountId)`: filter `organizationId` + `channelIds` per akun. CLI `--account <id>` + `--out`; default path per akun. |
| `scripts/check-duplicates.mts` | Default `--db` per akun (dari `publish.json.account`); `--db` eksplisit tetap menang (dipakai CI). |
| `scripts/duplicate-core.mts` | Tambah stop-word "labs" (kata "ai" sudah ada). |
| `scripts/pick-format.mts` | `FORMATS` → `FORMATS_BY_ACCOUNT: Record<AccountId, Format[]>`; CLI `--account <id>` (default `kali-aja`, jadi perintah lama tetap jalan). Pool AI Labs baru (lihat §7). |
| `scripts/report.mts` + `report-lib.mts` | `buildReportText({..., account})` → label akun di teks (Kali Aja: "[Kali Aja Tau]" — teks existing tidak berubah). CLI `--account`. |
| `scripts/lib.mts` | Helper kecil: `publishedVideosPath(accountId)`, `resolveAccount(arg?)` (dipakai bersama). |

Tidak ada perubahan di: `tts`, `align`, `build-timeline`, `music`, engine (`src/engine/*`), `src/videos/*` video existing.

### 3b. Kontrak akun di `publish.mts` (jawaban atas pertanyaan reviewer #4)

Dua sumber akun tidak boleh bisa berbeda diam-diam:

- **Identitas video** = `publish.json.account` → menentukan channel ID + kategori YouTube. Ini yang menang.
- **Akun run** = `--account <id>` atau env `ACCOUNT` (opsional). Kalau ada dan **tidak sama** dengan `publish.json.account` → **publish menolak** dengan pesan jelas.

Urutan pemeriksaan (penting: jangan ada efek samping):

1. validasi `publish.json` (sekarang termasuk `account` wajib);
2. cross-check akun run vs akun video → **tolak sebelum upload Cloudinary** (tidak ada file yang terupload untuk video yang ditolak);
3. cek `isConfigured()` → kalau masih placeholder, **tolak sebelum upload**;
4. baru upload → baru createPost.

Kalau akun run tidak diberikan (pemakaian lokal `npm run publish -- <slug>`), tidak ada cross-check → `publish.json.account` yang dipakai. Perilaku lama (tidak ada `--account`) tetap jalan.

`categoryId` YouTube ikut per akun (`27` untuk Kali Aja, `30` Science & Technology untuk AI Labs) — tidak lagi hardcode `"27"` di `publish.mts`.

### 4. Kredensial per akun

Konvensi nama secret GitHub: **nama kanonik** untuk Kali Aja (tanpa prefix, jadi secret existing tidak perlu disentuh), **`AI_LABS_` + nama kanonik** untuk AI Labs.

| Env/secret kanonik | Secret Kali Aja | Secret AI Labs |
|---|---|---|
| `GEMINI_API_KEY` | `GEMINI_API_KEY` (existing) | `AI_LABS_GEMINI_API_KEY` |
| `CLOUDINARY_CLOUD_NAME` | existing | `AI_LABS_CLOUDINARY_CLOUD_NAME` |
| `CLOUDINARY_API_KEY` | existing | `AI_LABS_CLOUDINARY_API_KEY` |
| `CLOUDINARY_API_SECRET` | existing | `AI_LABS_CLOUDINARY_API_SECRET` |
| `BUFFER_ACCESS_TOKEN` | existing | `AI_LABS_BUFFER_ACCESS_TOKEN` |
| `SLACK_BOT_TOKEN` / `SLACK_SOCIAL_CHANNEL_ID` | existing (dipakai bersama) | — (channel Slack sama) |

- Script **tidak** berubah: workflow menulis `.env` dengan **nama kanonik** → `loadDotenv()` (regex hanya huruf besar + angka + `_` → `AI_LABS_*` aman) → publish/report/agent tidak tahu ada akun lain.
- Workflow: step "Write .env" menerima **kedua** nama sebagai step-env (`${{ secrets.X }}` dan `${{ secrets.AI_LABS_X }}`), lalu loop bash memilih sesuai `$ACCOUNT`:

  ```bash
  umask 077; : > .env
  for key in GEMINI_API_KEY CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET BUFFER_ACCESS_TOKEN; do
    src="$key"; [ "$ACCOUNT" = "ai-labs" ] && src="AI_LABS_$key"
    printf '%s=%s\n' "$key" "${!src:-}" >> .env
  done
  ```

  Job `build` hanya menulis `GEMINI_API_KEY` (agent tidak boleh lihat secret publish). Job `publish` menulis Cloudinary + Buffer. Job `report-failure` tidak butuh .env (Slack secret langsung).
- **Jangan** pakai `secrets[expr]` dinamis (dukungannya tidak seragam) — daftar eksplisit di step-env.
- Secret kosong → script gagal dengan "Missing X in .env" (perilaku existing, tidak diam-diam).

### 5. Workflow `.github/workflows/video.yml`

- `workflow_dispatch` dapat input baru `account` (string, default `kali-aja`).
- `repository_dispatch` membaca `client_payload.account`.
- `concurrency.group` → `video-run-<akun>` supaya run kedua akun **tidak** saling blokir (sekarang: `video-run` global → run kedua channel akan antre). PerAKun = 2 run paralel di slot yang sama.
- Job `build`:
  1. step "Resolve account" → baca config → tulis semua env yang dibutuhkan ke `$GITHUB_ENV`. (Config dibaca via `node -e`/skrip kecil agar tidak ada duplikasi konstanta di YAML.)
  2. **step "Preflight account"** (pertama setelah resolve, sebelum opencode/agent/render): kalau `!isConfigured($ACCOUNT)` → **fail cepat** dengan pesan "akun ai-labs belum dikonfigurasi (isi src/accounts.ts + secret AI_LABS_*)" → job gagal → Slack lapor. Tidak ada agent, tidak ada render 40 menit untuk run yang pasti gagal (jawaban atas reviewer #2).
  3. katalog: `npx tsx scripts/fetch-published-videos.mts --account "$ACCOUNT" --out "$CATALOG_PATH"`. **Token Buffer hanya ada di step ini**: kedua nama secret diekspos sebagai step-env, bash memilih sesuai `$ACCOUNT` dan mengekspor ke proses step itu saja. Invariant "agent tidak pernah melihat secret publish" tetap berlaku — step-env tidak diwarisi ke step lain dan tidak pernah ditulis ke `.env`.
  4. agent: `opencode run --auto --standalone --model "$AGENT_MODEL" --file AGENTS.md --file ops/ci-prompt.md <file per akun> ... "$AGENT_PROMPT"`. Prompt memuat brand literal + brief + backlog + path katalog.
  5. gate baru "Account match": `publish.json.account` == `$ACCOUNT`, dan `src/videos/<slug>/index.ts` memuat `prefix: "<BRAND_PREFIX>"` + `accent: "<BRAND_ACCENT>"` (mencegah overlay brand salah).
  6. duplicate gate tetap, `--db "$CATALOG_PATH"`.
- Job `publish`: tulis `.env` per akun → `npm run publish -- "$SLUG" --account "$ACCOUNT"` → `npm run report -- "$SLUG" --account "$ACCOUNT"`.
- Job `report-failure`: `npm run report -- ... --account "$ACCOUNT"` (label akun di laporan kegagalan). Job ini fresh checkout tanpa env akun → ia **resolusi sendiri** dari payload event (`github.event.client_payload.account` / `inputs.account`), dan kalau tidak bisa → label netral `[video-short CI]` (bukan menebak "Kali Aja"). `report-lib` menerima `account?: string` dan memetakan ke label. **Success** → judul pakai label akun (Kali Aja: "Kali Aja Tau" — persis seperti sekarang; tanpa akun → `[video-short CI]`). **Error** → teks lama `[video-short CI] run gagal di *step* untuk \`slug\`` + suffix ` — <label akun>` kalau akun diketahui.
- Job `render`: **tidak berubah** (slug/frames dari `needs.build`; account tidak relevan untuk render).

### 6. Cron (Cloudflare Worker)

- `ops/cloudflare-cron/worker.js`: loop akun dari env `ACCOUNTS` (default `kali-aja,ai-labs`), dispatch per akun dengan `client_payload: { account }` → 2 `repository_dispatch` per tick cron.
- Env `ACCOUNTS` bisa dipersempit user (`ACCOUNTS=kali-aja`) selama AI Labs belum dikonfigurasi, supaya tidak ada run yang pasti gagal tiap slot (jawaban atas reviewer #2). Fail-fast di build tetap ada sebagai jaring pengaman.
- `wrangler.toml`: `crons` **tidak berubah** (6 slot).
- Peringatan Slack menyebut akun yang gagal dispatch.

### 7. Konten AI Labs — brief + backlog + format pool

**a. `ops/accounts/ai-labs.md`** (brief yang dibaca agent):
- Channel *AI Labs*, brand literal `brand: { prefix: "AI ", accent: "Labs" }`.
- Niche: tips & trik Claude / ChatGPT / Gemini — edit foto & video, coding, debugging, plugin (mis. superpowers).
- Format: `npx tsx scripts/pick-format.mts --account ai-labs` → pakai **verbatim**, catat di `catatan`. Larangan: "masalah → 3 langkah → kesalahan umum" sebagai kerangka; variasi sintaks hook (pertanyaan / klaim / before-after / demo /ralan).
- Topik: ambil 1 dari `ops/topics/ai-labs.md` yang belum pernah tayang (lihat katalog `/tmp/published-videos-ai-labs.json`); verifikasi fakta ke sumber resmi via `WebFetch`; sumber tak terjangkau → ganti topik atau stop. **Jangan WebSearch.**
- Naskah: 13–16 baris `NN  text`, 1.100–1.400 karakter, Indonesia santai-profesional, angka ditulis dengan kata.
- Scene 3D: bangun dari `Kit` (panel chat/terminal/file-tree/gear plugin/kartu foto before-after) — **tanpa screenshot UI asli** (CI tidak bisa login ke akun apa pun); diagram skematis diberi `tag: "ILUSTRASI"`.
- `publish.json`: `account: "ai-labs"` + `title` ≤100 + `description` + `tiktokTitle` ≤90 + `tiktokCaption` + `catatan: "format: <id>; ..."`.
- Batas klaim: hanya fitur yang ada di sumber; tidak mengarang angka benchmark; tidak menyebut model/fitur yang belum rilis; tanpa nasihat medis/finansial.

**b. `ops/topics/ai-labs.md`** (backlog, **~40 topik terverifikasi**): tiap entri = ide judul + apa yang ditampilkan + URL sumber resmi + tanggal verifikasi. Dibuat dari dokumentasi resmi (Anthropic, OpenAI, Google) + yang sudah terbukti di repo ini. Agent ambil satu per run.

*Isi & refill (keputusan user 2026-11-15):* **top-up manual on-demand** — 40 topik awal (±7 hari runway pada 6 video/hari); ketika perlu, user minta "isi backlog AI Labs" → assistant memverifikasi sumber resmi, menambah entri, 1 commit. **Guard:** sebelum menulis naskah, agent menghitung sisa backlog yang belum tayang; **sisa < 3 → stop + lapor Slack** (tidak mengarang topik, tidak memakai topik yang sudah pernah). Rutinitas refill didokumentasikan singkat di `ops/accounts/ai-labs.md` (§"Refill backlog").

*Alternatif yang ditolak (dicatat supaya tidak ditanya ulang):* B (skrip `topics --suggest` yang mem-parse halaman docs — rapuh, kualitasnya tidak terjamin) dan C (CI commit backlog otomatis — satu-satunya opsi zero-touch, tapi melonggarkan aturan repo "nothing generated lands in git"; ditolak user). Opsi keempat "cadence 3 slot/hari" juga ditolak (user mau jadwal persis sama).

**c. Pool format AI Labs** (`pick-format.mts`): `prompt-recipe`, `tool-compare`, `edit-photo-before-after`, `debug-postmortem`, `plugin-teardown`, `workflow-speedrun`, `pitfall-callout`, `feature-drop`, `screen-rebuild` (membangun ulang tampilan dari kalimat), `one-liner`. Bobot mengikuti performa short-form 2026 (lead = `prompt-recipe` & `tool-compare`), tiap format punya `instruction` satu kalimat seperti pool existing.

### 8. Dokumentasi yang diperbarui

| File | Perubahan |
|---|---|
| `docs/AUTOPILOT.md` | Tambah bagian "Multi-akun": cara menjalankan/menambah akun, config `src/accounts.ts`, brief per akun. Runbook science tetap untuk Kali Aja. |
| `docs/PUBLISHING.md` | Tabel channel ID per akun, daftar secret per akun, konvensi `.env` per akun. |
| `ops/README.md` | Worker dispatch 2 akun per tick; daftar secret GitHub (lama + `AI_LABS_*`); concurrency per akun. |
| `ops/ci-prompt.md` | `publish.json` wajib berisi `account` (nilainya dari env run), dan brief per akun dibaca dari daftar file yang diberikan agent. |
| `AGENTS.md` | Singgas: `pick-format --account`, `publish.json.account`, `src/accounts.ts`. |

### 9. Test & verifikasi

- `scripts/pick-format.test.mts`: pool per akun, bobot > 0, `instruction` non-kosong, id unik per pool, boundary roll.
- `scripts/publish.test.mts`: `validatePublishJson` mensyaratkan `account` yang dikenal; `account` ilegal → problem list.
- `scripts/report.test.mts`: label akun muncul di teks sukses & gagal.
- `scripts/accounts.test.mts` (baru): **invariant**, bukan fixture. Untuk tiap akun: brand prefix+accent non-kosong, id unik & valid, `secretPrefix` sesuai (`""` vs `AI_LABS_`), file brief/backlog benar-benar ada di disk, channel ID berawalan hex 24 (format Buffer), dan **all-or-nothing**: sebuah akun itu *fully configured* (tidak ada `TODO_` di field wajibnya) atau *fully placeholder* (semua field wajibnya `TODO_`) — tidak boleh campuran. Test ini tetap hijau setelah user mengisi ID aslinya (yang menghapus asersi "AI Labs masih placeholder" — itu akan mati saat channel dikonfigurasi).
- `npm run lint && npm test` harus hijau; `npx remotion bundle` harus tetap jalan.
- Verifikasi manual (sebelum merge): `workflow_dispatch` dengan `account=ai-labs` + `dry_run=true` → cek agent menghasilkan video dengan brand "AI Labs", format dari pool AI, dan `publish.json.account === "ai-labs"`.

### 10. Yang harus disiapkan user (blokir publish, bukan blokir coding)

| Item | Nilai |
|---|---|
| Buffer org AI Labs | org ID |
| Buffer channel AI Labs | YouTube channel ID, TikTok channel ID |
| Buffer token AI Labs | secret `AI_LABS_BUFFER_ACCESS_TOKEN` (scope `posts:read` + `posts:write`) |
| Cloudinary AI Labs | secret `AI_LABS_CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` |
| Gemini AI Labs | secret `AI_LABS_GEMINI_API_KEY` |
| YouTube/TikTok | hubungkan akun AI Labs ke channel Buffer di atas |

Sampai semua terisi, pipeline AI Labs **berhenti bersih** di publish dengan pesan konfigurasi (tidak ada posting parsial).

## Rollback

Satu commit (atau beberapa commit kecil) di `main`; rollback = `git revert` → Kali Aja kembali ke hardcode lama? Tidak: revert mengembalikan konfigurasi lama **dan** config per akun; karena semua perubahan Kali Aja defaults-nya sama, tidak ada migrasi data (tidak ada state, tidak ada katalog yang di-commit). Rollback aman kapan saja.

## Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Post ke channel salah | `publish.json.account` = sumber kebenaran + gate "Account match" di build job + fail-fast placeholder. |
| Overlay brand salah | Gate grep brand literal di `index.ts` + brand diberikan verbatim ke agent. |
| 2× beban CI (12 video/hari) | Repo public → menit gratis; 10 job paralel peak < limit 20 free tier. |
| Kuota Gemini TTS | Kunci terpisah per akun → 6 request/hari per kunci (batas ±10/hari/model) → aman. |
| Rate limit model opencode free | Sama untuk kedua akun (satu pool); kalau kena → run gagal & lapor Slack (jalur existing). |
| Backlog habis / topik basi | Backlog 40 topik + guard (sisa < 3 → stop + lapor, bukan mengarang) + refill manual on-demand terdokumentasi. Residual: channel gelap ±7 hari kalau lupa refill → laporan ke Slack jadi sinyal. |
| AI Labs "terasa sama" tiap video | Format diacak berbobot + brief melarang kerangka statis + judul/hook divariasikan. |
| Buffer token tanpa `account:read` | Channel ID ditulis manual di config (sudah jadi cara kerja existing). |

## Ringkasan hasil builder-check (6 pertanyaan)

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | File instruksi mana yang dibaca tiap akun; bagaimana konstanta per-akun tanpa kontradiksi? | **My call** (§2b): `AGENTS.md` + `ci-prompt.md` dinetralkan; AUTOPILOT.md khusus Kali Aja dan **tidak** dibaca agent AI Labs; brief + backlog baru per akun. AI Labs hanya lewat CI cron. |
| 2 | Apa arti "AI Labs siap"? Test how supaya tidak mati saat dikonfigurasi? | **My call**: test jadi invariant all-or-nothing (§9); fail-fast di build job sebelum agent/render (§5.2); worker bisa dipersempit via env `ACCOUNTS`. |
| 3 | Siapa yang mengisi ulang `ops/topics/ai-labs.md` (40 topik habis dalam ~7 hari)? | **User** (2026-11-15): **A — top-up manual on-demand** (~40 topik terverifikasi, ±7 hari runway) + **guard** sisa < 3 → stop + lapor. Opsi B (skrip suggest) & C (CI auto-commit) ditolak. |
| 4 | Akun mana yang otoritatif saat publish; apa yang terjadi kalau akun video ≠ akun run? | **My call** (§3b): `publish.json.account` menang; akun run jadi cross-check → **tolak sebelum upload Cloudinary**; tanpa akun run → tidak ada cross-check. |
| 5 | Dari mana token Buffer AI Labs untuk fetch katalog di job build? | **My call** (§5.3): kedua nama secret sebagai step-env, bash memilih per akun, diekspor hanya ke proses step katalog → agent tidak pernah melihat secret publish. |
| 6 | Label akun untuk laporan gagal saat run gagal sebelum akun ter-resolve? | **My call** (§5): job `report-failure` resolusi sendiri; fallback label netral `[video-short CI]`; teks Kali Aja tidak berubah. |

## Yang tersisa untuk builder

1. `src/accounts.ts` + test.
2. Update script (§3) + update test.
3. Update workflow (§5) + worker (§6).
4. Brief `ops/accounts/ai-labs.md` + backlog `ops/topics/ai-labs.md` (**~40 topik terverifikasi**) + pool format AI.
5. Update docs (§8).
6. `npm run lint && npm test` + bundle + 1 still per shot + 1 dry-run CI.
