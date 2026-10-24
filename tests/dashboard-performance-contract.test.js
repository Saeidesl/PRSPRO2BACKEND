'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'ReportService.js'),
  'utf8'
);
const start = source.indexOf('  dashboard: function(params) {');
const end = source.indexOf('\n  },', start);
assert.notEqual(start, -1, 'dashboard handler must exist');
assert.notEqual(end, -1, 'dashboard handler must be closed');
const dashboardSource = source.slice(start, end);

test('dashboard visibility filtering uses a project ID index rather than scanning projects per event', () => {
  assert.match(dashboardSource, /const visibleProjectIds = Object\.create\(null\)/);
  assert.match(dashboardSource, /hasOwnProperty\.call\(\s*visibleProjectIds/);
  assert.doesNotMatch(dashboardSource, /projects\.some\(function\(project\)/);
});

test('dashboard project activity uses a pre-grouped event index rather than filtering all events per project', () => {
  assert.match(dashboardSource, /const eventsByProject = Object\.create\(null\)/);
  assert.match(dashboardSource, /eventsByProject\[projectId\]\.push\(event\)/);
  assert.match(dashboardSource, /const projectEvents = eventsByProject\[String\(project\.ID\)\] \|\| \[\]/);
  assert.doesNotMatch(dashboardSource, /const projectEvents =\s*events\.filter/);
});
