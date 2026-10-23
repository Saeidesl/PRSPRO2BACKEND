'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadProcurementService() {
  const sheets = Object.create(null);
  let uuid = 0;
  const context = {
    AccessControlService: { getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }) },
    ProjectRepository: {
      findById: (id) => String(id) === 'P1' ? { ID: 'P1', TenantID: 'T1' } : null
    },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    EventRepository: {
      findById: (id) => String(id) === 'EV1' ? { ID: 'EV1', TenantID: 'T1', ProjectID: 'P1' } : null
    },
    ProcurementRepository: {
      SHEETS: { NEEDS: '18_MaterialNeeds', ORDERS: '19_PurchaseOrders', ITEMS: '20_PurchaseOrderItems', ALLOCATIONS: '21_PurchaseAllocations', RECEIPTS: '22_MaterialReceipts' },
      getNeeds: (tenantId) => (sheets['18_MaterialNeeds'] || []).filter((row) => String(row.TenantID) === String(tenantId)),
      getOrders: (tenantId) => (sheets['19_PurchaseOrders'] || []).filter((row) => String(row.TenantID) === String(tenantId)),
      getItems: (tenantId) => (sheets['20_PurchaseOrderItems'] || []).filter((row) => String(row.TenantID) === String(tenantId)),
      getAllocations: (tenantId) => (sheets['21_PurchaseAllocations'] || []).filter((row) => String(row.TenantID) === String(tenantId)),
      getReceipts: (tenantId) => (sheets['22_MaterialReceipts'] || []).filter((row) => String(row.TenantID) === String(tenantId))
    },
    GoogleSheetsRepository: {
      getAll: (name) => (sheets[name] || []).map((row) => ({ ...row })),
      findById: (name, id) => (sheets[name] || []).find((row) => String(row.ID) === String(id)) || null,
      insert: (name, row) => { sheets[name] = sheets[name] || []; sheets[name].push({ ...row }); return { ...row }; },
      updateById: (name, id, row) => {
        sheets[name] = sheets[name] || [];
        const i = sheets[name].findIndex((item) => String(item.ID) === String(id));
        if (i < 0) throw new Error('missing row');
        sheets[name][i] = { ...row };
        return { ...row };
      }
    },
    Validator: { required: (v, label) => { if (v === undefined || v === null || String(v).trim() === '') throw new Error('required: ' + label); } },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND', CONFLICT: 'CONFLICT' } },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Response: { success: (data) => ({ success: true, data }) },
    AuditService: { log: () => true },
    Utilities: { getUuid: () => 'uuid' + (++uuid) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => true }) },
    Date, Math, Number, String, Object, Array, JSON, isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'ProcurementService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = ProcurementService;', context);
  return { service: context.__service, sheets };
}

test('replaying a source event does not create a duplicate material need', () => {
  const { service, sheets } = loadProcurementService();
  const payload = {
    ProjectID: 'P1', SourceEventID: 'EV1', ItemName: 'پارچه',
    Unit: 'متر', RequestedQuantity: 100
  };
  const first = service.createNeed(payload, {}).data;
  const replay = service.createNeed(payload, {}).data;
  assert.equal(first.ID, replay.ID);
  assert.equal(replay.IdempotentReplay, true);
  assert.equal(sheets['18_MaterialNeeds'].length, 1);
});

test('estimated and confirmed needs for the same specification share an allocation key', () => {
  const { service } = loadProcurementService();
  const estimated = { ID: 'N1', ProjectID: 'P1', MaterialSpecKey: 'SPEC1', NeedType: 'ESTIMATED' };
  const confirmed = { ID: 'N2', ProjectID: 'P1', MaterialSpecKey: 'SPEC1', NeedType: 'CONFIRMED' };
  assert.equal(service._needKey_(estimated, 'P1'), service._needKey_(confirmed, 'P1'));
});

test('rejects a project from another tenant when creating a material need', () => {
  const { service } = loadProcurementService();
  assert.throws(() => service.createNeed({
    ProjectID: 'P2', ItemName: 'پارچه', Unit: 'متر', RequestedQuantity: 10
  }, {}), /پروژه معتبر نیست/);
});
