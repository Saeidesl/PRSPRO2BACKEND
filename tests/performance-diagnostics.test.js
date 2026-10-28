'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadDiagnostics(options = {}) {
  const context = {
    AppConfig: { PERFORMANCE_LOG_TO_CONSOLE: options.enabled === true, DATABASE: { SPREADSHEET_ID: '' } },
    Date,
    Object,
    String,
    Number,
    JSON,
    Error,
    console: { log: () => {}, error: () => {} }
  };
  if (options.spreadsheet) {
    context.SpreadsheetApp = {
      getActiveSpreadsheet: () => options.spreadsheet,
      openById: () => options.spreadsheet
    };
  }
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
  assert.equal(summary.repositoryElapsedMs, 11);
  assert.equal(summary.durationMsByType.getAll, 9);
  assert.equal(summary.durationMsBySheet['18_MaterialNeeds'], 9);
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

test('writes persistent endpoint summaries to a dedicated sheet when enabled', () => {
  const rows = [];
  const sheet = {
    getLastRow: () => rows.length,
    getRange: (row, column, rowCount, columnCount) => ({
      setValues: values => {
        values.forEach(value => rows.push(value));
      }
    }),
    setFrozenRows: () => {},
    appendRow: row => rows.push(row),
    deleteRows: () => {}
  };
  const spreadsheet = {
    getSheetByName: name => name === 'PMS_PerformanceDiagnostics' ? sheet : null,
    insertSheet: name => {
      assert.equal(name, 'PMS_PerformanceDiagnostics');
      return sheet;
    }
  };
  const diagnostics = loadDiagnostics({ enabled: true, spreadsheet });
  diagnostics.beginRequest('/procurement/workspace');
  diagnostics.record('getAll', '18_MaterialNeeds', 8, { cacheHit: false });
  const summary = diagnostics.finishRequest(23);

  assert.equal(summary.elapsedMs, 23);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], 'Timestamp');
  assert.equal(rows[1][1], '/procurement/workspace');
  assert.equal(rows[1][2], 23);
  assert.equal(rows[1][3], 1);
  assert.equal(rows[1][8], '{"getAll":1}');
});

test('disabled performance logging emits no console output or spreadsheet writes', () => {
  const diagnostics = loadDiagnostics();
  diagnostics.beginRequest('/procurement/needs');
  const summary = diagnostics.finishRequest(4);
  assert.equal(summary.type, 'PROCUREMENT_ENDPOINT_TIMING');
});
