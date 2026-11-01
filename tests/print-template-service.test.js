'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('print template storage is added as a non-destructive tenant-scoped sheet', () => {
  const setup = read('DatabaseSetup.js');
  const repository = read('PrintTemplateRepository.js');
  assert.match(setup, /PRINT_TEMPLATES:\s*\{/);
  assert.match(setup, /name:\s*'36_PrintTemplates'/);
  assert.match(setup, /'ID','TenantID','Name','Version','TemplateJSON','Status'/);
  assert.match(setup, /createAllSheets_\(ss\)/);
  assert.match(repository, /listByTenant/);
  assert.match(repository, /findById/);
  assert.match(repository, /insert/);
  assert.match(repository, /updateById/);
});

test('print template service validates named versioned layouts and stable form references', () => {
  const service = read('PrintTemplateService.js');
  assert.match(service, /MAX_NAME_LENGTH/);
  assert.match(service, /MAX_TEMPLATE_LENGTH/);
  assert.match(service, /Number\(template\.version\) !== 1/);
  assert.match(service, /template\.elements\.length > this\.MAX_ELEMENTS/);
  assert.match(service, /item\.formId/);
  assert.match(service, /item\.formDefinition/);
  assert.match(service, /Constants\.ERROR\.VALIDATION_ERROR/);
  assert.match(service, /Constants\.ERROR\.DUPLICATE/);
  assert.match(service, /String\(row\.TenantID\) === String\(user\.TenantID\)/);
  assert.doesNotMatch(service, /Constants\.ERROR\.VALIDATION\b/);
});

test('print template routes protect reads and writes with existing project permissions', () => {
  const router = read('Router.js');
  assert.match(router, /path === '\/print-templates'/);
  assert.match(router, /PrintTemplateService\.list\(params\)/);
  assert.match(router, /PrintTemplateService\.get\(/);
  assert.match(router, /PrintTemplateService\.create\(body, params\)/);
  assert.match(router, /PrintTemplateService\.update\(/);
  assert.match(router, /AccessControlService\.require\(params, 'PROJECT_VIEW'\)/);
  assert.match(router, /this\.requireAny\(params, \['PROJECT_EDIT', 'SYSTEM_SETTINGS'\]\)/);
});

test('print template data is independent from event form response records', () => {
  const service = read('PrintTemplateService.js');
  const repository = read('PrintTemplateRepository.js');
  assert.match(service, /TemplateJSON/);
  assert.match(service, /TenantID: user\.TenantID/);
  assert.match(repository, /36_PrintTemplates/);
  const forms = read('FormService.js');
  assert.match(forms, /Definition:this\._parse\(row\.DefinitionSnapshotJSON/);
  assert.match(forms, /Values:this\._parse\(row\.ResponseJSON/);
});
