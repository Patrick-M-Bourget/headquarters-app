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

## 2026-11-09 (session 3, owner asleep at the end)
- 5b step 1 DONE: `locale` on QuerySet/EngineAnswer (default en-US; frozen v1.json untouched), Unicode duplicate check (old one broke Japanese), markets.ts (Claude country, Serper gl/hl, Tavily country), runners take --locale. Owner: French market = **fr-FR (France)**, not fr-CA. Website tag fix filed: cachedrop-website #130.
- 5b step 2: generator --locale (locale also from Paperclip issue text "locale: fr-FR"); native prompt; near-dup works on Japanese (character pairs). HEA-11 generated fr-FR v1 ($0.0031); owner approved with 3 swaps (subscription question had been lost to the audience quota; duplicate comparison; off-target external-disk question; added OnyX alternative). Fix: model marks required questions, selection keeps them.
- 5b step 3: Gemini retrievalConfig latLng/languageCode accepted but ignored by Search grounding (Paris → still USD prices). Gemini's only market signal is the question language. Claude gets user_location.country. NOTE: en-US runs now also send country US; the en-US baseline did not, so the next en-US diff mixes that change in.
- fr-FR GEO baseline local-55af2f79: CacheDrop 0/50; top picks AppCleaner 9, CleanMyMac 3; $0.883 (vs $0.56 en-US). French judge blind eval 93.3% (56/60), CacheDrop 100% → passes. Labels eval/geo-labels-fr-FR-v1-test.json (fresh, not tuned on).
- fr-FR keywords local-44296df8: cachedrop.io 0/41; reddit 40/41, youtube 34.
- Known gap for ja-JP: labels.ts slug (and geo-agreement idFor) are ASCII-only; katakana product names would become empty ids. Fix before the ja-JP run.
- Owner's new request (late): full marketing/funnel agent suite before scheduling. Proposal with decisions in prototype/docs/marketing-agents-proposal.md. Nothing built (L3).
- Unfinished: 5b step 4 (fr-FR on-page + hreflang/lang checks + French answer-check eval), step 5/6 for de-DE/es-ES/pt-BR/ja-JP.
- Owner (late): wave 1 of the agent proposal approved with Claude's recommendations (drafts → Paperclip approval → Claude files website tickets; funnel data keys later; spend from the API budget); finish the French audit first.
- 5b step 4 DONE (fr-FR): langGaps (html lang incl. region vs market, hreflang self/x-default/translation/pair back), Tavily country, French-safe quote check (narrow no-break spaces). Run local-c1d9af4e: /fr/ pages 4 no (home, Adobe cache, plug-ins, System Data), 3 partial, 1 yes (pricing); all 8 flag lang fr-CA (#130); meta descriptions too long on all 8; $0.107. Competitors are French (Clubic, Les Numériques, Journal du Geek, Audiofanzine).
- French answer-check eval (16 blind openings, labels eval/onpage/labels-fr-FR-v1-test.json): answered-vs-no 100%, exact 93.8% → "no" verdicts are confirmed gaps. Quirk: opening ids hash the URL only, so a page found for two questions shares an id (eval judges the first question); harmless here (both "no"), keep in mind.
- Spend this session about $1.10 (total about $8.2 of $100).
- Next: wave 1 agents (claims reviewer → SEO content creator → on-page optimizer → funnel analyst skeleton until keys), then de-DE/es-ES/pt-BR/ja-JP (fix ASCII slug for ja-JP), then step 6.

## 2026-11-10 (session 4): marketing wave 1 built
- Claims & brand reviewer (`runners/marketing/claims-review.ts`, `claims-rules.ts`, facts `research/marketing/product-facts.json`): code checks for website Decisions 23/47/48/51/54 + French conventions; one Sonnet pass for invented proof, Trash claims, puns, never-claim capabilities and claims ahead of the shipped app (quotes verified in code). Decision 51 ("copy leads the product") means ahead-of-app claims are notes for the owner, not blocks: the proposal said otherwise and was corrected.
- Eval: 48 planted-violation cases written by an independent subagent that never saw the rules code (eval/claims/cases.json, split by sha256(id)). Dev fixes: French units with U+00A0; "free uninstaller" describing a competitor. Dev and test 100% recall, 100% clean pass. Small set from one writer: real drafts will be harder.
- On-page optimizer (`onpage-fixes.ts`): code fixes (html lang, JSON-LD from an allow-list), Sonnet title/meta/opening from the live page text, every text through the reviewer, exact "fix" findings applied in code, fields fixed by a website decision marked. Bug found: runs before 5b step 4 have no html_lang; absent ≠ missing.
- Content writer (`content-writer.ts`): built as a pipeline, not a claude_local agent (no web/shell needed; a new lockdown would be L3). Briefs in code from GEO mentions/citations, SERPs and on-page verdicts; `related_pages` stops new pages competing with existing guides. Drafts in research/marketing/drafts/<locale>/ with `verify` (paths and menus to check against the apps before filing).
- Funnel analyst (`funnel.ts`, docs/funnel-export.md): aggregate CSV only, personal columns refused, numbers computed in code, model text rejected if it uses a number not in the table. Data folder git-ignored (business numbers, public repo).
- Facts file was incomplete (missed Ableton Live cache cleaning, all-format plug-in uninstall with receipts, vendor managers, bundle-ID matching): the reviewer over-flagged until fixed from mac-cleaner GLOSSARY/RESET. Lesson: build the facts from mac-cleaner's glossary, not only release notes.
- Paperclip: Claims Reviewer 5cf09692, Content Writer 4c9f196d, On-page Optimizer 34086c94, Funnel Analyst 7b25ede5 (process, `--env-file=.env` instead of a key in adapter config; new agents start paused: POST /agents/:id/resume). Probation: HEA-12 (review), HEA-13 (draft en-US q05), HEA-14 (funnel, synthetic numbers) all done, cost recorded, no budget pause.
- Reviewer false positives found on real output and fixed (eval rerun after each, still 100%/100%): "everything goes to the Trash" is TRUE for uninstalls (mac-cleaner RESET 41); "safe/sans risque" alone is not a Trash claim. Stop tuning on production output now; log new patterns instead.
- Spend this session about $4.7 (evals ~$1.0, on-page optimizer runs ~$2.8 incl. reruns, drafts ~$0.85, rest cents). Total about $12.9 of $100.
- Throwaway folder research/marketing/onpage-fixes/local-c1d9af4e-only/ left uncommitted: the rm was blocked by the safety check; owner can delete it.
- Owner approved wave 1 output with Claude's recommendations (2026-11-10): France French, funnel via CSV first, keep Decisions 47/54 wording. Claude reviewed every item first and dropped: homepage opening + breadcrumb (D51), compare meta/opening (D54), the Ableton cache page (the producer page already has that section and FAQ; a new page would compete). Ableton drafts also had the wrong delete scope (`~/Library/Caches/Ableton` vs mac-cleaner's `~/Library/Caches/Ableton/Cache`) and mismatched EN/FR slugs.
- Filed cachedrop-website #131 (28 on-page changes EN+FR), #132 (France French terms + typography; legal pages excluded; currency left to the owner), #133 (new guide "free up space on a full Mac" EN+FR with the verify checklist; blocked by #132).
- 5b for de-DE, es-ES, pt-BR, ja-JP DONE. ASCII product ids fixed first (productId: Latin accents fold, other scripts kept; NFKD alone broke katakana プ). Sets generated via Paperclip HEA-15..18, owner approved 7 swaps (duplicate competitor-comparison pairs, weak Spanish questions), frozen.
- GEO baselines: 0/50 recommended everywhere ($3.27). ja-JP: Claude mentions CacheDrop once, from the PUBLIC mac-cleaner GitHub repo, as "an open-source tool in development" (website Decision 30 says the repo goes private before launch; still public). Keywords (157 Serper credits): cachedrop.io in no top 10; pt-BR SERPs carry translate.google.com 21×; ja-JP sources note.com, Yahoo Chiebukuro, Qiita, Zenn.
- Judge rubric gap: vendors' own installers (Native Access, Waves Central, ...) listed in some answers, not others. Rubric now excludes them and security tools; all six baselines relabelled (en relabel-66062516, fr 6acc1f45, de 7ee2c535, es b4882560, pt ba85d547, ja 4fcbb5e8; these are the baselines now). Agreement under the new rubric: en 93.9/94.9, fr 91.7, de 94.7, es 96.3, ja 93.5, pt 90.9 + fresh 93.4.
- Relabel bug fixed: it used the en-US set for every run (now reads the saved run's locale).
- My mistake: "approved" comments on HEA-13/15-18 woke the agents and re-ran them (stray drafts restored from git; ~$0.12). Anti-pattern recorded.
- Spend this part about $6.2 (GEO $3.27, relabels ~$2, evals/agents rest). Total about $19 of $100.
