'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadService() {
  const sheets = Object.create(null);
  const context = {
    AccessControlService: {
      getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' })
    },
    ProjectRepository: {
      findById: (id) => String(id) === 'P1'
        ? { ID: 'P1', TenantID: 'T1' } : null
    },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    EventRepository: { findById: (id) => String(id) === 'EV1' || String(id) === 'EV2'
      ? { ID: String(id), TenantID: 'T1', ProjectID: 'P1', EventTypeVersion: '1' } : null },
    GoogleSheetsRepository: {
      getAll: (name) => (sheets[name] || []).map((row) => ({ ...row })),
      findById: (name, id) => (sheets[name] || []).find((row) => String(row.ID) === String(id)) || null,
      insert: (name, record) => {
        sheets[name] = sheets[name] || [];
        sheets[name].push({ ...record });
        return { ...record };
      },
      updateById: (name, id, record) => {
        const rows = sheets[name] || [];
        const index = rows.findIndex((row) => String(row.ID) === String(id));
        if (index < 0) throw new Error('missing record');
        rows[index] = { ...record };
        return { ...record };
      }
    },
    Validator: {
      required: (value, label) => {
        if (value === undefined || value === null || String(value).trim() === '') {
          throw new Error('required: ' + label);
        }
      }
    },
    Constants: { ERROR: {
      VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND',
      DUPLICATE: 'DUPLICATE', INVALID_STATUS: 'INVALID_STATUS', CONFLICT: 'CONFLICT'
    }},
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Response: { success: (data) => ({ success: true, data }) },
    AuditService: { log: () => true },
    Utilities: { getUuid: (() => { let n = 0; return () => 'uuid-' + (++n).toString().padStart(8, '0'); })() },
    Date, Math, Number, String, Object, Array, JSON, isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'MaterialPlanningService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = MaterialPlanningService;', context);
  return { service: context.__service, sheets };
}

test('creates a versioned material specification with validated policy', () => {
  const { service } = loadService();
  const result = service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1.5,
    WastagePercent: 5, EarlyOrderPolicy: 'ESTIMATE_ALLOWED'
  }, {});
  assert.equal(result.success, true);
  assert.equal(result.data.Revision, 1);
  assert.equal(result.data.ConsumptionPerUnit, 1.5);
  assert.equal(result.data.WastagePercent, 5);
  assert.equal(result.data.EarlyOrderPolicy, 'ESTIMATE_ALLOWED');
});

test('rejects invalid material consumption and invalid early-order policy', () => {
  const { service } = loadService();
  assert.throws(() => service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 0
  }, {}), /مقدار معتبر نیست/);
  assert.throws(() => service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1,
    EarlyOrderPolicy: 'ALWAYS'
  }, {}), /سیاست سفارش زودهنگام معتبر نیست/);
});

test('revises specifications without losing the previous revision', () => {
  const { service, sheets } = loadService();
  const first = service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1.5
  }, {}).data;
  const second = service.reviseSpecification(first.ID, {
    ConsumptionPerUnit: 1.75
  }, {}).data;
  assert.equal(second.Revision, 2);
  assert.equal(second.SpecKey, first.SpecKey);
  const rows = sheets['24_ProjectMaterialSpecs'];
  assert.equal(rows.find((row) => row.ID === first.ID).Status, 'SUPERSEDED');
  const listed = service.listSpecifications('P1', {}).data.items;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].ID, second.ID);
});

test('calculation history is idempotent and records quantity variance', () => {
  const { service, sheets } = loadService();
  const payload = {
    ProjectID: 'P1', MaterialSpecID: 'MS1', SourceEventID: 'EV1',
    CalculationKey: 'T1|P1|EV1|MS1|R1', BasisQuantity: 840,
    ConsumptionPerUnit: 1.5, WastagePercent: 0
  };
  const first = service.recordCalculation(payload, {}).data;
  const replay = service.recordCalculation(payload, {}).data;
  assert.equal(first.CalculatedQuantity, 1260);
  assert.equal(replay.IdempotentReplay, true);
  assert.equal(sheets['25_MaterialNeedCalculations'].length, 1);
  const changed = service.recordCalculation({
    ...payload, CalculationKey: 'T1|P1|EV2|MS1|R1',
    SourceEventID: 'EV2', BasisQuantity: 900,
    PreviousCalculatedQuantity: 1260
  }, {}).data;
  assert.equal(changed.CalculatedQuantity, 1350);
  assert.equal(changed.VarianceQuantity, 90);
});


test('confirmed quantity event creates material needs and safely replays', () => {
  const { service, sheets } = loadService();
  service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1.5,
    WastagePercent: 0
  }, {});
  const first = service.recalculateProjectNeeds('P1', 'EV1', 840, '1', {}).data;
  assert.equal(first.items[0].RequestedQuantity, 1260);
  assert.equal(sheets['18_MaterialNeeds'].length, 1);
  const replay = service.recalculateProjectNeeds('P1', 'EV1', 840, '1', {}).data;
  assert.equal(replay.items[0].RequestedQuantity, 1260);
  assert.equal(sheets['18_MaterialNeeds'].length, 1);
  assert.equal(sheets['25_MaterialNeedCalculations'].length, 1);
  const revised = service.recalculateProjectNeeds('P1', 'EV2', 900, '1', {}).data;
  assert.equal(revised.items[0].RequestedQuantity, 1350);
  assert.equal(sheets['18_MaterialNeeds'].length, 1);
  assert.equal(sheets['25_MaterialNeedCalculations'].length, 2);
});

test('rejects cross-tenant or invisible projects', () => {
  const { service } = loadService();
  assert.throws(() => service.createSpecification('P2', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1
  }, {}), /پروژه مورد نظر پیدا نشد/);
});
