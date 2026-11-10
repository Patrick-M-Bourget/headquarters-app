# Hand-off: 2026-11-10, end of session 4 (session 3 and 2 notes below still apply)

## Session 4 (late): step 6 DONE
- Weekly routine 737794c4 is ON (Mondays 14:00 UTC; Paperclip must be running). Weekly Report agent d4f6ae02 orchestrates; report at `research/seo-geo/weeks/<week>/report.md`, parent issue goes to owner review.
- HEA-19 (first manual run) is in owner review: 5 proposals (new pages en q19/q20, fr q09/q16; GitHub as most-cited source). On approval: Claude checks existing pages, runs the Content Writer, files tickets, and adds every decided key to `research/seo-geo/proposals-ledger.json`.
- Approve via review PATCH only; never comment on the agent's issue (re-runs it).
- Cost: normal week ≈ $2.02 + 89 Serper credits; first week of month ≈ +$3.3 and +157 credits. ~$21.6 of $100 spent.

## Session 4 update: read first
- **Marketing wave 1 BUILT** (`prototype/docs/marketing-agents-proposal.md` "Wave 1 as built"): claims reviewer, content writer, on-page optimizer, funnel analyst in `prototype/runners/marketing/`, all pipelines, all in Paperclip as process agents (Claims Reviewer 5cf09692, Content Writer 4c9f196d, On-page Optimizer 34086c94, Funnel Analyst 7b25ede5). Probation HEA-12/13/14 done. New agents start paused: POST /api/agents/:id/resume.
- Claims eval: `node --env-file=.env eval/claims-agreement.ts dev|test` (re-run both after ANY change to the reviewer's instructions or `research/marketing/product-facts.json`).
- Owner review waiting: on-page fixes `research/marketing/onpage-fixes/<run>/fixes.md` (en-US 16, fr-FR 20 proposed); drafts `research/marketing/drafts/` (en-US q05, q10; fr-FR q14). Each draft's `verify` list must be checked against the apps before a ticket is filed. Approved items → Claude files cachedrop-website tickets.
- Owner decisions: France vs Quebec wording in the French glossary (reviewer notes Quebec terms on fr-FR); funnel CSV export (docs/funnel-export.md) or read-only keys; decision-bound fields (pricing meta D47, compare title D54).
- DONE 2026-11-10: owner approved; filed cachedrop-website #131 (on-page fixes), #132 (France French), #133 (new guide, blocked by #132). Still open for the owner: funnel CSV export (docs/funnel-export.md); € vs $ on /fr/.
- 5b DONE for all six locales (journal 2026-11-10). Baselines are the relabel-* runs listed in the journal; judge rubric r2 (vendor installers and security tools excluded).
- Owner: mac-cleaner repo is still PUBLIC and AI engines cite it as an unfinished open-source tool (website Decision 30).
- Step 6 done (see top). Never comment on a process agent's own issue (it re-runs).


## Session 3 update: read first
- 5b steps 1–3 DONE for **fr-FR** (France replaced fr-CA, owner decision). fr-FR v1 frozen; GEO baseline 0/50; French judge eval 93.3% passed; keywords 0/41. See journal session 3.
- **Agent suite wave 1 APPROVED** (`prototype/docs/marketing-agents-proposal.md`, #1–4) with Claude's recommendations: drafts only → owner approves in Paperclip → Claude files cachedrop-website tickets; funnel analyst data keys come later (owner sets up); spend from the API budget.
- 5b step 4 (fr-FR on-page) DONE; French answer check eval 100% answered-vs-no. Owner to confirm `research/seo-geo/onpage-pages.fr-FR.json` mapping.
- Next: build wave 1 (claims reviewer first: it gates the others), then de-DE/es-ES/pt-BR/ja-JP (fix ASCII slug in labels.ts first for ja-JP), then step 6 scheduling.
- cachedrop-website #130: French pages `lang="fr"`, `og:locale fr_FR`.


Read this first, then `project-context.md` and `prototype/docs/seo-geo-plan.md` (Q19–Q24 are new). The journal has the full history and numbers.

## Where things stand

- **Stack prototype: DONE.** ADR 0001 accepted: pipeline + Mastra default; Claude Code agent for open-ended work; **Paperclip on probation** (the SEO/GEO routine is its re-test).
- **SEO/GEO steps 1–5 DONE** (English only):
  - GEO tracker `runners/seo-geo/run-geo.ts`: eval 97.4%. Baseline: CacheDrop 0/50 mentioned.
  - On-page auditor `runners/seo-geo/onpage.ts` (+ `onpage-checks.ts`, `answer-check.ts`): 8 English pages vs Tavily top 3 competitors each. Answer-check eval (`eval/onpage-agreement.ts dev|test`): answered-vs-no 95% / 100%, exact 90% / 83%. So **"no" = confirmed gap; "partial" = "needs check"** (quote + reason shown; owner decides in review). Baseline `local-53fdc2a5`: 8/8 partial, meta descriptions too long on 6 pages, pricing page thin.
  - Keyword tracker `runners/seo-geo/keywords.ts` (+ `keyword-checks.ts`): Serper top 10 for 48 keywords. Baseline `local-29c325f2`: cachedrop.io 0/48 in top 10; Reddit in 47/48, YouTube 39.

## Next steps, in order

5b. **Multi-language, before any scheduling** (seo-geo-plan Q19–Q24 and build order 5b):
   1. Contracts: `locale` on QuerySet (v1 = en-US) and run summaries; one locale → parameters table (Claude `user_location`, Gemini language/region, Tavily country, Serper gl/hl). **L2: show the owner the contract diff first.**
   2. Generator `--locale`, **native** sets (not translations). fr-CA first → owner review in Paperclip → freeze. Then de-DE, es-ES, pt-BR, ja-JP.
   3. GEO per locale + blind eval per language (≥ 90%) before results count.
   4. On-page fr-CA: map `/fr/` pages to fr-CA questions; add hreflang-pair and `<html lang>` checks for all pages; French answer-check eval.
   5. Keywords per locale.
   6. Baselines for all six locales; record cost per locale.
6. **Synthesis + routine**: per-locale and combined weekly report with 3–5 ticket proposals → owner approves in Paperclip → Claude files on cachedrop-website. Routine: en-US + fr-CA weekly, the other four monthly. One manual run, measure cost, then schedule. Record the Paperclip probation checks.

## Gotchas (all verified this session)

- **Paperclip:**
  - Run it on demand: `cd prototype && ./node_modules/.bin/paperclipai run` (http://127.0.0.1:3100, local_trusted, telemetry off). It may still be running from session 1; check `curl -s 127.0.0.1:3100/api/health`.
  - Company `15e87ca3-86a6-4c20-9bb8-96330d67dca8`.
  - Agents:
    - Researcher `5e8d2d29…` (claude_local, locked down)
    - Engineer `6ecd0b11…`
    - Mastra Researcher `2979c1ff…` (process)
    - Query Generator `aa823d51…` (process)
  - **New `process` agents:** set the budget policy `unpricedUsagePolicy: "allow"` at creation, or they hard-stop after one run. Runners report their own cost through `packages/paperclip-client` (`reportCost`).
  - **Review "request changes" on a process agent's issue** leaves it assigned to the board user. To wake the agent: PATCH `{assigneeAgentId: <agent>, assigneeUserId: null, status: "todo"}`.
  - **After any approval**, check `executionState.lastDecisionOutcome`. Approvals have silently not taken effect (HEA-8).
  - **A failed run can put an issue into a recovery hold** that won't retry. Cancel it and open a new issue (HEA-7).
- **Never `node -e "import('…run-geo.ts')"`**: importing a runner executes a full run. To check a runner, use `npm test` or a run limited with `--only q01,q02`.
- **Re-judging is cheap:** `node runners/seo-geo/run-geo.ts --relabel <run dir>` re-labels saved answers with no engine calls.
- **Judge model:** swap it only after re-running `eval/geo-agreement.ts` on both label sets. Haiku scored 87.5% vs Sonnet's 97.4%.
- **Free-tier Gemini grounding is closed to new users.** The key is prepaid ($25, cash). Grounding is free up to 5,000 a month on paid. Default model: gemini-3.8-flash (price doubles after 2026-12-31).
- **Keys** (Anthropic, Gemini, Tavily, Serper) are in `prototype/.env`, which is git-ignored. Never commit them. The repo is public.
- **Shell:** use heredoc files for any Paperclip issue text containing backticks.
- **On-page evals:** rebuild openings with `node eval/onpage/build-openings.ts <on-page run dir>` (git-ignored output). Never commit competitor page text. Tune only on dev; the test set has been seen once after tuning (v1 numbers above).
- **Run outputs** are committed (facts, titles, short verified quotes only). Throwaway `--only` runs: delete them before committing (owner OK'd cleanup of superseded runs).
- **Nektony** owns two tracked products on one domain; keyword brand matching credits nektony.com to App Cleaner & Uninstaller.

## Budget

- About **$7** of the owner's **$100 total hard limit** spent. Per-phase caps are soft.
- Planned recurring (Q22): about $2.70/week average GEO across six locales (weekly en-US/fr-CA, monthly the rest), on-page about $0.20/week (en + fr), keywords $0 on Serper free tier: about 120 credits/week → free tier (2,500, 50 used) lasts about 20 weeks; paid Serper is cash and needs the owner.
- One-time for 5b: about $6 (5 query sets, 5 evals, baselines).
- Tavily free tier: 1,000 credits/month; about 8 a week now, about 16 with fr-CA.
- The $25 Gemini prepay is separate cash.

## Open owner items

- Approve the 5b contract diff (locale) when it's shown.
- Approve each native query set (fr-CA first).
- cachedrop-website #96: verify Search Console (unblocks own keyword positions beyond the top 10).
- OpenAI key, after claiming the ChatGPT Pro API credits (adds ChatGPT as a GEO engine; plan Q9).
- Nothing pushed; local `main` tracks `origin/main`, which shows **[gone]**. Sort out the remote before the first push; run `gh auth status` first. Ask before pushing.

## Suggested first message for the next session

`start session`, then: "Continue SEO/GEO step 5b (multi-language) per .agent/memory/handoff.md."
