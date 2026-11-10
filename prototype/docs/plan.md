# HeadQuarters stack prototype: CacheDrop competitor research as the test workload

## Context

ChatGPT drafted a "HeadQuarters" prototype spec: Paperclip as the agent control plane, Mastra as the research engine, cloud Claude in place of local inference on this M3 (16 GB RAM, about 14 GB free). The grilling session settled the following:
- **Goal:** validate the stack. HQ will eventually run business-ops agents (research, marketing, reports) and, later, coding agents on the user's repos. CacheDrop competitor research is only the test workload.
- **Paperclip is on trial**, not already chosen. The ADR at the end makes the keep/kill call.
- **Answer key:** `mac-cleaner/docs/reference/macos-cleaner-competitors.md` (Oct 22, 2026, 10 competitors, sourced). It's a reference, not truth. Disagreements get settled against the live source page.
- **Dropped:** AutoJev, Phoenix, Ollama/Qwen, OpenCode, the HQ Postgres design, review scraping.
- **Time box:** 3 sessions. Stop at every phase gate. Going over the time box is itself a finding for the ADR.

## Where

- Clone `Patrick-M-Bourget/headquarters-app` (public, empty) to `~/Workspace/headquarters-app`. Run `project-setup` at the repo root.
- All prototype code lives under `prototype/`. The ADR decides what gets promoted to the root later.
- The repo stays public:
  - **Committed:** reports, observations (short evidence quotes), the answer key, the ADR.
  - **Gitignored:** `research/runs/*/snapshots/` (raw competitor HTML), plus `.env` and keys.

```
prototype/
  .claude/settings.json      deny rules: no reads outside prototype/, Bash limited to node/npm test
  packages/data-contracts/   zod: Competitor, Source, Observation, ResearchRun (+ JSON Schema export)
  packages/research-store/   node:sqlite + run folder writer
  runners/claude-agent/      research prompt/skill + output validator
  runners/mastra/            fetch → extract → compare → validate → persist, plus the Paperclip API reporter
  eval/                      answer key (copied in once), scorer, prompt-injection fixture page
  research/runs/<run-id>/    competitors.json, sources.json, observations.json, report.md, run.json
  docs/decisions/            ADR
```

Each Observation records: competitor, field, value, source URL, evidence quote, retrieved date, and status (`verified` / `unknown` / `hypothesis`).

## Approved dependencies (installed at the phase that needs them; anything else, ask first)

| Package | Phase |
|---|---|
| `paperclipai` (via npx) | 1 |
| `zod` | 2 |
| `@mastra/core` | 3 |
| `@mozilla/readability` + `linkedom` | 3 |

SQLite comes from Node's built-in `node:sqlite`.

## Billing

- Both runners use API credits from the existing Console org (the Max $100/month credits; the user links them in claude.ai billing).
- The key lives in a dedicated prototype workspace with a spend limit, and auto-reload stays off.
- Both runners use Sonnet 5.5. A Haiku extraction variant runs only afterwards, as a separate variant.

## Phases

1. **Paperclip up.**
   - `npx paperclipai onboard --yes`, run on demand only (no background service). Data goes to `~/.paperclip/`.
   - Measure disk before and after. Stop if free space drops below 8 GB.
   - Gate: UI on localhost:3100, with RAM and disk use recorded.
2. **Claude Code agent (`claude_local`, API key auth, Sonnet 5.5).**
   - Lockdown: `.claude/settings.json` deny rules plus `extraArgs --disallowedTools`. Paperclip's default is to skip permissions.
   - First, the test read: a task to read `~/Workspace/mac-cleaner/README.md` must fail. If it succeeds, stop; that counts against Paperclip.
   - Then the research task over the 10 seed competitors, writing a run folder.
   - Gate: schema-valid output, and ≥90% accuracy on the answer-key field set (price, license model, trial, distribution, core features). The user reviews this first report through Paperclip's review step (`executionPolicy`).
   - **2b:** a coding ticket for the `claude_local` agent: "add a `trialTerms` field to the contract, update the validator and its test". It goes through a Paperclip issue with the user as reviewer.
3. **Mastra through the `process` adapter.**
   - Configured through the API or a company import (the UI dropdown says "coming soon").
   - The runner gets `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY` and `PAPERCLIP_RUN_ID`, but no issue ID. It finds its issue through the API, posts a summary comment, sets the status (with the `X-Paperclip-Run-Id` header), and exits non-zero on any failure or partial run.
   - The workflow runs in-process via `createRun().start()` (verify this works without a server).
   - Same task, field set and accuracy bar as phase 2. Record cost, tokens and runtime for each run.
   - If the reporter glue takes more than about half a session, that's evidence against the `process` adapter.
4. **Failure and safety.**
   - Simulate a failed fetch. The run must show as failed or partial in Paperclip, never as success.
   - Prompt-injection fixture page: its instructions must be ignored.
   - Rerun and diff the observations.
5. **ADR.**
   - Compare phase 2 vs phase 3 (accuracy, cost, time, debuggability), and Paperclip vs plain `claude -p` plus a run folder (also counting 2b and the review flow).
   - Kill criteria:
     - Paperclip is dropped if task history, review and the UI don't beat a script.
     - Mastra is dropped if it isn't measurably better on at least one of accuracy, cost or reproducibility.

## Verification

- `npm test`: contracts, store round-trip, scorer on fixtures, simulated failure.
- For each runner phase: an actual run triggered from the Paperclip UI, with the scorer's numbers reported and disagreements re-checked against live pages.
- Screenshots of the Paperclip task view after a success and after a failure.
