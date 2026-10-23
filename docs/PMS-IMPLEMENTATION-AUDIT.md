# PMS implementation audit and phased completion plan

Audit date: 2026-10-23
Repositories: Saeidesl/PRSPRO2 and Saeidesl/PRSPRO2BACKEND
Scope: source-code review of project material planning, procurement, event integration, schema migration, routing, frontend project actions, and automated tests. This is not a claim that the deployed Apps Script endpoint has been tested.

## Phase 1 — audit findings

### Existing implementation confirmed in source
- Versioned project material specifications in MaterialPlanningService.js and sheets 24_ProjectMaterialSpecs.
- Append-only material calculation history in 25_MaterialNeedCalculations.
- Early-order policies DISABLED, ESTIMATE_ALLOWED, and MANUAL_ALLOWED.
- Estimated need creation and confirmed need recalculation.
- Idempotency keys for calculations and estimated needs, and script locks for calculation paths.
- Event-type mapping action RECALCULATE_CONFIRMED_NEEDS in ProcurementEventIntegrationService.js.
- Event void handling calls MaterialPlanningService.markEventVoided and marks affected needs for review.
- Procurement supports needs, purchase orders, allocations, batch receipts, and idempotency checks.
- Router endpoints exist for material specifications, calculation history, estimate creation, specification revision, and procurement retry.
- Backend tests exist for material planning, procurement service, integration, schema contracts, and project reporting.
- Database setup is designed to add missing headers/sheets without deleting existing rows.

### Risks and gaps to close during implementation
1. The material-planning backend exists but the project-card frontend does not expose material-specification management; current project actions expose only manual material needs and color/size.
2. The current source audit does not prove that the live Apps Script deployment has the same revision as main or that the live spreadsheet has all expected headers.
3. Sheet names 18_MaterialNeeds and 18_ProjectStatuses share a numeric prefix. They are distinct names; do not rename existing sheets without a migration plan. Treat this as a naming/maintenance inconsistency, not a proven runtime collision.
4. Event creation persists the event before applying the post-save procurement integration. Failures are logged and retry support exists, but users and operators must be able to see/retry failures; idempotency must be preserved.
5. Material need calculation must keep estimate vs confirmed quantities separate, retain previous revisions and orders, and surface NEEDS_REVIEW states rather than silently overwriting history.
6. Order totals, allocations, receipts, cancelled orders, and cross-project allocation cases require tests to prove that new confirmed needs are not double-counted and receipts cannot exceed valid allocations.
7. Permission checks must be verified for read-only viewers vs project editors and procurement managers.
8. The project material-specification UI, calculation-history UI, and clear feedback for estimated-need creation are missing from the reviewed project page module.
9. Automated unit tests and source syntax checks are present in GitHub Actions, but a passing workflow and live deployment smoke test are required before calling the app ready for use.

## Phased execution / acceptance criteria

### Phase 1 — audit and baseline
- Document existing code, data model, routes, permissions, tests, migration behavior, and known gaps.
- Preserve existing sheets and production data; no destructive schema reset.
- Record a baseline and use an isolated feature branch.

### Phase 2 — material specification UI
- Add project-level UI to list/create/revise versioned material specifications.
- Capture item name, unit, consumption per unit, wastage, early-order policy, optional manual early quantity, and notes.
- Trigger estimated-need calculation only on explicit user action.
- Show calculation history and API errors; keep the interface responsive on mobile.
- Use existing backend routes and preserve the audit trail.

### Phase 3 — confirmed-quantity event integration
- Ensure an event type can map an active dynamic field to ConfirmedQuantity.
- Validate project linkage and quantity before event persistence.
- Confirm event replay is idempotent and event voiding moves affected needs to review.
- Make integration failures visible and retryable.

### Phase 4 — procurement reconciliation
- Verify calculations against needs, orders, allocations, receipts, cancelled orders, and revisions.
- Preserve legacy needs and order history.
- Add tests for changed confirmed quantity, revised specs, estimates superseded by confirmed needs, partial receipts, duplicate requests, and concurrent writes.

### Phase 5 — UX, reporting, and performance
- Surface estimated vs confirmed need, remaining-to-order, ordered, received, and remaining-delivery quantities.
- Make failure/retry state visible.
- Check mobile layout, accessible feedback, and avoid redundant sheet reads.

### Phase 6 — verification and release
- Run all backend tests and syntax checks in GitHub Actions.
- Run frontend checks and inspect changed-file diffs.
- Verify deployment workflow configuration and ensure no automatic Apps Script deployment is enabled unintentionally.
- Perform a live smoke test of project specs, estimate creation, confirmed event integration, procurement order, partial receipt, and event void/retry against the actual Apps Script deployment.
- Do not declare production readiness until the live smoke test and permissions are verified.

## Readiness rule
A successful source review or unit-test run alone does not establish production readiness. Final acceptance requires passing automated checks, reviewed diffs, matching deployed revision, working spreadsheet schema, and a successful live end-to-end smoke test.
