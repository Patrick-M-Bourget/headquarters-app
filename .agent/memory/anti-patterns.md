# Anti-patterns

- Paperclip `claude_local` skips permissions by default. Never assume `cwd` sandboxes the agent.
- Paperclip `process` adapter: exit code is the only success signal and no issue ID is passed. The runner must report through the API.
