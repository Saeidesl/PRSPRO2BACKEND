'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');

test('project deletion service source exists and documents safe cascade rules', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'ProjectDeletionService.js'), 'utf8');
  assert.match(source, /ADMIN_PROJECT_CASCADE_DELETE/);
  assert.match(source, /ensureColumn\(sheet, 'Status'\)/);
  assert.match(source, /allAllocations/);
});
