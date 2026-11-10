// Entry point for the Paperclip `process` adapter (also runnable by hand).
// Usage: node runners/mastra/run.ts [--seed agent-workspace/seed/competitors.json] [--only id1,id2]
// Exit 0 only when the run succeeded and was reported; non-zero on partial or failed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RunOutput, FIELDS } from "../../packages/data-contracts/index.ts";
import { competitorResearch, costUsd, MODEL } from "./workflow.ts";
import { findIssue, paperclipEnabled, reportCost, reportToIssue } from "../../packages/paperclip-client/index.ts";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const root = new URL("../../", import.meta.url).pathname;
const seedPath = join(root, arg("--seed") ?? "agent-workspace/seed/competitors.json");
const only = arg("--only")?.split(",");

const runId = process.env.PAPERCLIP_RUN_ID ?? `local-${randomUUID()}`;
const outDir = join(root, "research/runs", runId);
const started = new Date().toISOString();
const t0 = Date.now();

let issue: { id: string; identifier?: string } | null = null;
let exitCode = 1;
try {
  if (paperclipEnabled()) issue = await findIssue();
  let competitors = JSON.parse(readFileSync(seedPath, "utf8"));
  if (only) competitors = competitors.filter((c: { id: string }) => only.includes(c.id));

  const run = await competitorResearch.createRun();
  const res = await run.start({ inputData: competitors });
  if (res.status !== "success") throw new Error(`workflow ${res.status}: ${JSON.stringify((res as any).error ?? res).slice(0, 500)}`);
  const { researched, recommendations, usage: recUsage, dropped_recs } = res.result;

  const sources: any[] = [];
  const observations: any[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  for (const r of researched) {
    errors.push(...r.errors);
    notes.push(...r.downgraded.map(d => `downgraded ${r.competitor.id}.${d}`), ...r.injection_notes.map(n => `possible prompt injection (${r.competitor.id}): ${n}`));
    const idFor = new Map<string, string>();
    r.pages.filter(p => p.ok).forEach((p, i) => { const id = `${r.competitor.id}-${i + 1}`; idFor.set(p.url, id); sources.push({ id, url: p.url, retrieved_at: p.retrieved_at, title: p.title || undefined }); });
    for (const o of r.observations)
      observations.push({ competitor_id: r.competitor.id, field: o.field, value: o.value, status: o.status, source_id: o.source_url ? idFor.get(o.source_url) ?? null : null, evidence: o.evidence, channel: o.field.startsWith("price_") ? o.channel : undefined });
  }
  notes.push(...dropped_recs.map(t => `dropped recommendation citing unverified observations: ${t}`));

  const usage = [...researched.map(r => r.usage), recUsage].reduce((a, u) => ({ input_tokens: a.input_tokens + u.input_tokens, output_tokens: a.output_tokens + u.output_tokens }), { input_tokens: 0, output_tokens: 0 });
  const homepageFailures = researched.filter(r => !r.pages[0]?.ok).length;
  const status = homepageFailures === 0 ? "succeeded" : homepageFailures < researched.length ? "partial" : "failed";
  const output = {
    run: { run_id: runId, runner: "mastra", model: MODEL.replace("anthropic/", ""), started_at: started, finished_at: new Date().toISOString(), status,
      paperclip: { issue_id: issue?.id ?? null, run_id: process.env.PAPERCLIP_RUN_ID ?? null }, errors: [...errors, ...notes],
      usage: { ...usage, cost_usd: Number(costUsd(usage).toFixed(4)) } },
    competitors: researched.map(r => r.competitor),
    sources, observations,
    recommendations: recommendations.map(r => ({ ...r, status: "hypothesis" as const })),
  };
  const parsed = RunOutput.safeParse(output);
  if (!parsed.success) throw new Error("output failed contract: " + parsed.error.issues.slice(0, 5).map(i => `${i.path.join(".")}: ${i.message}`).join("; "));

  mkdirSync(join(outDir, "snapshots"), { recursive: true });
  for (const [k, v] of Object.entries(output)) writeFileSync(join(outDir, `${k}.json`), JSON.stringify(v, null, 2) + "\n");
  writeFileSync(join(outDir, "report.md"), report(output, Date.now() - t0));

  const v = observations.filter(o => o.status === "verified").length;
  const summary = `Mastra run ${runId}: ${status}. ${observations.length} observations (${v} verified, ${observations.length - v} unknown), ` +
    `${notes.filter(n => n.startsWith("downgraded")).length} claims downgraded for evidence not found on page, ${recommendations.length} recommendations. ` +
    `Cost $${output.run.usage.cost_usd} (${usage.input_tokens} in / ${usage.output_tokens} out tokens), ${Math.round((Date.now() - t0) / 1000)}s. Output: prototype/research/runs/${runId}/` +
    (errors.length ? `\nErrors:\n- ${errors.join("\n- ")}` : "");
  console.log(summary);
  if (paperclipEnabled()) await reportCost(issue?.id ?? null, MODEL.replace("anthropic/", ""), usage, output.run.usage.cost_usd)
    .catch(err => console.error("could not report cost:", err.message));
  if (issue) await reportToIssue(issue.id, summary, status === "succeeded" ? "done" : "blocked");
  exitCode = status === "succeeded" ? 0 : 2;
} catch (e) {
  const msg = `Mastra run ${runId} FAILED: ${(e as Error).message}`;
  console.error(msg);
  if (issue) await reportToIssue(issue.id, msg, "blocked").catch(err => console.error("could not report failure:", err.message));
  exitCode = 1;
}
process.exit(exitCode);

function report(o: any, ms: number): string {
  const cell = (c: string, f: string) => {
    const x = o.observations.find((x: any) => x.competitor_id === c && x.field === f);
    if (!x || x.status !== "verified") return "?";
    return String(x.value) + (x.channel === "mac_app_store" ? " (App Store)" : "");
  };
  const cols = ["pricing_model", "price_one_time_usd", "price_annual_usd", "distribution", "feature_cleanup", "feature_uninstall", "feature_disk_map", "feature_duplicates"] satisfies (typeof FIELDS[number])[];
  const v = o.observations.filter((x: any) => x.status === "verified").length;
  return [
    `# Research run ${o.run.run_id} (Mastra, ${o.run.model})`, "",
    `Status: ${o.run.status}. Observations: ${o.observations.length} (verified ${v}, unknown ${o.observations.length - v}). Every verified value's evidence was checked in code against the fetched page text. Cost $${o.run.usage.cost_usd}, ${Math.round(ms / 1000)}s.`, "",
    `| Competitor | ${cols.join(" | ")} |`, `|---|${cols.map(() => "---").join("|")}|`,
    ...o.competitors.map((c: any) => `| [${c.name}](${c.website}) | ${cols.map(f => cell(c.id, f)).join(" | ")} |`), "",
    "## Recommendations (hypotheses)", ...o.recommendations.map((r: any) => `- **${r.title}**: ${r.rationale}`), "",
    "## Errors and notes", ...(o.run.errors.length ? o.run.errors.map((e: string) => `- ${e}`) : ["- none"]), "",
  ].join("\n");
}
