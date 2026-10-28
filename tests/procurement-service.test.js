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
  let updateFailure = null;
  const auditEntries = [];
  let projectLookupCount = 0;
  let projectBulkReadCount = 0;
  const procurementReadCounts = Object.create(null);
  let projectRows = [{ ID: 'P1', TenantID: 'T1' }];
  let lockAcquired = true;
  let lockAttempts = 0;
  let lockReleases = 0;
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
      insertMany: (name, rows) => {
        if (typeof insertFailure === 'function') rows.forEach((row) => insertFailure(name, row));
        sheets[name] = sheets[name] || [];
        sheets[name].push(...rows.map((row) => ({ ...row })));
        return rows.map((row) => ({ ...row }));
      },
      updateById: (name, id, patch) => {
        if (typeof updateFailure === 'function') updateFailure(name, id, patch);
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
    AuditService: { log: (entry) => { auditEntries.push(entry); return true; } },
    Utilities: { getUuid: () => 'uuid' + (++uuid) },
    LockService: { getScriptLock: () => ({ tryLock: () => { lockAttempts++; return lockAcquired; }, releaseLock: () => { lockReleases++; return true; } }) },
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
    setInsertFailure: (failure) => { insertFailure = failure; },
    setUpdateFailure: (failure) => { updateFailure = failure; },
    setLockAcquired: (value) => { lockAcquired = value; },
    getLockAttempts: () => lockAttempts,
    getLockReleases: () => lockReleases,
    auditEntries
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
  const first = service.createOrder({
    ProjectID: 'P1',
    Items: [{ MaterialNeedID: need.ID, ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 60 }]
  }, {}).data;
  assert.equal(first.Order.Status, 'ACTIVE', 'an order becomes active only after all writes succeed');
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

  const replay = service.createOrder({
    OrderNumber: 'PO-RECOVERY-001',
    IdempotencyKey: 'ORDER-RECOVERY-001',
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 10 }]
  }, {});
  assert.equal(replay.success, true);
  assert.equal(replay.data.IdempotentReplay, true);
  assert.equal(replay.data.RecoveryRequired, true,
    'idempotent replay must explicitly signal that the existing partial order still needs review');
  assert.equal((sheets['19_PurchaseOrders'] || []).length, 1, 'replay must not create a second order header');
  assert.equal((sheets['20_PurchaseOrderItems'] || []).length, 1, 'replay must not silently duplicate or fabricate missing items');
});


test('partial purchase order remains NEEDS_REVIEW when both item insertion and recovery status update fail', () => {
  const { service, sheets, setInsertFailure, setUpdateFailure, auditEntries } = loadProcurementService();
  setInsertFailure((sheetName) => {
    if (sheetName === '20_PurchaseOrderItems') throw new Error('controlled item insert failure');
  });
  setUpdateFailure((sheetName) => {
    if (sheetName === '19_PurchaseOrders') throw new Error('controlled recovery update failure');
  });

  assert.throws(() => service.createOrder({
    OrderNumber: 'PO-RECOVERY-FAILSAFE',
    SupplierName: 'تأمین‌کننده آزمایشی',
    IdempotencyKey: 'ORDER-RECOVERY-FAILSAFE',
    Items: [
      { ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 10 },
      { ItemName: 'زیپ', Unit: 'عدد', OrderedQuantity: 5 }
    ]
  }, {}), /controlled item insert failure/, 'the original operation error should not be replaced by the recovery error');

  assert.equal(sheets['19_PurchaseOrders'][0].Status, 'NEEDS_REVIEW',
    'the header starts in a recovery state, so a failed recovery update cannot leave it ACTIVE');
  assert.equal((sheets['20_PurchaseOrderItems'] || []).length, 0);
  assert.ok(auditEntries.some((entry) =>
    entry.Action === 'RECOVERY_REQUIRED' &&
    entry.EntityID === sheets['19_PurchaseOrders'][0].ID
  ), 'a recovery audit breadcrumb should be attempted when the status update also fails');
});

