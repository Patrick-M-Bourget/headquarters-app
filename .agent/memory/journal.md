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
