// Funnel analyst (wave 1, agent #4): weekly visits → signups → download starts → app first launch/scan/cleanup → purchases,
// from AGGREGATE counts only. Code computes every number; Sonnet writes the summary and one experiment, and any number
// in its text that isn't in the computed table rejects the text.
//
// Input: one CSV `week,step,dim,value,count` (docs/funnel-export.md says how to export it). Until read-only keys exist
// (owner), the owner drops the file in research/marketing/funnel/ (git-ignored: these are the business's own numbers).
//   node runners/marketing/funnel.ts research/marketing/funnel/2026-11-09.csv [--week 2026-11-09] [--no-model]
import { readFileSync, writeFileSync } from "node:fs";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { FunnelReport, FunnelRow, FunnelStep } from "../../packages/data-contracts/marketing.ts";
import { findIssue, getIssueText, paperclipEnabled, reportCost, reportToIssue } from "../../packages/paperclip-client/index.ts";

export const FUNNEL_MODEL = process.env.FUNNEL_MODEL ?? "anthropic/claude-sonnet-5-5";
const PRICE: Record<string, [number, number]> = { "anthropic/claude-sonnet-5-5": [2e-6, 10e-6] };
export const MIN_SAMPLE = 30;
const PERSONAL = /e-?mail|\bip\b|ip_?address|name|customer|install_?id|token|session|phone|address|user_?id|cus_|@/i;

/** Parses the aggregate CSV. Refuses any column or value that could identify a person. */
export function parseFunnelCsv(csv: string): FunnelRow[] {
  const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(",").map(h => h.trim());
  if (header.join(",") !== "week,step,dim,value,count") {
    const bad = header.filter(h => PERSONAL.test(h));
    throw new Error(bad.length ? `refusing personal columns: ${bad.join(", ")}` : `header must be week,step,dim,value,count (got ${header.join(",")})`);
  }
  return lines.slice(1).map((l, i) => {
    const [week, step, dim, value, count] = l.split(",").map(s => s.trim());
    if (PERSONAL.test(value) && dim !== "page") throw new Error(`row ${i + 2}: value looks personal`);
    return FunnelRow.parse({ week, step, dim, value, count: Number(count) });
  });
}

const ORDER = FunnelStep.options;
const rate = (a: number, b: number) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null); // percent, one decimal

/** Everything numeric, computed in code. */
export function analyzeWeek(rows: FunnelRow[], week: string): Omit<FunnelReport, "summary" | "experiment" | "model" | "cost_usd"> {
  const w = rows.filter(r => r.week === week);
  const total = (step: string) => w.filter(r => r.step === step && r.dim === "all").reduce((s, r) => s + r.count, 0);
  const present = ORDER.filter(s => w.some(r => r.step === s && r.dim === "all"));
  const steps = present.map((step, i) => ({ step, count: total(step), from_previous: i ? rate(total(step), total(present[i - 1])) : null }));
  let biggest: FunnelReport["biggest_drop"] = null;
  for (let i = 1; i < steps.length; i++) {
    const r = steps[i].from_previous;
    if (r !== null && (!biggest || r < biggest.rate)) biggest = { from: steps[i - 1].step, to: steps[i].step, rate: r };
  }
  const segments: FunnelReport["segments"] = [];
  for (const r of w.filter(r => r.step === "signups" && r.dim !== "all")) {
    const p = w.find(x => x.step === "purchases" && x.dim === r.dim && x.value === r.value);
    segments.push({ dim: r.dim, value: r.value, signups: r.count, purchases: p ? p.count : null, rate: p ? rate(p.count, r.count) : null });
  }
  segments.sort((a, b) => b.signups - a.signups);
  return { week, steps, biggest_drop: biggest, segments, low_sample: total("signups") < MIN_SAMPLE };
}

/** Numbers the text may use: counts, rates, and small counts like "3 Macs" or "2 weeks". */
export function allowedNumbers(a: ReturnType<typeof analyzeWeek>): Set<string> {
  const s = new Set<string>();
  const add = (n: number | null) => { if (n !== null) { s.add(String(n)); s.add(n.toLocaleString("en-US")); } };
  for (const x of a.steps) { add(x.count); add(x.from_previous); }
  for (const x of a.segments) { add(x.signups); add(x.purchases); add(x.rate); }
  if (a.biggest_drop) add(a.biggest_drop.rate);
  for (const x of [...a.week.split("-"), "29.99", "19.99", "51", String(MIN_SAMPLE)]) s.add(x.replace(/^0/, "")), s.add(x); // the date, the fixed prices
  return s;
}
export function strayNumbers(text: string, allowed: Set<string>): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(m => m[0].replace(/,$/, "")).filter(n => Number(n.replace(/,/g, "")) > 12 && !allowed.has(n) && !allowed.has(n.replace(/,/g, "")));
}

const Out = z.object({ summary: z.string(), experiment: z.object({ hypothesis: z.string(), change: z.string(), metric: z.string(), min_weeks: z.number().int().positive() }) });

