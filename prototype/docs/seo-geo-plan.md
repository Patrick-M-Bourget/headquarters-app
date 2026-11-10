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
| Q13 | On-page: each sitemap page (home, pricing, 6 guides, the CleanMyMac comparison) against the top competing pages found via Tavily. Code checks: title, meta, H1, canonical, JSON-LD types, internal links, llms.txt, robots.txt access for AI crawlers. Model check (quotes verified): does the page answer the question directly near the top? |
| Q15 | Synthesis: a weekly report in the parent issue and in `research/seo-geo/weeks/<date>/`, with headline numbers, changes, audit gaps, keyword movements and 3–5 ticket proposals. The owner approves them in Paperclip review; Claude files them on GitHub. |
| Q12 | Estimated $3–8 a week. Hard stop at $100 total for the prototype (spent so far: about $4.15). The first run is by hand; measure, then schedule. |
| Q16 | The pricing and free-tier check comes before the owner creates any keys (Gemini, Tavily, keyword API, OpenAI later). |
| Q17 | Eval: the owner and Claude hand-label about 15 GEO answers from run 1. The tracker must reach 90% agreement before the schedule is turned on. |

## Build order

1. Contracts (Query, QuerySet version, EngineAnswer, Mention, PageAudit, KeywordResult, WeeklyReport) and tests.
2. Query generator, then owner review of query set v1.
3. GEO tracker (Claude first, Gemini once its key exists), then the hand-labelled eval (≥ 90%).
4. On-page auditor (code checks first, then the model check).
5. Keyword tracker (after the API pick).
6. Synthesis, then the Paperclip routine with parent/subtask wiring. First manual run, measured cost, then the schedule.

## Paperclip probation checks (record in the ADR follow-up)

- Do routines fire reliably and create the parent issue and its subtasks?
- Does the parent wait for all subtasks before synthesis runs?
- Do failures in one subtask jam the tree (cf. HEA-7)?
- Do review approvals take on the first try (cf. HEA-8)?
- Do unpriced `process` runs behave with `unpricedUsagePolicy: allow` plus self-reported cost?
