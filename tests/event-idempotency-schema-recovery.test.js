'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadRepository(sheet) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'GoogleSheetsRepository.js'), 'utf8');
  const context = { Date, Object, String, Array, JSON };
  vm.runInNewContext(source + '\nthis.repositoryUnderTest = GoogleSheetsRepository;', context);
  context.repositoryUnderTest._sheetCache['13_Events'] = sheet;
  return context.repositoryUnderTest;
}

function createSheet(headers, rows) {
  let maxColumns = Math.max(headers.length, 1);
  return {
    headers: headers.slice(),
    rows: rows.map((row) => row.slice()),
    getLastColumn() { return this.headers.length; },
    getMaxColumns() { return maxColumns; },
    insertColumnsAfter(_after, howMany) { maxColumns += howMany; },
    getRange(row, column, numRows, numColumns) {
      return {
        getValues: () => {
          if (row === 1) return [this.headers.slice(column - 1, column - 1 + numColumns)];
          return this.rows.slice(row - 2, row - 2 + numRows)
            .map((record) => record.slice(column - 1, column - 1 + numColumns));
        },
        getDisplayValues: () => {
          if (row === 1) return [this.headers.slice(column - 1, column - 1 + numColumns).map(String)];
          return this.rows.slice(row - 2, row - 2 + numRows)
            .map((record) => record.slice(column - 1, column - 1 + numColumns).map(String));
        },
        setValue: (value) => { this.headers[column - 1] = value; },
        setValues: (values) => {
          if (row === 1) this.headers.splice(column - 1, numColumns, ...values[0]);
          else this.rows.splice(row - 2, numRows, ...values);
        }
      };
    }
  };
}

test('ensureColumn appends a missing idempotency header without reordering existing columns', () => {
  const sheet = createSheet(['ID', 'ProjectID', 'Status'], [
    ['EVT_1', 'PRJ_1', 'ACTIVE'],
    ['EVT_2', 'PRJ_2', 'ACTIVE']
  ]);
  const repository = loadRepository(sheet);

  const headers = repository.ensureColumn('13_Events', 'IdempotencyStatus');

  assert.deepEqual(Array.from(headers), ['ID', 'ProjectID', 'Status', 'IdempotencyStatus']);
  assert.deepEqual(sheet.rows, [
    ['EVT_1', 'PRJ_1', 'ACTIVE'],
    ['EVT_2', 'PRJ_2', 'ACTIVE']
  ]);
  repository.ensureColumn('13_Events', 'IdempotencyStatus');
  assert.equal(sheet.headers.filter((header) => header === 'IdempotencyStatus').length, 1);
});

test('ensureColumn rechecks the sheet when the request header cache is stale', () => {
  const sheet = createSheet(['ID', 'Status'], [['EVT_1', 'ACTIVE']]);
  const repository = loadRepository(sheet);
  repository._headerCache['13_Events'] = ['ID', 'Status'];

  repository.ensureColumn('13_Events', 'IdempotencyStatus');

  assert.deepEqual(sheet.headers, ['ID', 'Status', 'IdempotencyStatus']);
  assert.deepEqual(sheet.rows, [['EVT_1', 'ACTIVE']]);
});
