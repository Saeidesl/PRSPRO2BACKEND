'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('event creation enforces the active workflow step rules before persistence', () => {
  const service = read('EventService.js');
  assert.match(service, /_getWorkflowRuleProgress_:\s*function/);
  assert.match(service, /_validateWorkflowEvent_:\s*function/);
  assert.match(service, /this\._validateWorkflowEvent_\(project, eventType, user\.TenantID\)/);
  assert.match(service, /ابتدا رویدادهای اجباری با ترتیب قبلی را ثبت کنید/);
  assert.match(service, /ابتدا رویدادهای اجباری گروه قبلی را تکمیل کنید/);
});

test('workflow progress is tenant and project access scoped', () => {
  const service = read('EventService.js');
  const router = read('Router.js');
  assert.match(service, /workflowProgress:\s*function/);
  assert.match(service, /ProjectService\._isProjectAvailableToUser_\(project, user\)/);
  assert.match(router, /parts\[3\] === 'workflow-progress'/);
  assert.match(router, /EventService\.workflowProgress\(projectId, params\)/);
});

test('events retain the workflow step and version used at registration', () => {
  const service = read('EventService.js');
  const database = read('DatabaseSetup.js');
  assert.match(service, /WorkflowID: project \? \(project\.WorkflowID \|\| ''\)/);
  assert.match(service, /WorkflowStepID: project \? \(project\.CurrentStepID \|\| ''\)/);
  assert.match(database, /'WorkflowID','WorkflowVersion','WorkflowStepID','EventTypeID'/);
  assert.match(service, /بازمحاسبه تکمیل مرحله پس از ابطال رویداد/);
});
