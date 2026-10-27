'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadService(seed) {
  const context = {
    Constants: { STATUS: { DELETED: 'DELETED' } },
    GoogleSheetsRepository: {
      getAll: (name) => (seed[name] || []).map((row) => ({ ...row }))
    },
    Object, Array, String, Number, Error
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'ProjectDeletionService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = ProjectDeletionService;', context);
  return context.__service;
}

function baseSeed() {
  return {
    '13_Events': [
      { ID: 'E1', TenantID: 'T1', ProjectID: 'P1', Status: 'ACTIVE' },
      { ID: 'E2', TenantID: 'T2', ProjectID: 'P1', Status: 'ACTIVE' },
      { ID: 'E3', TenantID: 'T1', ProjectID: 'P2', Status: 'ACTIVE' }
    ],
    '14_EventData': [
      { ID: 'D1', EventID: 'E1' },
      { ID: 'D2', EventID: 'E2' },
      { ID: 'D3', EventID: 'E3' }
    ],
    '15_Attachments': [
      { ID: 'A1', TenantID: 'T1', EntityType: 'EVENT', EntityID: 'E1', Status: 'ACTIVE' },
      { ID: 'A2', TenantID: 'T2', EntityType: 'PROJECT', EntityID: 'P1', Status: 'ACTIVE' },
      { ID: 'A3', TenantID: 'T1', EntityType: 'PROJECT', EntityID: 'P2', Status: 'ACTIVE' }
    ],
    '18_MaterialNeeds': [{ ID: 'N1', TenantID: 'T1', ProjectID: 'P1', Status: 'ACTIVE' }],
    '19_PurchaseOrders': [
      { ID: 'O1', TenantID: 'T1', Status: 'OPEN' },
      { ID: 'O2', TenantID: 'T1', Status: 'OPEN' }
    ],
    '20_PurchaseOrderItems': [
      { ID: 'I1', TenantID: 'T1', PurchaseOrderID: 'O1', MaterialNeedID: 'N1' },
      { ID: 'I2', TenantID: 'T1', PurchaseOrderID: 'O1', MaterialNeedID: 'N2' },
      { ID: 'I3', TenantID: 'T1', PurchaseOrderID: 'O2', MaterialNeedID: 'N1' }
    ],
    '21_PurchaseAllocations': [
      { ID: 'AL1', TenantID: 'T1', ProjectID: 'P1', MaterialNeedID: 'N1', PurchaseOrderItemID: 'I1' },
      { ID: 'AL2', TenantID: 'T1', ProjectID: 'TWO', MaterialNeedID: 'N2', PurchaseOrderItemID: 'I2' }
    ],
    '22_MaterialReceipts': [
      { ID: 'R1', TenantID: 'T1', ProjectID: 'P1', PurchaseOrderItemID: 'I1' }
    ],
    '24_ProjectMaterialSpecs': [{ ID: 'S1', TenantID: 'T1', ProjectID: 'P1', Status: 'ACTIVE' }],
    '25_MaterialNeedCalculations': [{ ID: 'C1', TenantID: 'T1', ProjectID: 'P1', MaterialNeedID: 'N1', Status: 'ACTIVE' }]
  };
}

test('collects event and project dependencies without crossing tenant/project boundaries', () => {
  const service = loadService(baseSeed());
  const rows = service._collect({ ID: 'P1', TenantID: 'T1' });
  assert.deepEqual(Array.from(rows.events, (r) => r.ID), ['E1']);
  assert.deepEqual(Array.from(rows.eventData, (r) => r.ID), ['D1']);
  assert.deepEqual(Array.from(rows.attachments, (r) => r.ID), ['A1']);
  assert.deepEqual(Array.from(rows.needs, (r) => r.ID), ['N1']);
  assert.deepEqual(Array.from(rows.specs, (r) => r.ID), ['S1']);
  assert.deepEqual(Array.from(rows.calculations, (r) => r.ID), ['C1']);
});

test('preserves a shared purchase order when it contains a line for another project', () => {
  const service = loadService(baseSeed());
  const rows = service._collect({ ID: 'P1', TenantID: 'T1' });
  assert.deepEqual(Array.from(rows.items, (r) => r.ID), ['I1', 'I3']);
  assert.deepEqual(Array.from(rows.orders, (r) => r.ID), ['O2']);
  assert.deepEqual(Array.from(rows.allocations, (r) => r.ID), ['AL1']);
  assert.deepEqual(Array.from(rows.receipts, (r) => r.ID), ['R1']);
});

test('ignores already deleted rows and does not use ProjectID as the sole order relationship', () => {
  const seed = baseSeed();
  seed['19_PurchaseOrders'].push({ ID: 'O3', TenantID: 'T1', ProjectID: 'P1', Status: 'DELETED' });
  seed['20_PurchaseOrderItems'].push({ ID: 'I4', TenantID: 'T1', PurchaseOrderID: 'O3', MaterialNeedID: 'N1' });
  const service = loadService(seed);
  const rows = service._collect({ ID: 'P1', TenantID: 'T1' });
  assert.equal(rows.orders.some((r) => r.ID === 'O3'), false);
});
