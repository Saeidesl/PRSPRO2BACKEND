'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('workflow event rule schema is additive and version-aware', () => {
  const schema = read('DatabaseSetup.js');
  assert.match(schema, /name: '37_WorkflowStepEventRules'/);
  assert.match(schema, /WorkflowType[\s\S]*LifecycleState[\s\S]*PublishedVersion[\s\S]*DraftVersion/);
  assert.match(schema, /WorkflowVersion/);
});

test('workflow event rule APIs are permission-protected and tenant-scoped', () => {
  const router = read('Router.js');
  const service = read('WorkflowService.js');
  assert.match(router, /event-rules/);
  assert.match(router, /WORKFLOW_MANAGE/);
  assert.match(router, /parts\[3\] === 'publish'/);
  assert.match(service, /saveStepEventRules/);
  assert.match(service, /String\(workflow\.TenantID\) !== String\(user\.TenantID\)/);
  assert.match(service, /WORKFLOW_PUBLISHED/);
  assert.match(service, /eventTypes: eventTypes/);
  assert.match(service, /ConnectionType/);
  assert.match(service, /return \{ ID: row.ID, Name: row.Name, Code: row.Code/);
  assert.match(service, /if \(isPublished && !workflow.DraftVersion\)/);
  assert.match(service, /Number\(item.WorkflowVersion \|\| 1\) <= version/);
  assert.match(service, /Number\(step.WorkflowVersion \|\| 1\) <= requestedVersion/);
});

test('workflow event rule validator enforces requirement, source and ordering compatibility', () => {
  const validator = read('WorkflowStepEventRuleValidator.js');
  assert.match(validator, /RequirementMode/);
  assert.match(validator, /DataSource/);
  assert.match(validator, /SequenceMode/);
  assert.match(validator, /strictOrders/);
  assert.match(validator, /stepSequenceMode/);
});
test('project workflow lookups and assignment only use published workflow versions', () => {
  const projects = read('ProjectService.js');
  assert.match(projects, /LifecycleState \\|\\| 'PUBLISHED'/);
  assert.match(projects, /PublishedVersion \\|\\| item.Version/);
  assert.match(projects, /WorkflowVersion: workflowVersion/);
});
