import type { Word } from "../src/engine/types";

export const normWord = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Caption chunks: punctuation phrases, max 5 tokens, spelled-out numbers never split internally.
const NUM = new Set([
  "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas", "puluh", "belas", "ratus", "ribu", "juta", "seratus", "seribu",
]);
const MAXW = 5;
const MAX_NUM_WORDS = 6;
const MAX_LINE_CHARS = 46;
const endsPhrase = (w: string) => /[,.:?!…]$/.test(w);

const tokenChars = (tok: Word[]) => tok.reduce((sum, w, i) => sum + w.w.length + (i > 0 ? 1 : 0), 0);

export const chunksOf = (ws: Word[]): Word[][] => {
  const toks: Word[][] = [];
  for (const w of ws) {
    const last = toks[toks.length - 1];
    const isNum = NUM.has(normWord(w.w));
    if (last && isNum && NUM.has(normWord(last[last.length - 1].w)) && !endsPhrase(last[last.length - 1].w)) last.push(w);
    else toks.push([w]);
  }
  const phrases: Word[][][] = [];
  let cur: Word[][] = [];
  toks.forEach((t, i) => {
    cur.push(t);
    if (endsPhrase(t[t.length - 1].w) && i < toks.length - 1) {
      phrases.push(cur);
      cur = [];
    }
  });
  if (cur.length) phrases.push(cur);
  const merged: Word[][][] = [];
  for (const p of phrases) {
    const prev = merged[merged.length - 1];
    if (prev && (p.length === 1 || prev.length === 1) && prev.length + p.length <= MAXW) merged[merged.length - 1] = [...prev, ...p];
    else merged.push(p);
  }
  const out: Word[][] = [];
  for (const p of merged) {
    const hasMultiNum = p.some((t) => t.length > 1);
    const totalWords = p.reduce((s, t) => s + t.length, 0);
    const totalChars = p.reduce((s, t, i) => s + tokenChars(t) + (i > 0 ? 1 : 0), 0);
    if (hasMultiNum && (totalWords > MAXW || totalChars > MAX_LINE_CHARS)) {
      let chunk: Word[][] = [];
      let cw = 0;
      let cc = 0;
      for (const tok of p) {
        const tc = tokenChars(tok);
        const nextChars = cc + (chunk.length > 0 ? 1 : 0) + tc;
        if (chunk.length > 0 && (chunk.length + 1 > MAXW || cw + tok.length > MAX_NUM_WORDS || nextChars > MAX_LINE_CHARS)) {
          out.push(chunk.flat());
          chunk = [];
          cw = 0;
          cc = 0;
        }
        cc += (chunk.length > 0 ? 1 : 0) + tc;
        cw += tok.length;
        chunk.push(tok);
      }
      if (chunk.length > 0) out.push(chunk.flat());
      continue;
    }
    const parts = Math.ceil(p.length / MAXW);
    const size = Math.ceil(p.length / parts);
    for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size).flat());
  }
  return out;
};
