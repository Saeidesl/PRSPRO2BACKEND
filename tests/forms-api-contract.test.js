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
  const persist=source.indexOf('FormService.saveEventResponses(created, validatedFormResponses, user, requestParams)');
  const complete=source.indexOf("IdempotencyStatus: 'COMPLETED'",persist);
  assert.ok(validate>0&&insert>validate&&persist>insert&&complete>persist);
});


test('event form amendment endpoint is permission guarded and validates amendment event and tenant',()=>{
  const router=read('Router.js');
  const service=read('FormService.js');
  assert.ok(router.includes("/^\\/events\\/([^/]+)\\/forms\\/([^/]+)$/"));
  assert.match(router,/AccessControlService\.require\(params, 'EVENT_EDIT'\)/);
  assert.match(router,/FormService\.updateEventFormResponse/);
  assert.match(service,/updateEventFormResponse: function/);
  assert.match(service,/AmendmentEventID/);
  assert.match(service,/LastAmendmentEventID/);
  assert.match(service,/اصلاح پاسخ فرم از طریق رویداد اصلاحی/);
});


test('form amendment uses optimistic concurrency and idempotent replay under the lock',()=>{
  const service=read('FormService.js');
  assert.match(service,/var currentResponse=FormRepository\.findResponse\(eventId,formId\)/);
  assert.match(service,/body\.ExpectedUpdatedAt/);
  assert.match(service,/currentResponse\.UpdatedAt/);
  assert.match(service,/LastAmendmentEventID/);
  assert.match(service,/این رویداد اصلاحی قبلاً با مقادیر دیگری ثبت شده است/);
  assert.match(service,/var isReplay=String\(currentResponse\.LastAmendmentEventID/);
  assert.match(service,/var updated=isReplay\?currentResponse:FormRepository\.updateResponse/);
  assert.match(service,/Even on replay, finish project-information synchronization/);
  assert.match(service,/if\(!isReplay\)AuditService\.log/);
});


test('explicit amendment configuration persists and server enforces allowed reusable forms',()=>{
  const service=read('EventTypeService.js');
  const validator=read('EventTypeValidator.js');
  const db=read('DatabaseSetup.js');
  const forms=read('FormService.js');
  assert.match(service,/IsFormAmendment/);
  assert.match(service,/AmendableFormIDs/);
  assert.match(service,/_validateAmendableForms_/);
  assert.match(validator,/IsFormAmendment/);
  assert.match(db,/IsFormAmendment','AmendableFormIDs/);
  assert.match(forms,/explicitlyConfigured/);
  assert.match(forms,/این فرم در تنظیمات نوع رویداد برای اصلاح مجاز نشده است/);
  assert.match(forms,/legacyMarker/);
});


test('amendment preserves the current project code when the saved form still contains its previous code',()=>{
  const service=read('FormService.js');
  assert.match(service,/var projectCodeChanged=Object\.create\(null\)/);
  assert.match(service,/previous=oldValues\[key\]/);
  assert.match(service,/clean\[key\]=String\(project\.ProjectCode\|\|''\)/);
  assert.match(service,/projectCodeChanged\[key\]&&!FormService\._isEmptyValue_\(next\)/);
});


test('event creation exposes separate persistence outcomes for reusable forms and central information',()=>{
  const event=read('EventService.js');
  const forms=read('FormService.js');
  assert.match(event,/formPersistence: formPersistence/);
  assert.match(event,/centralInformation: centralInformation/);
  assert.match(forms,/centralInformationCount/);
  assert.match(forms,/responseCount: responseCount/);
});

test('procurement retry route relies on the event service ownership-aware authorization',()=>{
  const router=read('Router.js');
  const service=read('EventService.js');
  const start=router.indexOf('const procurementRetryMatch');
  const end=router.indexOf("if (path === '/procurement/orders')",start);
  const route=router.slice(start,end);
  assert.match(route,/EventService\.retryProcurementIntegration/);
  assert.doesNotMatch(route,/AccessControlService\.require/);
  assert.match(service,/canManageIntegration/);
  assert.match(service,/event\.CreatedBy/);
});
