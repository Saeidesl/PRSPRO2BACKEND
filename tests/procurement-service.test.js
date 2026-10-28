'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadProcurementService() {
  const sheets = Object.create(null);
  let uuid = 0;
  let insertFailure = null;
  let projectLookupCount = 0;
  let projectBulkReadCount = 0;
  const procurementReadCounts = Object.create(null);
  let projectRows = [{ ID: 'P1', TenantID: 'T1' }];
  const context = {
    AccessControlService: { getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }) },
    ProjectRepository: {
      findById: (id) => {
        projectLookupCount++;
        return projectRows.find((row) => String(row.ID) === String(id)) || null;
      },
      getAll: () => {
        projectBulkReadCount++;
        return projectRows.map((row) => ({ ...row }));
      }
    },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    EventRepository: {
      findById: (id) => String(id) === 'EV1' ? { ID: 'EV1', TenantID: 'T1', ProjectID: 'P1' } : null
    },
    ProcurementRepository: {
      SHEETS: { NEEDS: '18_MaterialNeeds', ORDERS: '19_PurchaseOrders', ITEMS: '20_PurchaseOrderItems', ALLOCATIONS: '21_PurchaseAllocations', RECEIPTS: '22_MaterialReceipts' },
      getNeeds: (tenantId) => { procurementReadCounts.getNeeds = (procurementReadCounts.getNeeds || 0) + 1; return (sheets['18_MaterialNeeds'] || []).filter((row) => String(row.TenantID) === String(tenantId)); },
      getOrders: (tenantId) => { procurementReadCounts.getOrders = (procurementReadCounts.getOrders || 0) + 1; return (sheets['19_PurchaseOrders'] || []).filter((row) => String(row.TenantID) === String(tenantId)); },
      getItems: (tenantId) => { procurementReadCounts.getItems = (procurementReadCounts.getItems || 0) + 1; return (sheets['20_PurchaseOrderItems'] || []).filter((row) => String(row.TenantID) === String(tenantId)); },
      getAllocations: (tenantId) => { procurementReadCounts.getAllocations = (procurementReadCounts.getAllocations || 0) + 1; return (sheets['21_PurchaseAllocations'] || []).filter((row) => String(row.TenantID) === String(tenantId)); },
      getReceipts: (tenantId) => { procurementReadCounts.getReceipts = (procurementReadCounts.getReceipts || 0) + 1; return (sheets['22_MaterialReceipts'] || []).filter((row) => String(row.TenantID) === String(tenantId)); }
    },
    GoogleSheetsRepository: {
      getAll: (name) => (sheets[name] || []).map((row) => ({ ...row })),
      findById: (name, id) => (sheets[name] || []).find((row) => String(row.ID) === String(id)) || null,
      insert: (name, row) => {
        if (typeof insertFailure === 'function') insertFailure(name, row);
        sheets[name] = sheets[name] || [];
        sheets[name].push({ ...row });
        return { ...row };
      },
      updateById: (name, id, patch) => {
        sheets[name] = sheets[name] || [];
        const i = sheets[name].findIndex((item) => String(item.ID) === String(id));
        if (i < 0) throw new Error('missing row');
        // Match GoogleSheetsRepository.updateById: undefined fields retain their current values.
        sheets[name][i] = { ...sheets[name][i], ...patch };
        return { ...sheets[name][i] };
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
  return {
    service: context.__service,
    sheets,
    getProjectLookupCount: () => projectLookupCount,
    getProjectBulkReadCount: () => projectBulkReadCount,
    procurementReadCounts,
    setProjectRows: (rows) => { projectRows = rows.map((row) => ({ ...row })); },
    setInsertFailure: (failure) => { insertFailure = failure; }
  };
}


test('procurement project visibility switches to one bulk project read after repeated distinct lookups', () => {
  const { service, getProjectLookupCount, getProjectBulkReadCount, setProjectRows } = loadProcurementService();
  setProjectRows([
    { ID: 'P1', TenantID: 'T1' },
    { ID: 'P2', TenantID: 'T1' },
    { ID: 'P3', TenantID: 'T1' },
    { ID: 'P4', TenantID: 'T1' }
  ]);
  const user = { ID: 'U1', TenantID: 'T1' };
  const cache = Object.create(null);

  assert.equal(service._isProjectVisible_('P1', user, cache), true);
  assert.equal(service._isProjectVisible_('P2', user, cache), true);
  assert.equal(service._isProjectVisible_('P3', user, cache), true);
  assert.equal(service._isProjectVisible_('P4', user, cache), true);
  assert.equal(service._isProjectVisible_('P4', user, cache), true);

  assert.equal(getProjectLookupCount(), 2, 'only the first two distinct projects should use targeted lookups');
  assert.equal(getProjectBulkReadCount(), 1, 'later project checks should share one bulk read');
});

test('workspace reuses tenant-scoped procurement collections across read services within one request', () => {
  const { service, procurementReadCounts } = loadProcurementService();
  const result = service.workspace({});
  assert.equal(result.success, true);
  for (const collection of ['getNeeds', 'getOrders', 'getItems', 'getAllocations', 'getReceipts']) {
    assert.equal(procurementReadCounts[collection], 1, collection + ' should be read once per workspace request');
  }
});

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
  assert.equal(userCalls, 1, 'workspace should resolve and prepare the user/schema context once');
  assert.equal(getProjectLookupCount(), 1, 'project visibility should be checked once per project within the workspace request');
});

test('failed purchase-order item insert marks order NEEDS_REVIEW without dropping existing header fields', () => {
  const { service, sheets, setInsertFailure } = loadProcurementService();
  let itemInsertAttempts = 0;
  setInsertFailure((sheetName) => {
    if (sheetName !== '20_PurchaseOrderItems') return;
    itemInsertAttempts++;
    if (itemInsertAttempts === 2) throw new Error('controlled item insert failure');
  });

  assert.throws(() => service.createOrder({
    ProjectID: 'P1',
    OrderNumber: 'PO-RECOVERY-001',
    SupplierName: 'تأمین‌کننده آزمایشی',
    OrderDate: '2026-10-28T10:00:00.000Z',
    ExpectedDeliveryDate: '2026-11-05',
    Notes: 'یادداشت اصلی سفارش',
    IdempotencyKey: 'ORDER-RECOVERY-001',
    Items: [
      { ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 10, UnitPrice: 20 },
      { ItemName: 'زیپ', Unit: 'عدد', OrderedQuantity: 5, UnitPrice: 3 }
    ]
  }, {}), /controlled item insert failure/);

  const orders = sheets['19_PurchaseOrders'] || [];
  assert.equal(orders.length, 1, 'order header must remain for recovery');
  const order = orders[0];
  assert.equal(order.Status, 'NEEDS_REVIEW');
  assert.equal(order.OrderNumber, 'PO-RECOVERY-001');
  assert.equal(order.SupplierName, 'تأمین‌کننده آزمایشی');
  assert.equal(order.OrderDate, '2026-10-28T10:00:00.000Z');
  assert.equal(order.ExpectedDeliveryDate, '2026-11-05');
  assert.equal(order.CreatedBy, 'U1');
  assert.equal(order.TenantID, 'T1');
  assert.equal(order.IdempotencyKey, 'ORDER-RECOVERY-001');
  assert.match(order.Notes, /یادداشت اصلی سفارش/);
  assert.match(order.Notes, /controlled item insert failure/);
  assert.equal((sheets['20_PurchaseOrderItems'] || []).length, 1,
    'the first item remains recorded as partial history; the failed second item is absent');
});
