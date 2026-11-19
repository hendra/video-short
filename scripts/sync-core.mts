import type { Timeline } from "../src/engine/types";

/**
 * Verify that `timeline.json` aligns with actual speech segments from `vo.mp3`:
 * - word timestamps are monotonic and within audio duration
 * - no word straddles a silence longer than `maxTol` seconds
 * - no caption chunk starts more than `maxTol` seconds before speech resumes
 */
export const checkTimelineSync = (
  tl: Timeline,
  segs: [number, number][],
  audioDur: number,
  maxTol = 0.15,
): string[] => {
  const errs: string[] = [];
  const silences: [number, number][] = [];
  if (segs.length && segs[0][0] > 0) silences.push([0, segs[0][0]]);
  for (let i = 0; i < segs.length - 1; i++) silences.push([segs[i][1], segs[i + 1][0]]);
  if (segs.length && audioDur > segs[segs.length - 1][1]) silences.push([segs[segs.length - 1][1], audioDur]);

  const words = tl.chunks.flatMap((c) => c.words);
  words.forEach((w, i) => {
    if (w.s > w.e + 1e-6) errs.push(`word ${i} "${w.w}" has s=${w.s} > e=${w.e}`);
    if (i > 0 && w.s < words[i - 1].s - 1e-3) errs.push(`word ${i} "${w.w}" moves backward (${w.s} < ${words[i - 1].s})`);
    if (w.e > audioDur + 0.05) errs.push(`word ${i} "${w.w}" ends past audio (${w.e.toFixed(2)} > ${audioDur.toFixed(2)})`);
    for (const [a, b] of silences) {
      const ov = Math.min(w.e, b) - Math.max(w.s, a);
      if (ov > maxTol && w.s < a && w.e > b) {
        errs.push(`word ${i} "${w.w}" (${w.s.toFixed(2)}-${w.e.toFixed(2)}) straddles silence ${a.toFixed(2)}-${b.toFixed(2)}`);
      }
    }
  });

  tl.chunks.forEach((c, ci) => {
    for (const [a, b] of silences) {
      if (c.s >= a - 0.01 && c.s < b - maxTol) {
        const lead = (b - c.s).toFixed(2);
        errs.push(`chunk ${ci} ("${c.words.map((w) => w.w).join(" ")}") starts ${lead}s in silence (${c.s.toFixed(2)} < speech ${b.toFixed(2)})`);
      }
    }
  });

  return errs;
};
