'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('central information schemas are additive and preserve existing event storage', () => {
  const source = read('DatabaseSetup.js');
  assert.match(source, /name: '28_InformationTypes'/);
  assert.match(source, /name: '29_InformationTypeColumns'/);
  assert.match(source, /name: '30_ProjectInformation'/);
  assert.match(source, /name: '31_ProjectInformationHistory'/);
  assert.match(source, /name: '14_EventData',[\s\S]*?DataJSON/);
  assert.match(source, /append only missing required headers/i);
  assert.match(source, /Never reorder, overwrite, or delete user data/i);
});

test('central information definitions support scalar and dynamic table cardinalities', () => {
  const validator = read('InformationTypeValidator.js');
  const service = read('InformationTypeService.js');
  assert.match(validator, /CARDINALITIES: \['SINGLE', 'MULTIPLE'\]/);
  assert.match(validator, /DATA_TYPES:/);
  assert.match(validator, /validateColumn: function/);
  assert.match(service, /createColumn: function/);
  assert.match(service, /ColumnOrder/);
  assert.match(service, /DELETED/);
});

test('project information stores revisions and immutable before/after history', () => {
  const repository = read('ProjectInformationRepository.js');
  const service = read('ProjectInformationService.js');
  assert.match(repository, /findAnyByProjectAndType/);
  assert.match(repository, /31_ProjectInformationHistory/);
  assert.match(service, /OldValueJSON/);
  assert.match(service, /NewValueJSON/);
  assert.match(service, /ActorUserID/);
  assert.match(service, /SourceEventID/);
  assert.match(service, /Revision/);
  assert.match(service, /Status:'DELETED'/);
});

test('router protects definition management and project data with server-side permissions', () => {
  const router = read('Router.js');
  assert.match(router, /path === '\/information-types'[\s\S]*?SYSTEM_SETTINGS/);
  assert.match(router, /informationTypeColumnCreateMatch[\s\S]*?SYSTEM_SETTINGS/);
  assert.match(router, /projectInformationSaveMatch[\s\S]*?PROJECT_EDIT/);
  assert.match(router, /projectInformationListMatch[\s\S]*?PROJECT_VIEW/);
});

test('new service and repository files contain no direct SpreadsheetApp access', () => {
  ['InformationTypeService.js','InformationTypeRepository.js','ProjectInformationService.js','ProjectInformationRepository.js'].forEach((name) => {
    assert.doesNotMatch(read(name), /SpreadsheetApp\./);
  });
});
