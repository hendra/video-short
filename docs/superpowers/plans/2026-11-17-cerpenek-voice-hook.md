# Cerpenek voice + hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerpenek videos get a young-woman storyteller voice, a 3-second hook rule, and a denser script budget.

**Architecture:** All behaviour lives in config and prose: one line of `src/accounts.ts` (voice + style), the channel brief `ops/accounts/cerpenek.md` (persona, hook, script length, CTA), one story-format instruction in `scripts/pick-format.mts`, and the docs that name the voice. No pipeline code changes.

**Tech Stack:** TypeScript, node:test, tsx.

**Spec:** `docs/superpowers/specs/2026-11-17-cerpenek-voice-hook-design.md`

## Global Constraints

- Voice: `id-id-storyteller-1`; style: `hangat, ceria, bersemangat; intonasi naik-turun seperti bercerita`.
- Kalimat sapaan "adik-adik", maksimal sekali per naskah, tidak di baris pertama.
- Baris pertama = hook (pertanyaan, suara, atau aksi); dilarang sapaan dan "Pada zaman dahulu".
- Budget naskah 800–1000 karakter; durasi 60–90 detik.
- Nama channel, brand `Cerpe`+`nek`, `madeForKids: true`, dan aturan batas isi anak tidak berubah.
- Kali Aja dan AI Labs tidak boleh berubah (`id-id-podcaster-1` + `natural, warm, conversational`).

## Review Focus

- An agent writing a script that opens with a greeting anyway — the brief must forbid it by form, not by "make it varied".
- An agent re-introducing "Nenek"/"Cucuku" from the channel name.
- Script length drifting past 90 s at the faster tempo.
- The other two accounts' voice/style/tests breaking when the Cerpenek assertion changes.

---

### Task 1: Voice, style and storyteller persona

**Files:**
- Modify: `src/accounts.ts:88`
- Modify: `scripts/accounts.test.mts:61-64`
- Modify: `ops/accounts/cerpenek.md` (§Suara, §Naskah, CTA)
- Modify: `scripts/pick-format.mts:49-56`

**Interfaces:**
- Consumes: `Account.tts: { voice: string; style: string }`.
- Produces: `ACCOUNTS.cerpenek.tts` with the two literal values above; `pickFormat("cerpenek")` instructions that never say "Nenek".

- [ ] **Step 1: Update the failing assertion**

```ts
test("Cerpenek speaks with the young storyteller voice", () => {
  assert.equal(ACCOUNTS.cerpenek.tts.voice, "id-id-storyteller-1");
  assert.match(ACCOUNTS.cerpenek.tts.style, /bersemangat/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx tsx --test scripts/accounts.test.mts`
Expected: FAIL — actual voice `id-id-tutor-1`.

- [ ] **Step 3: Change the config and the prose**

`src/accounts.ts:88` → `tts: { voice: "id-id-storyteller-1", style: "hangat, ceria, bersemangat; intonasi naik-turun seperti bercerita" },`.

`ops/accounts/cerpenek.md` §Suara: narator = kakak perempuan muda yang bercerita ke adik kecil; sapaan "adik-adik" maksimal sekali per naskah dan tidak di baris pertama; "Cucuku" dan persona Nenek dilarang. `## Naskah`: baris pertama wajib hook (pertanyaan, suara, atau aksi), dilarang sapaan dan "Pada zaman dahulu"; budget 800–1000 karakter untuk 60–90 detik. CTA: "Besok kakak cerita lagi ya. Ajak ayah dan ibu."

`scripts/pick-format.mts`: comment on line 49 and the `tebak-dulu` instruction stop naming "Nenek" (use the kakak-perempuan narrator).

- [ ] **Step 4: Run tests and lint**

Run: `npx tsx --test scripts/accounts.test.mts scripts/pick-format.test.mts scripts/topics.test.mts` then `npm run lint`
Expected: PASS, no lint/type errors.

- [ ] **Step 5: Commit**

```bash
git add src/accounts.ts scripts/accounts.test.mts scripts/pick-format.mts ops/accounts/cerpenek.md
git commit -m "feat(cerpenek): young storyteller voice, hook rule, denser script"
```

### Task 2: Docs name the new voice

**Files:**
- Modify: `docs/PUBLISHING.md:36`
- Modify: `README.md:50`
- Modify: `AGENTS.md:14`

- [ ] **Step 1: Replace the voice name** — every "female `id-id-tutor-1` for Cerpenek" becomes "female `id-id-storyteller-1` for Cerpenek".
- [ ] **Step 2: Verify nothing else still claims tutor-1 or a Nenek narrator**

Run: `grep -rn "tutor-1\|nenek mendongeng" --include=*.md --include=*.ts --include=*.mts . | grep -v node_modules | grep -v ".claude/worktrees" | grep -v "docs/superpowers/"`
Expected: no hits.

- [ ] **Step 3: Run the full gate and commit**

Run: `npm run lint && npm test`
Expected: PASS.

```bash
git add README.md AGENTS.md docs/PUBLISHING.md
git commit -m "docs: Cerpenek voice is the young storyteller"
```
