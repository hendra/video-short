# Buffer slot scheduling — 3 video/hari, jam tayang per platform

## Why
Buffer free menolak post YouTube ke-3 dalam sehari (`LimitReachedError: … maximum number of posts YouTube allows in a day (2)`, run 44746588041). Cron sekarang 6 run/hari/akun, jadi sebagian besar run gagal di publish setelah render selesai. Tetap di Buffer, turunkan volume, dan tayangkan per platform di jam tetap.

## Goals
- 3 video/hari per akun (semua akun di `wrangler.toml`).
- Jam tayang (WIB):

| Slot | TikTok | Instagram* | YouTube |
|---|---|---|---|
| pagi | 07:00 | 08:00 | — |
| siang | 13:00 | 12:00 | 12:00 |
| malam | 19:00 | 20:00 | 19:00 |

\* hanya akun dengan `instagramChannelId` (sekarang Sastra Mesin).

- YouTube tepat 2 post/hari → tidak pernah kena limit Buffer.

## Non-goals
- Pindah ke Publer/SocialBu/YouTube API.
- Melanjutkan otomatis publish yang setengah gagal (tetap prosedur manual di PUBLISHING.md).

## Approaches
1. **Dipilih — Buffer `customScheduled`:** satu run per slot mulai ±1,5 jam sebelum jam tayang paling awal; publish membuat post terjadwal dengan `dueAt` per platform. Satu render per slot.
2. Satu run per jam tayang (6 render/hari, video beda per platform) — biaya 2×, ditolak.
3. Samakan jam semua platform + `shareNow` — paling sedikit kode, tapi tidak sesuai jadwal.

## Design
- **Slot table** (satu sumber, di `scripts/publish-lib.mts`): `pagi|siang|malam` → `{ youtube?, tiktok, instagram }` jam WIB. Helper murni `slotFor(now)` memilih slot berikutnya yang jam tayang terawalnya belum lewat (run manual otomatis ikut ini), dan `dueAtFor(slot, platform, now)` → ISO UTC (WIB = UTC+7, tanpa DST).
- **Jam yang sudah lewat** saat publish (run molor): platform itu memakai `shareNow`, bukan gagal.
- **`publish.mts`:** mode `customScheduled` + `dueAt`; slot pagi tidak membuat post YouTube. Publish sukses saat semua `createPost` mengembalikan `PostActionSuccess` (status `scheduled`, atau `sent` untuk yang `shareNow`) — tidak lagi polling sampai terkirim. Post yang `shareNow` tetap dipoll seperti sekarang.
- **Cek duplikat:** `fetch-published-videos.mts` mengambil status `sent` **dan** `scheduled`, supaya video yang masih antre ikut dicek.
- **Hasil/Slack:** `publish-result.json` membawa `slot` + jam tayang per platform; link diisi bila sudah ada. `report.mts` menampilkan jadwal ketika link belum ada.
- **Cron** (`ops/cloudflare-cron/wrangler.toml`, UTC): `30 22,3,10 * * *` = 05:30, 10:30, 17:30 WIB. Run ≈ 35 menit (build 13 + render 4 + publish ~18) → ±55 menit cadangan. Catatan: 22:30 UTC masih tanggal UTC sebelumnya — slot dipilih dari jam WIB, bukan tanggal UTC.
- **Cleanup lokal tetap** setelah Buffer menerima semua post (Cloudinary URL harus tetap hidup sampai tayang — Cloudinary tidak dihapus, sama seperti sekarang).
- Docs: PUBLISHING.md (mode, slot, duplikat), worker.js header komentar, AGENTS.md/ops README bila menyebut jadwal.
- Tests: unit untuk `slotFor`/`dueAtFor` (batas jam, lewat tengah malam UTC, slot pagi tanpa YouTube, jam lewat → shareNow).

## Left to the builder
- Penamaan helper dan bentuk persis `publish-result.json`.
- Apakah `dry_run` mencetak slot/dueAt yang akan dipakai (disarankan, murah).

## Risks
- Belum terbukti apakah limit 2/hari Buffer dihitung per tanggal `dueAt` atau tanggal dibuat; dengan YouTube tepat 2/hari keduanya aman, kecuali run manual tambahan di hari yang sama.
- Run manual ekstra di slot yang sama akan membuat post kedua untuk slot itu (YouTube bisa kena limit lagi) — dibiarkan, operator yang memutuskan.
