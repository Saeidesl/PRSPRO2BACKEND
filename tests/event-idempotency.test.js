'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadService() {
  const events = [];
  let currentUser = { ID: 'U1', TenantID: 'T1' };
  let createCalls = 0;
  let lockReleases = 0;
  const context = {
    AccessControlService: { getCurrentUser: () => currentUser },
    EventRepository: { getAll: () => events },
    ProjectRepository: { findById: () => null },
    ProjectService: { _isProjectAvailableToUser_: () => false },
    LockService: { getUserLock: () => ({
      waitLock: () => true,
      releaseLock: () => { lockReleases += 1; }
    }) },
    Validator: {
      object: (value, label) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
      }
    },
    Response: { success: (data, meta) => ({ success: true, data, meta: meta || {} }) },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', UNAUTHORIZED: 'UNAUTHORIZED', NOT_FOUND: 'NOT_FOUND' } },
    Date, Object, String, Array, JSON
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'EventService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = EventService;', context);
  context.__service._createUnlocked_ = function(event) {
    createCalls += 1;
    const created = Object.assign({
      ID: 'EVT_' + createCalls,
      TenantID: currentUser.TenantID,
      CreatedBy: currentUser.ID,
      ProjectID: '',
      Status: 'ACTIVE'
    }, event);
    events.push(created);
    return context.Response.success({
      event: created,
      project: null,
      workflowMoved: false,
      currentStepID: '',
      projectStatus: '',
      availableDepartmentIDs: [],
      procurementIntegration: { status: 'NOT_CONFIGURED' }
    });
  };
  return {
    service: context.__service,
    setUser: (user) => { currentUser = user; },
    getEvents: () => events,
    getCreateCalls: () => createCalls,
    getLockReleases: () => lockReleases
  };
}

test('replaying an event request returns the prior event without repeating creation', () => {
  const harness = loadService();
  const request = { EventTypeID: 'TYPE1', IdempotencyKey: 'EVREQ_same-key' };

  const first = harness.service.create(request, {});
  const replay = harness.service.create(request, {});

  assert.equal(first.data.event.ID, 'EVT_1');
  assert.equal(replay.data.event.ID, 'EVT_1');
  assert.equal(replay.data.idempotentReplay, true);
  assert.equal(harness.getCreateCalls(), 1);
  assert.equal(harness.getEvents().length, 1);
  assert.equal(harness.getLockReleases(), 2);
});

test('idempotency keys are scoped to tenant and creator', () => {
  const harness = loadService();
  const request = { EventTypeID: 'TYPE1', IdempotencyKey: 'EVREQ_same-key' };

  const first = harness.service.create(request, {});
  harness.setUser({ ID: 'U2', TenantID: 'T1' });
  const second = harness.service.create(request, {});

  assert.equal(first.data.event.ID, 'EVT_1');
  assert.equal(second.data.event.ID, 'EVT_2');
  assert.equal(harness.getCreateCalls(), 2);
  assert.equal(harness.getEvents().length, 2);
});