test('purchase order is not promoted to ACTIVE when the final activation write fails', () => {
  const { service, sheets, setUpdateFailure, auditEntries } = loadProcurementService();
  setUpdateFailure((sheetName) => {
    if (sheetName === '19_PurchaseOrders') throw new Error('controlled activation write failure');
  });

  assert.throws(() => service.createOrder({
    OrderNumber: 'PO-ACTIVATION-FAIL',
    IdempotencyKey: 'ORDER-ACTIVATION-FAIL',
    Items: [{ ItemName: 'دکمه', Unit: 'عدد', OrderedQuantity: 20 }]
  }, {}), /controlled activation write failure/);

  assert.equal(sheets['19_PurchaseOrders'][0].Status, 'NEEDS_REVIEW');
  assert.equal((sheets['20_PurchaseOrderItems'] || []).length, 1,
    'the persisted item is retained as partial history for review');
  assert.ok(auditEntries.some((entry) => entry.Action === 'RECOVERY_REQUIRED'),
    'failure of both activation and recovery status writes should be traceable');
});

test('single receipt retry reconciles order status when the first status update fails after receipt persistence', () => {
  const { service, sheets, setUpdateFailure } = loadProcurementService();
  sheets['19_PurchaseOrders'] = [{ ID: 'PO_REC_SINGLE', TenantID: 'T1', Status: 'ACTIVE', Notes: 'preserve', UpdatedAt: 'before' }];
  sheets['20_PurchaseOrderItems'] = [{
    ID: 'ITEM_REC_SINGLE', TenantID: 'T1', PurchaseOrderID: 'PO_REC_SINGLE',
    ItemName: 'پارچه', OrderedQuantity: 10
  }];
  const body = { PurchaseOrderItemID: 'ITEM_REC_SINGLE', QuantityReceived: 4, IdempotencyKey: 'REC_SINGLE_RETRY' };
  setUpdateFailure((sheetName) => {
    if (sheetName !== '19_PurchaseOrders') return;
    setUpdateFailure(null);
    throw new Error('controlled receipt status update failure');
  });

  assert.throws(() => service.createReceipt(body, {}), /controlled receipt status update failure/);
  assert.equal(sheets['22_MaterialReceipts'].length, 1, 'receipt remains persisted after status update failure');
  assert.equal(sheets['19_PurchaseOrders'][0].Status, 'ACTIVE', 'the first status update failed');

  const retry = service.createReceipt(body, {});
  assert.equal(retry.success, true);
  assert.equal(retry.data.IdempotentReplay, true);
  assert.equal(sheets['22_MaterialReceipts'].length, 1, 'idempotent retry must not duplicate the receipt');
  assert.equal(sheets['19_PurchaseOrders'][0].Status, 'PARTIALLY_RECEIVED', 'retry repairs the derived order status');
  assert.equal(sheets['19_PurchaseOrders'][0].Notes, 'preserve', 'reconciliation preserves unrelated order fields');
});

test('batch receipt retry reconciles order status when the first status update fails after batch persistence', () => {
  const { service, sheets, setUpdateFailure } = loadProcurementService();
  sheets['19_PurchaseOrders'] = [{ ID: 'PO_REC_BATCH', TenantID: 'T1', Status: 'ACTIVE', Notes: 'preserve', UpdatedAt: 'before' }];
  sheets['20_PurchaseOrderItems'] = [{
    ID: 'ITEM_REC_BATCH', TenantID: 'T1', PurchaseOrderID: 'PO_REC_BATCH',
    ItemName: 'زیپ', OrderedQuantity: 8
  }];
  const body = { Receipts: [{
    PurchaseOrderItemID: 'ITEM_REC_BATCH', QuantityReceived: 3, IdempotencyKey: 'REC_BATCH_RETRY'
  }] };
  setUpdateFailure((sheetName) => {
    if (sheetName !== '19_PurchaseOrders') return;
    setUpdateFailure(null);
    throw new Error('controlled batch status update failure');
  });

  assert.throws(() => service.createReceiptsBatch(body, {}), /controlled batch status update failure/);
  assert.equal(sheets['22_MaterialReceipts'].length, 1, 'batch receipt remains persisted after status update failure');
  assert.equal(sheets['19_PurchaseOrders'][0].Status, 'ACTIVE', 'the first status update failed');

  const retry = service.createReceiptsBatch(body, {});
  assert.equal(retry.success, true);
  assert.equal(retry.data.length, 1);
  assert.equal(retry.data[0].IdempotentReplay, true);
  assert.equal(sheets['22_MaterialReceipts'].length, 1, 'batch retry must not duplicate the receipt');
  assert.equal(sheets['19_PurchaseOrders'][0].Status, 'PARTIALLY_RECEIVED', 'batch retry repairs the derived order status');
  assert.equal(sheets['19_PurchaseOrders'][0].Notes, 'preserve', 'reconciliation preserves unrelated order fields');
});

