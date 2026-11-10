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
