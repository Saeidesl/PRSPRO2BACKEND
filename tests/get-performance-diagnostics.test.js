'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'WebApp.js'),
  'utf8'
);
const start = source.indexOf('function webAppDoGet(e) {');
const end = source.indexOf('\nfunction webAppDoPost(e)', start);
assert.notEqual(start, -1, 'GET handler must exist');
assert.notEqual(end, -1, 'GET handler must be closed');
const getHandler = source.slice(start, end);

test('GET diagnostics are disabled by default and only enabled by an explicit flag', () => {
  assert.match(getHandler, /var includeDiagnostics = false/);
  assert.match(getHandler, /shouldIncludeGetDiagnostics_\(request\.params\)/);
  assert.match(getHandler, /buildHttpResponse_\(result, timing, includeDiagnostics\)/);
  assert.match(source, /String\(params\._diagnostics \|\| params\.diagnostics \|\| ''\) === '1'/);
});

test('GET diagnostics require an authenticated admin user', () => {
  const helperStart = source.indexOf('function shouldIncludeGetDiagnostics_(params) {');
  const helperEnd = source.indexOf('\nfunction webAppDoPost(e)', helperStart);
  assert.notEqual(helperStart, -1, 'diagnostics authorization helper must exist');
  assert.notEqual(helperEnd, -1, 'diagnostics authorization helper must be closed');
  const helper = source.slice(helperStart, helperEnd);
  assert.match(helper, /if \(!requested\) return false/);
  assert.match(helper, /AccessControlService\.getCurrentUser\(params\)/);
  assert.match(helper, /AccessControlService\.isAdmin\(user\) === true/);
});

test('GET error responses never include internal diagnostics', () => {
  assert.match(getHandler, /return buildErrorResponse_\(error, timing, false\)/);
});


test('WebApp uses the shared PerformanceDiagnostics implementation without shadowing it', () => {
  assert.doesNotMatch(source, /var PerformanceDiagnostics\s*=\s*\{/);
  assert.match(source, /PerformanceDiagnostics\.reset\(\)/);
  assert.match(source, /PerformanceDiagnostics\.getSummary\(\)/);
});
