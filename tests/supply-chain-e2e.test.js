'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadSource(file, context, exportName) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = ' + exportName + ';', context);
  return context.__service;
}

function commonContext() {
  let id = 0;
  return {
    AccessControlService: { getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }) },
    ProjectRepository: {
      findById: (id) => String(id) === 'P1' ? { ID: 'P1', TenantID: 'T1', Quantity: 100 } : null
    },
    ProjectService: { _isProjectAvailableToUser_: () => true },
    EventRepository: {
      findById: (id) => String(id) === 'EV1'
        ? { ID: 'EV1', TenantID: 'T1', ProjectID: 'P1', EventTypeVersion: '1' } : null
    },
    Validator: {
      required: (v, label) => {
        if (v === undefined || v === null || String(v).trim() === '') throw new Error('required: ' + label);
      },
      object: (v, label) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(label + ' must be an object');
      }
    },
    Constants: { ERROR: {
      VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND',
      DUPLICATE: 'DUPLICATE', INVALID_STATUS: 'INVALID_STATUS',
      CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR'
    }},
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Response: { success: (data) => ({ success: true, data }) },
    AuditService: { log: () => true },
    Utilities: { getUuid: () => 'uuid-' + (++id).toString().padStart(4, '0') },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => true }),
      getUserLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => true })
    },
    Date, Math, Number, String, Object, Array, JSON, isFinite
  };
}

function loadMaterialPlanner() {
  const sheets = Object.create(null);
  const context = commonContext();
  context.GoogleSheetsRepository = {
    getAll: (name) => (sheets[name] || []).map((row) => ({ ...row })),
    findById: (name, id) => (sheets[name] || []).find((row) => String(row.ID) === String(id)) || null,
    insert: (name, row) => { sheets[name] = sheets[name] || []; sheets[name].push({ ...row }); return { ...row }; },
    updateById: (name, id, row) => {
      const rows = sheets[name] || [];
      const i = rows.findIndex((item) => String(item.ID) === String(id));
      if (i < 0) throw new Error('missing row ' + id);
      rows[i] = { ...row };
      return { ...row };
    }
  };
  return { service: loadSource('MaterialPlanningService.js', context, 'MaterialPlanningService'), sheets };
}

function loadProcurement() {
  const sheets = Object.create(null);
  const context = commonContext();
  context.ProcurementRepository = {
    SHEETS: {
      NEEDS: '18_MaterialNeeds', ORDERS: '19_PurchaseOrders',
      ITEMS: '20_PurchaseOrderItems', ALLOCATIONS: '21_PurchaseAllocations',
      RECEIPTS: '22_MaterialReceipts'
    },
    getNeeds: (tenant) => (sheets['18_MaterialNeeds'] || []).filter((r) => String(r.TenantID) === String(tenant)),
    getOrders: (tenant) => (sheets['19_PurchaseOrders'] || []).filter((r) => String(r.TenantID) === String(tenant)),
    getItems: (tenant) => (sheets['20_PurchaseOrderItems'] || []).filter((r) => String(r.TenantID) === String(tenant)),
    getAllocations: (tenant) => (sheets['21_PurchaseAllocations'] || []).filter((r) => String(r.TenantID) === String(tenant)),
    getReceipts: (tenant) => (sheets['22_MaterialReceipts'] || []).filter((r) => String(r.TenantID) === String(tenant))
  };
  context.GoogleSheetsRepository = {
    getAll: (name) => (sheets[name] || []).map((row) => ({ ...row })),
    findById: (name, id) => (sheets[name] || []).find((row) => String(row.ID) === String(id)) || null,
    insert: (name, row) => { sheets[name] = sheets[name] || []; sheets[name].push({ ...row }); return { ...row }; },
    insertMany: (name, rows) => { sheets[name] = sheets[name] || []; sheets[name].push(...rows.map((r) => ({ ...r }))); return rows; },
    updateById: (name, id, row) => {
      const rows = sheets[name] || [];
      const i = rows.findIndex((item) => String(item.ID) === String(id));
      if (i < 0) throw new Error('missing row ' + id);
      rows[i] = { ...row };
      return { ...row };
    }
  };
  const service = loadSource('ProcurementService.js', context, 'ProcurementService');
  return { service, sheets };
}

