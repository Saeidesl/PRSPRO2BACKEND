# PMS Readiness Audit — Phase 1

Date: 2026-10-23
Scope: repository source audit for `Saeidesl/PRSPRO2` and `Saeidesl/PRSPRO2BACKEND`, with emphasis on production workflow, project material requirements, procurement, event integration, reporting, access control, and release readiness.

## Audit boundary

This is a source-code audit of the `main` branches. It does not prove that the currently deployed Apps Script version matches the repositories, that the live spreadsheet has the declared headers, or that production data flows pass end-to-end. Those require deployment/environment access and live smoke tests.

## Existing capabilities verified in source

- Project model contains suggested `Quantity`, `ColorSizeJSON`, workflow references, allowed departments/users, and current step/status fields.
- Event types support dynamic fields, project/independent relation, workflow movement, color/size tracking, variant quantity, and work-completion metadata.
- Workflow step-to-department assignments have a dedicated sheet/repository/service path.
- Procurement has separate material needs, purchase orders, order lines, allocations, and receipts.
- Procurement service supports multi-line orders, need/project allocations, partial receipts, remaining quantities, request-level caching through the sheets repository, a combined workspace endpoint, dashboard and reports.
- Event type procurement configuration supports `NONE`, `CREATE_NEED`, `RECORD_RECEIPT`, and (on the implementation branch) `RECALCULATE_CONFIRMED_NEEDS` with dynamic-field mappings.
- EventService includes procurement projections in project timelines and records explicit audit information if the post-event procurement integration fails.
- Project reports include project events and project-scoped procurement data.
- Router contains permission checks for procurement reads/writes and workflow/event management.
- CI workflows exist for frontend JavaScript/CSS checks and backend Node tests/source syntax checks.
- The original `main` branch test coverage was limited to `tests/report-service.test.js`; implementation-branch tests now cover material specifications, estimate/confirmed calculations, event mapping, procurement idempotency and schema contracts.

## Confirmed gaps and risks

1. **Baseline gap addressed on the implementation branch:** versioned per-project material specifications now capture consumption per unit, wastage and early-order policy; legacy needs remain untouched. A need currently stores a scalar `RequestedQuantity`, not a normalized per-unit consumption rate, calculation basis, wastage rule, or specification revision.
2. **Baseline gap partially addressed on the implementation branch:** an explicitly configured event type and dynamic quantity field can trigger confirmed-needs recalculation; there is no separate approval workflow in the current app, so registering the configured event is the authorization/confirmation boundary. Event dynamic fields and variant quantities exist, but do not alone guarantee this workflow.
3. **Residual risk:** EventService still persists the production event before the integration applies. The new confirmed-needs action is idempotent, has a retry endpoint, and flags affected needs for review when their source event is voided, but this is recoverable consistency rather than a true cross-sheet transaction. EventService persists the event and then applies procurement integration; integration errors are audited, but the original event can remain saved. Retries need idempotency to avoid duplicate material needs/receipts.
4. **The order creation path validates the payload before writes, but Google Sheets does not provide a multi-sheet transaction.** A write failure after the order header is inserted can leave partial order data; recovery/compensation and idempotency require explicit handling.
5. **Partially addressed:** order/receipt writes use script locks; confirmed and estimated material calculations now use a script lock. Live contention behavior still needs end-to-end verification.
6. **The database declaration uses both `18_MaterialNeeds` and `18_ProjectStatuses`.** Names differ, so this is not itself a collision, but the duplicated numeric prefix is confusing and should only be changed through a non-destructive migration. Never rebuild/delete sheets in production to renumber them.
7. **A received quantity is not the same as usable warehouse stock.** The current procurement model records receipts but does not constitute a complete inventory ledger with stock movements, reservations, issues/consumption, returns and stock valuation.
8. **Baseline gap addressed on the implementation branch:** per-material early-order policy supports disabled, estimated-quantity and manual-quantity modes. There is no first-class per-material policy for early ordering based on estimate versus ordering against confirmed needs.
9. **Partially addressed:** calculations are append-only with revision, basis, source event, prior quantity and variance; older material needs are superseded rather than deleting order/receipt history. A versioned calculation ledger and variance records are needed when confirmed quantity/specification changes.
10. **Improved but not complete:** backend tests now cover material planning, event mapping, procurement idempotency and schema contracts; authorized-user end-to-end tests and real Sheets behavior remain outstanding. Current checked-in tests focus on project-report tenant/visibility scoping; procurement arithmetic, concurrency, idempotency, authorization, migration and frontend integration need tests.
11. **Repository CI is not equivalent to live deployment validation.** Backend workflow checks syntax and Node tests; the Apps Script sync workflow requires repository secrets and deploys only under its configured trigger/guard. This audit cannot verify secret availability, the live Script ID, or the deployed version.
12. **Frontend is a static HTML/CSS/JS app.** Existing UI modules must continue to use the current API/permission conventions; a new feature must not bypass backend authorization or break mobile layouts.

