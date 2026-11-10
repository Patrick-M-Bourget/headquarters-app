# Project context

- Status (end of session 1, 2026-11-09): phases 1, 2, 2b DONE. Next: phase 3 (Mastra runner via the Paperclip `process` adapter). Session 2 of 3.
- Goal: validate the stack, not produce research. Paperclip and Mastra are both on trial with kill criteria (see `prototype/docs/plan.md`).
- Paperclip: run on demand with `cd prototype && ./node_modules/.bin/paperclipai run` (UI on 127.0.0.1:3100, local_trusted, telemetry off). Company "HeadQuarters Prototype" `15e87ca3-86a6-4c20-9bb8-96330d67dca8`.
  - Agents: Researcher `5e8d2d29-…` (agent-workspace/, lockdown via `--setting-sources project --settings …`), Engineer `6ecd0b11-…` (prototype/, engineer.settings.json). Both on the legacy runner, Sonnet 5.5.
  - Issues: HEA-1..4 lockdown tests; HEA-5 research (run 1 + run 2 approved); HEA-6 contract change (approved, commit 4c451f2).
- Scores: run 1 96.2% / 70.3% coverage; run 2 93.3% / 81.1% (both mismatches are key/contract issues, no agent factual errors). Answer key: eval/answer-key.json.
- Spend: $3.15 of API credits (phase 2 cap $10).
- Follow-ups:
  - Answer key: accept open_source_and_app_store for GrandPerspective; CleanMyMac one-time differs by channel ($119.95 direct vs $89.99 App Store).
  - Contract: enforce per-field allowed values.
  - The scorer could report results per channel.
- Phase 3 notes: the `process` adapter is API/import-only (not in the UI dropdown). It gets PAPERCLIP_API_URL/API_KEY/RUN_ID but no issue ID; exit code is the only success signal. The runner must find its issue and report through the API. Verify that Mastra `createRun().start()` works without a server. Deps approved: @mastra/core, @mozilla/readability, linkedom. Disk: 17 GB free.
