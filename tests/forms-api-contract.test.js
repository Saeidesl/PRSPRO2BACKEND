'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('database setup includes reusable form definitions, mappings and immutable event responses',()=>{
  const source=read('DatabaseSetup.js');
  for(const sheet of ['32_Forms','33_FormFields','34_EventTypeForms','35_EventFormData']) assert.ok(source.includes(sheet));
  assert.match(source,/DefinitionSnapshotJSON/);
  assert.match(source,/VisibilityRuleJSON/);
});

test('router exposes form management, event type assignment and event response APIs',()=>{
  const source=read('Router.js');
  assert.match(source,/path === '\/forms'/);
  assert.match(source,/FormService\.create/);
  assert.match(source,/FormService\.addField/);
  assert.match(source,/FormService\.listFormEventTypes/);
  assert.match(source,/FormService\.listEventTypeForms/);
  assert.match(source,/FormService\.assignEventType/);
  assert.match(source,/FormService\.unassignEventType/);
  assert.match(source,/FormService\.getEventResponses/);
});

test('central information structure and status cannot invalidate active reusable forms',()=>{
  const source=read('InformationTypeService.js');
  assert.match(source,/usedInForm/);
  assert.match(source,/این نوع اطلاعات در فرم فعال استفاده شده است/);
  assert.match(source,/structureChanged&&\(usedInProject\|\|usedInForm\)/);
});

test('event creation validates and persists form responses before completing idempotency',()=>{
  const source=read('EventService.js');
  const validate=source.indexOf('FormService.prepareEventResponses');
  const insert=source.indexOf('const created = EventRepository.insert(newEvent)');
  const persist=source.indexOf('FormService.saveEventResponses(created, validatedFormResponses, user)');
  const complete=source.indexOf("IdempotencyStatus: 'COMPLETED'",persist);
  assert.ok(validate>0&&insert>validate&&persist>insert&&complete>persist);
});
