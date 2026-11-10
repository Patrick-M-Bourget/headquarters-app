// GEO tracker: asks each engine every question in the frozen query set and labels CacheDrop's visibility.
// Usage: node runners/seo-geo/run-geo.ts [--locale en-US] [--version 1] [--set <path>] [--engines claude,gemini] [--only q01,q02]
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { EngineAnswer, Locale, Mention, QuerySet } from "../../packages/data-contracts/seo-geo.ts";
import { MARKETS, querySetPath } from "../../packages/data-contracts/markets.ts";
import { issueParams, paperclipEnabled, reportCost, reportToIssue } from "../../packages/paperclip-client/index.ts";
import { askClaude, askGemini, type EngineResult } from "./engines.ts";
import { labelAnswer, JUDGE_MODEL } from "./labels.ts";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const root = new URL("../../", import.meta.url).pathname;
// A relabel judges a saved run: its locale and version come from that run unless given (summaries before 5b: en-US).
// In Paperclip the issue text carries the parameters (`locale: fr-FR`); command-line flags win.
const pc = await issueParams();
const savedSummary = arg("--relabel") ? JSON.parse(readFileSync(join(root, arg("--relabel")!, "summary.json"), "utf8")) : {};
const set = QuerySet.parse(JSON.parse(readFileSync(join(root, arg("--set") ?? querySetPath(Locale.parse(arg("--locale") ?? pc.params.locale ?? savedSummary.locale ?? "en-US"), Number(arg("--version") ?? savedSummary.query_set_version ?? 1))), "utf8")));
if (!set.approved_by) throw new Error("query set is a draft; only approved (frozen) sets can be tracked");
const sameLocale = (s: { locale?: string }) => (s.locale ?? "en-US") === set.locale; // summaries before 5b have no locale: en-US
const engines = (arg("--engines") ?? "claude,gemini").split(",") as ("claude" | "gemini")[];
const only = arg("--only")?.split(",");
const queries = set.queries.filter(q => !only || only.includes(q.id));
// --relabel <run dir>: re-judge saved answers without asking the engines again (no engine cost).
const relabelDir = arg("--relabel");
const saved: any[] = relabelDir ? JSON.parse(readFileSync(join(root, relabelDir, "answers.json"), "utf8")) : [];
const JUDGE_PRICE: Record<string, [number, number]> = { "anthropic/claude-haiku-5-5": [0.1e-6, 0.5e-6], "anthropic/claude-sonnet-5-5": [2e-6, 10e-6] };

const runId = process.env.PAPERCLIP_RUN_ID ?? (relabelDir ? `relabel-${randomUUID().slice(0, 8)}` : `local-${randomUUID()}`);
const outDir = join(root, "research/seo-geo/geo-runs", runId);
const t0 = Date.now();
let issue: { id: string } | null = null;
let exitCode = 1;

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } }));
  return out;
}

