// Eval gate for the claims reviewer: planted violations written independently (eval/claims/cases.json).
//   node eval/claims-agreement.ts dev|test [--no-model]
// Split by sha256(id): even first byte = dev, odd = test. Tune on dev only; report test.
// Gate (proposal): recall of planted violations >= 90% and clean cases passing >= 90%.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { Draft, Rule } from "../packages/data-contracts/marketing.ts";
import { CLAIMS_MODEL, loadFacts, reviewDraft } from "../runners/marketing/claims-review.ts";

const Case = z.object({ id: z.string(), locale: z.enum(["en-US", "fr-FR", "de-DE"]), page_kind: z.string(), text: z.string(), expected: z.array(Rule), note: z.string().optional() });
const split = process.argv[2];
if (split !== "dev" && split !== "test") throw new Error("usage: claims-agreement.ts dev|test [--no-model]");
const useModel = !process.argv.includes("--no-model");
const cases = z.array(Case).parse(JSON.parse(readFileSync(new URL("./claims/cases.json", import.meta.url), "utf8")))
  .filter(c => (createHash("sha256").update(c.id).digest()[0] % 2 === 0) === (split === "dev"));
const facts = loadFacts();

let planted = 0, caught = 0, clean = 0, cleanPass = 0, extraBlocks = 0, cost = 0, unverified = 0;
const rows: unknown[] = [];
const results = await Promise.all(cases.map(c => reviewDraft(Draft.parse({ ...c, target_url: null, query_ids: [] }), facts, { model: useModel }).then(r => ({ c, ...r }))));
for (const { c, review, unverified: u } of results) {
  cost += review.cost_usd; unverified += u;
  const got = new Set(review.findings.map(f => f.rule));
  const missed = c.expected.filter(r => !got.has(r));
  const extra = review.findings.filter(f => f.severity === "block" && !c.expected.includes(f.rule));
  if (c.expected.length === 0) { clean++; if (!review.findings.some(f => f.severity === "block")) cleanPass++; }
  planted += c.expected.length; caught += c.expected.length - missed.length; extraBlocks += extra.length;
  if (missed.length || extra.length) rows.push({ id: c.id, note: c.note, missed, extra: extra.map(f => `${f.rule} (${f.source}): ${f.quote}`) });
}
const pct = (a: number, b: number) => b ? Math.round((1000 * a) / b) / 10 : 100;
const summary = {
  split, model: useModel ? CLAIMS_MODEL : null, facts: facts.as_of, cases: cases.length,
  recall: `${caught}/${planted} (${pct(caught, planted)}%)`, clean_pass: `${cleanPass}/${clean} (${pct(cleanPass, clean)}%)`,
  extra_blocks_on_violating_cases: extraBlocks, model_quotes_dropped: unverified, cost_usd: Number(cost.toFixed(4)),
  gate: pct(caught, planted) >= 90 && pct(cleanPass, clean) >= 90 ? "pass" : "fail", disagreements: rows,
};
console.log(JSON.stringify(summary, null, 2));
if (useModel) writeFileSync(new URL(`./claims/results-${split}.json`, import.meta.url), JSON.stringify(summary, null, 2) + "\n");
