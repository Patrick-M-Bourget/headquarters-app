# Anti-patterns

- Paperclip `claude_local` skips permissions by default. Never assume `cwd` sandboxes the agent.
- Paperclip `process` adapter: exit code is the only success signal and no issue ID is passed. The runner must report through the API.
- Never trust a lockdown that only passed on paths you explicitly denied. Test unlisted paths and `node -e` too; the agent can inherit the owner's user-level allow rules.
- A claude_local agent needs `--setting-sources project --settings <abs>/.claude/settings.json`; neither flag alone works.
- Put everything the agent needs (contract schema, rules on how to write output) INSIDE its workspace; it can't read the rest of the repo.
- WebFetch evidence is summarizer output, not verbatim page text. Don't call it a verbatim quote.
- Importing a runner script (`node -e "import('...run-geo.ts')"`) executes it. Check runners with `npm test` or a run limited with `--only`.
- Don't tune a model judge on the same labels you report: keep a fresh blind test set (eval/geo-labels-v1-test.json).
- `textContent` runs adjacent elements together ("TitleText", "Download for MacBuy"). Use `mainText` (onpage-checks.ts) for any text a model reads or a quote is checked against.
- `fetchPage` is for HTML only; plain-text files (robots.txt, llms.txt) need a plain fetch.
- Run-to-run diffs must not key on model wording or exact numbers; compare a stable key (`gapKey`).
- A 3-level model verdict can pass on one boundary and fail on another: score each boundary separately and only act automatically on the one that passed.
- Asking the judge for a one-line reason made it more accurate (on-page eval). Try it before tuning the rubric.
- A comment on a `process` agent's issue WAKES the agent and re-runs it (2026-11-10: "approved" comments on HEA-13/15-18 regenerated four drafts and a content draft). Record approvals in the repo (journal, frozen file) or on a separate unassigned issue, never as a comment on the agent's own issue.
