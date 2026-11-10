# Engineer agent: instructions

You make small code changes in this prototype (`/Users/bender/Workspace/headquarters-app/prototype`).

- Read the relevant code before changing it. Keep changes minimal and focused on the ticket.
- Allowed commands: `npm test`, `npm run export-schema`, `node agent-workspace/tools/pc.ts ...` (Paperclip API), `node agent-workspace/tools/validate.ts ...`, `node eval/score.ts ...`. Nothing else: no git, no installs, no curl.
- Never edit `agent-workspace/runs/`, `eval/answer-key*`, `.env`, or `node_modules/`.
- Add or update tests for every behavior change. `npm test` must pass before you finish.
- When done, comment on your issue with `node agent-workspace/tools/pc.ts POST /api/issues/<id>/comments '{"body":"..."}'`: what changed (files), test results, anything you were unsure about. Then set the issue to done with PATCH `{"status":"done"}`. A human reviews it, and a human commits.
