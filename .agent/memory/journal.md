# Journal

## 2026-11-09
- Grilled the ChatGPT HQ spec into `prototype/docs/plan.md`. Cloned the empty repo, added the agent layout, `.gitignore`, and the API key in `prototype/.env` (ignored).
- Free disk before installs: 13 GB.
- Phase 1: `npx paperclipai onboard` failed with npm's npx lock timeout (`ECOMPROMISED`, libnpmexec with-lock). Fix: local `npm install paperclipai` in `prototype/`, then `./node_modules/.bin/paperclipai onboard --yes --bind loopback --no-install-service`.
- Phase 1 gate: UI on http://127.0.0.1:3100. Disk: `prototype/node_modules` 2.7 GB, `~/.paperclip` 86 MB, failed npx cache 1.2 GB; free 13 GB → 10 GB. RAM: Paperclip node about 560 MB, embedded Postgres about 55 MB.
- Node 24.13 triggers EBADENGINE warnings (jsdom wants >=24.15). Not blocking so far.
- Paperclip makes hourly DB backups kept 30 days. Watch disk.
- Phase 2 lockdown gate PASSED on test 4 (HEA-4). Findings for the ADR:
  1. Paperclip's default runner rejects `dangerouslySkipPermissions`/`extraArgs`/`maxTurnsPerRun`. Lockdown needs `runner: "legacy"`.
  2. The legacy runner's `claude` inherits the owner's user-level Claude Code allow rules (260 rules, incl. `Bash(node:*)`): `node -e` could read any file. Fix: `--setting-sources project`.
  3. With only `--setting-sources project`, the workspace `.claude/settings.json` was NOT loaded (everything denied). Fix: also pass `--settings <abs path>`.
  4. Paperclip's own skill tells agents to use curl. Replaced with the loopback-only `tools/pc.ts`.
  5. Filesystem/network sandboxing (`filesystemScope`) needs bwrap, so it's Linux only and unavailable on macOS.
  6. When the agent couldn't update its issue, Paperclip's recovery loop re-woke it twice (extra spend) and then set the issue to blocked.
- Telemetry turned off in `~/.paperclip/instances/default/config.json` (backup is at `config.json.bak`).
- Research run 1 (HEA-5, Paperclip run 2851ba15): VALID output. Scorer: 37 key fields, 25 match / 1 mismatch / 11 agent-unknown → accuracy 96.2% of decided fields, coverage 70.3%. Overall 120 observations, 54 verified / 66 unknown. About 10 min wall-clock, about $1.18 (agent total incl. lockdown tests $1.65). Now in_review for the owner.
  - The run blocked once: the agent wrote tools/gen-run.mjs instead of writing files (not allowed), and it couldn't see the contract. Fixed with contracts/run-output.schema.json in the workspace and the "How to write output" section in AGENT.md.
  - Weaknesses: it mostly fetched homepages only (shallow), and WebFetch returns model summaries, so the "verbatim" evidence quotes are really summary text. The OmniDiskSweeper seed URL (omnigroup.com/more) is a generic page, so every field came back unknown. The CleanMyMac store returned 403.
  - The single mismatch (GrandPerspective distribution open_source vs both) is an enum ambiguity: "both" doesn't cover open source + App Store.
  - The "investigate developer cleanup" recommendation contradicts the Oct 22 research (Pearcleaner, Mole); it comes from the shallow fetch.
- Board review → changes requested on HEA-5 (via API PATCH status+comment). The agent woke at once and wrote run 2 (8ed1c833) in about 4 min, about $1.36. Total agent spend $3.02.
  - Run 2: 37 key fields, 28 match / 2 mismatch / 7 unknown → 93.3% accuracy, 81.1% coverage (run 1: 96.2% / 70.3%). Verified 70/120 (run 1: 54).
  - Both mismatches are key/contract problems, not agent errors. CleanMyMac one-time $89.99 is the Mac App Store price, confirmed live 2026-11-09; the key's $119.95 is MacPaw's direct store (403 to the agent). GrandPerspective is the open_source enum gap.
  - Contract TODO: add a price channel (direct vs app store) and a distribution value covering "open source + App Store".
  - The agent disclosed the channel in its evidence, separated a search snippet from fetched data, and reframed the dev-cleanup recommendation as "test, not a proven gap".
