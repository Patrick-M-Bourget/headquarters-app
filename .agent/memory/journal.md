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
