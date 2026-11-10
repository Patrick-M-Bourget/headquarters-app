# Anti-patterns

- Paperclip `claude_local` skips permissions by default. Never assume `cwd` sandboxes the agent.
- Paperclip `process` adapter: exit code is the only success signal and no issue ID is passed. The runner must report through the API.
- Never trust a lockdown that only passed on paths you explicitly denied. Test unlisted paths and `node -e` too; the agent can inherit the owner's user-level allow rules.
- A claude_local agent needs `--setting-sources project --settings <abs>/.claude/settings.json`; neither flag alone works.
- Put everything the agent needs (contract schema, rules on how to write output) INSIDE its workspace; it can't read the rest of the repo.
- WebFetch evidence is summarizer output, not verbatim page text. Don't call it a verbatim quote.