## Data and business rules to lock before implementation

- Project suggested quantity is planning data and must not automatically become confirmed production quantity.
- A material specification is project-scoped and versioned; each line has material/item identity, unit, consumption per garment (or another explicitly declared basis), allowed wastage, and early-order policy.
- A configured, authorized and validated event is the only source of confirmed production quantity. The exact event type, field mapping, approval status and variant aggregation rule must be explicit.
- Estimated need and confirmed need must be distinguishable. A calculation records the specification revision, quantity basis, source event, formula inputs, output and timestamp.
- Ordered quantity, received quantity, remaining-to-order, remaining-to-receive and usable stock are separate measures.
- Prior orders and receipts are preserved. Changes in confirmed quantity create a variance/recalculation record and require review of affected orders; they do not delete or rewrite history.
- Reprocessing the same event/request must be idempotent.
- Every lookup/write must be scoped to tenant and checked against project visibility and permissions.
- Existing sheets/data are migrated non-destructively; no destructive reset is acceptable.

## Phases and acceptance gates

### Phase 1 — Audit and baseline
- [x] Inspect frontend/backend repository trees and key source paths.
- [x] Inspect workflow, event, project, procurement, report, router, database schema and CI configuration.
- [x] Record current capabilities, gaps, data-safety risks and release boundary.
- [x] Establish acceptance criteria for later phases.
- [x] Capture baseline GitHub Actions results and run CI on the implementation branches.
- [ ] Confirm the currently deployed Apps Script version and live spreadsheet headers; repository access alone does not expose that state.

### Phase 2 — Data model and non-destructive migration
- [x] Add versioned project material specifications.
- [x] Add durable, idempotent material-need calculation/revision records.
- [x] Add additive schema migration that preserves existing rows and validates expected headers.
- [x] Keep legacy needs/orders/receipts readable; no historical consumption rates are invented.
- [x] Add schema contract tests.

### Phase 3 — Confirmed quantity event integration
- [x] Configure the authoritative event type and confirmed quantity field.
- [x] Validate quantity, project visibility and event permissions; the app has no separate approval subsystem.
- [x] Recalculate needs idempotently and audit failures.
- [x] Preserve event history, add a retry endpoint for confirmed-needs integration, and flag affected needs for review when the source event is voided.
- [x] Add event integration tests.

### Phase 4 — Procurement calculation and consistency
- [x] Implement estimate vs confirmed need and early-order policy.
- [x] Aggregate early-order allocations into confirmed needs by material specification key and distinguish ordered/received/outstanding quantities.
- [x] Preserve calculation history and supersede old need/specification revisions without deleting order/receipt history.
- [x] Serialize order, receipt and material-calculation writes; partial multi-sheet order failures are marked `NEEDS_REVIEW`.
- [x] Add procurement idempotency, calculation, lock and tenant-visibility tests; broader live concurrency testing remains a release gate.

### Phase 5 — Frontend and reporting
- [x] Add project material specification UI.
- [x] Show estimate policy, per-unit consumption, wastage and calculation history; procurement workspace continues to show order/receipt/shortage balances.
- [x] Use existing responsive form controls and project-card patterns.
- [x] Update project reports with need/order/receipt balances and calculation history.
- [x] Run frontend syntax and local-asset/CSS checks.

### Phase 6 — Release validation
- [x] Run backend unit tests and syntax checks on the latest validated implementation commit.
- [x] Run frontend syntax and local-asset/CSS checks on the latest validated implementation commit.
- [ ] Verify migration on a copy/staging spreadsheet before production. No staging spreadsheet or authorized test-user session is exposed to this work session.
- [ ] Verify deployed Apps Script version and API URL; the repository CI does not deploy the branch and no authenticated live deployment status is available here.
- [ ] Run end-to-end acceptance scenarios with authorized test users.
- [ ] Verify no regressions in workflow, events, projects, procurement and reports using a live/staging environment.
- [ ] Publish a precise release report. Do not call the system ready for use until live/staging acceptance has passed.

## Release blockers

- Do not delete or recreate existing sheets as a shortcut.
- Do not deploy to production merely because repository syntax checks pass.
- Do not report “ready” without a successful end-to-end run against the target Apps Script deployment and a representative spreadsheet.
- Do not infer a missing historical consumption rate for existing material needs; require review or preserve as legacy.
