# SEO/GEO tracker: plan (grilled 2026-11-09)

## Context

This is the second workload on the HeadQuarters stack, and Paperclip's probation re-test (ADR 0001). It tracks how visible CacheDrop is to buyers in AI assistants (GEO), on its own pages (on-page SEO) and in search results (keywords). It runs weekly, and each run is compared with the last.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | All three jobs: GEO visibility, on-page audit, keyword tracking. Several agents. |
| Q2 | A repeatable tracker; each run is diffed against the last. |
| Q3 | Read-only. Findings become cachedrop-website tickets, filed only after owner approval. Copy rules: "copy leads the product", no softening. |
| Q4 | Built in `prototype/runners/` as pipelines. The contract lives beside the research contract in `packages/data-contracts`. |
| Q5 | A weekly Paperclip **routine** creates a parent issue with three subtasks (GEO tracker, on-page auditor, keyword tracker). A synthesis step runs when all three are done. All are pipelines (ADR 0001). |
| Q9 | GEO engines: **Gemini** (free tier, Google Search grounding) and **Claude** (web search, Max credits). **ChatGPT** is added when an OpenAI key is provided. **Tavily** is the search tool (not an engine). Perplexity is skipped for now. |
| Q7/Q14 | Keywords are derived from the frozen query set (1–2 per question). Volume and top-10 come from a pay-as-you-go API (pick after the pricing check). Own positions come from Search Console once **cachedrop-website #96** (verify Search Console, ready-for-human) is done. Until then, competitors only. |
| Q8/Q10 | Query set: about 25 questions (about 5 each for producers, developers, video editors and general users, plus comparisons). It is proposed by a **generator step** (Haiku now, local Qwen later via the model setting), checked in code (audience, intent, no duplicates) and approved through Paperclip review. It is then **frozen and versioned**; changes only by approving a new version. |
| Q11 | Per answer: CacheDrop mentioned? recommended? position? cachedrop.io cited? competitors named. Names and URLs are detected in code. "Recommended vs mentioned" is judged by a model, with the quote checked in code. Headline: share of answers recommending CacheDrop, by engine and audience. |
| Q13 | On-page: each sitemap page (home, pricing, 5 guides, the CleanMyMac comparison: 8 English pages as of 2026-11-09) against the top competing pages found via Tavily. Code checks: title, meta, H1, canonical, JSON-LD types, internal links, llms.txt, robots.txt access for AI crawlers. Model check (quotes verified): does the page answer the question directly near the top? |
| Q15 | Synthesis: a weekly report in the parent issue and in `research/seo-geo/weeks/<date>/`, with headline numbers, changes, audit gaps, keyword movements and 3–5 ticket proposals. The owner approves them in Paperclip review; Claude files them on GitHub. |
| Q12 | Estimated $3–8 a week. Hard stop at $100 total for the prototype (spent so far: about $4.15). The first run is by hand; measure, then schedule. |
| Q16 | The pricing and free-tier check comes before the owner creates any keys (Gemini, Tavily, keyword API, OpenAI later). |
| Q17 | Eval: the owner and Claude hand-label about 15 GEO answers from run 1. The tracker must reach 90% agreement before the schedule is turned on. |

## Multi-language (decided 2026-11-09, session 2)

| # | Decision |
|---|---|
| Q19 | Locales: **en-US** and **fr-FR** (the site's two languages; owner 2026-11-09: France, not Quebec, is the French target market because it is larger. The site still tags `/fr/` as `fr-CA`: cachedrop-website #130), plus **de-DE, es-ES, pt-BR, ja-JP** for GEO and keywords only (no site pages: demand and competitor discovery). One market per language. |
| Q20 | Query sets are **generated natively** per locale (not translated from English), so they are not comparable question-for-question across languages. Each is frozen and versioned on its own, approved by the owner in Paperclip review. The existing English v1 becomes the en-US set. |
| Q21 | **Blind eval per language** before its results count, same gates as English: GEO judge ≥ 90% (about 15 answers), and for fr-FR the on-page answer check ≥ 90% answered-vs-no (about 16 openings). About $0.30 each. |
| Q22 | Cadence: **en-US and fr-FR weekly; de-DE, es-ES, pt-BR, ja-JP monthly**. About $2.70/week average GEO cost and about 120 Serper credits/week (free tier lasts about 20 weeks; the paid tier is cash and needs the owner). |
| Q23 | On-page covers fr-FR: the `/fr/` pages mapped to fr-FR questions, French competitors searched in France. New code checks on every page: `hreflang` pairs (each page lists itself and its translation, plus x-default) and `<html lang>`. |
| Q24 | Market signals are passed to every search: Claude web search `user_location` country, Gemini language/region, Tavily country, Serper `gl`/`hl`. |

Step 4 eval result (2026-11-09): the on-page answer check agrees with blind labels 95% (dev) / 100% (test) on answered-vs-no, but only 90% / 83% on exact yes/partial/no (the judge is stricter on "yes"). So "no" is a confirmed gap and "partial" is a "needs check" finding with the judge's quote and reason (eval/onpage-agreement.ts).

## Build order

1. Contracts (Query, QuerySet version, EngineAnswer, Mention, PageAudit, KeywordResult, WeeklyReport) and tests.
2. Query generator, then owner review of query set v1.
3. GEO tracker (Claude first, Gemini once its key exists), then the hand-labelled eval (≥ 90%).
4. On-page auditor (code checks first, then the model check).
5. Keyword tracker (after the API pick).
5b. Multi-language (Q19–Q24), before any scheduling:
   1. Contracts: `locale` on QuerySet (en-US for v1) and on run summaries; locale → engine/search parameters in one place. L2: owner approves the contract diff. DONE 2026-11-09 (`packages/data-contracts/markets.ts`; Gemini parameters still unverified).
   2. Generator `--locale`: native fr-FR set first, owner review; then de-DE, es-ES, pt-BR, ja-JP. fr-FR v1 FROZEN 2026-11-09 (3 owner swaps).
   3. GEO tracker per locale with market signals; blind eval per language (fr-FR first). fr-FR DONE: baseline 0/50, judge eval 93.3%. Gemini takes no market parameter (retrievalConfig ignored).
   4. On-page: fr-FR mapping, hreflang and lang checks, French answer-check eval. DONE 2026-11-09: run local-c1d9af4e (4 no / 3 partial / 1 yes; fr-CA lang on all 8), eval answered-vs-no 100%, exact 93.8% (16 openings). Mapping awaits owner confirmation.
   5. Keyword tracker per locale (Serper gl/hl).
   6. Baselines for all six locales; record cost per locale.
6. Synthesis (per locale and combined), then the Paperclip routine with parent/subtask wiring and the weekly/monthly split. First manual run, measured cost, then the schedule.

## Paperclip probation checks (record in the ADR follow-up)

- Do routines fire reliably and create the parent issue and its subtasks?
- Does the parent wait for all subtasks before synthesis runs?
- Do failures in one subtask jam the tree (cf. HEA-7)?
- Do review approvals take on the first try (cf. HEA-8)?
- Do unpriced `process` runs behave with `unpricedUsagePolicy: allow` plus self-reported cost?
