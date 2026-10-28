'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadService() {
  const context = {
    AccessControlService: { getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }) },
    Constants: { ERROR: { CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR' } },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Object, Array, String, Number, Date, JSON, Math, isFinite
  };
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'MaterialPlanningService.js'),
    'utf8'
  );
  vm.runInNewContext(source + '\nthis.__service = MaterialPlanningService;', context);
  return context.__service;
}

test('material planning service does not expose automatic schema migration on request paths', () => {
  const service = loadService();
  assert.equal(service._ensureSchema_, undefined);
  assert.equal(service._schemaReady, undefined);
});

test('schema setup remains an explicit database setup responsibility', () => {
  const setupSource = fs.readFileSync(path.join(__dirname, '..', 'DatabaseSetup.js'), 'utf8');
  assert.match(setupSource, /function setupDatabase\s*\(/);
  assert.match(setupSource, /createAllSheets_\s*\(/);
  assert.match(setupSource, /ensureHeaders_\s*\(/);
});
