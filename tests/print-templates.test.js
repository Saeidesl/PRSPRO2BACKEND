'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('database schema defines a separate persistent print template sheet', () => {
  const schema = read('DatabaseSetup.js');
  assert.match(schema, /name: '36_PrintTemplates'/);
  assert.match(schema, /'ID','TenantID','Name','Description','LayoutJSON','Version','Status','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt'/);
});

test('print template repository creates the sheet without deleting or resetting existing data', () => {
  const repository = read('PrintTemplateRepository.js');
  assert.match(repository, /getSpreadsheet\(\)/);
  assert.match(repository, /insertSheet\(this\.SHEET_NAME\)/);
  assert.match(repository, /ensureColumn\(this\.SHEET_NAME, header\)/);
  assert.doesNotMatch(repository, /deleteSheet|clear\(/);
});

test('print template API is tenant-scoped and requires project permissions', () => {
  const router = read('Router.js');
  assert.match(router, /printTemplateMatch[\s\S]{0,180}PROJECT_VIEW[\s\S]{0,160}PrintTemplateService/);
  assert.match(router, /path === '\/print-templates'[\s\S]{0,120}PROJECT_EDIT[\s\S]{0,100}PrintTemplateService\.create/);
  assert.match(router, /printTemplateUpdateMatch[\s\S]{0,120}PROJECT_EDIT/);
  assert.match(router, /printTemplateDeleteMatch[\s\S]{0,120}PROJECT_EDIT/);
  const service = read('PrintTemplateService.js');
  assert.match(service, /String\(item\.TenantID\) === String\(user\.TenantID\)/);
  assert.match(service, /String\(item\.TenantID\) !== String\(tenantId\)/);
});

test('print template service validates layout size and structure and soft-deletes records', () => {
  const service = read('PrintTemplateService.js');
  assert.match(service, /MAX_LAYOUT_LENGTH: 40000/);
  assert.match(service, /Array\.isArray\(layout\.elements\)/);
  assert.match(service, /elements\.length > 200/);
  assert.match(service, /LayoutJSON: layout\.json/);
  assert.match(service, /Status:'INACTIVE'/);
  assert.match(service, /AuditService\.log/);
});
