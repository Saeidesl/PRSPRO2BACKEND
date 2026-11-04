'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('repeat project creation persists a per-information copy plan instead of copying inline', () => {
  const source = read('ProjectService.js');
  const start = source.indexOf('var sourceRows = ProjectInformationRepository.findByProject(sourceProject.ID)');
  const end = source.indexOf('createLock.releaseLock()', start);
  const block = source.slice(start, end);
  assert.match(block, /ReferenceCopyStatusJSON/);
  assert.match(block, /ReferenceCopyPlan/);
  assert.match(block, /PENDING/);
  assert.match(block, /SKIPPED_FILE/);
  assert.doesNotMatch(block, /ProjectInformationRepository\.insert\(/);
});

test('repeat project copies one information type at a time with history and live-sync idempotency', () => {
  const source = read('ProjectService.js');
  const start = source.indexOf('copyReferenceInformationType: function');
  const end = source.indexOf('  update: function(id, data, params)', start);
  const block = source.slice(start, end);
  assert.match(block, /ProjectInformationRepository\.insert\(/);
  assert.match(block, /ProjectInformationRepository\.insertHistory\(/);
  assert.match(block, /ProjectInformationRepository\.insertSyncLog\(/);
  assert.match(block, /LockService\.getScriptLock\(\)/);
  assert.match(block, /\['COPIED','INDEPENDENT','EMPTY','SKIPPED_FILE'\]/);
  assert.match(block, /status = 'FAILED'/);
});

test('project information list includes active copied values regardless of status casing and ignores deleted rows', () => {
  const source = read('ProjectInformationService.js');
  const start = source.indexOf('  list: function(projectId,params)');
  const end = source.indexOf('  get: function(projectId,typeId,params)', start);
  const block = source.slice(start, end);
  assert.match(block, /String\(row\.Status \|\| 'ACTIVE'\)\.toUpperCase\(\)==='ACTIVE'/);
  assert.match(block, /String\(type\.Status \|\| 'ACTIVE'\)\.toUpperCase\(\)==='ACTIVE'/);
  assert.match(block, /row\.Value=this\._parse\(row\.ValueJSON,null\)/);
});

test('repeat project create requests use a stable operation key to recover lost responses', () => {
  const source = read('ProjectService.js');
  assert.match(source, /ReferenceCopyOperationID/);
  assert.match(source, /درخواست قبلی ایجاد پروژه بازیابی شد/);
});

test('repeat project initializes live-sync baseline and idempotency log', () => {
  const source = read('ProjectService.js');
  assert.match(source, /policy === 'LIVE_SYNC'/);
  assert.match(source, /Action: 'SYNCED'/);
  assert.match(source, /ProjectInformationRepository\.insertSyncLog\(/);
});

test('saving central information automatically synchronizes live-reference children', () => {
  const source = read('ProjectInformationService.js');
  const start = source.indexOf('  save: function(projectId,typeId,body,params)');
  const end = source.indexOf('  approve: function(projectId,typeId,body,params)', start);
  const block = source.slice(start, end);
  assert.match(block, /this\._syncLiveReference_\(project,type,current,user\)/);
  assert.match(source, /_syncLiveReference_: function\(sourceProject,type,sourceInfo,user\)/);
  assert.match(source, /previous\.Action\)==='CONFLICT_RESOLVED_LOCAL'/);
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


test('project form lookups return workflow repeat-reference policies for frontend defaults', () => {
  const source = read('ProjectService.js');
  const start = source.indexOf('const workflows = (WorkflowRepository.getAll()');
  const end = source.indexOf('const projectStatuses', start);
  const block = source.slice(start, end);
  assert.match(block, /RepeatReferencePolicyJSON: item\.RepeatReferencePolicyJSON/);
  assert.match(block, /PublishedRepeatReferencePolicyJSON: item\.PublishedRepeatReferencePolicyJSON/);
});


test('project creation ignores client policy overrides and uses workflow policy only', () => {
  const source = read('ProjectService.js');
  const start = source.indexOf("try { referencePolicy = JSON.parse(workflow.PublishedRepeatReferencePolicyJSON");
  const end = source.indexOf("Object.keys(referencePolicy).forEach", start);
  const block = source.slice(start, end);
  assert.match(block, /ignore client policy overrides/);
  assert.doesNotMatch(block, /project\.ReferencePolicyJSON/);
});

test('workflow policy edits validate active tenant information types and update published policy snapshot', () => {
  const source = read('WorkflowService.js');
  const start = source.indexOf('  update: function(id, data, params)');
  const end = source.indexOf('  getSteps: function(workflowId, params)', start);
  const block = source.slice(start, end);
  assert.match(block, /InformationTypeRepository\.findByTenant\(user\.TenantID\)/);
  assert.match(block, /updateData\.PublishedRepeatReferencePolicyJSON = JSON\.stringify\(repeatPolicy\)/);
});

test('reference copy operation is exposed as POST, never as a mutating GET', () => {
  const router = read('Router.js');
  const getStart = router.indexOf('  get: function(path, params)');
  const postStart = router.indexOf('  post: function(path, body, params)');
  assert.ok(getStart >= 0 && postStart > getStart);
  const getBlock = router.slice(getStart, postStart);
  const postBlock = router.slice(postStart);
  assert.doesNotMatch(getBlock, /reference-copy/);
  assert.match(postBlock, /reference-copy/);
  assert.match(postBlock, /ProjectService\.copyReferenceInformationType/);
  assert.match(postBlock, /AccessControlService\.require\(params, 'PROJECT_EDIT'\)/);
  assert.match(postBlock, /AccessControlService\.require\(params, 'PROJECT_CREATE'\)/);
});