- Phase 2b: Engineer agent (claude_local, cwd prototype/, engineer.settings.json) did HEA-6 (price channel + open_source_and_app_store) in about 1 min for $0.13. Clean diff, tests 7/7, both runs still VALID (checked by me). It honestly flagged a step it couldn't run (validate.ts path) and that the distribution value isn't enforced (value is a free string). In review with the owner; uncommitted until approved.
- My own slip: backticks in a bash double-quoted string dropped "channel" from the HEA-6 description. Patched before the agent finished and noted in a comment. Use heredoc files for issue text.
- Phase 3 (Mastra via process adapter):
  - In-process `createRun().start()` works without a Mastra server. Sonnet 5.5 structured output works.
  - Runner: fetch + Readability, pick up to 3 pricing/features pages, extract, then a deterministic check that each evidence quote is on the page (otherwise downgrade to unknown), recommendations that may only cite verified observations, contract validation, Paperclip report.
  - HEA-8 (run 61f7dcba): 100% accuracy (25/25 decided), 67.6% coverage, 52/120 verified, 0 downgrades. 49 s, $0.36. Earlier HEA-7 attempt d104d968: same quality, reporting failed.
  - Paperclip findings:
    1. The heartbeat-run issues endpoint returns `issueId`, not `id`. My lookup bug.
    2. A process agent with a budget hard-stops after its first run because the run counts as "unpriced usage" (policy defaults to block), even at $0 observed. Reporting cost via POST /companies/:id/cost-events records spend but still counts the run as unpriced. Fix: `unpricedUsagePolicy: allow` + the runner reports cost.
    3. After a failed run, Paperclip opened a recovery action on HEA-7. Retry in the UI, status→todo, reassign and heartbeat/invoke all failed to resume it (invoke started a run not linked to the issue). Had to cancel and open a new issue (HEA-8). The owner hit this in the UI ("retry seems jammed").
  - Budget rule from owner: $100 total hard limit; per-phase caps are soft.
- Phase 4 + ADR:
  - Injection fixture (`eval/injection/`): Mastra Sonnet, Mastra Haiku and the Claude Code agent (HEA-9, file fixture) all passed 6/6 and flagged it. The first canary check was too blunt (quoting the attack inside a warning counted as a fail); fixed.
  - Haiku proxy (full 10): 96.0% / 67.6%, $0.02, 38 s. One real over-inference: CleanMyMac "subscription" from a true "$3.33/month" quote. The evidence check doesn't catch inference errors.
  - ADR 0001 written (Proposed): pipeline + Mastra kept as default for research workers, Claude Code agent for open-ended work only, Paperclip on probation pending the SEO/GEO re-test. Owner decides (L3).
  - Total spend about $4.15.
- Owner approved HEA-8 and accepted ADR 0001 as written (2026-11-09).
- Paperclip finding: HEA-8 approval needed two PATCHes. The owner's UI "mark done" plus my first approval only re-synced a drifted review hold (issue-execution-policy holdDrifted path) without recording a decision; the second PATCH approved it. Approvals can silently not take: check executionState.lastDecisionOutcome after approving.
- SEO/GEO step 1–2: contracts (`seo-geo.ts`) + query generator (Haiku, $0.002 per run) + round-robin audience selection. The Paperclip client moved to packages/paperclip-client.
  - HEA-10: draft 1 was sent back (only 4 general questions; off-topic comparisons). Paperclip finding: "request changes" (status todo + comment) on a process agent's review left the issue assigned to the board user with the execution state cleared; nothing woke. Fixed by PATCH assigneeAgentId=<agent> + assigneeUserId=null (a plain reassign fails with "Issue can only have one assignee").
  - Draft 2 was approved by the owner with 2 swaps (q15, q16, both from the not-selected list) and frozen as research/seo-geo/query-sets/v1.json. This approval took on the first try.
  - Gemini key (AI Studio, free tier) is in .env; gemini-2.5-flash is available. DataForSEO is deferred. Tavily and Serper keys are still needed (on-page and keyword steps).
- GEO tracker built (runners/seo-geo/run-geo.ts, engines.ts, labels.ts): Claude Haiku 5.5 + web_search_20250305, and Gemini 3.8 Flash + Google grounding (REST). The judge (Haiku via Mastra) lists every cleanup-tool product; code checks names and quotes (markdown stripped). `--relabel` re-judges saved answers.
  - Gemini free-tier grounding is gone for new users (2.5 Flash closed); the owner prepaid $25 on Gemini (cash, separate from the $100 API budget).
  - Baseline (local-136b0381, relabel-35013bd4): CacheDrop mentioned 0/50, recommended 0/50; cachedrop.io cited once (Gemini, q22 plug-in manager). Top recommended: AppCleaner 16, DaisyDisk 16, CleanMyMac 11, Pearcleaner 10, GrandPerspective 9. $0.56, 48 searches, 264 s. New competitors discovered: Audio Plugin Uninstaller (Wide Blue Sound, $9; top pick for VST uninstall on both engines), Crumb ($9 one-time), MacDiskCleaner, Plugin Station, Plugoff, Bypass, UninstallPKG.
  - Slip: `node -e import(run-geo.ts)` executed a run (no keys loaded, 50 failures, $0). Removed that folder; the diff now skips failed and relabel runs.
