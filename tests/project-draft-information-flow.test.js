'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('project schema stores lifecycle state without replacing project status', () => {
  const source = read('DatabaseSetup.js');
  assert.match(source, /'SourceProjectID','RecordState'/);
});

test('project validator accepts a title-only draft and requires completion fields for activation', () => {
  const source = read('ProjectValidator.js');
  assert.match(source, /RecordState[^\n]*DRAFT/);
  assert.match(source, /requestedState === 'ACTIVE'/);
  assert.match(source, /Validator\.required\(data\.Title, 'Title'\)/);
  assert.match(source, /برای تکمیل پروژه حداقل یک واحد مجاز انتخاب کنید/);
});

test('existing project API creates drafts and completes them in place', () => {
  const source = read('ProjectService.js');
  assert.match(source, /RecordState:\s*'DRAFT'/);
  assert.match(source, /ensureColumn\('08_Projects', 'RecordState'\)/);
  assert.match(source, /ProjectRepository\.insert\(draft\)/);
  assert.match(source, /const completesDraft = isDraft/);
  assert.match(source, /updateData\.RecordState = 'ACTIVE'/);
  assert.match(source, /duplicateCode/);
});

test('create-only users can list and retrieve only their own drafts and complete them', () => {
  const service = read('ProjectService.js');
  const router = read('Router.js');
  assert.match(service, /!canViewAllProjects[\s\S]{0,350}RecordState[\s\S]{0,120}DRAFT[\s\S]{0,120}CreatedBy/);
  assert.match(router, /requireAny\(params, \['PROJECT_VIEW', 'PROJECT_CREATE'\]\)/);
  assert.match(router, /projectByIdMatch[\s\S]{0,500}PROJECT_CREATE/);
  assert.match(router, /projectUpdateMatch[\s\S]{0,600}PROJECT_CREATE/);
});

test('only event types explicitly enabled can be recorded on drafts', () => {
  const source = read('EventService.js');
  const typeService = read('EventTypeService.js');
  const validator = read('EventTypeValidator.js');
  assert.match(source, /project\.RecordState[\s\S]{0,220}eventType\.AllowOnDraft/);
  assert.match(typeService, /result\.AllowOnDraft = this\._toBoolean_/);
  assert.match(validator, /Validator\.boolean\(data\.AllowOnDraft, 'AllowOnDraft'\)/);
  assert.match(validator, /رویداد مستقل نمی‌تواند روی پیش‌نویس/);
});

test('draft events never change project workflow or business status implicitly', () => {
  const source = read('EventService.js');
  assert.match(source, /RecordState[\s\S]{0,150}DRAFT[\s\S]{0,80}return changes/);
});

test('project code from an event is validated and assigned only once while draft', () => {
  const service = read('ProjectService.js');
  const forms = read('FormService.js');
  assert.match(service, /validateDraftProjectCodeFromEvent/);
  assert.match(service, /assignDraftProjectCodeFromEvent/);
  assert.match(forms, /Code \\|\\| ''\\)\\.toUpperCase\\(\\) === 'PROJECT_CODE'/);
});

test('project cards receive only active central information explicitly enabled for card display', () => {
  const service = read('ProjectService.js');
  const typeService = read('InformationTypeService.js');
  assert.match(service, /type\.ShowOnCard/);
  assert.match(service, /CardInformation/);
  assert.match(typeService, /ShowOnCard/);
});

test('approved image references may use an existing PROFILE attachment without duplicating the file', () => {
  const service = read('ProjectInformationService.js');
  assert.match(service, /type==='image'.*AttachmentType.*PROFILE/);
});

test('event form responses update current project information and retain source event', () => {
  const source = read('FormService.js');
  assert.match(source, /ProjectInformationService\.save\(event\.ProjectID, typeId/);
  assert.match(source, /SourceEventID: event\.ID/);
  assert.match(source, /FormService\._isEmptyValue_\(value\)/);
  assert.match(source, /responses, user, params/);
});

test('replaying the same event value does not create another project information revision', () => {
  const source = read('ProjectInformationService.js');
  assert.match(source, /existing\.SourceEventID[\s\S]{0,150}existing\.ValueJSON/);
  assert.match(source, /return Response\.success\(Object\.assign\(\{\},existing/);
});
