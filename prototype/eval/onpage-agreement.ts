// Usage: node --env-file=.env eval/onpage-agreement.ts <dev|test>
// Runs the on-page answer check (runners/seo-geo/answer-check.ts) on the saved openings
// (eval/onpage/openings.local.json, built by eval/onpage/build-openings.ts) and compares it with blind labels
// (eval/onpage/labels-v1-<split>.json). Gate: >= 90% exact agreement on yes/partial/no.
// Tune only on dev. The test set is for the final number.
import { readFileSync } from "node:fs";
import { ANSWER_MODEL, judgeOpening } from "../runners/seo-geo/answer-check.ts";

const split = process.argv[2];
if (split !== "dev" && split !== "test") throw new Error("usage: onpage-agreement.ts <dev|test>");
const openings: { id: string; url: string; question: string; opening: string }[] = JSON.parse(readFileSync(new URL("./onpage/openings.local.json", import.meta.url), "utf8"));
const labels: { id: string; verdict: "yes" | "partial" | "no" }[] = JSON.parse(readFileSync(new URL(`./onpage/labels-v1-${split}.json`, import.meta.url), "utf8"));

let cost = 0, exact = 0, yesAgree = 0;
const confusion: Record<string, Record<string, number>> = {};
const issues: string[] = [];
const results = await Promise.all(labels.map(async l => {
  const o = openings.find(x => x.id === l.id);
  if (!o) throw new Error(`label ${l.id} has no saved opening; rebuild openings or relabel`);
  const r = await judgeOpening(o.question, o.opening);
  return { l, o, r };
}));
for (const { l, o, r } of results) {
  cost += r.cost_usd;
  const v = r.answer.verdict;
  (confusion[l.verdict] ??= {})[v] = (confusion[l.verdict][v] ?? 0) + 1;
  if (v === l.verdict) exact++;
  else issues.push(`${l.id} ${new URL(o.url).hostname} (${o.question}): label=${l.verdict} judge=${v}`);
  if ((v === "yes") === (l.verdict === "yes")) yesAgree++;
}
const n = labels.length, pct = (a: number) => `${((100 * a) / n).toFixed(1)}%`;
console.log(`${split}: ${n} openings | judge ${ANSWER_MODEL} | exact agreement ${pct(exact)} (${exact}/${n}) | yes-vs-not agreement ${pct(yesAgree)} | $${cost.toFixed(4)}`);
console.log("  confusion (rows = label, cols = judge):");
for (const [lv, row] of Object.entries(confusion)) console.log(`    ${lv.padEnd(7)} ${Object.entries(row).map(([k, c]) => `${k} ${c}`).join(", ")}`);
for (const i of issues) console.log("  - " + i);
process.exit(exact / n >= 0.9 ? 0 : 1);
