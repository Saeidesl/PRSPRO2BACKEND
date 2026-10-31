'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadServices() {
  const mappings = [];
  const stored = new Map();
  const history = [];
  const columns = [
    { ID: 'C1', Code: 'Name', Name: 'نام', DataType: 'text', IsRequired: true, Status: 'ACTIVE', OptionsJSON: '[]', ValidationRuleJSON: '{}' },
    { ID: 'C2', Code: 'Quantity', Name: 'تعداد', DataType: 'number', IsRequired: true, Status: 'ACTIVE', OptionsJSON: '[]', ValidationRuleJSON: '{}' }
  ];
  const form = { ID: 'F1', TenantID: 'T1', Code: 'TABULAR', Name: 'فرم جدولی', Version: 2, Status: 'ACTIVE' };
  const context = {
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND', CONFLICT: 'CONFLICT', INVALID_OPERATION: 'INVALID_OPERATION' }, ACTION: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' } },
    FormRepository: {
      findMappingsByEventType: () => mappings,
      findForm: () => form
    },
    InformationTypeRepository: { findById: () => null, findColumns: () => columns },
    ProjectInformationRepository: {
      findAnyByProjectAndType: (projectId, typeId) => stored.get(projectId + '|' + typeId) || null,
      insert: row => { stored.set(row.ProjectID + '|' + row.InformationTypeID, row); return row; },
      update: (id, patch) => { const row = Array.from(stored.values()).find(item => item.ID === id); Object.assign(row, patch); return row; },
      insertHistory: row => { history.push(row); return row; }
    },
    Validator: { object: value => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required'); } },
    Response: { success: (data, meta) => ({ data, meta }) },
    AuditService: { log: () => {} },
    Date, Object, String, Array, JSON, Number, isFinite
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'ProjectInformationService.js'), 'utf8') + '\nthis.__projectInfo=ProjectInformationService;', context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'FormService.js'), 'utf8') + '\nthis.__forms=FormService;', context);
  const singleType = { ID: 'I1', TenantID: 'T1', Name: 'اطلاعات تک‌مقداری جدولی', Code: 'SINGLE_TABLE', Cardinality: 'SINGLE', DataType: 'text', Status: 'ACTIVE', Columns: columns };
  const multiType = { ID: 'I2', TenantID: 'T1', Name: 'اطلاعات چندمقداری', Code: 'MULTI_TABLE', Cardinality: 'MULTIPLE', DataType: 'number', Status: 'ACTIVE', Columns: columns };
  const fields = [
    { ID: 'FF1', TenantID: 'T1', FormID: 'F1', InformationTypeID: 'I1', FieldOrder: 1, IsRequired: true, InformationType: singleType },
    { ID: 'FF2', TenantID: 'T1', FormID: 'F1', InformationTypeID: 'I2', FieldOrder: 2, IsRequired: true, InformationType: multiType }
  ];
  const forms = context.__forms;
  const projectInfo = context.__projectInfo;
  projectInfo._user = () => ({ TenantID: 'T1', ID: 'U1' });
  projectInfo._project = projectId => ({ ID: projectId, TenantID: 'T1' });
  projectInfo._type = typeId => typeId === 'I1' ? singleType : multiType;
  projectInfo._id = prefix => prefix + '_' + Math.random().toString(36).slice(2);
  forms._form = () => form;
  forms._definition = () => fields;
  return { projectInfo, forms, mappings, singleType, multiType, columns, form, stored, history };
}

test('information type validation keeps base data type independent from cardinality', () => {
  const context = {
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR' }, STATUS: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } },
    Validator: {
      object: value => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required'); },
      required: (value, label) => { if (value === undefined || value === null || value === '') throw new Error(label + ' required'); },
      string: value => { if (typeof value !== 'string') throw new Error('string required'); },
      enum: (value, allowed, label) => { if (!allowed.includes(value)) throw new Error(label + ' invalid'); },
      boolean: value => { if (typeof value !== 'boolean') throw new Error('boolean required'); }
    },
    String, Array, Object, JSON, Number, isFinite, RegExp
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'InformationTypeValidator.js'), 'utf8') + '\\nthis.__validator=InformationTypeValidator;', context);
  assert.equal(context.__validator.validateDefinition({ Name: 'جدول نمونه', Code: 'TABLE_SAMPLE', Cardinality: 'MULTIPLE', DataType: 'number' }, false), true);
  assert.equal(context.__validator.validateDefinition({ Name: 'اطلاعات تکی', Code: 'SINGLE_SAMPLE', Cardinality: 'SINGLE', DataType: 'text' }, false), true);
});

