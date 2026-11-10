// On-page auditor (plan Q13): each own page vs the top competing pages for the question it should answer.
// Code checks (title, meta, H1, canonical, JSON-LD, internal links, llms.txt, robots.txt for AI crawlers),
// plus a model check (quote verified in code): does the page answer its question near the top?
// Usage: node --env-file=.env runners/seo-geo/onpage.ts [--locale fr-FR] [--only pricing,uninstall-apps] [--competitors 3] [--no-model]
// Pages per locale: research/seo-geo/onpage-pages.json (en-US) or onpage-pages.<locale>.json. Competitors are searched in that market.
// Page HTML is never saved (public repo): outputs hold extracted facts and short verified quotes only.
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AnswerCheck, Locale, PageAudit, PageComparison, QuerySet, SiteAudit } from "../../packages/data-contracts/seo-geo.ts";
import { MARKETS, querySetPath } from "../../packages/data-contracts/markets.ts";
import { findIssue, paperclipEnabled, reportCost, reportToIssue } from "../../packages/paperclip-client/index.ts";
import { fetchPage, type Page } from "../mastra/fetch.ts";
import { ANSWER_MODEL, judgeOpening } from "./answer-check.ts";
import { findGaps, gapKey, langGaps, mainText, opening, pageChecks, robotsReport } from "./onpage-checks.ts";
import { parseHTML } from "linkedom";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const root = new URL("../../", import.meta.url).pathname;
const pagesLocale = arg("--locale") ?? "en-US";
const mapping = JSON.parse(readFileSync(join(root, pagesLocale === "en-US" ? "research/seo-geo/onpage-pages.json" : `research/seo-geo/onpage-pages.${pagesLocale}.json`), "utf8")) as { locale?: string; query_set_version: number; pages: { url: string; query_id: string }[] };
const set = QuerySet.parse(JSON.parse(readFileSync(join(root, querySetPath(Locale.parse(mapping.locale ?? "en-US"), mapping.query_set_version)), "utf8")));
const sameLocale = (s: { locale?: string }) => (s.locale ?? "en-US") === set.locale; // summaries before 5b have no locale: en-US
const only = arg("--only")?.split(",");
const pages = mapping.pages.filter(p => !only || only.some(o => p.url.includes(o)));
const nCompetitors = Number(arg("--competitors") ?? 3);
const useModel = !process.argv.includes("--no-model");
// Sites that are never a comparable "page": our own, video hosts and social networks.
const EXCLUDE = /(^|\.)(cachedrop\.io|youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|linkedin\.com|pinterest\.com)$/i;

const runId = process.env.PAPERCLIP_RUN_ID ?? `local-${randomUUID().slice(0, 8)}`;
const outDir = join(root, "research/seo-geo/onpage-runs", runId);
const t0 = Date.now();
let cost = 0, searches = 0;
let issue: { id: string } | null = null;
let exitCode = 1;

async function tavily(query: string): Promise<string[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set (run with --env-file=.env)");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 10, include_answer: false, topic: "general", country: MARKETS[set.locale].tavilyCountry }), signal: AbortSignal.timeout(30000),
  });
  searches++;
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { results: { url: string }[] }).results.map(r => r.url);
}

async function answerCheck(question: string, page: Page): Promise<AnswerCheck> {
  const r = await judgeOpening(question, opening(page.text));
  cost += r.cost_usd;
  return r.answer;
}

async function audit(url: string, q: { id: string; text: string }, page?: Page): Promise<{ audit: PageAudit; page: Page }> {
  page ??= await fetchPage(url);
  if (page.ok) page = { ...page, text: mainText(page.html) };
  const failed = !page.ok ? page.error ?? `HTTP ${page.status}` : page.text.split(" ").length < 100 ? "too little readable text (blocked or script-rendered)" : null;
  const checks = failed ? null : pageChecks(page.html, page.url, page.text);
  const answer = failed || !useModel ? null : await answerCheck(q.text, page);
  return { page, audit: PageAudit.parse({ url: page.url || url, query_id: q.id, query_text: q.text, audited_at: new Date().toISOString(), http_status: page.status, error: failed, checks, answer }) };
}