test('script-lock contention rejects order, single receipt, and batch receipt before any write', () => {
  const scenarios = [
    {
      name: 'order',
      invoke: (service) => service.createOrder({
        IdempotencyKey: 'LOCK_ORDER',
        Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 2 }]
      }, {})
    },
    {
      name: 'single receipt',
      invoke: (service) => service.createReceipt({
        PurchaseOrderItemID: 'ITEM_LOCK', QuantityReceived: 1, IdempotencyKey: 'LOCK_SINGLE'
      }, {})
    },
    {
      name: 'batch receipt',
      invoke: (service) => service.createReceiptsBatch({
        Receipts: [{ PurchaseOrderItemID: 'ITEM_LOCK', QuantityReceived: 1, IdempotencyKey: 'LOCK_BATCH' }]
      }, {})
    }
  ];

  scenarios.forEach(({ name, invoke }) => {
    const { service, sheets, setLockAcquired, getLockAttempts, getLockReleases } = loadProcurementService();
    setLockAcquired(false);
    assert.throws(() => invoke(service), /در حال انجام است/, name + ' should return a retryable contention error');
    assert.equal(getLockAttempts(), 1, name + ' should attempt to acquire the script lock once');
    assert.equal(getLockReleases(), 0, name + ' must not release a lock it did not acquire');
    assert.equal(Object.values(sheets).reduce((sum, rows) => sum + rows.length, 0), 0,
      name + ' must not write any sheet rows when the lock is unavailable');
  });
});

test('script lock is released after a write-path exception so a retry can proceed', () => {
  const { service, sheets, setInsertFailure, getLockAttempts, getLockReleases } = loadProcurementService();
  setInsertFailure((sheetName) => {
    if (sheetName === '20_PurchaseOrderItems') throw new Error('controlled locked write failure');
  });

  assert.throws(() => service.createOrder({
    IdempotencyKey: 'LOCK_RELEASE_RETRY',
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 2 }]
  }, {}), /controlled locked write failure/);
  assert.equal(getLockAttempts(), 1);
  assert.equal(getLockReleases(), 1, 'finally must release the acquired lock even on failure');

  setInsertFailure(null);
  const replay = service.createOrder({
    IdempotencyKey: 'LOCK_RELEASE_RETRY',
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 2 }]
  }, {});
  assert.equal(replay.data.IdempotentReplay, true);
  assert.equal(replay.data.RecoveryRequired, true);
  assert.equal(getLockAttempts(), 2, 'retry should be able to acquire the released lock');
  assert.equal(getLockReleases(), 2);
  assert.equal(sheets['19_PurchaseOrders'].length, 1, 'retry must not create a duplicate order');
});

test('successful order retry with the same idempotency key returns the original order without duplicate writes', () => {
  const { service, sheets } = loadProcurementService();
  const first = service.createOrder({
    OrderNumber: 'PO-IDEMPOTENT-ORDER',
    IdempotencyKey: 'ORDER-IDEMPOTENCY-SUCCESS',
    Items: [{ ItemName: 'دکمه', Unit: 'عدد', OrderedQuantity: 12 }]
  }, {});
  const replay = service.createOrder({
    OrderNumber: 'PO-SHOULD-NOT-REPLACE',
    IdempotencyKey: 'ORDER-IDEMPOTENCY-SUCCESS',
    Items: [{ ItemName: 'زیپ', Unit: 'عدد', OrderedQuantity: 999 }]
  }, {});

  assert.equal(first.data.Order.ID, replay.data.Order.ID);
  assert.equal(replay.data.IdempotentReplay, true);
  assert.equal(replay.data.Order.OrderNumber, 'PO-IDEMPOTENT-ORDER');
  assert.equal(sheets['19_PurchaseOrders'].length, 1);
  assert.equal(sheets['20_PurchaseOrderItems'].length, 1);
  assert.equal(sheets['20_PurchaseOrderItems'][0].OrderedQuantity, 12);
});

