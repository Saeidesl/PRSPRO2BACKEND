/**
 * Live Google Apps Script web-app end-to-end test.
 * Requires PMS_E2E_ALLOW_WRITES=YES and a dedicated TEST deployment.
 * Test records are retained with TEST-E2E identifiers for audit; the API has no cascade-delete endpoint.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const baseUrl = (process.env.PMS_GAS_WEB_APP_URL || '').trim();
const username = (process.env.PMS_TEST_USERNAME || '').trim();
const password = process.env.PMS_TEST_PASSWORD || '';
const liveEnabled = Boolean(baseUrl && username && password && process.env.PMS_E2E_ALLOW_WRITES === 'YES');

function unwrap(response, label) {
  assert.equal(response && response.success, true, label + ' failed: ' + JSON.stringify(response && response.error || response));
  return response.data;
}
async function request(method, path, token, body) {
  const url = new URL(baseUrl);
  url.searchParams.set('path', path);
  if (token) url.searchParams.set('token', token);
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    redirect: 'follow',
    signal: AbortSignal.timeout(45000)
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error(method + ' ' + path + ': expected JSON; HTTP ' + response.status + '; body=' + text.slice(0, 500)); }
  if (!response.ok) throw new Error(method + ' ' + path + ': HTTP ' + response.status + '; ' + JSON.stringify(parsed));
  return parsed;
}
function rows(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of ['items','Items','needs','Needs','projects','Projects','workflows','Workflows','departments','Departments','orders','Orders']) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}
function idOf(value, keys) {
  for (const key of keys) if (value && value[key]) return value[key];
  return '';
}
const id = value => idOf(value, ['ID','Id','ProjectID','EventID','EventTypeID','PurchaseOrderItemID']);

test('LIVE Apps Script: project -> specs -> configured confirmed-quantity event -> need -> order -> warehouse receipts',
  { skip: liveEnabled ? false : 'Set PMS_GAS_WEB_APP_URL, PMS_TEST_USERNAME, PMS_TEST_PASSWORD and PMS_E2E_ALLOW_WRITES=YES to run against an isolated Apps Script test deployment.' },
  async (t) => {
    assert.match(baseUrl, /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/, 'Use the /exec URL of a dedicated TEST deployment');
    const nonce = (new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex')).toUpperCase();
    const login = unwrap(await request('POST', '/auth/login', '', { username, password }), 'login');
    const token = idOf(login, ['token','Token']);
    const user = login.user || login.User;
    assert.ok(token, 'Login response has no session token');
    const userId = id(user);
    assert.ok(userId, 'Login response has no user ID');

    const workflows = rows(unwrap(await request('GET', '/workflows', token), 'list workflows'));
    const workflow = workflows.find(x => String(x.Status || 'ACTIVE').toUpperCase() === 'ACTIVE') || workflows[0];
    assert.ok(workflow, 'Configure a workflow in the test tenant');
    const workflowId = idOf(workflow, ['ID','Id','WorkflowID']);
    const departments = rows(unwrap(await request('GET', '/departments', token), 'list departments'));
    const userDepartmentId = idOf(user, ['DepartmentID','departmentId']);
    const department = departments.find(x => String(id(x)) === String(userDepartmentId))
      || departments.find(x => String(x.Code || '').toUpperCase() === 'ADMIN') || departments[0];
    assert.ok(department, 'Configure a department in the test tenant');
    const departmentId = id(department);

    const projectCode = 'TEST-E2E-' + nonce;
    const projectTitle = 'Automated supply chain test ' + nonce;
    const projectData = unwrap(await request('POST', '/projects', token, {
      ProjectCode: projectCode, Title: projectTitle, Quantity: 100, WorkflowID: workflowId,
      AvailableDepartmentIDs: [departmentId], AllowedUserIDs: [userId], NotifyEnabled: false,
      Description: 'AUTOMATED E2E TEST — safe to archive after review'
    }), 'create test project');
    const project = projectData.project || projectData.Project || projectData;
    const projectId = id(project);
    assert.ok(projectId, 'Project create response did not include ID: ' + JSON.stringify(projectData));
    t.diagnostic('Created project ' + projectCode + ' (' + projectId + ')');

    const specData = unwrap(await request('POST', '/projects/' + encodeURIComponent(projectId) + '/material-specifications', token, {
      SpecKey: 'TEST-FABRIC-' + nonce, ItemName: 'Test fabric ' + nonce, Unit: 'meter',
      ConsumptionPerUnit: 1.2, WastagePercent: 5, Notes: 'AUTOMATED E2E TEST'
    }), 'create material specification');
    const spec = specData.specification || specData.Specification || specData;
    assert.ok(id(spec), 'Material specification ID missing: ' + JSON.stringify(specData));

    const eventTypeCode = ('TEST_CONFIRMED_' + nonce).replace(/[^A-Z0-9_]/g, '_').slice(0, 70);
    const typeData = unwrap(await request('POST', '/event-types', token, {
      Name: 'Automated confirmed quantity ' + nonce, Code: eventTypeCode, ConnectionType: 'PROJECT',
      DepartmentID: departmentId, AllowAttachments: false, MovesProjectToStep: false,
      Status: 'ACTIVE', Description: 'AUTOMATED E2E TEST — confirmed material needs'
    }), 'create event type');
    const eventType = typeData.eventType || typeData.EventType || typeData;
    const eventTypeId = id(eventType);
    assert.ok(eventTypeId, 'Event type ID missing: ' + JSON.stringify(typeData));

    const fieldData = unwrap(await request('POST', '/event-types/' + encodeURIComponent(eventTypeId) + '/fields', token, {
      Name: 'Confirmed production quantity', Code: 'CONFIRMED_QTY', FieldType: 'number',
      IsRequired: true, FieldOrder: 1, Status: 'ACTIVE'
    }), 'create confirmed quantity field');
    assert.ok(id(fieldData.field || fieldData.Field || fieldData), 'Event field ID missing');

    unwrap(await request('POST', '/event-types/' + encodeURIComponent(eventTypeId) + '/procurement', token, {
      Action: 'RECALCULATE_CONFIRMED_NEEDS', FieldMap: { ConfirmedQuantity: 'CONFIRMED_QTY' }
    }), 'configure event procurement mapping');

    const eventData = unwrap(await request('POST', '/events', token, {
      IdempotencyKey: 'TEST-E2E-EVENT-' + nonce, ProjectID: projectId, EventTypeID: eventTypeId,
      PerformedBy: userId, DepartmentID: departmentId,
      Description: 'Automated confirmed quantity: 100 units', OccurredAt: new Date().toISOString(),
      DynamicData: { CONFIRMED_QTY: 100 }
    }), 'create confirmed quantity event');
    const event = eventData.event || eventData.Event || eventData;
    const eventId = id(event);
    assert.ok(eventId, 'Event ID missing: ' + JSON.stringify(eventData));
    const integration = eventData.procurementIntegration;
    assert.ok(integration && integration.success !== false,
      'Event saved but procurement integration failed: ' + JSON.stringify(integration));
    if (integration.status) {
      assert.notEqual(String(integration.status).toUpperCase(), 'FAILED',
        'Event saved but procurement integration failed: ' + JSON.stringify(integration));
    }

    const needsData = unwrap(await request('GET', '/procurement/needs', token), 'read procurement needs');
    const needs = rows(needsData);
    const need = needs.find(n => String(n.ProjectID) === String(projectId) &&
      String(n.SourceEventID) === String(eventId) && String(n.NeedType || '').toUpperCase() === 'CONFIRMED' &&
      String(n.Status || '').toUpperCase() === 'ACTIVE');
    assert.ok(need, 'No active confirmed need for test project/event: ' + JSON.stringify(needsData).slice(0, 1500));
    const expected = Math.ceil(100 * 1.2 * (1 + 5 / 100) * 10000) / 10000;
    assert.equal(Number(need.RequestedQuantity), expected, 'Calculated need quantity is incorrect');
    assert.equal(Number(need.BasisQuantity), 100, 'Need basis quantity differs from confirmed quantity');
    assert.equal(String(need.Unit), 'meter', 'Need unit differs from specification');
    t.diagnostic('Need verified: ' + need.RequestedQuantity + ' ' + need.Unit + ' (expected ' + expected + ')');

    const orderData = unwrap(await request('POST', '/procurement/orders', token, {
      IdempotencyKey: 'TEST-E2E-ORDER-' + nonce, SupplierName: 'Automated test supplier ' + nonce,
      Notes: 'AUTOMATED E2E TEST',
      Items: [{ ItemName: need.ItemName, Unit: need.Unit, OrderedQuantity: 80,
        ProjectID: projectId, MaterialNeedID: need.ID, Notes: 'AUTOMATED E2E TEST' }]
    }), 'create linked purchase order');
    const order = orderData.Order || orderData.order;
    const orderItems = orderData.Items || orderData.items || [];
    assert.ok(order && id(order), 'Purchase order missing: ' + JSON.stringify(orderData));
    assert.equal(orderItems.length, 1, 'Expected one purchase order item');
    const orderItemId = id(orderItems[0]);
    assert.ok(orderItemId, 'Purchase order item ID missing');
    assert.equal(Number(orderItems[0].OrderedQuantity), 80, 'Ordered quantity incorrect');

    unwrap(await request('POST', '/procurement/receipts', token, {
      PurchaseOrderItemID: orderItemId, ProjectID: projectId, QuantityReceived: 30,
      Notes: 'AUTOMATED E2E TEST — partial receipt', IdempotencyKey: 'TEST-E2E-RECEIPT-1-' + nonce
    }), 'record partial receipt');
    const partialOrders = rows(unwrap(await request('GET', '/procurement/orders', token), 'read partial order status'));
    const partialOrder = partialOrders.find(o => String(id(o)) === String(id(order)));
    assert.ok(partialOrder, 'Order not found after partial receipt');
    assert.equal(String(partialOrder.Status).toUpperCase(), 'PARTIALLY_RECEIVED', 'Expected PARTIALLY_RECEIVED after 30/80');

    unwrap(await request('POST', '/procurement/receipts', token, {
      PurchaseOrderItemID: orderItemId, ProjectID: projectId, QuantityReceived: 50,
      Notes: 'AUTOMATED E2E TEST — final receipt', IdempotencyKey: 'TEST-E2E-RECEIPT-2-' + nonce
    }), 'record final receipt');
    const finalOrders = rows(unwrap(await request('GET', '/procurement/orders', token), 'read final order status'));
    const finalOrder = finalOrders.find(o => String(id(o)) === String(id(order)));
    assert.ok(finalOrder, 'Order not found after final receipt');
    assert.equal(String(finalOrder.Status).toUpperCase(), 'RECEIVED', 'Expected RECEIVED after 80/80');
    const finalNeeds = rows(unwrap(await request('GET', '/procurement/needs', token), 'read final needs'));
    const finalNeed = finalNeeds.find(n => String(id(n)) === String(id(need)));
    assert.ok(finalNeed, 'Need disappeared after receipts');
    assert.equal(Number(finalNeed.RequestedQuantity), expected, 'Receipt must not mutate total calculated need');

    const report = {
      result: 'PASS', projectCode, projectId, eventTypeCode, eventTypeId, eventId,
      specificationId: id(spec), materialNeedId: id(need), calculatedNeed: expected,
      orderId: id(order), orderItemId, partialReceipt: 30, finalReceipt: 50,
      orderStatusAfterPartialReceipt: partialOrder.Status, finalOrderStatus: finalOrder.Status,
      remainingUnorderedNeed: expected - 80
    };
    t.diagnostic('E2E report: ' + JSON.stringify(report));
    assert.equal(report.remainingUnorderedNeed, 46, 'Expected 46 meters to remain unordered');
  });