test('automated supply chain: confirmed need -> linked purchase order -> partial and full warehouse receipt', () => {
  // Isolated in-memory Sheets mocks: no production spreadsheet or live deployment is touched.
  const planner = loadMaterialPlanner();
  const materialSpec = planner.service.createSpecification('P1', {
    ItemName: 'پارچه آزمایشی', Unit: 'متر',
    ConsumptionPerUnit: 1.2, WastagePercent: 5
  }, {}).data;

  const calculated = planner.service.recalculateProjectNeeds('P1', 'EV1', 100, '1', {}).data;
  assert.equal(calculated.BasisQuantity, 100);
  assert.equal(calculated.items[0].RequestedQuantity, 126);
  const needId = calculated.items[0].MaterialNeedID;
  const need = planner.sheets['18_MaterialNeeds'].find((r) => r.ID === needId);
  assert.ok(need, 'confirmed need is persisted');
  assert.equal(need.MaterialSpecID, materialSpec.ID);
  assert.equal(need.NeedType, 'CONFIRMED');

  const procurement = loadProcurement();
  procurement.sheets['18_MaterialNeeds'] = planner.sheets['18_MaterialNeeds'].map((r) => ({ ...r }));
  const orderResult = procurement.service.createOrder({
    ProjectID: 'P1',
    Items: [{
      MaterialNeedID: needId,
      ItemName: need.ItemName,
      ItemCode: need.ItemCode,
      Unit: need.Unit,
      OrderedQuantity: 80
    }]
  }, {}).data;

  const order = procurement.sheets['19_PurchaseOrders'][0];
  const item = procurement.sheets['20_PurchaseOrderItems'][0];
  assert.ok(order, 'purchase order is persisted');
  assert.ok(item, 'purchase order item is persisted');
  assert.equal(procurement.sheets['21_PurchaseAllocations'][0].ProjectID, 'P1');
  assert.equal(item.MaterialNeedID, needId);
  assert.equal(Number(item.OrderedQuantity), 80);
  assert.equal(procurement.sheets['21_PurchaseAllocations'].reduce((sum, row) =>
    sum + Number(row.AllocatedQuantity || 0), 0), 80);
  assert.ok(orderResult, 'createOrder returns a result');

  // Simulate receiving 30 units, then the remaining 50 against the same order item.
  procurement.service.createReceipt({
    PurchaseOrderItemID: item.ID, QuantityReceived: 30, ProjectID: 'P1', SourceEventID: 'EV1'
  }, {});
  let receipts = procurement.sheets['22_MaterialReceipts'];
  assert.equal(receipts.reduce((sum, row) => sum + Number(row.QuantityReceived || 0), 0), 30);
  assert.equal(procurement.sheets['19_PurchaseOrders'][0].Status, 'PARTIALLY_RECEIVED');

  procurement.service.createReceipt({
    PurchaseOrderItemID: item.ID, QuantityReceived: 50, ProjectID: 'P1', SourceEventID: 'EV1'
  }, {});
  receipts = procurement.sheets['22_MaterialReceipts'];
  assert.equal(receipts.reduce((sum, row) => sum + Number(row.QuantityReceived || 0), 0), 80);
  assert.equal(procurement.sheets['19_PurchaseOrders'][0].Status, 'RECEIVED');

  const totalOrdered = procurement.sheets['20_PurchaseOrderItems']
    .filter((r) => r.MaterialNeedID === needId)
    .reduce((sum, row) => sum + Number(row.OrderedQuantity || 0), 0);
  assert.equal(totalOrdered, 80);
  assert.equal(Number(need.RequestedQuantity) - totalOrdered, 46);
});

test('automated supply chain rejects a receipt above the remaining ordered quantity', () => {
  const procurement = loadProcurement();
  procurement.sheets['19_PurchaseOrders'] = [{
    ID: 'PO1', TenantID: 'T1', ProjectID: 'P1', Status: 'ACTIVE'
  }];
  procurement.sheets['20_PurchaseOrderItems'] = [{
    ID: 'ITEM1', TenantID: 'T1', PurchaseOrderID: 'PO1', ProjectID: 'P1',
    ItemName: 'پارچه آزمایشی', OrderedQuantity: 10, MaterialNeedID: 'NEED1'
  }];
  assert.throws(() => procurement.service.createReceipt({
    PurchaseOrderItemID: 'ITEM1', QuantityReceived: 11, ProjectID: 'P1', SourceEventID: 'EV1'
  }, {}), /بیشتر|باقیمانده|مقدار سفارش/);
  assert.equal((procurement.sheets['22_MaterialReceipts'] || []).length, 0);
});