try {
  if (paperclipEnabled()) issue = await findIssue();
  const origin = new URL(pages[0]?.url ?? "https://cachedrop.io/").origin;
  // Plain-text files: fetch directly (fetchPage parses HTML). A missing robots.txt means everything is allowed.
  const getText = async (path: string) => { const r = await fetch(origin + path, { signal: AbortSignal.timeout(20000) }); return { status: r.status, body: r.ok ? await r.text() : "" }; };
  const [robots, llms] = await Promise.all([getText("/robots.txt"), getText("/llms.txt")]);
  if (robots.status !== 200 && robots.status !== 404) throw new Error(`robots.txt returned HTTP ${robots.status}; cannot judge crawler access`);
  const site = SiteAudit.parse({ origin, llms_txt: llms.status === 200 && llms.body.trim().length > 0, robots_allows: robotsReport(robots.status === 404 ? null : robots.body) });

  const comparisons: PageComparison[] = [];
  const skipped: string[] = [];
  for (const p of pages) {
    const q = set.queries.find(x => x.id === p.query_id);
    if (!q) throw new Error(`mapping names ${p.query_id}, which is not in query set v${set.version}`);
    const own = await audit(p.url, q);
    const competitors: PageAudit[] = [];
    const seenHosts = new Set<string>();
    for (const u of await tavily(q.text)) {
      if (competitors.length >= nCompetitors) break;
      const host = new URL(u).hostname.replace(/^www\./, "");
      if (EXCLUDE.test(host) || seenHosts.has(host)) continue;
      seenHosts.add(host);
      const c = await audit(u, q);
      // A competitor that failed to load says nothing about the page; try the next result instead.
      if (c.audit.error) { skipped.push(`${p.query_id} ${u}: ${c.audit.error}`); continue; }
      competitors.push(c.audit);
    }
    // Language targeting (plan Q23): fetch each listed translation (no model) to check it links back.
    const back: Record<string, string[]> = {};
    for (const a of own.audit.checks?.hreflang ?? []) {
      if (a.lang.toLowerCase() === "x-default" || a.href.replace(/\/$/, "") === own.audit.url.replace(/\/$/, "")) continue;
      const t = await fetchPage(a.href);
      if (t.ok) back[a.href] = [...parseHTML(t.html).document.querySelectorAll('link[rel="alternate"][hreflang]')].map(l => { try { return new URL(l.getAttribute("href") ?? "", a.href).toString(); } catch { return ""; } });
    }
    const lang = own.audit.checks ? langGaps(own.audit.url, own.audit.checks, set.locale, back) : [];
    comparisons.push(PageComparison.parse({ page: own.audit, competitors, gaps: [...lang, ...findGaps(own.audit, competitors)] }));
    console.log(`${new URL(p.url).pathname}: ${own.audit.answer?.verdict ?? "-"}, ${competitors.length} competitors, ${comparisons.at(-1)!.gaps.length} gaps`);
  }

  const siteGaps = [
    ...(site.llms_txt ? [] : ["no /llms.txt"]),
    ...Object.entries(site.robots_allows).filter(([, ok]) => !ok).map(([bot]) => `robots.txt blocks ${bot}`),
  ];
  const verdicts = comparisons.map(c => c.page.answer?.verdict ?? "skipped");
  const compVerdicts = comparisons.flatMap(c => c.competitors.map(x => x.answer?.verdict ?? "skipped"));
  const tally = (xs: string[]) => xs.reduce<Record<string, number>>((m, v) => ((m[v] = (m[v] ?? 0) + 1), m), {});
  const summary = {
    run_id: runId, locale: set.locale, query_set_version: set.version, pages: comparisons.length, competitors: compVerdicts.length, model: useModel ? ANSWER_MODEL : null,
    own_answers_near_top: tally(verdicts), competitor_answers_near_top: tally(compVerdicts),
    gaps: comparisons.reduce((s, c) => s + c.gaps.length, 0) + siteGaps.length, site_gaps: siteGaps,
    skipped_competitors: skipped, searches, cost_usd: Number(cost.toFixed(4)), seconds: Math.round((Date.now() - t0) / 1000),
  };
  // Diff against the previous full run: which gaps are new, which were fixed.
  const runsDir = join(root, "research/seo-geo/onpage-runs");
  const prevDir = existsSync(runsDir) ? readdirSync(runsDir).filter(d => d !== runId && existsSync(join(runsDir, d, "summary.json")))
    .map(d => ({ d, s: JSON.parse(readFileSync(join(runsDir, d, "summary.json"), "utf8")) })).filter(x => sameLocale(x.s) && x.s.pages === mapping.pages.length)
    .sort((a, b) => (a.s.finished_at < b.s.finished_at ? 1 : -1))[0]?.d : undefined;
  let delta: { previous_run: string; new_gaps: string[]; fixed_gaps: string[] } | null = null;
  if (prevDir && pages.length === mapping.pages.length) {
    // Compare only the stable part of a gap: the model's reason/quote and the competitor list change wording each run.
    const key = (c: PageComparison) => c.gaps.map(g => `${new URL(c.page.url).pathname}: ${gapKey(g)}`);
    const prev = new Set<string>((JSON.parse(readFileSync(join(runsDir, prevDir, "audits.json"), "utf8")).pages as PageComparison[]).flatMap(key));
    const now = new Set(comparisons.flatMap(key));
    delta = { previous_run: prevDir, new_gaps: [...now].filter(g => !prev.has(g)), fixed_gaps: [...prev].filter(g => !now.has(g)) };
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "audits.json"), JSON.stringify({ site, pages: comparisons }, null, 2) + "\n");
  writeFileSync(join(outDir, "summary.json"), JSON.stringify({ ...summary, delta, finished_at: new Date().toISOString() }, null, 2) + "\n");
  const headline = [
    `On-page run ${runId}: ${comparisons.length} pages vs ${compVerdicts.length} competitor pages. Own pages answering near the top: ${JSON.stringify(summary.own_answers_near_top)}; competitors: ${JSON.stringify(summary.competitor_answers_near_top)}.`,
    `Site: llms.txt ${site.llms_txt ? "present" : "MISSING"}; AI crawlers ${Object.values(site.robots_allows).every(Boolean) ? "all allowed" : "partly blocked"}. ${summary.gaps} gaps.`,
    delta ? `Since ${delta.previous_run}: ${delta.new_gaps.length} new gaps, ${delta.fixed_gaps.length} fixed.` : "No previous full run.",
    `${searches} Tavily searches, $${summary.cost_usd}, ${summary.seconds}s. Output: prototype/research/seo-geo/onpage-runs/${runId}/`,
  ].join("\n");
  const perPage = comparisons.map(c => [
    `## ${new URL(c.page.url).pathname} (${c.page.query_id}: "${c.page.query_text}")`,
    `Answers near the top: **${c.page.answer?.verdict ?? "not checked"}**${c.page.answer?.quote ? ` — "${c.page.answer.quote}"` : ""}`,
    `Competitors: ${c.competitors.map(x => `${new URL(x.url).hostname.replace(/^www\./, "")} (${x.answer?.verdict ?? "-"}, ${x.checks!.word_count} words)`).join(", ") || "none loaded"}`,
    ...(c.gaps.length ? c.gaps.map(g => `- ${g}`) : ["- no gaps found"]),
  ].join("\n"));
  writeFileSync(join(outDir, "report.md"), `# On-page run ${runId}\n\n${headline}\n\n${siteGaps.map(g => `- ${g}`).join("\n")}\n\n${perPage.join("\n\n")}\n${delta ? `\n## Changes since ${delta.previous_run}\nNew:\n${delta.new_gaps.map(g => `- ${g}`).join("\n") || "- none"}\nFixed:\n${delta.fixed_gaps.map(g => `- ${g}`).join("\n") || "- none"}\n` : ""}`);
  console.log(headline);
  const failedOwn = comparisons.filter(c => c.page.error).length;
  if (paperclipEnabled()) await reportCost(issue?.id ?? null, ANSWER_MODEL, { input_tokens: 0, output_tokens: 0 }, cost).catch(e => console.error("cost report failed:", e.message));
  if (issue) await reportToIssue(issue.id, headline, failedOwn > 0 ? "blocked" : "done");
  exitCode = failedOwn > 0 ? 1 : 0;
} catch (e) {
  console.error("On-page run FAILED:", (e as Error).message);
  if (issue) await reportToIssue(issue.id, `On-page run failed: ${(e as Error).message}`, "blocked").catch(() => {});
}
process.exit(exitCode);
