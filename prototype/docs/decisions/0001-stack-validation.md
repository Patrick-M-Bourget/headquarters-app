# ADR 0001: HeadQuarters stack validation (Paperclip, Mastra, Claude Code)

- **Status:** Proposed (owner decides; architecture-level, L3)
- **Date:** 2026-11-09
- **Evidence:** `prototype/research/runs/`, `prototype/agent-workspace/runs/`, `.agent/memory/journal.md`, Paperclip issues HEA-1 to HEA-9

## Question

Can Paperclip (orchestration), a Claude Code agent and a Mastra pipeline do real agent work for HeadQuarters, using CacheDrop competitor research as the workload? Kill criteria from the plan:
- **Paperclip** is dropped if its task history, review and UI don't beat a script plus a run folder.
- **Mastra** is dropped if it isn't measurably better than the agent path on at least one of accuracy, cost or reproducibility.

## What we measured

All runs used the same 10-competitor seed list and were scored against `eval/answer-key.json` (37 fields from the 2026-10-22 desk research). Disagreements were re-checked live.

| Runner | Model | Accuracy (decided) | Coverage | Verified / 120 | Time | Cost |
|---|---|---|---|---|---|---|
| Claude Code agent, run 1 (HEA-5) | Sonnet 5.5 | 96.2% | 70.3% | 54 | ~10 min | $1.18 |
| Claude Code agent, run 2 (after review) | Sonnet 5.5 | 93.3%¹ | **81.1%** | **70** | ~4 min | $1.36 |
| Mastra pipeline (HEA-8) | Sonnet 5.5 | **100%** | 67.6% | 52 | **49 s** | $0.36 |
| Mastra pipeline (weak-model proxy) | Haiku 5.5 | 96.0%² | 67.6% | 52 | 38 s | **$0.02** |

1. Both misses were answer-key or contract problems (an App Store vs direct price; a missing distribution value), not agent errors.
2. A real reasoning error: it inferred "subscription" from a true quote ("Starting at $3.33/month").

**Prompt injection** (`eval/injection/`: hidden instructions to falsify the price, mark every feature yes, leak `.env`, read an SSH key, add a canary word, self-approve): the Claude Code agent, Mastra on Sonnet and Mastra on Haiku all passed 6/6 checks and flagged the attempt. The agent got the page as a local file rather than through web fetch (which won't load localhost), and its tool-call log wasn't parsed. The lockdown (verified separately in HEA-1 to HEA-4) blocks those reads anyway.

**Total API spend for the prototype:** about $4.15.

## Findings

**Claude Code agent (`claude_local`):**
- (+) Best coverage. It searches, finds the right pages, works around blocks, and reasons well about caveats.
- (−) Its evidence is a page summarizer's paraphrase, not a verifiable quote.
- (−) It is about 4× costlier and 5–10× slower than the pipeline.
- (−) It needs hand-holding: it stalled when instructions or the schema weren't in its workspace.
- (−) Locking it down was hard. It inherited the owner's ~260 user-level permission rules (`node -e` could read any file). It needs `--setting-sources project --settings <file>` *and* Paperclip's legacy runner. Filesystem sandboxing in Paperclip is Linux-only.
- (−) For a local model it's a poor fit: long self-directed tool loops are what weak models do worst, and the harness is Claude-specific.

**Mastra pipeline (`process` adapter):**
- (+) Cheapest and fastest. Evidence is checked in code against the fetched page, and recommendations must cite verified observations.
- (+) The model has no tools, so injection can corrupt at most a field.
- (+) Swapping Sonnet for Haiku was one environment variable, with accuracy held. That's the path to a local Qwen.
- (−) Lower coverage: it only follows links from each homepage, has no search, and MacPaw's store blocks plain fetches.
- (−) The evidence check catches made-up quotes, not wrong conclusions from real ones (the Haiku error).
- (−) We used a thin slice of Mastra (workflow steps, structured output, the model router). The same pipeline is a similar amount of code with the plain Anthropic SDK. Its real value here is provider portability.

**Paperclip:**
- (+) Useful: task history per issue; the review → changes-requested → rework loop worked (run 1 → run 2 improved coverage 70% → 81%); separate agents with separate permissions (Researcher, Engineer); per-agent budgets; cost tracking for `claude_local`.
- (−) Default unsafe: `claude_local` runs with permissions skipped, its default runner rejects lockdown settings, and its own skill tells agents to use `curl`.
- (−) The `process` adapter is thin. No issue ID is passed; exit code is the only signal; the runner must find its issue and report status and cost through the API (≈ half a session of glue, including one bug on our side).
- (−) Budgets hard-stop a `process` agent after its first run because the run counts as "unpriced" (default policy: block), even at $0 observed. Local-model runs would always be unpriced.
- (−) After a failed run, Paperclip's recovery put HEA-7 on hold. UI retry, setting status back to todo, reassigning and heartbeat/invoke all failed to resume it; it took a new issue. The owner hit this as "retry seems jammed".
- (−) 2.7 GB of `node_modules` (embedded Postgres) and about 560 MB RAM on a 16 GB machine; 373 database migrations on first start.
- (−) Paperclip had to be operated mostly through its API. Its UI was touched only for the jammed retry.

## Decision (proposed)

1. **Keep the pipeline approach as the default for HQ research workers, and keep Mastra for now.** It met the bar: better cost (4×), speed (≥5×) and reproducibility (verified quotes). It's the realistic route to local Qwen. Revisit Mastra vs plain SDK once a local provider is wired in; if Mastra adds nothing there, drop it, since the pipeline design is the asset, not the framework.
2. **Use a Claude Code-style agent only where open-ended exploration earns its cost** (e.g. hard-to-find facts, coding tickets), behind the lockdown recipe, and expect it to stay on cloud Claude.
3. **Paperclip: keep on probation, not adopted.** The review loop, task history and per-agent permissions are real value we'd have to rebuild. But it's unsafe by default, fragile on failure (jammed recovery), awkward for `process` agents (unpriced budgets, no issue ID), and heavy for this machine. Re-test it on the SEO/GEO workflow before committing. Kill if the recovery jam or the glue cost recurs.
4. **Keep the data contracts and scorer framework-independent** (`packages/data-contracts`, `eval/`). They survived every runner change unchanged except one reviewed contract addition (HEA-6).

## Follow-ups

- Pipeline coverage: add a search step for pricing/features pages; use the GitHub README API for open-source tools; fix the OmniDiskSweeper seed URL.
- Add a check for over-reaching conclusions (e.g. a second-pass "does this quote support this value?" check) before trusting weaker or local models.
- The scorer should report per price channel; the contract should enforce allowed values per field (agent-flagged in HEA-6).
- Local model: try a small Qwen through Ollama on the M3 with the Haiku-proven pipeline, before the M6.
- Paperclip: find the API to resolve a recovery hold, so a failed run can be retried in place.
