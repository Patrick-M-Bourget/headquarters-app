// Query generator: proposes a draft query set for owner review.
// Usage: node runners/seo-geo/generate-queries.ts [--locale fr-FR] [--version N]
// In Paperclip, the locale comes from the issue text ("locale: fr-FR"); default en-US.
// Non-English sets are written natively for that market (plan Q20), never translated from English.
// Model: SEO_MODEL (default anthropic/claude-haiku-5-5); a local model later, same code.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { Locale, QuerySet } from "../../packages/data-contracts/seo-geo.ts";
import { MARKETS, querySetPath } from "../../packages/data-contracts/markets.ts";
import { findIssue, getIssueText, paperclipEnabled, reportCost, reportToIssue } from "../../packages/paperclip-client/index.ts";
import { selectQueries } from "./queries.ts";

const MODEL = process.env.SEO_MODEL ?? "anthropic/claude-haiku-5-5";
const PRICE: Record<string, [number, number]> = { "anthropic/claude-haiku-5-5": [0.1e-6, 0.5e-6], "anthropic/claude-sonnet-5-5": [2e-6, 10e-6] };
const root = new URL("../../", import.meta.url).pathname;
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

let issue: { id: string } | null = null;
let code = 1;
try {
  if (paperclipEnabled()) issue = await findIssue();
  const issueText = issue ? await getIssueText(issue.id) : "";
  const locale = Locale.parse(arg("--locale") ?? issueText.match(/locale:\s*([a-z]{2}-[A-Z]{2})/)?.[1] ?? "en-US");
  const version = Number(arg("--version") ?? issueText.match(/version:\s*(\d+)/)?.[1] ?? 1);
  const market = MARKETS[locale];
  const marketRules = locale === "en-US" ? "" : `
- Market: ${market.name}. Write every question and keyword in that language, the way people in that country actually type them: native phrasing and the everyday local words for storage, cache, uninstalling, subscriptions. Do NOT translate English questions; think about what buyers in that country search for.
- Comparisons and alternatives may name tools well known in that country, as long as they are real Mac cleanup, uninstaller or disk-space tools.
- Keywords: what they would type into Google in that country, in that language.`;
  const llms = await (await fetch("https://cachedrop.io/llms.txt", { signal: AbortSignal.timeout(15000) })).text();

  const agent = new Agent({
    id: "query-generator", name: "query-generator", model: MODEL,
    instructions: `You write the questions real Mac users type into ChatGPT, Gemini or Google when they have a problem a product like the one described could solve.
Rules:
- Write as a buyer who has NEVER heard of the product: never use its name.
- Audiences: producers (music producers: plug-ins, sample libraries, DAW caches), developers (Xcode, node_modules, Docker), video_editors (Premiere, Final Cut caches), general (storage full, System Data, uninstalling apps, Mac cleaners).
- Intents: recommendation ("best ... for ..."), how_to ("how do I ..."), comparison ("X vs Y"), alternative ("alternative to X").
- Competitor names only in comparison or alternative questions. Use real, well-known Mac tools.
- Every question must be one a person asks when deciding how to clean up, uninstall or free space, where a cleanup/uninstaller app could be the answer. No questions about choosing a DAW or video editor, or general performance.
- Comparisons and alternatives: only between cleanup, uninstaller or disk-space tools (e.g. CleanMyMac, AppCleaner, DaisyDisk). Include the subscription vs one-time purchase question, and a CleanMyMac alternative question for music producers.
- Natural phrasing, varied, no near-duplicates. 1-2 short search keywords per question (what they'd type into Google).
- Return 36 candidates: 10 general, about 9 each for producers, developers and video_editors, with a mix of intents in each.
- audience and intent are always the English labels above.${marketRules}`,
  });
  const r = await agent.generate(`The product (its own llms.txt):\n\n${llms}`, {
    structuredOutput: { schema: z.object({ candidates: z.array(z.object({ text: z.string(), audience: z.string(), intent: z.string(), keywords: z.array(z.string()) })) }) },
    maxSteps: 1,
  });
  const { queries, rejected, perAudience } = selectQueries(r.object.candidates);
  const set = QuerySet.parse({ locale, version, created_at: new Date().toISOString(), generator_model: MODEL.replace("anthropic/", ""), approved_by: null, approved_at: null, queries });

  const draftPath = join(root, querySetPath(locale, version, true));
  mkdirSync(dirname(draftPath), { recursive: true });
  writeFileSync(draftPath, JSON.stringify(set, null, 2) + "\n");
  const table = ["| id | audience | intent | question | keywords |", "|---|---|---|---|---|",
    ...queries.map(q => `| ${q.id} | ${q.audience} | ${q.intent} | ${q.text} | ${q.keywords.join(", ")} |`)].join("\n");
  const rej = rejected.map(x => `- ${x.text}: ${x.reason}`).join("\n") || "- none";
  const usage = { input_tokens: r.usage?.inputTokens ?? 0, output_tokens: r.usage?.outputTokens ?? 0 };
  const [pi, po] = PRICE[MODEL] ?? [0, 0];
  const cost = usage.input_tokens * pi + usage.output_tokens * po;
  const md = `# Query set ${locale} v${version} (DRAFT, needs owner approval)\n\nGenerated by ${set.generator_model} from cachedrop.io/llms.txt. ${r.object.candidates.length} candidates, ${queries.length} kept. Per audience: ${JSON.stringify(perAudience)}. Cost $${cost.toFixed(4)}.\n\n${table}\n\n## Rejected by the code checks\n${rej}\n`;
  writeFileSync(draftPath.replace(/\.json$/, ".md"), md);
  console.log(md);

  if (paperclipEnabled()) await reportCost(issue?.id ?? null, MODEL.replace("anthropic/", ""), usage, cost).catch(e => console.error("cost report failed:", e.message));
  if (issue) await reportToIssue(issue.id, md + "\nApprove to freeze this as " + locale + " v" + version + "; request changes to regenerate.", "done");
  code = 0;
} catch (e) {
  console.error("query generation FAILED:", (e as Error).message);
  if (issue) await reportToIssue(issue.id, `Query generation failed: ${(e as Error).message}`, "blocked").catch(() => {});
}
process.exit(code);
