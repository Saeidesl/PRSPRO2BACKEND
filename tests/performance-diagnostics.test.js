'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadDiagnostics() {
  const context = {
    AppConfig: { PERFORMANCE_LOG_TO_CONSOLE: false },
    Date,
    Object,
    String,
    Number,
    JSON,
    console: { log: () => {} }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'PerformanceDiagnostics.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__diagnostics = PerformanceDiagnostics;', context);
  return context.__diagnostics;
}

test('aggregates repository operations, sheets and cache outcomes per endpoint', () => {
  const diagnostics = loadDiagnostics();
  diagnostics.beginRequest('/procurement/workspace');
  diagnostics.record('getAll', '18_MaterialNeeds', 8, { cacheHit: false });
  diagnostics.record('getAll', '18_MaterialNeeds', 1, { cacheHit: true });
  diagnostics.record('findById', '19_PurchaseOrders', 2, { cacheHit: false });

  const summary = diagnostics.finishRequest(25);
  assert.equal(summary.endpoint, '/procurement/workspace');
  assert.equal(summary.elapsedMs, 25);
  assert.equal(summary.repositoryOperationCount, 3);
  assert.equal(summary.cacheHitCount, 1);
  assert.equal(summary.cacheMissCount, 2);
  assert.equal(summary.operationsByType.getAll, 2);
  assert.equal(summary.operationsBySheet['18_MaterialNeeds'], 2);
  assert.equal(summary.operationsBySheet['19_PurchaseOrders'], 1);
  assert.equal(diagnostics._active, null);
});

test('records endpoint failures without throwing away the timing summary', () => {
  const diagnostics = loadDiagnostics();
  diagnostics.beginRequest('/procurement/orders');
  diagnostics.recordEndpointError(new Error('test-only'));
  const summary = diagnostics.finishRequest(12);
  assert.equal(summary.endpoint, '/procurement/orders');
  assert.equal(summary.errors, 1);
  assert.equal(summary.elapsedMs, 12);
});

test('disabled performance logging emits no console output', () => {
  const diagnostics = loadDiagnostics();
  diagnostics.beginRequest('/procurement/needs');
  const summary = diagnostics.finishRequest(4);
  assert.equal(summary.type, 'PROCUREMENT_ENDPOINT_TIMING');
});
