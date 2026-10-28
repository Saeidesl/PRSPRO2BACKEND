'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadIntegration() {
  const calls = [];
  let projectAvailable = true;
  const settings = [{
    ID: 'SET1', TenantID: 'T1', EventTypeID: 'ET1',
    Action: 'RECALCULATE_CONFIRMED_NEEDS',
    FieldMapJSON: JSON.stringify({ ConfirmedQuantity: 'confirmed_qty' }),
    Status: 'ACTIVE'
  }];
  const context = {
    AccessControlService: {
      getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }),
      require: () => ({ ID: 'U1', TenantID: 'T1' })
    },
    GoogleSheetsRepository: {
      getAll: (name) => name === '23_EventTypeProcurementSettings' ? settings : [],
      findById: () => null
    },
    EventTypeRepository: { findById: () => ({ ID: 'ET1', TenantID: 'T1', Version: '2' }) },
    EventFieldRepository: { findByEventTypeId: () => [] },
    ProjectRepository: { findById: () => ({ ID: 'P1', TenantID: 'T1' }) },
    ProjectService: { _isProjectAvailableToUser_: () => projectAvailable },
    MaterialPlanningService: {
      recalculateProjectNeeds: (...args) => {
        calls.push(args);
        return { success: true, data: { BasisQuantity: args[2] } };
      }
    },
    ProcurementService: { createReceipt: () => null },
    Validator: { required: (value, label) => {
      if (value === undefined || value === null || String(value).trim() === '') throw new Error('required: ' + label);
    }},
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND' } },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    AuditService: { log: () => true },
    Date, Math, Number, String, Object, Array, JSON, isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'ProcurementEventIntegrationService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = ProcurementEventIntegrationService;', context);
  return { service: context.__service, calls, setProjectAvailable: (value) => { projectAvailable = value; } };
}

test('validates confirmed quantity mapping before event persistence', () => {
  const { service } = loadIntegration();
  const type = { ID: 'ET1', TenantID: 'T1', Version: '2' };
  assert.equal(service.validate(type, { confirmed_qty: 840 }, 'P1', {}), true);
  assert.throws(() => service.validate(type, {}, 'P1', {}), /الزامی است/);
  assert.throws(() => service.validate(type, { confirmed_qty: 0 }, 'P1', {}), /بزرگ‌تر از صفر/);
});

test('applies confirmed quantity integration to the material planner', () => {
  const { service, calls } = loadIntegration();
  const result = service.apply(
    { ID: 'ET1', Version: '2' },
    { ID: 'EV1', ProjectID: 'P1', EventTypeVersion: '2' },
    { confirmed_qty: 840 },
    {}
  );
  assert.equal(result.success, true);
  assert.equal(calls[0][0], 'P1');
  assert.equal(calls[0][1], 'EV1');
  assert.equal(calls[0][2], 840);
  assert.equal(calls[0][3], '2');
});


test('rejects confirmed-quantity recalculation for a project unavailable to the current user', () => {
  const { service, setProjectAvailable } = loadIntegration();
  setProjectAvailable(false);
  assert.throws(
    () => service.validate(
      { ID: 'ET1', TenantID: 'T1', Version: '2' },
      { confirmed_qty: 840 },
      'P1',
      {}
    ),
    /پروژه برای محاسبه نیاز قطعی معتبر نیست/
  );
});
