'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadFormService() {
  const mappings = [];
  const responses = [];
  const audits = [];
  const context = {
    AccessControlService: { getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }) },
    FormRepository: {
      findMappingsByEventType: () => mappings,
      findResponse: (eventId, formId) => responses.find(x => x.EventID === eventId && x.FormID === formId) || null,
      insertResponse: row => { responses.push(row); return row; },
      updateResponse: (id, patch) => { const row=responses.find(x=>x.ID===id); Object.assign(row,patch); return row; },
      findResponsesByEvent: eventId => responses.filter(x=>x.EventID===eventId)
    },
    InformationTypeRepository: { findById: () => null, findColumns: () => [] },
    EventTypeRepository: { findById: () => ({ ID: 'ET1', TenantID: 'T1', ConnectionType: 'PROJECT' }) },
    EventRepository: { findById: () => ({ ID: 'EV1', TenantID: 'T1', ProjectID: 'P1' }) },
    ProjectRepository: { findById: () => ({ ID: 'P1', TenantID: 'T1' }) },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    ProjectInformationService: { _validate: (_type, _columns, value) => value },
    AuditService: { log: entry => audits.push(entry) },
    Validator: { required: (value,label) => { if(value===undefined||value===null||value==='') throw new Error(label+' required'); } },
    Response: { success: (data,meta) => ({ success:true,data,meta:meta||{} }) },
    ErrorHandler: { create: (_code,message) => new Error(message) },
    Constants: { ERROR: { NOT_FOUND:'NOT_FOUND',VALIDATION_ERROR:'VALIDATION_ERROR',CONFLICT:'CONFLICT',DUPLICATE:'DUPLICATE' }, STATUS:{ACTIVE:'ACTIVE'}, ACTION:{CREATE:'CREATE',UPDATE:'UPDATE',DELETE:'DELETE'} },
    Utilities: { getUuid: () => 'uuid' },
    Date, Object, String, Array, JSON, Number, isFinite
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','FormService.js'),'utf8')+'\nthis.__service=FormService;',context);
  const service=context.__service;
  const form={ID:'F1',TenantID:'T1',Code:'SPEC',Name:'مشخصات',Version:3,Status:'ACTIVE'};
  const type={ID:'I1',TenantID:'T1',Name:'نام مدل',Code:'ModelName',Cardinality:'SINGLE',DataType:'text',Status:'ACTIVE',OptionsJSON:'[]',ValidationRuleJSON:'{}'};
  service._form=()=>form;
  service._definition=()=>[{ID:'FF1',TenantID:'T1',FormID:'F1',InformationTypeID:'I1',FieldOrder:1,IsRequired:true,InformationType:type}];
  return {service,mappings,responses,audits};
}

test('required event form cannot be omitted',()=>{
  const h=loadFormService();h.mappings.push({TenantID:'T1',EventTypeID:'ET1',FormID:'F1',IsRequired:true,Status:'ACTIVE'});
  assert.throws(()=>h.service.prepareEventResponses('ET1',[],'T1'),/تکمیل فرم الزامی/);
});

test('valid response is validated and returned with immutable definition snapshot',()=>{
  const h=loadFormService();h.mappings.push({TenantID:'T1',EventTypeID:'ET1',FormID:'F1',IsRequired:true,Status:'ACTIVE'});
  const result=h.service.prepareEventResponses('ET1',[{FormID:'F1',FormVersion:3,Values:{I1:'مدل بهار'}}],'T1');
  assert.equal(result.length,1);
  assert.equal(result[0].Values.I1,'مدل بهار');
  assert.equal(result[0].DefinitionSnapshot.Version,3);
  assert.equal(result[0].DefinitionSnapshot.Fields[0].InformationTypeID,'I1');
});

test('stale form versions and unassigned forms are rejected',()=>{
  const h=loadFormService();h.mappings.push({TenantID:'T1',EventTypeID:'ET1',FormID:'F1',IsRequired:true,Status:'ACTIVE'});
  assert.throws(()=>h.service.prepareEventResponses('ET1',[{FormID:'F1',FormVersion:2,Values:{I1:'x'}}],'T1'),/نسخه فرم تغییر کرده/);
  assert.throws(()=>h.service.prepareEventResponses('ET1',[{FormID:'OTHER',FormVersion:3,Values:{}}],'T1'),/فرم ارسالی به این نوع رویداد متصل نیست/);
});

test('event form response persistence is idempotent per event and form',()=>{
  const h=loadFormService();
  const response={FormID:'F1',FormVersion:3,Values:{I1:'مدل'},DefinitionSnapshot:{ID:'F1',Version:3,Fields:[]}};
  h.service.saveEventResponses({ID:'EV1' },[response],{ID:'U1',TenantID:'T1'});
  h.service.saveEventResponses({ID:'EV1' },[response],{ID:'U1',TenantID:'T1'});
  assert.equal(h.responses.length,1);
  assert.equal(h.audits.length,2);
});
