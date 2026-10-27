'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadProcurementService() {
  const sheets = Object.create(null);
  let uuid = 0;
  let projectLookupCount = 0;
  let schemaPreparationCalls = 0;
  const context = {
    AccessControlService: { getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }) },
    MaterialPlanningService: { _ensureSchema_: () => { schemaPreparationCalls++; return true; } },
    ProjectRepository: {
      findById: (id) => {
        projectLookupCount++;
        return String(id) === 'P1' ? { ID: 'P1', TenantID: 'T1' } : (String(id) === 'P2' ? { ID: 'P2', TenantID: 'T2' } : null);
      }
    },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    EventRepository: {
      findById: (id) => String(id) === 'EV1'
        ? { ID: 'EV1', TenantID: 'T1', ProjectID: 'P1' }
        : (String(id) === 'EV2' ? { ID: 'EV2', TenantID: 'T2', ProjectID: 'P2' } : null)
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
  const validatorSource = fs.readFileSync(path.join(__dirname, '..', 'ProcurementValidator.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '..', 'ProcurementService.js'), 'utf8');
  vm.runInNewContext(validatorSource + '\n' + source + '\nthis.__service = ProcurementService;', context);
  return { service: context.__service, sheets, getProjectLookupCount: () => projectLookupCount, getSchemaPreparationCalls: () => schemaPreparationCalls };
}

test('legacy estimated needs and confirmed needs share an allocation key for existing procurement records', () => {
  const { service } = loadProcurementService();
  const estimated = { ID: 'N1', ProjectID: 'P1', MaterialSpecKey: 'SPEC1', NeedType: 'ESTIMATED' };
  const confirmed = { ID: 'N2', ProjectID: 'P1', MaterialSpecKey: 'SPEC1', NeedType: 'CONFIRMED' };
  assert.equal(service._needKey_(estimated, 'P1'), service._needKey_(confirmed, 'P1'));
});

test('caps cumulative allocations at the need quantity and records the remainder as surplus', () => {
  const { service, sheets } = loadProcurementService();
  const need = {
    ID: 'N_TEST_1', TenantID: 'T1', ProjectID: 'P1', SourceEventID: 'EV1',
    ItemName: 'پارچه', ItemCode: 'MAT-TEST', Unit: 'متر',
    RequestedQuantity: 100, Status: 'ACTIVE', NeedType: 'CONFIRMED',
    MaterialSpecKey: 'SPEC_TEST', CreatedAt: new Date().toISOString()
  };
  sheets['18_MaterialNeeds'] = [need];
  service.createOrder({
    ProjectID: 'P1',
    Items: [{ MaterialNeedID: need.ID, ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 60 }]
  }, {});
  const second = service.createOrder({
    ProjectID: 'P1',
    Items: [{ MaterialNeedID: need.ID, ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 50 }]
  }, {}).data;
  const secondItem = second.Items[0];
  assert.equal(secondItem.OrderedQuantity, 50);
  assert.equal(secondItem.SurplusQuantity, 10);
  const allocations = sheets['21_PurchaseAllocations'].filter((row) => row.MaterialNeedID === need.ID);
  assert.equal(allocations.reduce((sum, row) => sum + row.AllocatedQuantity, 0), 100);
});
test('procurement workspace reuses order mapping, user context, and project visibility checks', () => {
  const { service, sheets, getProjectLookupCount } = loadProcurementService();
  sheets['18_MaterialNeeds'] = [{
    ID: 'N_WORKSPACE_1', TenantID: 'T1', ProjectID: 'P1',
    RequestedQuantity: 10, Status: 'ACTIVE', NeedType: 'CONFIRMED', MaterialSpecKey: 'SPEC_WORKSPACE'
  }];

  const originalUser = service._user_;
  const originalListOrders = service.listOrders;
  let userCalls = 0;
  let listOrdersCalls = 0;
  service._user_ = function(params) {
    userCalls++;
    return originalUser.call(this, params);
  };
  service.listOrders = function(params, sharedContext) {
    listOrdersCalls++;
    return originalListOrders.call(this, params, sharedContext);
  };

  const result = service.workspace({});
  assert.equal(result.success, true);
  assert.equal(result.data.needs.length, 1);
  assert.equal(listOrdersCalls, 1, 'workspace and dashboard should share the same mapped order response');
  assert.equal(userCalls, 1, 'workspace should resolve the user context once');
  assert.equal(getSchemaPreparationCalls(), 0, 'workspace must not perform schema migration during a request');
  assert.equal(getProjectLookupCount(), 1, 'project visibility should be checked once per project within the workspace request');
});

test('tenant boundary helpers reject cross-tenant project and event references', () => {
  const { service } = loadProcurementService();
  const user = { ID: 'U1', TenantID: 'T1' };
  assert.throws(() => service._validateProject_('P2', 'T1', user), /پروژه معتبر نیست/);
  assert.throws(() => service._validateEvent_('EV2', 'T1', user), /رویداد منبع معتبر نیست/);
  assert.equal(service._validateProject_('P1', 'T1', user).ID, 'P1');
  assert.equal(service._validateEvent_('EV1', 'T1', user).ID, 'EV1');
});

test('createOrder rejects a project owned by another tenant before writing an order', () => {
  const { service, sheets } = loadProcurementService();
  assert.throws(() => service.createOrder({
    ProjectID: 'P2',
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 5 }]
  }, {}), /پروژه معتبر نیست/);
  assert.equal((sheets['19_PurchaseOrders'] || []).length, 0);
  assert.equal((sheets['20_PurchaseOrderItems'] || []).length, 0);
});

test('createReceipt rejects a source event owned by another tenant before writing a receipt', () => {
  const { service, sheets } = loadProcurementService();
  sheets['19_PurchaseOrders'] = [{
    ID: 'PO1', TenantID: 'T1', Status: 'ACTIVE', ProjectID: '', OrderedQuantity: 5
  }];
  sheets['20_PurchaseOrderItems'] = [{
    ID: 'ITEM1', TenantID: 'T1', PurchaseOrderID: 'PO1', OrderedQuantity: 5, ItemName: 'پارچه'
  }];
  assert.throws(() => service.createReceipt({
    PurchaseOrderItemID: 'ITEM1', QuantityReceived: 1, SourceEventID: 'EV2'
  }, {}), /رویداد منبع معتبر نیست/);
  assert.equal((sheets['22_MaterialReceipts'] || []).length, 0);
});