try {
  issue = pc.issue;
  const jobs = queries.flatMap(q => engines.map(engine => ({ q, engine })));
  const results = await pool(jobs, 3, async ({ q, engine }) => {
    const prior = saved.find(a => a.query_id === q.id && a.engine === engine);
    const r: EngineResult = prior ? { answer_text: prior.answer_text, cited_urls: prior.cited_urls, model: prior.model, cost_usd: 0, input_tokens: 0, output_tokens: 0, searches: 0, error: prior.error }
      : engine === "claude" ? await askClaude(q.text, MARKETS[set.locale].country) : await askGemini(q.text);
    const answer = EngineAnswer.parse({ locale: set.locale, query_id: q.id, query_set_version: set.version, engine, model: r.model, asked_at: prior?.asked_at ?? new Date().toISOString(), answer_text: r.answer_text, cited_urls: r.cited_urls, error: r.error });
    const j = r.error ? { labelled: [], usage: { input_tokens: 0, output_tokens: 0 }, unverified: [] as string[] } : await labelAnswer(r.answer_text, r.cited_urls);
    const rows = j.labelled.some(l => l.brand === "cachedrop") ? j.labelled
      // CacheDrop always gets a row, so "not mentioned" is recorded explicitly.
      : [{ brand: "cachedrop", name: "CacheDrop", position: null, stance: null, evidence: null, cited_own_site: r.cited_urls.some(u => u.includes("cachedrop.io")) }, ...j.labelled];
    const mentions = rows.map(l => Mention.parse({ query_id: q.id, engine, brand: l.brand, mentioned: l.position !== null, recommended: l.position !== null && l.stance !== "mentioned" && l.stance !== null, stance: l.position !== null ? l.stance : null,
      position: l.position, cited_own_site: l.cited_own_site, evidence: l.position !== null ? l.evidence : null }));
    const [pi, po] = JUDGE_PRICE[JUDGE_MODEL] ?? [0, 0];
    return { answer, mentions, cost: r.cost_usd + j.usage.input_tokens * pi + j.usage.output_tokens * po, searches: r.searches, unverified: j.unverified.map(u => `${q.id}/${engine}: ${u}`) };
  });

  const answers = results.map(r => r.answer);
  const mentions = results.flatMap(r => r.mentions);
  const errors = answers.filter(a => a.error).map(a => `${a.query_id}/${a.engine}: ${a.error}`);
  const cost = results.reduce((s, r) => s + r.cost, 0);
  const own = mentions.filter(m => m.brand === "cachedrop");
  const by = (k: "engine" | "audience") => {
    const groups = new Map<string, { n: number; mentioned: number; recommended: number; cited: number }>();
    for (const m of own) {
      const key = k === "engine" ? m.engine : set.queries.find(q => q.id === m.query_id)!.audience;
      const g = groups.get(key) ?? { n: 0, mentioned: 0, recommended: 0, cited: 0 };
      g.n++; g.mentioned += +m.mentioned; g.recommended += +m.recommended; g.cited += +m.cited_own_site; groups.set(key, g);
    }
    return Object.fromEntries(groups);
  };
  const competitorCounts: Record<string, number> = {};
  const topPicks: Record<string, number> = {};
  for (const m of mentions) if (m.brand !== "cachedrop" && m.stance === "top_pick") topPicks[m.brand] = (topPicks[m.brand] ?? 0) + 1;
  for (const m of mentions) if (m.brand !== "cachedrop" && m.recommended) competitorCounts[m.brand] = (competitorCounts[m.brand] ?? 0) + 1;
  const okAnswers = answers.length - errors.length;
  const summary = {
    run_id: runId, locale: set.locale, query_set_version: set.version, market_signals: { claude_country: MARKETS[set.locale].country, gemini: "question language only" }, engines, answers: answers.length, failed: errors.length,
    cachedrop: { mentioned: own.filter(m => m.mentioned).length, recommended: own.filter(m => m.recommended).length, top_pick: own.filter(m => m.stance === "top_pick").length, cited: own.filter(m => m.cited_own_site).length, of: okAnswers },
    by_engine: by("engine"), by_audience: by("audience"),
    competitors_top_pick: Object.fromEntries(Object.entries(topPicks).sort((a, b) => b[1] - a[1])),
    competitors_recommended: Object.fromEntries(Object.entries(competitorCounts).sort((a, b) => b[1] - a[1])),
    unverified_judgements: results.flatMap(r => r.unverified),
    cost_usd: Number(cost.toFixed(4)), searches: results.reduce((s, r) => s + r.searches, 0), seconds: Math.round((Date.now() - t0) / 1000), errors,
  };
  // Diff against the previous run on the same query set version.
  const runsDir = join(root, "research/seo-geo/geo-runs");
  const prev = existsSync(runsDir) ? readdirSync(runsDir).filter(d => d !== runId && !d.startsWith("relabel-") && existsSync(join(runsDir, d, "summary.json")))
    .map(d => JSON.parse(readFileSync(join(runsDir, d, "summary.json"), "utf8"))).filter(s => sameLocale(s) && s.query_set_version === set.version && s.answers === summary.answers && s.failed < s.answers / 5)
    .sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1))[0] : undefined;
  const delta = prev ? { previous_run: prev.run_id, mentioned: summary.cachedrop.mentioned - prev.cachedrop.mentioned, recommended: summary.cachedrop.recommended - prev.cachedrop.recommended, cited: summary.cachedrop.cited - prev.cachedrop.cited } : null;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "answers.json"), JSON.stringify(answers, null, 2) + "\n");
  writeFileSync(join(outDir, "mentions.json"), JSON.stringify(mentions, null, 2) + "\n");
  writeFileSync(join(outDir, "summary.json"), JSON.stringify({ ...summary, delta, finished_at: new Date().toISOString() }, null, 2) + "\n");
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");
  const text = [
    `GEO run ${runId} (${set.locale} query set v${set.version}, ${engines.join(" + ")}): CacheDrop recommended in ${summary.cachedrop.recommended}/${okAnswers} answers (${pct(summary.cachedrop.recommended, okAnswers)}), mentioned in ${summary.cachedrop.mentioned}, cachedrop.io cited in ${summary.cachedrop.cited}.`,
    delta ? `Since ${delta.previous_run}: recommended ${delta.recommended >= 0 ? "+" : ""}${delta.recommended}, mentioned ${delta.mentioned >= 0 ? "+" : ""}${delta.mentioned}, cited ${delta.cited >= 0 ? "+" : ""}${delta.cited}.` : "No previous run on this query set.",
    `Top picks: ${Object.entries(summary.competitors_top_pick).slice(0, 5).map(([b, n]) => `${b} ${n}`).join(", ") || "none"}. Most-suggested competitors: ${Object.entries(summary.competitors_recommended).slice(0, 5).map(([b, n]) => `${b} ${n}`).join(", ") || "none"}.`,
    `${summary.searches} searches, $${summary.cost_usd}, ${summary.seconds}s. ${errors.length} failed answers. Output: prototype/research/seo-geo/geo-runs/${runId}/`,
    ...(errors.length ? ["Errors:", ...errors.slice(0, 10).map(e => `- ${e}`)] : []),
  ].join("\n");
  writeFileSync(join(outDir, "report.md"), `# GEO run ${runId}\n\n${text}\n\n## By engine\n\`\`\`json\n${JSON.stringify(summary.by_engine, null, 2)}\n\`\`\`\n\n## By audience\n\`\`\`json\n${JSON.stringify(summary.by_audience, null, 2)}\n\`\`\`\n`);
  console.log(text);
  const status = errors.length === 0 ? "succeeded" : errors.length < answers.length / 5 ? "partial" : "failed";
  if (paperclipEnabled()) await reportCost(issue?.id ?? null, "geo-mixed", { input_tokens: 0, output_tokens: 0 }, cost).catch(e => console.error("cost report failed:", e.message));
  if (issue) await reportToIssue(issue.id, text, status === "failed" ? "blocked" : "done");
  exitCode = status === "failed" ? 1 : 0;
} catch (e) {
  console.error("GEO run FAILED:", (e as Error).message);
  if (issue) await reportToIssue(issue.id, `GEO run failed: ${(e as Error).message}`, "blocked").catch(() => {});
}
process.exit(exitCode);
