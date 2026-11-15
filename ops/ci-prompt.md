# Agent rules inside CI (opencode run)

You are an autonomous agent running inside GitHub Actions on a **GitHub-hosted `ubuntu-latest`** runner.
Your task: produce a **complete new vertical 3D explainer Short** end-to-end, EXCEPT the final publish/upload steps — the workflow does those after you.

## Hard rules
- Never call Web Search or `websearch`; it is not available in this CI runner and will cancel the process after you produce a video. Use `WebFetch` for every live source; if the source is unavailable or unverifiable, choose another verifiable topic or stop.
- Always build a **brand-new** video with a new slug. Any slug that already shipped lives in the published-video catalog and YouTube/TikTok — never treat existing work as "this run's output". Your source disappears with the VM; CI commits nothing from publishing.
- This run is **one channel account** (the account id is stated in this prompt; if it isn't, stop and say so). The published-video lookup catalog is the path stated in this prompt (e.g. `/tmp/published-videos-<account>.json`) — read it there; do not guess another path. Before choosing a topic, read that file. Do not reuse a topic, angle, title, or source. After writing `publish.json`, the workflow runs the deterministic duplicate gate against that file; if it fails, you chose too close a video.
- Pick the narration format at random: run `npx tsx scripts/pick-format.mts --account <account-id>`, use its output verbatim, and record it in `publish.json` as `catatan: "format: <id>; ..."`. Do not swap it for another format.
- Follow `AGENTS.md` and the **per-account instruction files this prompt lists** (for Kali Aja: `docs/AUTOPILOT.md`; for AI Labs: `ops/accounts/ai-labs.md` + `ops/topics/ai-labs.md`). Do not import rules from another account's brief — channel voice, brand and limits differ per account.
- You MAY create/edit only files under `src/videos/<your-slug>/` and register the video in `src/videos/registry.ts`.
- You MUST produce, before stopping:
  1. `src/videos/<slug>/naskah.txt` (13–16 lines, `NN  text`, 1.100–1.400 chars; narrative format from `pick-format`, not the old fixed mystery/hook pattern)
  2. `src/videos/<slug>/config.json` (shots list, tail)
  3. `src/videos/<slug>/state.ts`, `world.ts`, `shots.ts`, `index.ts`
  4. `src/videos/<slug>/timeline.json` (via `npm run timeline -- <slug>`)
  5. `src/videos/<slug>/alignment.json` (via `npm run tts -- <slug>`)
  6. `src/videos/<slug>/publish.json` — **exactly this shape**:
     `{ "account": "<account-id>", "title": "...", "description": "...", "tiktokTitle": "...", "tiktokCaption": "...", "catatan": "..." }`
     - `account` **must equal the account id of this run** (the workflow refuses to publish a mismatch)
     - `title` ≤ 100 chars
     - `description` (YouTube): ringkasan 2–3 kalimat + `Sumber: …` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + hashtag (`#shorts` + 5–6 topik)
     - No `<` or `>` in `title` or `description` (YouTube rejects them) — write "lebih dari" / "kurang dari"
     - `tiktokTitle` ≤ 90 chars (hook only), `tiktokCaption` like description + `Suara: AI (Google AI Studio)`
     - `catatan`: start with `format: <id>;` from `pick-format`, followed by one short line (kept in the VM-local publish log only; not committed anywhere)
- Do NOT render or upload or post anything. Do NOT `git push` — CI commits nothing from publishing; your source stays in the VM and is discarded when the job ends.
- Run checks before stopping: `npm run timeline -- <slug>`, `npm run lint`, `npm test`.
- If you cannot produce a complete video (tooling/quota), stop and exit non-zero WITHOUT creating partial files anywhere outside `src/videos/<slug>/`.
