# GitHub Copilot instructions — PRSPRO2BACKEND

Follow `PMS-AGENTS.md` and any `AGENTS.md` instructions. For implementation tasks, prefer the `pms-backend-implementer` custom agent.

- Work on a task branch and submit a PR; do not push application changes directly to `main`.
- Trace the full request-to-persistence-to-integration path before changing backend behavior.
- Add regression tests for event validation, confirmed quantities, material planning, idempotency/replay, partial procurement, permissions, and error propagation when relevant.
- Run targeted tests and the full available backend suite; state exact results and remaining gaps.
- Never call production Apps Script endpoints or mutate live Google Sheets/Drive during tests.
- Never include secrets or real production records in code, logs, fixtures, or PRs.
- Do not merge or deploy. Remember runtime root JS and `appsscript.json` changes can trigger Apps Script sync/deploy after merge to `main`.
- Never claim a live test or deployment succeeded without evidence.