test('single cardinality supports one structured row while retaining scalar compatibility', () => {
  const h = loadServices();
  assert.equal(h.projectInfo._validate({ Cardinality: 'SINGLE', DataType: 'text', ValidationRuleJSON: '{}', OptionsJSON: '[]' }, [], 'نمونه'), 'نمونه');
  assert.deepEqual(
    JSON.parse(JSON.stringify(h.projectInfo._validate(h.singleType, h.columns, { Name: 'نمونه تابستانی', Quantity: '2' }))),
    { Name: 'نمونه تابستانی', Quantity: 2 }
  );
  assert.throws(() => h.projectInfo._validate(h.singleType, h.columns, [{ Name: 'الف', Quantity: 1 }]), /به‌صورت یک ردیف/);
});

test('multiple cardinality accepts a variable row list and validates every populated row', () => {
  const h = loadServices();
  const rows = Array.from({ length: 5 }, (_, i) => ({ Name: 'نمونه ' + (i + 1), Quantity: i + 1 }));
  const saved = h.projectInfo._validate(h.multiType, h.columns, rows);
  assert.equal(saved.length, 5);
  assert.equal(saved[4].Quantity, 5);
  assert.throws(() => h.projectInfo._validate(h.multiType, h.columns, [{ Name: 'ردیف ناقص', Quantity: '' }]), /تعداد.*الزامی/);
  assert.throws(() => h.projectInfo._validate(h.multiType, h.columns, { Name: 'یک ردیف', Quantity: 1 }), /فهرست ردیف‌ها/);
});

test('empty tabular rows are ignored and unknown columns are rejected', () => {
  const h = loadServices();
  const rows = h.projectInfo._validate(h.multiType, h.columns, [{ Name: '', Quantity: '' }, { Name: 'نمونه', Quantity: 3 }]);
  assert.equal(rows.length, 1);
  assert.throws(() => h.projectInfo._validate(h.singleType, h.columns, { Name: 'نمونه', Quantity: 2, Unexpected: 'x' }), /ستون ناشناخته/);
});

test('required single-row tabular fields are validated as objects in reusable form responses', () => {
  const h = loadServices();
  h.mappings.push({ TenantID: 'T1', EventTypeID: 'ET1', FormID: 'F1', IsRequired: true, Status: 'ACTIVE' });
  const valid = h.forms.prepareEventResponses('ET1', [{
    FormID: 'F1', FormVersion: 2,
    Values: { I1: { Name: 'نمونه پاییز', Quantity: 4 }, I2: [{ Name: 'رنگ قرمز', Quantity: 2 }] }
  }], 'T1');
  assert.equal(valid.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(valid[0].Values.I1)), { Name: 'نمونه پاییز', Quantity: 4 });
  assert.equal(valid[0].Values.I2.length, 1);
  assert.throws(() => h.forms.prepareEventResponses('ET1', [{
    FormID: 'F1', FormVersion: 2,
    Values: { I1: {}, I2: [] }
  }], 'T1'), /فرم الزامی باید حداقل یک مقدار داشته باشد|تکمیل «اطلاعات تک‌مقداری جدولی» الزامی است/);
});

test('visibility rules treat empty single-row objects as empty values', () => {
  const h = loadServices();
  assert.equal(h.forms._isVisible_({ fieldId: 'I1', operator: 'FILLED' }, { I1: { Name: '', Quantity: '' } }), false);
  assert.equal(h.forms._isVisible_({ fieldId: 'I1', operator: 'EMPTY' }, { I1: { Name: '', Quantity: '' } }), true);
  assert.equal(h.forms._isVisible_({ fieldId: 'I1', operator: 'FILLED' }, { I1: { Name: 'نمونه', Quantity: 2 } }), true);
});

test('the same multi-row type stores independent row counts for separate projects', () => {
  const h = loadServices();
  const five = Array.from({ length: 5 }, (_, i) => ({ Name: 'P1-' + i, Quantity: i + 1 }));
  const eight = Array.from({ length: 8 }, (_, i) => ({ Name: 'P2-' + i, Quantity: i + 1 }));
  h.projectInfo.save('P1', 'I2', { Value: five }, {});
  h.projectInfo.save('P2', 'I2', { Value: eight }, {});
  const savedFive = JSON.parse(h.stored.get('P1|I2').ValueJSON);
  const savedEight = JSON.parse(h.stored.get('P2|I2').ValueJSON);
  assert.equal(savedFive.length, 5);
  assert.equal(savedEight.length, 8);
  assert.equal(h.stored.size, 2);
  assert.equal(h.history.length, 2);
});
