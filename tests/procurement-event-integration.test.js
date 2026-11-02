'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadIntegration(overrides = {}) {
  const calls = [];
  const settings = [{
    ID: 'SET1', TenantID: 'T1', EventTypeID: 'ET1',
    Action: 'RECALCULATE_CONFIRMED_NEEDS',
    ConfirmedQuantityInformationTypeID: 'IT1',
    FieldMapJSON: JSON.stringify({ ConfirmedQuantity: 'legacy_quantity' }),
    Status: 'ACTIVE'
  }];
  const centralValue = {
    ID: 'PI1', TenantID: 'T1', ProjectID: 'P1',
    InformationTypeID: 'IT1', ValueJSON: '840',
    SourceEventID: 'EV1', Status: 'ACTIVE'
  };
  const type = {
    ID: 'IT1', TenantID: 'T1', Status: 'ACTIVE',
    DataType: 'number', Cardinality: 'SINGLE', Name: 'تعداد قطعی'
  };
  const context = {
    AccessControlService: {
      getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }),
      require: () => ({ ID: 'U1', TenantID: 'T1' })
    },
    GoogleSheetsRepository: {
      getAll: name => name === '23_EventTypeProcurementSettings' ? settings : [],
      updateById: (_sheet, id, patch) => {
        Object.assign(settings.find(row => row.ID === id), patch);
        return settings.find(row => row.ID === id);
      },
      insert: (_sheet, row) => { settings.push(row); return row; }
    },
    EventTypeRepository: { findById: () => ({ ID: 'ET1', TenantID: 'T1', Version: '2' }) },
    InformationTypeRepository: {
      findById: id => String(id) === 'IT1' ? type : null,
      findColumns: () => []
    },
    ProjectRepository: { findById: () => ({ ID: 'P1', TenantID: 'T1' }) },
    ProjectInformationRepository: {
      findByProjectAndType: () => overrides.centralValue || centralValue
    },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    MaterialPlanningService: {
      recalculateProjectNeeds: (...args) => {
        calls.push(args);
        return { success: true, data: { BasisQuantity: args[2] } };
      }
    },
    Utilities: { getUuid: () => 'uuid-1' },
    Response: { success: data => ({ data }) },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND', CONFLICT: 'CONFLICT' } },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    AuditService: { log: () => true },
    Date, Math, Number, String, Object, Array, JSON, isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'ProcurementEventIntegrationService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = ProcurementEventIntegrationService;', context);
  return { service: context.__service, calls, settings, context };
}

test('validates a numeric single central information type and prepared form quantity', () => {
  const { service } = loadIntegration();
  const type = { ID: 'ET1', TenantID: 'T1', Version: '2' };
  assert.equal(service.validate(type, [{ FormID: 'F1', Values: { IT1: 840 } }], 'P1', {}), true);
  assert.throws(() => service.validate(type, [], 'P1', {}), /فرم متصل باید مقدار/);
  assert.throws(() => service.validate(type, [{ Values: { IT1: 0 } }], 'P1', {}), /بزرگ‌تر از صفر/);
  assert.throws(() => service.validate(type, [{ Values: { IT1: -2 } }], 'P1', {}), /بزرگ‌تر از صفر/);
  assert.throws(() => service.validate(type, [{ Values: { IT1: 3 } }, { Values: { IT1: 4 } }], 'P1', {}), /بیش از یک فرم/);
});

test('rejects inactive, non-numeric, multi-value and table-shaped central information types', () => {
  const { service, context } = loadIntegration();
  const type = { ID: 'ET1', TenantID: 'T1' };
  context.InformationTypeRepository.findById = () => ({ ID: 'IT1', TenantID: 'T1', Status: 'INACTIVE', DataType: 'number', Cardinality: 'SINGLE' });
  assert.throws(() => service.validate(type, [{ Values: { IT1: 10 } }], 'P1', {}), /معتبر یا فعال نیست/);
  context.InformationTypeRepository.findById = () => ({ ID: 'IT1', TenantID: 'T1', Status: 'ACTIVE', DataType: 'text', Cardinality: 'SINGLE' });
  assert.throws(() => service.validate(type, [{ Values: { IT1: 10 } }], 'P1', {}), /عدد/);
  context.InformationTypeRepository.findById = () => ({ ID: 'IT1', TenantID: 'T1', Status: 'ACTIVE', DataType: 'number', Cardinality: 'MULTIPLE' });
  assert.throws(() => service.validate(type, [{ Values: { IT1: 10 } }], 'P1', {}), /تک‌مقداری/);
  context.InformationTypeRepository.findById = () => ({ ID: 'IT1', TenantID: 'T1', Status: 'ACTIVE', DataType: 'number', Cardinality: 'SINGLE' });
  context.InformationTypeRepository.findColumns = () => [{ ID: 'C1', Status: 'ACTIVE' }];
  assert.throws(() => service.validate(type, [{ Values: { IT1: 10 } }], 'P1', {}), /ساختار جدولی/);
});