const INSTRUCTIONS = `You analyse one week of CacheDrop's website funnel (a Mac storage cleaner sold for a one-time price; download gated by email; try before you buy).
You get a table computed in code. Write:
- summary: 3–5 plain sentences: the biggest drop-off, the segments that differ, what changed. Use ONLY numbers from the table, copied exactly; don't compute new ones.
- experiment: ONE experiment on the biggest drop-off: hypothesis, the change (copy or layout on cachedrop.io, within the site's rules: no "free" in headlines or buttons, price $29.99 with $19.99 limited-time, no major redesign), the metric, and how many weeks to run it given the volumes.
Button labels are fixed by website Decision 51 ("Download for Mac", "Buy · $29.99 once", "Email Me the Link" on the form): if the experiment changes one, say it needs that decision amended.
If low_sample is true, say the numbers are too small to conclude anything and make the experiment a measurement fix or a low-risk copy test.
Download starts and app events are totals that don't link to individual signups; never call them conversion of a specific signup.`;

export async function writeReport(a: ReturnType<typeof analyzeWeek>): Promise<FunnelReport> {
  const agent = new Agent({ id: "funnel-analyst", name: "funnel-analyst", model: FUNNEL_MODEL, instructions: INSTRUCTIONS });
  const [pi, po] = PRICE[FUNNEL_MODEL] ?? [0, 0];
  let cost = 0;
  const allowed = allowedNumbers(a);
  let extra = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await agent.generate(`=== TABLE ===\n${JSON.stringify(a, null, 1)}${extra}`, { structuredOutput: { schema: Out }, maxSteps: 1 });
    cost += (r.usage?.inputTokens ?? 0) * pi + (r.usage?.outputTokens ?? 0) * po;
    const stray = strayNumbers(`${r.object.summary} ${r.object.experiment.hypothesis} ${r.object.experiment.change} ${r.object.experiment.metric}`, allowed);
    if (!stray.length) return FunnelReport.parse({ ...a, ...r.object, model: FUNNEL_MODEL, cost_usd: Number(cost.toFixed(5)) });
    console.error(`funnel text rejected (attempt ${attempt + 1}): numbers not in the table: ${stray.join(", ")}`);
    extra = `\n\nYour last answer used numbers not in the table: ${stray.join(", ")}. Use only the table's numbers.`;
  }
  return FunnelReport.parse({ ...a, summary: null, experiment: null, model: FUNNEL_MODEL, cost_usd: Number(cost.toFixed(5)) }); // numbers never checked out: show the table only
}

export function formatFunnel(r: FunnelReport): string {
  const t = r.steps.map(s => `| ${s.step} | ${s.count} | ${s.from_previous === null ? "" : `${s.from_previous}%`} |`);
  const seg = r.segments.map(s => `| ${s.dim}=${s.value} | ${s.signups} | ${s.purchases ?? "n/a"} | ${s.rate === null ? "n/a" : `${s.rate}%`} |`);
  return [`# Funnel, week of ${r.week}`, r.low_sample ? `\nFewer than ${MIN_SAMPLE} signups: too small to conclude anything.\n` : "",
    "| Step | Count | From previous |", "|---|---|---|", ...t, "",
    r.biggest_drop ? `Biggest drop: ${r.biggest_drop.from} → ${r.biggest_drop.to} (${r.biggest_drop.rate}%).` : "",
    seg.length ? ["", "| Segment | Signups | Purchases | Rate |", "|---|---|---|---|", ...seg].join("\n") : "",
    r.summary ? `\n${r.summary}` : "", r.experiment ? `\n**Experiment.** ${r.experiment.hypothesis} Change: ${r.experiment.change} Metric: ${r.experiment.metric} Run for at least ${r.experiment.min_weeks} week(s).` : "",
  ].filter(Boolean).join("\n");
}

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  let issue: { id: string } | null = null;
  let path = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : undefined;
  let week = arg("--week");
  if (paperclipEnabled()) { issue = await findIssue(); if (issue) { const t = await getIssueText(issue.id); path ??= t.match(/csv:\s*(\S+)/)?.[1]; week ??= t.match(/week:\s*(\S+)/)?.[1]; } }
  try {
    if (!path) throw new Error("no input: pass the aggregate CSV or put `csv: <path>` in the issue");
    const rows = parseFunnelCsv(readFileSync(path, "utf8"));
    week ??= [...new Set(rows.map(r => r.week))].sort().at(-1)!;
    const a = analyzeWeek(rows, week);
    const report = process.argv.includes("--no-model") ? FunnelReport.parse({ ...a, summary: null, experiment: null, model: null, cost_usd: 0 }) : await writeReport(a);
    const md = formatFunnel(report);
    const out = arg("--out") ?? path.replace(/\.csv$/, `.report-${week}.md`);
    writeFileSync(out, md + "\n");
    console.log(md);
    if (issue) {
      if (report.cost_usd) await reportCost(issue.id, FUNNEL_MODEL, { input_tokens: 0, output_tokens: 0 }, report.cost_usd);
      await reportToIssue(issue.id, md, "done");
    }
  } catch (e) {
    if (issue) await reportToIssue(issue.id, `Funnel analysis failed: ${(e as Error).message}`, "blocked");
    throw e;
  }
}

if (import.meta.main) await main();
