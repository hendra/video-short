/**
 * Pick one weighted, current short-form format at random.
 *   npx tsx scripts/pick-format.mts
 * Prints JSON consumed by the agent before writing naskah.txt.
 */
import { randomInt } from "node:crypto";
import { pathToFileURL } from "node:url";

export type Format = {
  id: string;
  weight: number;
  name: string;
  instruction: string;
};

// Weights follow 2026 YouTube Shorts / TikTok short-form research: expert explainers lead,
// listicles and story arcs retain well, Q&A/challenges earn comments.
export const FORMATS: Format[] = [
  { id: "expert-explainer", weight: 3, name: "Expert Explainer", instruction: "authority hook with a verified number/fact; 1–3 mechanism steps; one everyday analogy; takeaway, not a mystery tag every time." },
  { id: "numbered-listicle", weight: 2, name: "Numbered Listicle", instruction: "promise a count in the hook; 3 evidence-backed points; visual/scale payoff per point; final ranking or punchline." },
  { id: "myth-buster", weight: 2, name: "Myth-Buster", instruction: "open with the common misconception; separate what people repeat from what the evidence shows; explain why the myth survives; state the corrected version." },
  { id: "mystery-story", weight: 2, name: "Mystery / Curiosity", instruction: "one impossible or counter-intuitive fact; reveal clues in order; answer why; do not use the stock phrase \"Tapi tunggu… kok bisa…?\"." },
  { id: "before-after", weight: 2, name: "Before → After", instruction: "start with the viewer's default assumption; flip it with evidence; show the mechanism; end with the changed mental model." },
  { id: "how-to-tutorial", weight: 2, name: "How-To / Step-by-Step", instruction: "promise one concrete result; show three ordered steps with the key mistake to avoid; make the final step the reveal." },
  { id: "storytime", weight: 1, name: "Storytime", instruction: "open with a turning point; tell only the facts that change the stakes; land on the lesson or consequence." },
  { id: "qa-rapid", weight: 1, name: "Rapid Q&A", instruction: "ask the question viewers ask; answer two tempting wrong options briefly; explain the right answer; connect it to Indonesia." },
  { id: "viewer-challenge", weight: 1, name: "Viewer Challenge", instruction: "open with a real yes/no or estimate challenge; answer immediately; explain the decision rule; never make the interaction empty engagement bait." },
  { id: "problem-solution", weight: 1, name: "Problem → Mechanism → Benefit", instruction: "name the concrete problem and who has it; show the mechanism; quantify the benefit and its limit; end with the practical implication." },
  { id: "mini-documentary", weight: 1, name: "Mini Documentary", instruction: "scene → turning point → consequence; three tight beats; keep the full arc complete and factual, not a list." },
];

export const TOTAL_WEIGHT = FORMATS.reduce((sum, format) => sum + format.weight, 0);

export const pickFormat = (roll: number = randomInt(TOTAL_WEIGHT) / TOTAL_WEIGHT): Format => {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error(`roll must be in [0, 1), got ${roll}`);
  let cursor = roll * TOTAL_WEIGHT;
  for (const format of FORMATS) {
    cursor -= format.weight;
    if (cursor < 0) return format;
  }
  return FORMATS[FORMATS.length - 1];
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(pickFormat(), null, 2));
}
