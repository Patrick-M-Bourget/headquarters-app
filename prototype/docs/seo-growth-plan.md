# SEO growth loop: plan (DRAFT, to grill)

Status: grilled 2026-11-10 (four rounds, Q1–Q27). Decisions are in "Settled decisions" at the end and override anything above them. Next: owner confirms, then P0.

## Context

The SEO/GEO trackers (`seo-geo-plan.md`) and marketing wave 1 (`marketing-agents-proposal.md`) are built and on a weekly routine. They measure well, but they discover very little:

- **Keywords** are only the 1–2 per question in the frozen query sets (48 en-US, 41 fr-FR). Nothing finds new demand.
- **Competitors** are compared on product facts (Mastra Researcher), not on why they rank.
- **Own data**: only "cachedrop.io in the Google top 10, yes or no" (0/48, 0/41). There are no impressions, no positions past 10, and no CTR.
- **Outcomes**: the proposals ledger stops at "ticketed". Nothing checks whether a shipped change worked.
- **Authority**: nothing tracks links. A new domain at 0/48, with Reddit in 47/48 results, probably can't rank on on-page fixes alone.

Goal: a loop that finds demand, works out why competitors win, proposes changes, and **measures whether shipped changes worked**, so each week's proposals get better. Target: more organic clicks to cachedrop.io (en-US and fr-FR) and more signups from organic visits.

## The loop

```
discover (keywords, gaps) → prioritize → propose (3–5 a week) → owner approves → ticket → ship
      ↑                                                                                │
      └──────────── learn (which kinds of change worked) ← measure at +2/+4/+8 weeks ←─┘
```

Rules from wave 1 still apply:
- Drafts only. The owner approves in Paperclip, then Claude files cachedrop-website tickets.
- Every text goes through the Claims Reviewer.
- Code detects things; models judge, and their quotes are verified.
- Every agent has an eval gate before its output counts.
- Never commit competitor page text.

## Metrics

| Level | Metric | Source |
|---|---|---|
| Outcome | Organic clicks per week, by locale; organic signups | Search Console; funnel (Vercel Analytics + signups, `funnel-export.md`) |
| Leading | Impressions; queries with any impression; queries at positions 1–10, 11–20 and 21–50; indexed pages | Search Console |
| Leading | Referring domains; mentions in AI answers (existing 0/50) | Bing Webmaster, backlink API (G5); GEO tracker |
| Health | Pages indexed vs in the sitemap; on-page gaps | URL Inspection API; On-page Auditor |

Expectation: a young domain shows impressions within weeks, positions within 1–3 months, and clicks later. Judge the loop on leading metrics for the first 2–3 months (G2).

## Data access needed from the owner

All read-only. Keys go in `prototype/.env` (git-ignored). Creating keys and granting access is L3: the owner does it, and Claude writes a `wizard` script for the steps.

