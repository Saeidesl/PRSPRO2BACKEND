# PMS automation agents

This file describes the automated agents installed for the PMS repositories. The agents are deterministic CI checks, not autonomous code-writing bots. They report evidence and block their own check when an invariant fails; they do not merge pull requests, write Google Sheets, or deploy Apps Script themselves.

## Available agents

| Agent | Where it runs | Purpose | Result |
|---|---|---|---|
| Cross-repository QA | Frontend repository: `.github/workflows/pms-cross-repo-qa.yml` | Checks frontend syntax/assets/CSS together with backend tests, Apps Script manifest and critical integration files | Required CI signal; read-only |
| Domain Contract Review | Backend repository: `.github/workflows/pms-agent-suite.yml` + `scripts/pms-agent-audit.js` | Checks event persistence/integration ordering, confirmed quantity validation, tenant/project boundaries, idempotency, partial procurement quantities, and regression-test presence | JSON report in Actions log; fails on missing safety contracts |
| QA + Release Safety | Backend repository: `.github/workflows/pms-agent-suite.yml` | Runs backend unit/integration tests, syntax/schema checks and deployment-contract tests | CI pass/fail |
| Workflow/Supply Regression | Backend repository: `tests/material-planning.test.js`, `tests/procurement-event-integration.test.js`, and the agent suite | Exercises confirmed quantity → material needs, replay safety, event voiding and event-to-procurement integration contracts | Automated test results |
| Workflow Failure Monitor | Both repositories: `.github/workflows/agent-monitor.yml` | Checks recent GitHub Actions failures daily and opens/updates a tracking issue | Daily alert; manual run also available |

## How to use

1. Open **Actions** in either repository.
2. Select **PMS cross-repository QA** in the frontend repository or **PMS agent suite** in the backend repository.
3. Choose **Run workflow** to run the checks manually, or rely on pull-request/push triggers.
4. Open the run and review each job's result and logs. A red check means investigate the evidence; do not bypass it without understanding the failure.

## Safety boundaries

- The agents have read-only repository permissions except the existing failure monitor, which needs issue permission to file alerts.
- The agents never receive Apps Script deployment credentials in these workflows.
- They do not auto-merge, rewrite application files, or mutate production Google Sheets.
- The existing backend sync/deployment workflow is separate. A merge to backend `main` may trigger that workflow under its existing policy; review its status separately.
- A green static audit is not a live production test. The audit verifies known source-level contracts and existing regression tests; it cannot prove that a tenant's event-type mapping is configured correctly in the live database.
