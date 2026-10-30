'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('backend exposes project and event entry points without a design-case API', () => {
  const router = read('Router.js');
  const eventService = read('EventService.js');

  assert.match(router, /path === '\/projects'/);
  assert.match(router, /path === '\/events'/);
  assert.doesNotMatch(router, /design-cases|DesignCaseService|createForDesignCase|DESIGN_CASE/);
  assert.doesNotMatch(eventService, /DesignCase|DESIGN_CASE|designCase/);
});

test('event types and attachments accept only project or independent/project entities', () => {
  const eventTypeValidator = read('EventTypeValidator.js');
  const attachmentValidator = read('AttachmentValidator.js');
  const eventTypeService = read('EventTypeService.js');

  assert.match(eventTypeValidator, /\['PROJECT', 'INDEPENDENT'\]/);
  assert.doesNotMatch(eventTypeValidator, /DESIGN_CASE|TargetDesignCaseStatus|TransitionsToProduction/);
  assert.match(attachmentValidator, /\['PROJECT', 'EVENT'\]/);
  assert.doesNotMatch(attachmentValidator, /DESIGN_CASE|DesignCase/);
  assert.doesNotMatch(eventTypeService, /DESIGN_CASE|TargetDesignCaseStatus|TransitionsToProduction/);
});

test('legacy design-case sheets are no longer part of active database setup', () => {
  const schema = read('DatabaseSetup.js');
  assert.doesNotMatch(schema, /name: '26_DesignCases'|name: '27_DesignCaseHistory'/);
  assert.match(schema, /ATTACHMENT_ENTITY_TYPES: \['PROJECT','EVENT'\]/);
  // Legacy columns in existing project/event sheets are intentionally retained for data safety.
  assert.match(schema, /'DesignCaseID'/);
});
