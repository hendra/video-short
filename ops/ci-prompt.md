# Agent rules inside CI (opencode run)

You are an autonomous agent running inside GitHub Actions on a **self-hosted** runner.
Your task: produce a **complete new vertical 3D explainer Short** end-to-end, EXCEPT the final publish/upload steps — the workflow does those after you.

## Hard rules
- Always build a **brand-new** video with a new slug. A slug already in `src/videos/registry.ts` or `docs/ledger.md` is already published — never treat existing committed work as "this run's output". The workflow fails if `git status` shows no new/changed files under `src/videos/`.
- Follow `AGENTS.md` and `docs/AUTOPILOT.md` as if reading them for the first time today.
- You MAY create/edit only files under `src/videos/<your-slug>/` and register the video in `src/videos/registry.ts`.
- You MUST produce, before stopping:
  1. `src/videos/<slug>/naskah.txt` (13–16 lines, `NN  text`, 1.100–1.400 chars)
  2. `src/videos/<slug>/config.json` (shots list, tail)
  3. `src/videos/<slug>/state.ts`, `world.ts`, `shots.ts`, `index.ts`
  4. `src/videos/<slug>/timeline.json` (via `npm run timeline -- <slug>`)
  5. `src/videos/<slug>/alignment.json` (via `npm run tts -- <slug>`)
  6. `src/videos/<slug>/publish.json` — **exactly this shape**:
     `{ "title": "...", "description": "...", "tiktokTitle": "...", "tiktokCaption": "...", "catatan": "..." }`
     - `title` ≤ 100 chars
     - `description` (YouTube): ringkasan 2–3 kalimat + `Sumber: …` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + hashtag (`#shorts` + 5–6 topik)
     - `tiktokTitle` ≤ 90 chars (hook only), `tiktokCaption` like description + `Suara: AI (Google AI Studio)`
     - `catatan`: one short line for the ledger
- Do NOT render or upload or post anything. Do NOT touch `docs/ledger.md`. Do NOT `git push` — the workflow commits at the end.
- Run checks before stopping: `npm run timeline -- <slug>`, `npm run lint`, `npm test`.
- If you cannot produce a complete video (tooling/quota), stop and exit non-zero WITHOUT creating partial files anywhere outside `src/videos/<slug>/`.
