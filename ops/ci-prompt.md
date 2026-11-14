# Agent rules inside CI (opencode run)

You are an autonomous agent running inside GitHub Actions on a **GitHub-hosted `ubuntu-latest`** runner.
Your task: produce a **complete new vertical 3D explainer Short** end-to-end, EXCEPT the final publish/upload steps — the workflow does those after you.

## Hard rules
- Always build a **brand-new** video with a new slug. Any slug that already shipped lives in the published-video catalog and YouTube/TikTok — never treat existing work as "this run's output". Your source disappears with the VM; the publish job later commits only `data/published-videos.json`.
- Before choosing a topic, read `data/published-videos.json` (the git-tracked database of published YouTube + TikTok posts). Do not reuse a topic, angle, title, or source. After writing `publish.json`, the workflow runs the deterministic duplicate gate against that file; if it fails, you chose too close a video.
- Pick the narration format at random: run `npx tsx scripts/pick-format.mts`, use its output verbatim, and record it in `publish.json` as `catatan: "format: <id>; ..."`. Do not swap it for another format.
- Follow `AGENTS.md` and `docs/AUTOPILOT.md` as if reading them for the first time today.
- You MAY create/edit only files under `src/videos/<your-slug>/` and register the video in `src/videos/registry.ts`.
- You MUST produce, before stopping:
  1. `src/videos/<slug>/naskah.txt` (13–16 lines, `NN  text`, 1.100–1.400 chars; narrative format from `pick-format`, not the old fixed mystery/hook pattern)
  2. `src/videos/<slug>/config.json` (shots list, tail)
  3. `src/videos/<slug>/state.ts`, `world.ts`, `shots.ts`, `index.ts`
  4. `src/videos/<slug>/timeline.json` (via `npm run timeline -- <slug>`)
  5. `src/videos/<slug>/alignment.json` (via `npm run tts -- <slug>`)
  6. `src/videos/<slug>/publish.json` — **exactly this shape**:
     `{ "title": "...", "description": "...", "tiktokTitle": "...", "tiktokCaption": "...", "catatan": "..." }`
     - `title` ≤ 100 chars
     - `description` (YouTube): ringkasan 2–3 kalimat + `Sumber: …` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + hashtag (`#shorts` + 5–6 topik)
     - `tiktokTitle` ≤ 90 chars (hook only), `tiktokCaption` like description + `Suara: AI (Google AI Studio)`
     - `catatan`: start with `format: <id>;` from `pick-format`, followed by one short line (kept in the VM-local publish log only; not committed anywhere)
- Do NOT render or upload or post anything. Do NOT `git push` — the workflow persists only the published-video catalog after publish; your source stays in the VM and is discarded when the job ends.
- Run checks before stopping: `npm run timeline -- <slug>`, `npm run lint`, `npm test`.
- If you cannot produce a complete video (tooling/quota), stop and exit non-zero WITHOUT creating partial files anywhere outside `src/videos/<slug>/`.
