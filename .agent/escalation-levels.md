# Escalation levels

Anything not listed is safe and reversible: proceed.

## L1: Inform (do it, then explain)
- Refactoring within one file
- Adding error handling
- Minor/patch dependency updates
- New utility files

## L2: Propose (wait for approval)
- Changing public APIs, interfaces, or the data contracts
- Database schema or query changes
- Deleting files or removing functionality
- Changes touching more than 3 files
- Anything involving auth, payments, user data, or API spend beyond the agreed caps

## L3: Stop (flag and wait)
- Production deployments
- Irreversible data operations
- CI/CD pipeline changes
- Security-sensitive changes (secrets, permissions, access controls, agent lockdown rules)
- Architecture decisions affecting the whole system (e.g. the keep/kill ADR outcome)
- Uncertain about the right approach
