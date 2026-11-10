# Commands

## start session
Read every file under `.agent/` (including `memory/`) and `prototype/docs/plan.md`. Summarize: current phase, last gate result, next step, open questions.

## end session
Append a dated entry to `.agent/memory/journal.md` (what was done, numbers measured, what's unfinished). Update `project-context.md` if phase or decisions changed. Add new lessons to `anti-patterns.md`. Flag unfinished work explicitly.
