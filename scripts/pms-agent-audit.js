'use strict';

// Deterministic PMS domain-contract review. This agent is intentionally read-only:
// it reports missing safeguards and never edits application code or production data.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const findings = [];
const checks = [];
function check(id, description, condition, severity = 'error') {
  checks.push({ id, description, passed: Boolean(condition), severity });
  if (!condition) findings.push({ id, description, severity });
}
function includesAll(source, patterns) {
  return patterns.every((pattern) => pattern.test(source));
}

const eventService = read('EventService.js');
const integration = read('ProcurementEventIntegrationService.js');
const planner = read('MaterialPlanningService.js');
const procurement = read('ProcurementService.js');
const integrationTests = read('tests/procurement-event-integration.test.js');
const planningTests = read('tests/material-planning.test.js');

const eventInsert = eventService.indexOf('const created = EventRepository.insert(newEvent)');
const preValidate = eventService.lastIndexOf('ProcurementEventIntegrationService.validate(', eventInsert);
const applyIndex = eventService.indexOf('ProcurementEventIntegrationService.apply(', eventInsert);
check('EVENT-VALIDATE-BEFORE-PERSIST', 'Mapped procurement inputs are validated before the event is persisted.',
  eventInsert >= 0 && preValidate >= 0 && preValidate < eventInsert);
check('EVENT-INTEGRATION-AFTER-PERSIST', 'Event creation applies the configured integration to the created event.',
  applyIndex > eventInsert);
check('INTEGRATION-FAILURE-VISIBLE', 'Post-persistence integration failures are returned and audited, not silently treated as success.',
  includesAll(eventService, [
    /status:\s*'FAILED'/,
    /PROCUREMENT_INTEGRATION_FAILED/,
    /رویداد ثبت شد اما اتصال تأمین نیازمند بررسی است/
  ]));

check('CONFIRMED-QUANTITY-ACTION', 'The integration supports recalculation from a confirmed production quantity.',
  includesAll(integration, [
    /RECALCULATE_CONFIRMED_NEEDS/,
    /ConfirmedQuantity/,
    /MaterialPlanningService\.recalculateProjectNeeds/
  ]));
check('CONFIRMED-QUANTITY-VALIDATION', 'Confirmed quantity must be numeric and greater than zero and the event must belong to a project.',
  includesAll(integration, [
    /!isFinite\(quantity\) \|\| quantity <= 0/,
    /محاسبه نیاز قطعی فقط برای رویداد مرتبط با پروژه مجاز است/,
    /event\.ProjectID, event\.ID, read\('ConfirmedQuantity'\)/
  ]));
check('TENANT-PROJECT-BOUNDARY', 'Material recalculation verifies the source event belongs to the same tenant and project.',
  includesAll(planner, [
    /EventRepository\.findById\(sourceEventId\)/,
    /String\(sourceEvent\.TenantID\) !== String\(user\.TenantID\)/,
    /String\(sourceEvent\.ProjectID \|\| ''\) !== String\(projectId\)/
  ]));
check('MATERIAL-NEED-QUANTITY', 'Confirmed needs are calculated from the confirmed basis quantity and per-unit consumption.',
  includesAll(planner, [
    /BasisQuantity: quantity/,
    /ConsumptionPerUnit: spec\.ConsumptionPerUnit/,
    /NeedType: 'CONFIRMED'/
  ]));
check('MATERIAL-NEED-IDEMPOTENCY', 'Calculation history and confirmed-need updates use a deterministic calculation key.',
  includesAll(planner, [
    /CalculationKey: key/,
    /recordCalculation\(/,
    /IdempotentReplay/
  ]));
check('PROCUREMENT-PARTIAL-QUANTITIES', 'Procurement summaries clamp ordered/received amounts and calculate remaining quantities without negatives.',
  includesAll(procurement, [
    /copy\.RemainingToOrderQuantity = Math\.max\(0/,
    /copy\.RemainingDeliveryQuantity = Math\.max\(0/,
    /copy\.ReceivedQuantity = Math\.min\(requested/
  ]));
check('INTEGRATION-REGRESSION-TESTS', 'Automated tests cover validation and confirmed-quantity integration.',
  includesAll(integrationTests, [
    /validates confirmed quantity mapping before event persistence/,
    /applies confirmed quantity integration to the material planner/
  ]));
check('PLANNING-REGRESSION-TESTS', 'Automated tests cover confirmed need creation, replay safety, and source-event voiding.',
  includesAll(planningTests, [
    /confirmed quantity event creates material needs and safely replays/,
    /voiding the source event marks confirmed needs for review/
  ]));

const report = {
  agent: 'PMS Domain Contract Review Agent',
  mode: 'read-only deterministic checks',
  passed: checks.filter((item) => item.passed).length,
  total: checks.length,
  checks,
  findings
};
console.log(JSON.stringify(report, null, 2));
if (findings.some((item) => item.severity === 'error')) process.exitCode = 1;
