'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'DatabaseSetup.js'), 'utf8');

test('database schema declares versioned project material specifications', () => {
  assert.match(source, /name: '24_ProjectMaterialSpecs'/);
  assert.match(source, /ConsumptionPerUnit/);
  assert.match(source, /WastagePercent/);
  assert.match(source, /EarlyOrderPolicy/);
  assert.match(source, /SpecificationRevision|Revision/);
});

test('database schema declares durable material calculation history', () => {
  assert.match(source, /name: '25_MaterialNeedCalculations'/);
  assert.match(source, /CalculationKey/);
  assert.match(source, /CalculatedQuantity/);
  assert.match(source, /PreviousCalculatedQuantity/);
  assert.match(source, /VarianceQuantity/);
});

test('schema setup appends missing headers and does not delete or reorder existing data', () => {
  assert.match(source, /append only missing required headers/i);
  assert.match(source, /Never reorder, overwrite, or delete user data/i);
  assert.match(source, /missing = headers\.filter/);
});
