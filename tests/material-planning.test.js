'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadService(lockAvailable = true) {
  const sheets = Object.create(null);
  let auditCalls = 0;
  const context = {
    AccessControlService: {
      getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock: () => true }) },
    ProjectRepository: {
      findById: (id) => String(id) === 'P1'
        ? { ID: 'P1', TenantID: 'T1', Quantity: 100 } : null
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
    AuditService: { log: () => { auditCalls++; return true; } },
    Utilities: { getUuid: (() => { let n = 0; return () => 'uuid-' + (++n).toString().padStart(8, '0'); })() },
    Date, Math, Number, String, Object, Array, JSON, isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'MaterialPlanningService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = MaterialPlanningService;', context);
  return { service: context.__service, sheets, eventRepository: context.EventRepository, getAuditCalls: () => auditCalls };
}

test('creates versioned per-unit material specifications without an early-order path', () => {
  const { service } = loadService();
  const result = service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1.5,
    WastagePercent: 5, EarlyOrderPolicy: 'ESTIMATE_ALLOWED'
  }, {});
  assert.equal(result.success, true);
  assert.equal(result.data.Revision, 1);
  assert.equal(result.data.ConsumptionPerUnit, 1.5);
  assert.equal(result.data.WastagePercent, 5);
  assert.equal(result.data.EarlyOrderPolicy, 'DISABLED');
});

test('rejects invalid material consumption and ignores legacy early-order settings', () => {
  const { service } = loadService();
  assert.throws(() => service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 0
  }, {}), /مقدار معتبر نیست/);
  const legacyPayload = service.createSpecification('P1', {
    ItemName: 'زیپ', Unit: 'عدد', ConsumptionPerUnit: 1,
    EarlyOrderPolicy: 'ALWAYS', EarlyOrderQuantity: 75
  }, {});
  assert.equal(legacyPayload.data.EarlyOrderPolicy, 'DISABLED');
  assert.equal(legacyPayload.data.EarlyOrderQuantity, '');
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
  sheets['24_ProjectMaterialSpecs'] = [{ ID: 'MS1', TenantID: 'T1', ProjectID: 'P1' }];
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



test('voiding the source event marks confirmed needs for review without deleting history', () => {
  const { service, sheets } = loadService();
  service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1.5
  }, {});
  service.recalculateProjectNeeds('P1', 'EV1', 840, '1', {});
  const result = service.markEventVoided('EV1', {}).data;
  assert.equal(result.AffectedNeedCount, 1);
  assert.equal(sheets['18_MaterialNeeds'][0].Status, 'NEEDS_REVIEW');
  assert.equal(sheets['25_MaterialNeedCalculations'][0].Status, 'SOURCE_EVENT_VOIDED');
  assert.equal(sheets['18_MaterialNeeds'].length, 1);
});


test('schema preparation runs before calculation lock acquisition', () => {
  const { service } = loadService();
  let schemaPrepared = false;
  service._ensureSchema_ = () => { schemaPrepared = true; return true; };
  service._recalculateProjectNeedsUnlocked_ = () => {
    assert.equal(schemaPrepared, true);
    return { success: true, data: {} };
  };
  service.recalculateProjectNeeds('P1', 'EV1', 10, '1', {});
});

test('does not run duplicate material calculations when the script lock is unavailable', () => {
  const { service } = loadService(false);
  assert.throws(() => service.recalculateProjectNeeds('P1', 'EV1', 840, '1', {}), /محاسبه نیازهای ملزومات دیگری در حال انجام است/);
});

test('rejects cross-tenant or invisible projects', () => {
  const { service } = loadService();
  assert.throws(() => service.createSpecification('P2', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1
  }, {}), /پروژه مورد نظر پیدا نشد/);
});


