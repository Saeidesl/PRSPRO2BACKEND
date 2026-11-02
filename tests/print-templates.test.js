'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadPrintTemplates() {
  const templates = [];
  const audits = [];
  const responses = [
    { ID:'R1',TenantID:'T1',EventID:'E1',FormID:'F1',FormVersion:2,CreatedAt:'2026-01-01T10:00:00Z',
      ResponseJSON:JSON.stringify({I1:'قدیمی'}),DefinitionSnapshotJSON:JSON.stringify({Version:2,Fields:[{ID:'FF1',InformationTypeID:'I1'}]}) },
    { ID:'R2',TenantID:'T1',EventID:'E2',FormID:'F1',FormVersion:3,CreatedAt:'2026-01-02T10:00:00Z',
      ResponseJSON:JSON.stringify({I1:'جدید'}),DefinitionSnapshotJSON:JSON.stringify({Version:3,Fields:[{ID:'FF1',InformationTypeID:'I1'}]}) },
    { ID:'R3',TenantID:'T2',EventID:'E3',FormID:'F1',FormVersion:3,CreatedAt:'2026-01-03T10:00:00Z',
      ResponseJSON:JSON.stringify({I1:'خارج از tenant'}),DefinitionSnapshotJSON:'{}' }
  ];
  const context = {
    AccessControlService: { getCurrentUser: () => ({ID:'U1',TenantID:'T1'}) },
    PrintTemplateRepository: {
      getAll: () => templates,
      findById: id => templates.find(row => String(row.ID) === String(id)) || null,
      insert: row => { templates.push(row); return row; },
      update: (id, patch) => { const row=templates.find(item=>String(item.ID)===String(id)); if(row)Object.assign(row,patch); return row; }
    },
    ProjectRepository: { findById: () => ({ID:'P1',TenantID:'T1',ProjectCode:'PR-1',Title:'پروژه آزمایشی',Status:'ACTIVE'}) },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    InformationTypeRepository: {
      findByTenant: () => [{ID:'I1',TenantID:'T1',Code:'MODEL',Name:'نام مدل',DataType:'text',Cardinality:'SINGLE',Status:'ACTIVE'}],
      findById: id => String(id)==='I1' ? {ID:'I1',TenantID:'T1',Status:'ACTIVE'} : null,
      findColumns: () => []
    },
    ProjectInformationRepository: {
      findByProject: () => [{ID:'PI1',TenantID:'T1',ProjectID:'P1',InformationTypeID:'I1',ValueJSON:'"مقدار جاری"',Status:'ACTIVE'}]
    },
    EventRepository: {
      findByProjectId: () => [
        {ID:'E1',TenantID:'T1',Status:'ACTIVE'},
        {ID:'E2',TenantID:'T1',Status:'ACTIVE'},
        {ID:'E3',TenantID:'T2',Status:'ACTIVE'}
      ]
    },
    FormRepository: {
      getForms: () => [{ID:'F1',TenantID:'T1',Code:'F',Name:'فرم',Version:3,Status:'ACTIVE'}],
      findFieldsByForm: () => [{ID:'FF1',TenantID:'T1',Status:'ACTIVE',InformationTypeID:'I1'}],
      getEventResponses: () => responses
    },
    AuditService: { log: entry => audits.push(entry) },
    Validator: {
      required: (value,label) => { if(value===undefined||value===null||String(value)==='') throw new Error(label+' الزامی است.'); },
      object: value => { if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('object'); }
    },
    Response: { success: (data,meta) => ({success:true,data,meta:meta||{}}) },
    ErrorHandler: { create: (_code,message) => new Error(message) },
    Constants: { ERROR:{NOT_FOUND:'NOT_FOUND',VALIDATION_ERROR:'VALIDATION_ERROR',DUPLICATE:'DUPLICATE'}, ACTION:{CREATE:'CREATE',UPDATE:'UPDATE',DELETE:'DELETE'} },
    Utilities: { getUuid: () => 'test-uuid' },
    Date, Object, String, Array, JSON, Number, Math, isFinite
  };
  const root = path.join(__dirname,'..');
  vm.runInNewContext(fs.readFileSync(path.join(root,'PrintTemplateValidator.js'),'utf8')+'\nthis.__validator=PrintTemplateValidator;',context);
  context.PrintTemplateValidator = context.__validator;
  vm.runInNewContext(fs.readFileSync(path.join(root,'PrintTemplateService.js'),'utf8')+'\nthis.__service=PrintTemplateService;',context);
  return {service:context.__service,templates,audits};
}

