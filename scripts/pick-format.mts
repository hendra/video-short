/**
 * Pick one weighted, current short-form format at random.
 *   npx tsx scripts/pick-format.mts [--account <id>]
 * Prints JSON consumed by the agent before writing naskah.txt.
 * The pool is per account: Kali Aja keeps its promotion-format mix; AI Labs and Cerpenek have their own.
 */
import { randomInt } from "node:crypto";
import { pathToFileURL } from "node:url";
import { ACCOUNT_IDS, DEFAULT_ACCOUNT, isAccountId, type AccountId } from "../src/accounts.ts";

export type Format = {
  id: string;
  weight: number;
  name: string;
  instruction: string;
};

// Weights follow 2026 YouTube Shorts / TikTok short-form research: expert explainers lead,
// listicles and story arcs retain well, Q&A/challenges earn comments.
const KALI_AJA: Format[] = [
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

// AI Labs: prompting and tool-comparison lead — the audience wants one usable thing they
// can copy, not a story about the industry.
const AI_LABS: Format[] = [
  { id: "prompt-recipe", weight: 3, name: "Prompt Recipe", instruction: "open with the result being promised; split the prompt into three parts (role, context, constraint); show before/after briefly; close with a template the viewer can copy." },
  { id: "tool-compare", weight: 2, name: "Tool Compare", instruction: "compare two tools or features for one task; one is used, one is not; evidence from the official docs; close with a recommendation per situation." },
  { id: "edit-photo-before-after", weight: 2, name: "Edit Photo Before → After", instruction: "open with the embarrassing before photo; show the edit result; name the three decisions that made the difference (light, colour, detail); close with one change to try tonight." },
  { id: "debug-postmortem", weight: 2, name: "Debug Postmortem", instruction: "open with the error that made you stuck; narrow it to three hypotheses; name the one that was right and why; close with how to keep it from happening again." },
  { id: "plugin-teardown", weight: 2, name: "Plugin Teardown", instruction: "open with one plugin going viral; take it apart from manifest to actions; name two things to check before installing; close with when it is worth installing and when not." },
  { id: "workflow-speedrun", weight: 2, name: "Workflow Speedrun", instruction: "open with one boring recurring task; do it start to finish on camera; say the time saved; close with the trap that breaks this workflow." },
  { id: "pitfall-callout", weight: 1, name: "Pitfall Callout", instruction: "open with a setting that looks correct; show how it is silently wrong; two quick checks to prove it; close with the one line that is actually right." },
  { id: "feature-drop", weight: 1, name: "Feature Drop", instruction: "announce one new feature that matters; one sentence that says exactly what changed; three things worth trying; close with the honest limit." },
  { id: "screen-rebuild", weight: 1, name: "Screen Rebuild", instruction: "open with the screen you want; rebuild it from a single instruction to the AI; show the intermediate result; close with the exact instruction used." },
  { id: "one-liner", weight: 1, name: "One-Liner", instruction: "open with one question nobody asks; answer it with one sharp sentence; show the proof in two lines; close with the key line worth writing down." },
];

// Cerpenek: stories told by "Nenek" to children aged 5–10. Every format is a story arc that ends
// on one clear lesson — no explainer, listicle or tutorial frameworks.
const CERPENEK: Format[] = [
  { id: "dongeng-klasik", weight: 3, name: "Dongeng Klasik", instruction: "introduce one character and their place; give them a wish or a problem; show the choice they make; show what happens because of it; close with one gentle lesson." },
  { id: "asal-usul-tempat", weight: 3, name: "Asal-Usul Tempat", instruction: "open on a real place children can visit today; say 'kata orang dulu…'; tell the legend of how it came to be; return to the place as it is now; close with one gentle lesson." },
  { id: "tokoh-sejarah", weight: 2, name: "Tokoh Sejarah", instruction: "one real historical figure and one moment of courage or kindness; only facts found in the source; say when and where simply; close with what children can imitate." },
  { id: "tebak-dulu", weight: 2, name: "Tebak Dulu", instruction: "Nenek asks one riddle-like question; let the child wonder for a beat; tell the story that answers it; repeat the answer plainly; close with one gentle lesson." },
  { id: "kenapa-begitu", weight: 2, name: "Kenapa Begitu", instruction: "start from something children notice (an animal's shape, a rock, a lake, a custom); tell the old story people tell to explain it, clearly as a legend; close with one gentle lesson." },
  { id: "sahabat-hewan", weight: 2, name: "Sahabat Hewan", instruction: "a person and an animal helper from a regional legend; show how they meet; one kindness given and one returned; close with one gentle lesson about caring for others." },
  { id: "asal-usul-benda", weight: 1, name: "Asal-Usul Benda", instruction: "one regional food, game, cloth or instrument; where the story says it came from; how people still use it today; invite the child to try or look for it." },
];

export const FORMATS_BY_ACCOUNT: Record<AccountId, Format[]> = {
  "kali-aja": KALI_AJA,
  "ai-labs": AI_LABS,
  cerpenek: CERPENEK,
};

export const formatsFor = (accountId: AccountId | string = DEFAULT_ACCOUNT): Format[] => {
  if (!isAccountId(accountId)) throw new Error(`Unknown account "${accountId}". Valid accounts: ${ACCOUNT_IDS.join(", ")}`);
  return FORMATS_BY_ACCOUNT[accountId];
};

export const pickFormat = (accountId: AccountId | string = DEFAULT_ACCOUNT, roll?: number): Format => {
  const pool = formatsFor(accountId);
  const totalWeight = pool.reduce((sum, format) => sum + format.weight, 0);
  const resolvedRoll = roll ?? randomInt(totalWeight) / totalWeight;
  if (!Number.isFinite(resolvedRoll) || resolvedRoll < 0 || resolvedRoll >= 1) throw new Error(`roll must be in [0, 1), got ${resolvedRoll}`);
  let cursor = resolvedRoll * totalWeight;
  for (const format of pool) {
    cursor -= format.weight;
    if (cursor < 0) return format;
  }
  return pool[pool.length - 1];
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const inline = args.find((a) => a.startsWith("--account="));
  const idx = args.indexOf("--account");
  const accountId = inline ? inline.slice("--account=".length) : idx >= 0 ? args[idx + 1] : DEFAULT_ACCOUNT;
  try {
    console.log(JSON.stringify(pickFormat(accountId), null, 2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
