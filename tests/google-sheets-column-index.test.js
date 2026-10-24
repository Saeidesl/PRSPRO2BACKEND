'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createRepository() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'GoogleSheetsRepository.js'), 'utf8');
  const context = {};
  vm.runInNewContext(source + '\nthis.repositoryUnderTest = GoogleSheetsRepository;', context);
  return context.repositoryUnderTest;
}

function createSheet(rows) {
  let columnReads = 0;
  return {
    getLastRow: () => rows.length + 1,
    getRange: (row, column, numRows, numColumns) => ({
      getValues: () => {
        if (row === 2 && numColumns === 1) {
          columnReads++;
          return rows.map((record) => [record[column - 1]]);
        }
        throw new Error('Unexpected range requested by test');
      }
    }),
    getColumnReads: () => columnReads
  };
}

test('different lookups on the same column reuse one sheet read per request', () => {
  const repository = createRepository();
  const sheet = createSheet([
    ['P-100', 'Alpha'],
    ['P-200', 'Beta'],
    ['P-300', 'Gamma']
  ]);
  const headers = ['Code', 'Name'];

  assert.equal(repository._findRowNumber(sheet, headers, 'Code', 'P-100', 'Projects'), 2);
  assert.equal(repository._findRowNumber(sheet, headers, 'Code', 'P-300', 'Projects'), 4);
  assert.equal(repository._findRowNumber(sheet, headers, 'Code', 'missing', 'Projects'), -1);
  assert.equal(sheet.getColumnReads(), 1);
});

test('duplicate values keep the original first-match behavior', () => {
  const repository = createRepository();
  const sheet = createSheet([
    ['DUP', 'First'],
    ['DUP', 'Second']
  ]);

  assert.equal(repository._findRowNumber(sheet, ['Code', 'Name'], 'Code', 'DUP', 'Projects'), 2);
  assert.equal(sheet.getColumnReads(), 1);
});

test('request reset and sheet writes invalidate the column index', () => {
  const repository = createRepository();
  const sheet = createSheet([['P-100'], ['P-200']]);
  const headers = ['Code'];

  repository._findRowNumber(sheet, headers, 'Code', 'P-100', 'Projects');
  repository.resetRequestCache();
  repository._findRowNumber(sheet, headers, 'Code', 'P-200', 'Projects');
  assert.equal(sheet.getColumnReads(), 2);

  repository._findRowNumber(sheet, headers, 'Code', 'P-100', 'Projects');
  repository._invalidateSheetRecordCache('Projects');
  repository._findRowNumber(sheet, headers, 'Code', 'P-200', 'Projects');
  assert.equal(sheet.getColumnReads(), 3);
});