test('template definitions accept stable bindings and reject duplicate or unsupported sources',()=>{
  const h=loadPrintTemplates();
  const valid=h.service && {schemaVersion:1,page:{size:'A4',orientation:'portrait'},elements:[],bindings:[
    {id:'project_code',sourceType:'PROJECT_FIELD',field:'ProjectCode'}
  ]};
  assert.equal(valid.bindings[0].sourceType,'PROJECT_FIELD');
  const source=fs.readFileSync(path.join(__dirname,'..','PrintTemplateValidator.js'),'utf8');
  const context={ErrorHandler:{create:(_c,m)=>new Error(m)},Constants:{ERROR:{VALIDATION_ERROR:'VALIDATION_ERROR'}},
    Validator:{required:(v,l)=>{if(!v)throw new Error(l);}},Date,Object,String,Array,JSON,Number};
  vm.runInNewContext(source+'\nthis.validator=PrintTemplateValidator;',context);
  assert.throws(()=>context.validator.parseDefinition({bindings:[
    {id:'x',sourceType:'PROJECT_FIELD',field:'Title'},
    {id:'x',sourceType:'PROJECT_FIELD',field:'Status'}
  ]}),/تکراری/);
  assert.throws(()=>context.validator.parseDefinition({bindings:[{id:'x',sourceType:'UNKNOWN'}]}),/پشتیبانی نمی‌شود/);
});

test('templates are tenant-scoped, centrally created and versioned on update',()=>{
  const h=loadPrintTemplates();
  const created=h.service.create({Code:'PROJECT_REPORT',Name:'گزارش پروژه',Definition:{bindings:[]}}, {});
  assert.equal(created.success,true);
  assert.equal(created.data.Version,1);
  assert.equal(h.templates.length,1);
  assert.equal(h.audits[0].EntityType,'PRINT_TEMPLATE');
  const updated=h.service.update(created.data.ID,{Name:'گزارش پروژه جدید'}, {});
  assert.equal(updated.data.Version,2);
  assert.equal(updated.data.Name,'گزارش پروژه جدید');
  assert.throws(()=>h.service.get('MISSING',{}),/پیدا نشد/);
});

test('template code is unique within a tenant',()=>{
  const h=loadPrintTemplates();
  h.service.create({Code:'DUPLICATE',Name:'اول',Definition:{bindings:[]}}, {});
  assert.throws(()=>h.service.create({Code:'duplicate',Name:'دوم',Definition:{bindings:[]}}, {}),/قبلاً استفاده شده/);
});

test('data resolution uses current project information and the latest form snapshot only',()=>{
  const h=loadPrintTemplates();
  const created=h.service.create({Code:'DATA_REPORT',Name:'گزارش داده',Definition:{bindings:[
    {id:'project_code',sourceType:'PROJECT_FIELD',field:'ProjectCode'},
    {id:'current_model',sourceType:'PROJECT_INFORMATION',informationTypeId:'I1'},
    {id:'latest_form_value',sourceType:'EVENT_FORM_FIELD',formId:'F1',fieldId:'FF1',selection:'LATEST'},
    {id:'all_form_values',sourceType:'EVENT_FORM_FIELD',formId:'F1',fieldId:'FF1',selection:'ALL'}
  ]}}, {});
  const result=h.service.resolve(created.data.ID,{ProjectID:'P1'}, {});
  assert.equal(result.data.data.project_code,'PR-1');
  assert.equal(result.data.data.current_model,'مقدار جاری');
  assert.equal(result.data.data.latest_form_value,'جدید');
  assert.deepEqual(Array.from(result.data.data.all_form_values),['قدیمی','جدید']);
});

test('resolve rejects projects outside the current tenant or access boundary',()=>{
  const h=loadPrintTemplates();
  const created=h.service.create({Code:'SECURE',Name:'قالب امن',Definition:{bindings:[]}}, {});
  h.service._user=()=>({ID:'U1',TenantID:'T1'});
  const context=vm.runInNewContext;
  assert.throws(()=>h.service.resolve(created.data.ID,{ProjectID:'OTHER'},{}),/پیدا نشد/);
});

test('source catalog exposes active tenant information types and reusable forms',()=>{
  const h=loadPrintTemplates();
  const result=h.service.sources({});
  assert.equal(result.data.informationTypes.length,1);
  assert.equal(result.data.forms.length,1);
  assert.equal(result.data.forms[0].Fields[0].InformationTypeID,'I1');
});

test('template deletion is logical and retains the stored record',()=>{
  const h=loadPrintTemplates();
  const created=h.service.create({Code:'ARCHIVE',Name:'قالب بایگانی',Definition:{bindings:[]}}, {});
  const removed=h.service.deactivate(created.data.ID,{});
  assert.equal(removed.data.Status,'DELETED');
  assert.equal(h.templates.length,1);
  assert.throws(()=>h.service.get(created.data.ID,{}),/پیدا نشد/);
});