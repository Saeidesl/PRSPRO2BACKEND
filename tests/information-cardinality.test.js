'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadServices() {
  const mappings = [];
  const form = { ID: 'F1', TenantID: 'T1', Code: 'TABULAR', Name: 'فرم جدولی', Version: 2, Status: 'ACTIVE' };
  const context = {
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND', CONFLICT: 'CONFLICT', INVALID_OPERATION: 'INVALID_OPERATION' } },
    FormRepository: {
      findMappingsByEventType: () => mappings,
      findForm: () => form
    },
    InformationTypeRepository: { findById: () => null, findColumns: () => [] },
    Date, Object, String, Array, JSON, Number, isFinite
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'ProjectInformationService.js'), 'utf8') + '\nthis.__projectInfo=ProjectInformationService;', context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'FormService.js'), 'utf8') + '\nthis.__forms=FormService;', context);
  const columns = [
    { ID: 'C1', Code: 'Name', Name: 'نام', DataType: 'text', IsRequired: true, Status: 'ACTIVE', OptionsJSON: '[]', ValidationRuleJSON: '{}' },
    { ID: 'C2', Code: 'Quantity', Name: 'تعداد', DataType: 'number', IsRequired: true, Status: 'ACTIVE', OptionsJSON: '[]', ValidationRuleJSON: '{}' }
  ];
  const singleType = { ID: 'I1', TenantID: 'T1', Name: 'اطلاعات تک‌مقداری جدولی', Code: 'SINGLE_TABLE', Cardinality: 'SINGLE', DataType: 'text', Status: 'ACTIVE', Columns: columns };
  const multiType = { ID: 'I2', TenantID: 'T1', Name: 'اطلاعات چندمقداری', Code: 'MULTI_TABLE', Cardinality: 'MULTIPLE', DataType: 'number', Status: 'ACTIVE', Columns: columns };
  const fields = [
    { ID: 'FF1', TenantID: 'T1', FormID: 'F1', InformationTypeID: 'I1', FieldOrder: 1, IsRequired: true, InformationType: singleType },
    { ID: 'FF2', TenantID: 'T1', FormID: 'F1', InformationTypeID: 'I2', FieldOrder: 2, IsRequired: true, InformationType: multiType }
  ];
  const forms = context.__forms;
  forms._form = () => form;
  forms._definition = () => fields;
  return { projectInfo: context.__projectInfo, forms, mappings, singleType, multiType, columns, form };
}

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

test('the same multi-row type can store different row counts without cross-project coupling', () => {
  const h = loadServices();
  const five = h.projectInfo._validate(h.multiType, h.columns, Array.from({ length: 5 }, (_, i) => ({ Name: 'P1-' + i, Quantity: i + 1 })));
  const eight = h.projectInfo._validate(h.multiType, h.columns, Array.from({ length: 8 }, (_, i) => ({ Name: 'P2-' + i, Quantity: i + 1 })));
  assert.equal(five.length, 5);
  assert.equal(eight.length, 8);
});
