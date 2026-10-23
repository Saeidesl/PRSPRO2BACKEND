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
- Event type procurement configuration currently supports `NONE`, `CREATE_NEED`, and `RECORD_RECEIPT` actions with dynamic-field mappings.
- EventService includes procurement projections in project timelines and records explicit audit information if the post-event procurement integration fails.
- Project reports include project events and project-scoped procurement data.
- Router contains permission checks for procurement reads/writes and workflow/event management.
- CI workflows exist for frontend JavaScript/CSS checks and backend Node tests/source syntax checks.
- Existing automated backend test coverage found in repository tree is limited to `tests/report-service.test.js`.

## Confirmed gaps and risks

1. **No complete material-consumption specification model is present in the reviewed project/procurement model.** A need currently stores a scalar `RequestedQuantity`, not a normalized per-unit consumption rate, calculation basis, wastage rule, or specification revision.
2. **No explicit canonical contract was found for an approved cutting/completion event to set the authoritative confirmed production quantity and trigger a versioned needs recalculation.** Event dynamic fields and variant quantities exist, but do not alone guarantee this workflow.
3. **Event and procurement integration are not atomic.** EventService persists the event and then applies procurement integration; integration errors are audited, but the original event can remain saved. Retries need idempotency to avoid duplicate material needs/receipts.
4. **The order creation path validates the payload before writes, but Google Sheets does not provide a multi-sheet transaction.** A write failure after the order header is inserted can leave partial order data; recovery/compensation and idempotency require explicit handling.
5. **Concurrency protection is currently visible on order creation, but must be verified for all paths that change the same material balance**, including receipts, need recalculation, cancellations and integration retries.
6. **The database declaration uses both `18_MaterialNeeds` and `18_ProjectStatuses`.** Names differ, so this is not itself a collision, but the duplicated numeric prefix is confusing and should only be changed through a non-destructive migration. Never rebuild/delete sheets in production to renumber them.
7. **A received quantity is not the same as usable warehouse stock.** The current procurement model records receipts but does not constitute a complete inventory ledger with stock movements, reservations, issues/consumption, returns and stock valuation.
8. **Procurement integration settings are limited to need creation and receipt recording.** There is no first-class per-material policy for early ordering based on estimate versus ordering against confirmed needs.
9. **Need recalculation must not mutate historical orders/receipts silently.** A versioned calculation ledger and variance records are needed when confirmed quantity/specification changes.
10. **Backend automated tests are too narrow for release readiness.** Current checked-in tests focus on project-report tenant/visibility scoping; procurement arithmetic, concurrency, idempotency, authorization, migration and frontend integration need tests.
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
- [ ] Capture and run baseline CI results from GitHub Actions and confirm live Apps Script version. This requires available GitHub Actions/environment access and is not proven by source inspection alone.

### Phase 2 — Data model and non-destructive migration
- [ ] Add versioned project material specifications.
- [ ] Add durable, idempotent material-need calculation/revision records.
- [ ] Add schema migration that preserves existing rows and validates expected headers.
- [ ] Keep legacy needs/orders/receipts readable and mark their calculation basis as legacy/unknown rather than inventing consumption rates.
- [ ] Add migration tests.

### Phase 3 — Confirmed quantity event integration
- [ ] Configure the authoritative event type and confirmed quantity field.
- [ ] Validate quantity and permission/approval requirements.
- [ ] Recalculate needs idempotently and audit failures.
- [ ] Preserve event history and support safe retry/reconciliation.
- [ ] Add event integration tests.

### Phase 4 — Procurement calculation and consistency
- [ ] Implement estimate vs confirmed need and early-order policy.
- [ ] Calculate ordered/received/outstanding/shortage without double counting.
- [ ] Preserve history on changed quantities, cancelled orders and revised specifications.
- [ ] Protect concurrent writes and partial multi-sheet writes.
- [ ] Add procurement arithmetic, concurrency/idempotency and authorization tests.

### Phase 5 — Frontend and reporting
- [ ] Add project material specification UI.
- [ ] Show estimated/confirmed requirement, early-order policy, order/receipt/shortage and revision history.
- [ ] Keep responsive mobile/desktop layout and existing design system.
- [ ] Update procurement and project reports.
- [ ] Add frontend smoke/syntax/accessibility checks.

### Phase 6 — Release validation
- [ ] Run all backend tests and syntax checks.
- [ ] Run all frontend checks.
- [ ] Verify migration on a copy/staging spreadsheet before production.
- [ ] Verify deployed Apps Script version and API URL.
- [ ] Run end-to-end acceptance scenarios with authorized test users.
- [ ] Verify no regressions in workflow, events, projects, procurement and reports.
- [ ] Publish a precise release report. Do not call the system ready for use until live/staging acceptance has passed.

## Release blockers

- Do not delete or recreate existing sheets as a shortcut.
- Do not deploy to production merely because repository syntax checks pass.
- Do not report “ready” without a successful end-to-end run against the target Apps Script deployment and a representative spreadsheet.
- Do not infer a missing historical consumption rate for existing material needs; require review or preserve as legacy.