test('revised material specifications supersede the old confirmed need without deleting history', () => {
  const { service, sheets } = loadService();
  const firstSpec = service.createSpecification('P1', {
    ItemName: 'پارچه', Unit: 'متر', ConsumptionPerUnit: 1.5
  }, {}).data;
  const firstNeed = service.recalculateProjectNeeds('P1', 'EV1', 840, '1', {}).data.items[0];
  const secondSpec = service.reviseSpecification(firstSpec.ID, {
    ConsumptionPerUnit: 1.75
  }, {}).data;
  const secondNeed = service.recalculateProjectNeeds('P1', 'EV2', 900, '1', {}).data.items[0];
  const needs = sheets['18_MaterialNeeds'];
  assert.equal(needs.length, 2);
  assert.equal(needs.find((need) => need.ID === firstNeed.MaterialNeedID).Status, 'SUPERSEDED');
  assert.equal(needs.find((need) => need.ID === secondNeed.MaterialNeedID).Status, 'ACTIVE');
  assert.equal(secondNeed.RequestedQuantity, 1575);
  assert.equal(sheets['25_MaterialNeedCalculations'].length, 2);
  assert.equal(sheets['25_MaterialNeedCalculations'].some((row) => row.MaterialSpecID === firstSpec.ID), true);
  assert.equal(sheets['25_MaterialNeedCalculations'].some((row) => row.MaterialSpecID === secondSpec.ID), true);
});


test('recordCalculation rejects foreign, missing, or cross-project references before insert and audit', () => {
  const { service, sheets, eventRepository, getAuditCalls } = loadService();
  sheets['24_ProjectMaterialSpecs'] = [
    { ID: 'MS_OK', TenantID: 'T1', ProjectID: 'P1' },
    { ID: 'MS_OTHER_TENANT', TenantID: 'T2', ProjectID: 'P1' },
    { ID: 'MS_OTHER_PROJECT', TenantID: 'T1', ProjectID: 'P2' }
  ];
  sheets['18_MaterialNeeds'] = [
    { ID: 'NEED_OTHER_TENANT', TenantID: 'T2', ProjectID: 'P1' },
    { ID: 'NEED_OTHER_PROJECT', TenantID: 'T1', ProjectID: 'P2' }
  ];
  const base = {
    ProjectID: 'P1', CalculationKey: 'security-test', BasisQuantity: 10,
    ConsumptionPerUnit: 1, MaterialSpecID: 'MS_OK'
  };
  const invalidPayloads = [
    { ...base, MaterialSpecID: 'MS_OTHER_TENANT' },
    { ...base, MaterialSpecID: 'MS_OTHER_PROJECT' },
    { ...base, MaterialSpecID: 'MS_MISSING' },
    { ...base, MaterialNeedID: 'NEED_OTHER_TENANT' },
    { ...base, MaterialNeedID: 'NEED_OTHER_PROJECT' },
    { ...base, MaterialNeedID: 'NEED_MISSING' },
    { ...base, SourceEventID: 'EV_FOREIGN' }
  ];
  // Explicitly simulate a foreign-tenant source event.
  const originalFindEvent = eventRepository.findById;
  eventRepository.findById = (id) => id === 'EV_FOREIGN'
    ? { ID: id, TenantID: 'T2', ProjectID: 'P1' }
    : originalFindEvent(id);
  for (const payload of invalidPayloads) {
    assert.throws(() => service.recordCalculation(payload, {}), /مطابقت ندارد/);
  }
  assert.equal((sheets['25_MaterialNeedCalculations'] || []).length, 0);
  assert.equal(getAuditCalls(), 0);
});

test('recordCalculation validates references even when CalculationKey is an idempotent replay', () => {
  const { service, sheets, getAuditCalls } = loadService();
  sheets['24_ProjectMaterialSpecs'] = [
    { ID: 'MS_OK', TenantID: 'T1', ProjectID: 'P1' },
    { ID: 'MS_OTHER', TenantID: 'T2', ProjectID: 'P1' }
  ];
  sheets['25_MaterialNeedCalculations'] = [{
    ID: 'CALC_OLD', TenantID: 'T1', ProjectID: 'P1',
    CalculationKey: 'same-key', MaterialSpecID: 'MS_OK'
  }];
  assert.throws(() => service.recordCalculation({
    ProjectID: 'P1', MaterialSpecID: 'MS_OTHER', CalculationKey: 'same-key',
    BasisQuantity: 10, ConsumptionPerUnit: 1
  }, {}), /مطابقت ندارد/);
  assert.equal(sheets['25_MaterialNeedCalculations'].length, 1);
  assert.equal(getAuditCalls(), 0);
});