| # | Source | What it gives | Access | Cost |
|---|---|---|---|---|
| D1 | **Google Search Console** (cachedrop-website #96: Domain property, sitemap submitted) | Queries × pages × country × device: clicks, impressions, CTR, position (16 months). URL Inspection: indexing state per page. | A Google Cloud service account added to the property as a **restricted** (read-only) user; JSON key in `.env`. Search Console API only. | Free. Quotas: I'm not sure of the current numbers; check them in P0. |
| D2 | **Bing Webmaster Tools** (import the site from Search Console) | Bing queries and positions; **inbound links** to our pages; keyword stats (Bing impressions for any term, a free volume proxy). Bing's index feeds ChatGPT search and Copilot. | API key from the Bing Webmaster settings. | Free. Endpoint names to verify in P0 (sources disagree). |
| D3 | **Search volume** (optional) | Google Ads volume and difficulty for candidate keywords; a competitor's ranked keywords. | DataForSEO account, pay-as-you-go. | $50 minimum deposit (cash). Volume costs cents per batch. To verify in P0. |
| D4 | **Backlinks for competitors** (optional) | Who links to AppCleaner, CleanMyMac, Pearcleaner, etc.: the link-gap list. | DataForSEO Backlinks API (same account as D3). | Reportedly no monthly minimum any more (vendor update page); older pages say $100/month. Verify in P0. |
| D5 | **Funnel** (already pending) | Organic visits → signups → downloads → purchases. | CSV export (`funnel-export.md`) or read-only keys. | Free. |

Free first: D1, D2 and D5 cover own data, links to us, and a Bing volume proxy. D3 and D4 cost cash, so they come after P0 and only if the free data leaves a gap (G4, G5).

## Agents: new and changed

Every new agent is a pipeline (ADR 0001) unless noted, and is registered in Paperclip as a `process` agent: `unpricedUsagePolicy: allow`, self-reported cost, contract in `packages/data-contracts/`, tests, eval, probation issue.

| # | Agent | Does | Built as | Gate | Cost per week (I'm not sure) |
|---|---|---|---|---|---|
| A | **Search Console Reader** (new) | Weekly pull per locale: query × page rows, totals, striking-distance queries (positions 8–30), pages with impressions but no clicks; URL Inspection for each sitemap page. Bing equivalents from D2. Diff against the last run. | Code only, no model | Totals match the Search Console UI for one week (owner spot-check); tests on fixtures | $0 |
| B | **Outcome Tracker** (new; part of Weekly Report) | Ledger entries get `shipped_at` (merge date of the cachedrop-website PR, via `gh`), target pages, query IDs and keywords. At +2, +4 and +8 weeks, compare Search Console, SERP and GEO for the targets against the 4 weeks before shipping. Status: `too_early`, `worked`, `no_change`, `regressed`. Keeps a table of which change types work (new page, opening rewrite, meta, schema, links). | Code only | Rules fixed in code: never `worked` before 4 weeks or below a minimum number of impressions (G7). Tests on fixtures. | $0 |
| C | **Competitor Gap Analyst** (new) | For each tracked keyword where a competitor is in the top 10: fetch the ranking URL (Readability), extract structure (H2s, word count, JSON-LD types, date, questions answered, media), compare with our matching page or note that we have none. Output: gap briefs (keyword, who ranks, what their page does that ours doesn't) that feed the Content Writer. Also diffs competitor sitemaps each month to catch new pages. | Pipeline: code extraction, Sonnet comparison, quotes verified in code | Blind eval: owner labels about 20 briefs as useful or not; ≥ 80% (G9) | about $0.30–1 |
| D | **Keyword Discovery** (new) | Candidates come from: Serper `related_searches` (**already saved in every keyword run**, free); Search Console queries we already get impressions for; Bing keyword stats; DataForSEO ranked keywords of competitors (if D3). Scored on volume (or a proxy), intent fit against `product-facts.json` (Sonnet), winnability (forums, Reddit or thin pages in the top 10 count as winnable), our position, and whether a page exists. Output: a ranked shortlist → owner approves → **a new query-set version** (the existing freeze and version flow), so every tracker picks it up. | Pipeline: code scoring, Sonnet intent classifier | Intent classifier vs owner labels on about 40 candidates; ≥ 85% (G9) | about $0.10 + optional D3 cents |
| E | **Citation & Link Strategist** (moved up from wave 2 #5) | From GEO cited URLs, SERP listicles ("best mac cleaner 2026"), Bing inbound links and (optionally) competitor backlinks: a target list (listicles, review sites, directories such as AlternativeTo, MacUpdate, Product Hunt and Setapp-style catalogs, French tech press) with the reason and a drafted pitch. The **owner sends**; nothing is sent automatically. | Pipeline first (G10); Claude Code agent only if live research is needed (new permission surface: L3) | Claims Reviewer on every pitch; owner rates the first list | about $0.30 |
| F | **On-page Auditor: sitemap mode** (change, not a new agent) | Read `sitemap.xml`; any page not in `onpage-pages*.json` gets a proposed question mapping for owner approval, so new pages from the Content Writer are audited. Add checks: broken internal links, sitemap vs indexed (from A), and hreflang already exists. | Change to `onpage.ts` | Existing on-page evals still pass | ≈ $0 |

Changes to existing agents:
- **Weekly Report**: new sections for Search Console (from A) and Outcomes (from B). Proposals are ranked by expected gain: striking-distance queries and winnable gaps first. Proposal types that `no_change` twice drop in rank (G8).
- **Content Writer**: takes gap briefs (C) and approved keywords (D) as input, not only GEO, keyword and on-page runs.
- **Query Generator**: unchanged. Discovery produces candidate versions, and the owner freezes them as today.

Not proposed (say if you disagree):
- Daily rank tracking: weekly is enough at this scale.
- A Core Web Vitals agent: Vercel Speed Insights covers it.
- Agents that publish or open PRs: L3. Tickets stay the hand-off (G12).
- The Reddit drafter: stays deferred (G11).

## Build order

- **P0. Access and pricing check**: owner sets up D1 (finish #96, service account) and D2. Claude verifies quotas and endpoints, and D3/D4 pricing, from primary docs. No code. `wizard` script for the owner steps.
- **P1. A: Search Console Reader**, then the reconcile gate. Start collecting data early, because everything else needs history.
- **P2. B: Outcome Tracker** in the Weekly Report. Backfill `shipped_at` for #131–#133 once they merge.
- **P3. C: Competitor Gap Analyst**, then its eval.
- **P4. D: Keyword Discovery**, then its eval; the first candidate query-set versions for en-US and fr-FR go to owner review.
- **P5. E: Citation & Link Strategist**, then the owner rates the first list.
- **P6. F: sitemap mode.**
- Each step: tests, eval, a Paperclip probation issue, cost measured, then it joins the weekly routine.

## Budget (I'm not sure; to be measured)

- Spent so far: about $21.6 of the $100 prototype hard limit. Current routine: about $2.02 a normal week, about $5.3 the first week of each month.
- Build P1–P6: about $5–10 of API credits (mostly evals and the first runs of C and D).
- Added running cost: about $0.70–2.50 a week. Combined with the current routine: about $3–5 a week, so roughly $15–20 a month.
- At that rate the $100 limit runs out in about 3–4 months. This loop needs to run longer than that to show results (G1).
- Cash, separate: DataForSEO $50 deposit if D3/D4 are chosen; Serper paid tier once the free credits run out (about 20 weeks).

## Settled decisions (grilled 2026-11-10)

| # | Decision |
|---|---|
| Q1 | **Still the prototype**, on Paperclip: we are testing what the setup can do. The full rollout waits for the M6 Mac (expected around the end of November 2026). |
| Q2 | Success at 12 weeks from the first Search Console pull: impressions trending up, queries at positions 11–50 roughly doubled, at least 3 shipped changes `worked`. Clicks and organic signups become the measure after 6 months. |
| Q4 | Search Console through a **restricted** (read-only) service account; Bing Webmaster API key; JSON key and API key in `prototype/.env`. Claude writes a `wizard` script; the owner creates the keys (L3). cachedrop-website #96 comes first. |
| Q5 | Plan for 2 shipped tickets a week. The report keeps 3–5 ranked proposals; anything unshipped after 4 weeks drops back to the candidate list. |
| Q6 | The loop may propose website-decision amendments: at most 1 a month, marked "decision amendment", with the evidence. |
| Q7 | **Multi-market content.** The prototype must draft SEO copy for several markets, mock up the code to deploy it, and monitor it once it's live. The four GEO-only locales are no longer only monitors. |
| Q8/Q24 | Cost: **$100 is a soft target**, not a hard stop. Weekly cost line in the report; Claude flags it at $80; at $100 the model steps pause until the owner raises the limit or says continue. The monthly locales keep running. |
| Q9 | No DataForSEO for now (D3, D4). Free sources only: Search Console, Bing (keywords, inbound links), Serper related searches, GEO-cited sources. P0 still checks the pricing. |
| Q10 | `worked` at +4 and +8 weeks: target impressions +50% **or** average position +5, with at least 100 impressions in the window, after subtracting the site-wide trend. Below 100 impressions: `too_early`. Worse by the same margins: `regressed`. v1 thresholds; revisit after 10 measured changes. |
| Q11 | The report shows the "what worked by change type" table only; the owner ranks. Auto-ranking only after about 20 measured changes. |
| Q12 | Weekly cadence for most things, Search Console included, inside the Monday routine. |
| Q13 | Eval gates, owner labels: Gap Analyst ≥ 80% useful on about 20 briefs; Keyword Discovery ≥ 85% agreement on intent on about 40 candidates; the owner rates the Link Strategist's first list. |
| Q14 | The Link Strategist is a pipeline (no new `claude_local` agent). |
| Q15 | The Reddit drafter stays deferred. |
| Q16 | **OpenCode** (coding on cachedrop-website) is the next test after this plan. Its gate: P1–P4 built with evals passed, 4 clean scheduled weekly runs with the probation checks recorded, and at least 3 approved tickets waiting. It gets its own plan and grill. Installing it and giving it write access are L3. |
| Q17 | New markets: **de-DE first** as the proof (draft → mockup → ship → monitor). es-ES, pt-BR and ja-JP repeat it afterwards. |
| Q18 | The app is English only. Every new-market page says the app's interface is in English (the Claims Reviewer enforces it). Each market gets a mac-cleaner ticket for app localization, with the demand data. |
| Q19 | **Code mockups stay in this repo:** Astro page files plus the `i18n.ts` and hreflang changes under `research/marketing/site-drafts/<locale>/`. A script builds them in a throwaway copy of cachedrop-website for screenshots and the site's tests. Nothing is written to the website repo. The mockups go with the ticket and later feed the OpenCode test. |
| Q20 | de-DE **ships** during the prototype: owner approval → website decision amending Decision 5 (a third language) → ticket → implementation (a Claude session, or the first OpenCode task if Q16's gate is met). |
| Q21 | Language quality without a native reviewer: a glossary per market (like `french-glossary.md`), per-language rules in the Claims Reviewer, a blind fluency and term check by a separate model (≥ 90% of sampled sentences), then ship as drafted (Decision 34 precedent). A native review is optional later. |
| Q22 | New markets show USD until the owner settles € vs $ for `/fr/`; then one rule for every market. |
| Q23 | English slugs under the locale prefix (`/de/uninstall-apps-mac/`), as Decision 49 does for French. |
| Q25 | de-DE drafting starts right after P1, from the existing German GEO and keyword baselines; gap briefs refine later versions. |
| Q26 | First de-DE set: native German versions of the 8 core pages (home, pricing, 5 guides, compare). Legal and download pages stay English-linked for now (translated terms need the owner). German-only pages wait for Keyword Discovery. |
| Q27 | When de-DE ships it moves from monthly to weekly tracking, with its own on-page mapping (`onpage-pages.de-DE.json`, owner approves) and its own Search Console section. |

Superseded above: G4/G5 by Q9; G12 by Q16 and Q19; the "Not proposed" automation item by Q19 (mockups only, no PRs).

## Build order (settled)

- **P0.** Access and pricing check: owner finishes #96 and runs the wizard (service account, Bing key). Claude verifies quotas and endpoints from primary docs. **DONE 2026-11-10**: `scripts/setup-search-access.sh`; `scripts/check-search-access.ts` all green. Restricted level is enough for URL Inspection. Bing has no data yet (0 impressions, 0 links). Pricing check for D3/D4 skipped (Q9: not needed now).
- **P1.** A: Search Console Reader, then the reconcile gate (owner spot-check). **BUILT 2026-11-10**: `runners/seo-geo/search-console.ts` (+ `-checks.ts`, `-report.ts`, contract `packages/data-contracts/search.ts`), Paperclip agent Search Console Reader 047474f4, stage 1 of the weekly routine. Public-repo rule (owner 2026-11-10): committed summary has counts and page paths only; raw rows and query lists go to git-ignored `research/search-console/private/` and to the local Paperclip issue. First run local-e2babdc1: en-US 79 impressions / 2 clicks, fr-FR 49 / 0; 19/24 sitemap pages indexed. Reconcile gate PASSED 2026-11-10: owner saw 111 impressions / 1 click for Oct 11–Nov 7; the API's whole-property total is 111 / 1. The first version summed per-page rows (128 / 2: a search showing two of our pages counts twice), so the summary now carries `site_totals` and labels market rows as page sums. Indexing finding filed as cachedrop-website #138 (owner: request indexing; no code cause found).
- **P1-de.** de-DE content (Q25, Q26):
  1. German glossary and Claims Reviewer rules (Q18, Q21, Q22). **DONE 2026-11-10**: `research/marketing/site-drafts/de-DE/docs/german-glossary.md`; rules de_siezen, de_typography, de_units, app_language; 16 German eval cases written by a separate agent; claims eval dev 34/35, test 33/33, clean 10/10 both.
  2. Content Writer gains `de-DE` and a site-draft output (Q19). Drafts of the 8 pages, then the blind fluency check. **DONE 2026-11-10**: `runners/marketing/site-draft.ts` (+ `copy-blocks.ts`) writes a `de` value beside each `{ en, fr }` copy value of the website, shape-checked in code; 19 files (8 pages, 11 shared), all pass the claims review. Blind fluency check `eval/de-fluency.ts` (Gemini, other vendor, 6 planted canaries): 200/200, canaries 6/6.
  3. The mockup build script (throwaway website copy, screenshots, site tests). **DONE 2026-11-10**: `runners/marketing/site-mockup.ts` + `patches/code.patch` (26 website files, tests included) + `site-screens.ts`; the site's `scripts/check.sh` passes (906 Playwright, 0 failures). About $3.35 for steps 1–3.
  4. Owner review in Paperclip. **DONE 2026-11-11**: owner approved HEA-29, all 7 choices as listed (English flows and legal pages, „Deutsch“ in the en/fr footer, no German in llms.txt, „29,99 $“, the app-in-English line, copy as drafted).
  5. Website decision amending Decision 5, then a ticket, then implementation (Q20). **Ticketed 2026-11-11**: cachedrop-website #139 (carries Decision 57 to add with the PR; ready-for-agent) and the app ticket mac-cleaner #810 (Q18, needs-triage, demand data to follow from weekly tracking). Built 2026-11-11 in a Claude session: cachedrop-website PR #140 (branch de-pages-139, check.sh green, 906 Playwright), waiting on the owner's smoke test and merge OK. Owner 2026-11-11: forget OpenCode for now (Q16 on hold).
  6. On ship: weekly de-DE tracking plus its on-page mapping (Q27).
- **P2.** B: Outcome Tracker in the Weekly Report (Q10, Q11). Backfill `shipped_at` for #131–#133 and the de-DE ticket.
- **P3.** C: Competitor Gap Analyst, then its eval (Q13).
- **P4.** D: Keyword Discovery, then its eval; first candidate query-set versions to owner review.
- **P5.** E: Citation & Link Strategist (pipeline), then the owner rates the first list.
- **P6.** F: On-page Auditor sitemap mode.
- **Then:** es-ES, pt-BR, ja-JP repeat P1-de. The OpenCode plan, once Q16's gate is met.
- Each step: tests, eval, a Paperclip probation issue, cost measured, then it joins the weekly routine.