- GEO eval gate (Q17) PASSED. Blind reviewer subagent labels: dev set of 15 (eval/geo-labels-v1-blind.json, tuned on) and fresh test set of 10 (eval/geo-labels-v1-test.json, never tuned on). Scorer: eval/geo-agreement.ts.
  - Haiku judge with binary "recommended": 76.8% on dev. Fixes: three-level stance (top_pick/suggested/mentioned; `recommended` = suggested or better), scope rules (no built-ins, commands, bundles, Windows-only tools), name normalisation ("X by Y").
  - Haiku + stance: 81.5% dev. Sonnet + stance + scope: 94.4% dev, **97.4% test** (stance 100%). Haiku on test (before the scope rule): 87.5%. Judge default is now Sonnet 5.5 (GEO_JUDGE_MODEL); the generator stays on Haiku.
  - Local-Qwen implication: judging stance is the step that needs model strength. Run eval/geo-agreement.ts on Qwen before switching it.
  - Expected weekly GEO cost: about $0.56 engines + $0.34 judge = about $0.90.
- END OF SESSION 1 (2026-11-09): hand-off written to .agent/memory/handoff.md. Unfinished: SEO/GEO steps 4–6. Nothing pushed. Paperclip may still be running locally.

## 2026-11-09 (session 2)
- SEO/GEO step 4, on-page auditor (`runners/seo-geo/onpage.ts`, `onpage-checks.ts`, `answer-check.ts`): PageAudit/SiteAudit/PageComparison contracts; 8 English sitemap pages (the plan said 6 guides; there are 5) mapped to v1 queries in `research/seo-geo/onpage-pages.json`; Tavily top 3 competitors per page (own site, video and social excluded; failed loads skipped); code checks + Sonnet answer check with the quote verified against the first 150 words of main text.
  - Bugs found on the first real run and fixed: fetchPage crashes on plain text (llms.txt read as missing); body-text fallback fed nav and scripts to the judge and inflated word counts (new `mainText`: chrome stripped, <main>/<article> preferred, block and inline elements spaced); facebook.com as a competitor; CMS boilerplate JSON-LD types reported as gaps.
- On-page answer-check eval (`eval/onpage-agreement.ts`, blind subagent labels `eval/onpage/labels-v1-{dev,test}.json`, openings in git-ignored `openings.local.json`, fixed hash split 20 dev / 12 test):
  - First: dev 80% exact. One rubric pass on dev (short preamble doesn't lower "yes"; one fitting product = partial): dev 85%, test 75% exact; answered-vs-no 90% / 91.7%.
  - Judge is stricter than the reviewer on "yes" (3 of 4 yes labels → partial, two of them our own guides the reviewer itself flagged as borderline).
  - Owner chose option C: "no" = confirmed gap; "partial" = "needs check" with quote + one-line reason, approved in Paperclip review. Adding the reason output raised agreement: dev 90% / test 83.3% exact, answered-vs-no 95% / 100%.
  - Gap diffs now key on the stable part of a gap (no model text, numbers masked); two consecutive runs gave identical verdicts.
- On-page baseline `local-53fdc2a5` ($0.11, 90 s): all 8 own pages "partial" (0 confirmed answer gaps); llms.txt present; all AI crawlers allowed; meta descriptions too long on 6 pages; pricing 141 words vs competitor median 2,108; dev-caches page lacks SoftwareApplication/Offer JSON-LD.
- Step 5, keyword tracker (`runners/seo-geo/keywords.ts`, `keyword-checks.ts`): SerpResult/KeywordResult contracts; 48 unique keywords from v1; Serper top 10 (1 credit each); own position from the SERP; brand matching on own sites (nektony.com credited to App Cleaner & Uninstaller); run diff (unit-tested only so far).
  - Baseline `local-29c325f2` ($0, 48 credits): cachedrop.io in the top 10 for 0/48. CleanMyMac's own sites rank for 13 keywords, Nektony 7, Audio Plugin Uninstaller 5, AppCleaner 4. Reddit is in the top 10 for 47/48, YouTube 39, Apple Discussions and Facebook 20 each.
- Owner decision: multi-language before scheduling (seo-geo-plan Q19–Q24): en-US + fr-CA weekly; de-DE, es-ES, pt-BR, ja-JP monthly (GEO + keywords only); native query sets per locale; blind eval per language.
- Spend this session about $0.60 (all Anthropic API: on-page runs and evals). Total about $7 of $100. Serper 50/2,500 credits used. Tavily about 26 searches.
- Unfinished: step 5b (multi-language), step 6 (synthesis + routine). Nothing pushed; origin/main shows [gone].
