// Keyword tracker (plan Q7/Q14): Google top 10 for every keyword in the frozen query set, via Serper.
// Own positions come from the SERP (cachedrop.io in the top 10). Search Console positions are added after
// cachedrop-website #96. Search volume (DataForSEO) is deferred by the owner.
// Usage: node --env-file=.env runners/seo-geo/keywords.ts [--only "uninstall vst mac,mac cleaner"] [--gl us] [--hl en]
// Cost: 1 Serper credit per keyword (48 for query set v1; 2,500 free credits).
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { KeywordResult, QuerySet } from "../../packages/data-contracts/seo-geo.ts";
import { findIssue, paperclipEnabled, reportCost, reportToIssue } from "../../packages/paperclip-client/index.ts";
import { diffRuns, keywordsFrom, parseSerp, summarize } from "./keyword-checks.ts";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const root = new URL("../../", import.meta.url).pathname;
const set = QuerySet.parse(JSON.parse(readFileSync(join(root, arg("--set") ?? "research/seo-geo/query-sets/v1.json"), "utf8")));
if (!set.approved_by) throw new Error("query set is a draft; only approved (frozen) sets can be tracked");
const gl = arg("--gl") ?? "us", hl = arg("--hl") ?? "en";
const only = arg("--only")?.split(",").map(s => s.trim().toLowerCase());
const keywords = keywordsFrom(set).filter(k => !only || only.includes(k.keyword));

const runId = process.env.PAPERCLIP_RUN_ID ?? `local-${randomUUID().slice(0, 8)}`;
const outDir = join(root, "research/seo-geo/keyword-runs", runId);
const t0 = Date.now();
let credits = 0;
let issue: { id: string } | null = null;
let exitCode = 1;

async function serper(q: string) {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY is not set (run with --env-file=.env)");
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ q, gl, hl, num: 10 }), signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  credits += json.credits ?? 1;
  return json;
}

try {
  if (paperclipEnabled()) issue = await findIssue();
  const results: KeywordResult[] = [];
  for (const kw of keywords) {
    try { results.push(parseSerp(await serper(kw.keyword), kw, gl, hl)); }
    catch (e) { results.push(KeywordResult.parse({ ...kw, checked_at: new Date().toISOString(), engine: "google", gl, hl, results: [], own_position: null, related_searches: [], error: (e as Error).message.slice(0, 300) })); }
  }
  const summary = { run_id: runId, query_set_version: set.version, gl, hl, ...summarize(results), serper_credits: credits, cost_usd: 0, seconds: Math.round((Date.now() - t0) / 1000) };

  // Diff against the previous full run on the same query set, country and language.
  const runsDir = join(root, "research/seo-geo/keyword-runs");
  const prevDir = existsSync(runsDir) ? readdirSync(runsDir).filter(d => d !== runId && existsSync(join(runsDir, d, "summary.json")))
    .map(d => ({ d, s: JSON.parse(readFileSync(join(runsDir, d, "summary.json"), "utf8")) }))
    .filter(x => x.s.query_set_version === set.version && x.s.gl === gl && x.s.hl === hl && x.s.keywords === keywordsFrom(set).length && x.s.failed < x.s.keywords / 5)
    .sort((a, b) => (a.s.finished_at < b.s.finished_at ? 1 : -1))[0]?.d : undefined;
  const delta = prevDir && keywords.length === keywordsFrom(set).length
    ? { previous_run: prevDir, changes: diffRuns(JSON.parse(readFileSync(join(runsDir, prevDir, "results.json"), "utf8")), results) } : null;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "results.json"), JSON.stringify(results, null, 2) + "\n");
  writeFileSync(join(outDir, "summary.json"), JSON.stringify({ ...summary, delta, finished_at: new Date().toISOString() }, null, 2) + "\n");
  const top = (o: Record<string, number>, n: number) => Object.entries(o).slice(0, n).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
  const headline = [
    `Keyword run ${runId} (query set v${set.version}, Google ${gl}/${hl}): cachedrop.io in the top 10 for ${summary.own.ranked}/${summary.keywords - summary.failed} keywords (top 3: ${summary.own.top3}).`,
    `Tracked products ranking (keywords): ${top(Object.fromEntries(Object.entries(summary.brands_in_top10).filter(([b]) => b !== "cachedrop")), 6)}.`,
    `Most frequent domains: ${top(summary.domains_in_top10, 8)}.`,
    delta ? `Since ${delta.previous_run}: ${delta.changes.length} changes.` : "No previous full run.",
    `${credits} Serper credits, ${summary.seconds}s, ${summary.failed} failed. Output: prototype/research/seo-geo/keyword-runs/${runId}/`,
  ].join("\n");
  const rows = results.map(r => `| ${r.keyword} | ${r.query_ids.join(", ")} | ${r.error ? `error: ${r.error}` : r.own_position ?? "–"} | ${r.results.slice(0, 3).map(x => x.domain).join(", ")} |`);
  writeFileSync(join(outDir, "report.md"), `# Keyword run ${runId}\n\n${headline}\n\n| Keyword | Queries | cachedrop.io | Top 3 domains |\n|---|---|---|---|\n${rows.join("\n")}\n${delta ? `\n## Changes since ${delta.previous_run}\n${delta.changes.map(c => `- ${c.keyword}: ${c.change}`).join("\n") || "- none"}\n` : ""}`);
  console.log(headline);
  const status = summary.failed === 0 ? "succeeded" : summary.failed < summary.keywords / 5 ? "partial" : "failed";
  // Serper's free tier costs $0; report it so Paperclip doesn't count the run as unpriced.
  if (paperclipEnabled()) await reportCost(issue?.id ?? null, "serper", { input_tokens: 0, output_tokens: 0 }, 0).catch(e => console.error("cost report failed:", e.message));
  if (issue) await reportToIssue(issue.id, headline, status === "failed" ? "blocked" : "done");
  exitCode = status === "failed" ? 1 : 0;
} catch (e) {
  console.error("Keyword run FAILED:", (e as Error).message);
  if (issue) await reportToIssue(issue.id, `Keyword run failed: ${(e as Error).message}`, "blocked").catch(() => {});
}
process.exit(exitCode);