test('applies confirmed quantity only from central information saved by the same event', () => {
  const { service, calls } = loadIntegration();
  const result = service.apply(
    { ID: 'ET1', Version: '2' },
    { ID: 'EV1', ProjectID: 'P1', EventTypeVersion: '2' },
    {}
  );
  assert.equal(result.success, true);
  assert.equal(calls[0][0], 'P1');
  assert.equal(calls[0][1], 'EV1');
  assert.equal(calls[0][2], 840);
  assert.equal(calls[0][3], '2');
});

test('does not reuse a central value written by an older or different event', () => {
  const { service } = loadIntegration({
    centralValue: { ID: 'PI1', TenantID: 'T1', ProjectID: 'P1', InformationTypeID: 'IT1', ValueJSON: '840', SourceEventID: 'EV_OLD', Status: 'ACTIVE' }
  });
  assert.throws(() => service.apply(
    { ID: 'ET1', Version: '2' },
    { ID: 'EV1', ProjectID: 'P1', EventTypeVersion: '2' },
    {}
  ), /همین رویداد/);
});

test('legacy receipt integration settings are inert and never create receipts', () => {
  const { service, settings } = loadIntegration();
  settings[0].Action = 'RECORD_RECEIPT';
  const result = service.get('ET1', {});
  assert.equal(result.data.Action, 'NONE');
  assert.equal(result.data.FieldMapJSON, undefined);
  assert.equal(service.validate({ ID: 'ET1' }, [], 'P1', {}), true);
  assert.equal(service.apply({ ID: 'ET1' }, { ID: 'EV1', ProjectID: 'P1' }, {}), null);
});

test('settings save only NONE or central confirmed quantity configuration', () => {
  const { service, settings } = loadIntegration();
  const saved = service.save('ET1', {
    Action: 'RECALCULATE_CONFIRMED_NEEDS',
    ConfirmedQuantityInformationTypeID: 'IT1'
  }, {});
  assert.equal(saved.data.ConfirmedQuantityInformationTypeID, 'IT1');
  assert.equal(saved.data.FieldMapJSON, undefined);
  assert.throws(() => service.save('ET1', { Action: 'RECORD_RECEIPT' }, {}), /عملیات تأمین معتبر نیست/);
  assert.throws(() => service.save('ET1', { Action: 'RECALCULATE_CONFIRMED_NEEDS', ConfirmedQuantityInformationTypeID: '' }, {}), /انتخاب کنید/);
  assert.equal(settings[0].Action, 'RECALCULATE_CONFIRMED_NEEDS');
});

test('event creation validates forms before insert, saves central information, then applies procurement', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'EventService.js'), 'utf8');
  const prepare = source.indexOf('FormService.prepareEventResponses');
  const validate = source.indexOf('ProcurementEventIntegrationService.validate');
  const insert = source.indexOf('const created = EventRepository.insert(newEvent)');
  const saveForms = source.indexOf('FormService.saveEventResponses(created, validatedFormResponses, user, requestParams)');
  const apply = source.indexOf('ProcurementEventIntegrationService.apply(eventType, created, requestParams)');
  assert.ok(prepare > 0 && validate > prepare && insert > validate && saveForms > insert && apply > saveForms);
  assert.doesNotMatch(source, /hasDynamicData|validatedDynamicData|DynamicData|EventDataRepository\.insert/);
});

test('legacy event data is read-only and historical detail lookup remains available', () => {
  const router = fs.readFileSync(path.join(__dirname, '..', 'Router.js'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '..', 'EventDataService.js'), 'utf8');
  const fields = fs.readFileSync(path.join(__dirname, '..', 'EventFieldRepository.js'), 'utf8');
  assert.match(router, /EventDataService\.getByEventId/);
  assert.doesNotMatch(router, /EventFieldService|EventDataService\.save|event-fields/);
  assert.doesNotMatch(router, /parts\[3\] === 'fields'/);
  assert.match(service, /getByEventId: function/);
  assert.doesNotMatch(service, /validateDynamicData|save: function/);
  assert.match(fields, /getAll: function/);
  assert.doesNotMatch(fields, /insert: function|update: function|delete: function/);
});

test('database retains legacy sheets and appends the central quantity setting column', () => {
  const setup = fs.readFileSync(path.join(__dirname, '..', 'DatabaseSetup.js'), 'utf8');
  assert.match(setup, /name: '12_EventFields'/);
  assert.match(setup, /name: '14_EventData'/);
  assert.match(setup, /'FieldMapJSON','Status','CreatedBy','CreatedAt','UpdatedAt','ConfirmedQuantityInformationTypeID'/);
});

test('standard procurement order and receipt routes remain independent and available', () => {
  const router = fs.readFileSync(path.join(__dirname, '..', 'Router.js'), 'utf8');
  assert.match(router, /path === '\/procurement\/orders'/);
  assert.match(router, /ProcurementService\.createOrder/);
  assert.match(router, /path === '\/procurement\/receipts'/);
  assert.match(router, /ProcurementService\.createReceipt/);
  assert.match(router, /path === '\/procurement\/receipts\/batch'/);
  assert.match(router, /ProcurementService\.createReceiptsBatch/);
});
