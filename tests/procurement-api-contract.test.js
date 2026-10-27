'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const router = read('Router.js');
const procurement = read('ProcurementService.js');
const planning = read('MaterialPlanningService.js');
const setup = read('DatabaseSetup.js');

test('procurement read endpoints retain service mapping and view permissions', () => {
  const routes = [
    ['/procurement/workspace', 'ProcurementService.workspace(params)'],
    ['/procurement/reports', 'ProcurementService.reports(params)'],
    ['/procurement/dashboard', 'ProcurementService.dashboard(params)'],
    ['/procurement/needs', 'ProcurementService.listNeeds(params)'],
    ['/procurement/orders', 'ProcurementService.listOrders(params)']
  ];
  for (const [route, handler] of routes) {
    assert.ok(router.includes("path === '" + route + "'"), 'missing GET route ' + route);
    assert.ok(router.includes(handler), 'missing handler for ' + route);
  }
  assert.match(router, /path === '\/procurement\/workspace'[\s\S]{0,180}requireAny\(params, \['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE'\]\)/);
  assert.match(router, /path === '\/procurement\/reports'[\s\S]{0,180}requireAny\(params, \['REPORT_VIEW', 'PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE'\]\)/);
});

test('procurement write endpoints require server-side manage permission', () => {
  const routes = [
    ['/procurement/orders', 'ProcurementService.createOrder(body, params)'],
    ['/procurement/receipts', 'ProcurementService.createReceipt(body, params)'],
    ['/procurement/receipts/batch', 'ProcurementService.createReceiptsBatch(body, params)']
  ];
  for (const [route, handler] of routes) {
    const start = router.indexOf("if (path === '" + route + "')", router.indexOf('  post: function'));
    assert.ok(start >= 0, 'missing POST route ' + route);
    const block = router.slice(start, start + 260);
    assert.match(block, /AccessControlService\.require\(params, 'PROCUREMENT_MANAGE'\)/);
    assert.ok(block.includes(handler), 'wrong handler for ' + route);
  }
});

test('material planning routes remain wired to the planning service', () => {
  assert.match(router, /parts\[3\] === 'material-specifications'[\s\S]{0,100}MaterialPlanningService\.listSpecifications\(projectId, params\)/);
  assert.match(router, /parts\[3\] === 'material-calculations'[\s\S]{0,100}MaterialPlanningService\.listCalculationHistory\(projectId, params\)/);
  assert.ok(router.includes('MaterialPlanningService.createSpecification(projectId, body, params)'));
  assert.ok(router.includes('MaterialPlanningService.reviseSpecification(materialSpecUpdateMatch[1], body, params)'));
});

test('service methods and schema tables required by the procurement API remain present', () => {
  for (const method of ['createOrder', 'createReceipt', 'createReceiptsBatch', 'listNeeds', 'listOrders', 'workspace', 'reports', 'dashboard']) {
    assert.match(procurement, new RegExp('\\b' + method + ': function\\s*\\('), 'missing ProcurementService.' + method);
  }
  for (const method of ['createSpecification', 'reviseSpecification', 'listSpecifications', 'listCalculationHistory', 'recalculateProjectNeeds', 'recordCalculation', 'markEventVoided']) {
    assert.match(planning, new RegExp('\\b' + method + ': function\\s*\\('), 'missing MaterialPlanningService.' + method);
  }
  for (const sheet of ['18_MaterialNeeds', '19_PurchaseOrders', '20_PurchaseOrderItems', '21_PurchaseAllocations', '22_MaterialReceipts', '23_EventTypeProcurementSettings', '24_ProjectMaterialSpecs', '25_MaterialNeedCalculations']) {
    assert.ok(setup.includes(sheet), 'missing schema definition for ' + sheet);
  }
});

test('order and receipt paths retain idempotency and partial-quantity guards', () => {
  assert.match(procurement, /IdempotencyKey/);
  assert.match(procurement, /IdempotentReplay/);
  assert.match(procurement, /SurplusQuantity/);
  assert.match(procurement, /مجموع دریافت‌های انتخاب‌شده از مقدار باقیمانده سفارش/);
  assert.match(procurement, /مجموع دریافت از سهم تخصیص‌یافته پروژه/);
  assert.match(procurement, /PARTIALLY_RECEIVED/);
});
