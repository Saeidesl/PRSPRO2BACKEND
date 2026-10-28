'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const router = fs.readFileSync(path.join(__dirname, '..', 'Router.js'), 'utf8');

function routeBlock(method, route, nextMarker) {
  const methodStart = router.indexOf('  ' + method + ': function');
  assert.notEqual(methodStart, -1, 'missing Router.' + method);
  const start = router.indexOf("if (path === '" + route + "')", methodStart);
  assert.notEqual(start, -1, 'missing ' + method.toUpperCase() + ' route ' + route);
  const end = nextMarker ? router.indexOf(nextMarker, start) : router.length;
  return router.slice(start, end > start ? end : start + 320);
}

test('procurement read routes require server-side view or manage permission', () => {
  const routes = [
    ['/procurement/workspace', /requireAny\(params, \['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE'\]\)/],
    ['/procurement/dashboard', /requireAny\(params, \['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE'\]\)/],
    ['/procurement/needs', /requireAny\(params, \['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE'\]\)/],
    ['/procurement/orders', /requireAny\(params, \['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE'\]\)/],
    ['/procurement/reports', /requireAny\(params, \['REPORT_VIEW', 'PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE'\]\)/]
  ];
  for (const [route, permission] of routes) {
    const block = routeBlock('get', route, "\n    if (path === '/");
    assert.match(block, permission, 'permission gate missing for ' + route);
  }
});

test('procurement write routes require PROCUREMENT_MANAGE before service call', () => {
  const routes = [
    ['/procurement/orders', 'ProcurementService.createOrder(body, params)'],
    ['/procurement/receipts', 'ProcurementService.createReceipt(body, params)'],
    ['/procurement/receipts/batch', 'ProcurementService.createReceiptsBatch(body, params)']
  ];
  for (const [route, handler] of routes) {
    const block = routeBlock('post', route, "\n    if (");
    assert.match(block, /AccessControlService\.require\(params, 'PROCUREMENT_MANAGE'\)/, 'manage gate missing for ' + route);
    assert.ok(block.includes(handler), 'service mapping missing for ' + route);
  }
});

test('event-to-procurement configuration and retry routes retain explicit permission gates', () => {
  const retryStart = router.indexOf("const procurementRetryMatch = path.match");
  assert.notEqual(retryStart, -1, 'missing procurement retry route');
  const retryBlock = router.slice(retryStart, retryStart + 300);
  assert.match(retryBlock, /AccessControlService\.require\(params, 'EVENT_EDIT'\)/);
  assert.match(retryBlock, /EventService\.retryProcurementIntegration\(/);

  const configStart = router.indexOf("const eventTypeProcurementMatch = path.match");
  assert.notEqual(configStart, -1, 'missing event-type procurement configuration route');
  const configBlock = router.slice(configStart, configStart + 300);
  assert.match(configBlock, /AccessControlService\.require\(params, 'EVENT_TYPE_MANAGE'\)/);
  assert.match(configBlock, /ProcurementEventIntegrationService\.save\(/);
});
