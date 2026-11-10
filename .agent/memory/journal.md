# Journal

## 2026-11-09
- Grilled the ChatGPT HQ spec into `prototype/docs/plan.md`. Cloned the empty repo, added the agent layout, `.gitignore`, and the API key in `prototype/.env` (ignored).
- Free disk before installs: 13 GB.
- Phase 1: `npx paperclipai onboard` failed with npm's npx lock timeout (`ECOMPROMISED`, libnpmexec with-lock). Fix: local `npm install paperclipai` in `prototype/`, then `./node_modules/.bin/paperclipai onboard --yes --bind loopback --no-install-service`.
- Phase 1 gate: UI on http://127.0.0.1:3100. Disk: `prototype/node_modules` 2.7 GB, `~/.paperclip` 86 MB, failed npx cache 1.2 GB; free 13 GB → 10 GB. RAM: Paperclip node about 560 MB, embedded Postgres about 55 MB.
- Node 24.13 triggers EBADENGINE warnings (jsdom wants >=24.15). Not blocking so far.
- Paperclip makes hourly DB backups kept 30 days. Watch disk.
