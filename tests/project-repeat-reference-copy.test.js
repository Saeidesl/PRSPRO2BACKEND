'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('repeat project copies current active central information without manual approval history', () => {
  const source = read('ProjectService.js');
  const start = source.indexOf('created = ProjectRepository.insert(newProject)');
  const end = source.indexOf('createLock.releaseLock()', start);
  const block = source.slice(start, end);
  assert.match(block, /policy !== 'INITIAL_COPY' && policy !== 'LIVE_SYNC'/);
  assert.match(block, /var currentValueJSON = String\(row\.ValueJSON \|\| ''\)/);
  assert.match(block, /ValueJSON: currentValueJSON/);
  assert.doesNotMatch(block, /findHistory\(row\.ID\)/);
  assert.doesNotMatch(block, /APPROVED/);
});

test('repeat project initializes live-sync baseline and idempotency log', () => {
  const source = read('ProjectService.js');
  assert.match(source, /policy === 'LIVE_SYNC'/);
  assert.match(source, /Action: 'SYNCED'/);
  assert.match(source, /ProjectInformationRepository\.insertSyncLog\(log\)/);
});

test('saving central information automatically synchronizes live-reference children', () => {
  const source = read('ProjectInformationService.js');
  const start = source.indexOf('  save: function(projectId,typeId,body,params)');
  const end = source.indexOf('  approve: function(projectId,typeId,body,params)', start);
  const block = source.slice(start, end);
  assert.match(block, /this\._syncLiveReference_\(project,type,current,user\)/);
  assert.match(source, /_syncLiveReference_: function\(sourceProject,type,sourceInfo,user\)/);
});

test('live reference conflict resolution uses current source revision, not manual approval', () => {
  const source = read('ProjectInformationService.js');
  const start = source.indexOf('  resolveReferenceConflict: function');
  const end = source.indexOf('  _syncLiveReference_: function', start);
  const block = source.slice(start, end);
  assert.match(block, /Number\(sourceInfo\.Revision\)!==Number\(conflictLog\.SourceRevision\)/);
  assert.match(block, /String\(sourceInfo\.ValueJSON\|\|''\)/);
  assert.doesNotMatch(block, /_latestApproval_|approval\./);
});
