'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createEnvironment() {
  const rows = [['ID', 'Name', 'Status'], ['A', 'Alpha', 'ACTIVE']];
  const sheet = {
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max.apply(null, rows.map(row => row.length)),
    getRange: (startRow, startColumn, rowCount, columnCount) => ({
      getValues: () => Array.from({ length: rowCount }, (_, r) => Array.from({ length: columnCount }, (_, c) => (rows[startRow + r - 1] || [])[startColumn + c - 1] ?? '')),
      getDisplayValues: () => Array.from({ length: rowCount }, (_, r) => Array.from({ length: columnCount }, (_, c) => String((rows[startRow + r - 1] || [])[startColumn + c - 1] ?? ''))),
      setValues: values => values.forEach((row, offset) => { rows[startRow + offset - 1] = row.slice(); }),
      setValue: value => { rows[startRow - 1] = rows[startRow - 1] || []; rows[startRow - 1][startColumn - 1] = value; }
    })
  };
  const spreadsheet = { getSheetByName: name => name === 'Records' ? sheet : null };
  const context = {
    AppConfig: { DATABASE: { SPREADSHEET_ID: '' } },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { NOT_FOUND: 'NOT_FOUND' }, STATUS: { DELETED: 'DELETED' } },
    PerformanceDiagnostics: { record() {} }, Date, Object, String, Number, Math, Array, isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'GoogleSheetsRepository.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.repositoryUnderTest = GoogleSheetsRepository;', context);
  return { repository: context.repositoryUnderTest };
}

test('insert invalidates cached list and a previously missing ID', () => {
  const { repository } = createEnvironment();
  assert.equal(repository.getAll('Records').length, 1);
  assert.equal(repository.findById('Records', 'B'), null);
  repository.insert('Records', { ID: 'B', Name: 'Beta', Status: 'ACTIVE' });
  assert.equal(repository.getAll('Records').length, 2);
  assert.equal(repository.findById('Records', 'B').Name, 'Beta');
});

test('update invalidates cached list and cached record', () => {
  const { repository } = createEnvironment();
  repository.getAll('Records');
  repository.findById('Records', 'A');
  repository.updateById('Records', 'A', { Name: 'Updated Alpha' });
  assert.equal(repository.getAll('Records')[0].Name, 'Updated Alpha');
  assert.equal(repository.findById('Records', 'A').Name, 'Updated Alpha');
});

test('soft delete invalidates cached list and cached record', () => {
  const { repository } = createEnvironment();
  repository.getAll('Records');
  repository.findById('Records', 'A');
  repository.deleteById('Records', 'A');
  assert.equal(repository.getAll('Records')[0].Status, 'DELETED');
  assert.equal(repository.findById('Records', 'A').Status, 'DELETED');
});
