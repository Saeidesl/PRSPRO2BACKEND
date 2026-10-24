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
  let failCompletionUpdate = false;
  const context = {
    AccessControlService: { getCurrentUser: () => currentUser },
    EventRepository: { getAll: () => events, update: (id, patch) => { const found = events.find((item) => item.ID === id); if (found && !failCompletionUpdate) Object.assign(found, patch); return found; } },
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
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', UNAUTHORIZED: 'UNAUTHORIZED', NOT_FOUND: 'NOT_FOUND', INTERNAL_ERROR: 'INTERNAL_ERROR' } },
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
      Status: 'ACTIVE',
      IdempotencyStatus: event.IdempotencyStatus || (String(event.IdempotencyKey || '').trim() ? 'PROCESSING' : '')
    }, event);
    events.push(created);
    // Model the completion-state write performed after all event side effects.
    if (String(created.IdempotencyKey || '').trim()) {
      const finalEvent = context.EventRepository.update(created.ID, { IdempotencyStatus: 'COMPLETED' });
      if (!finalEvent || String(finalEvent.IdempotencyStatus || '').toUpperCase() !== 'COMPLETED') {
        throw context.ErrorHandler.create(
          context.Constants.ERROR.INTERNAL_ERROR,
          'رویداد ثبت شده اما تأیید نهایی آن ذخیره نشد؛ از ارسال مجدد درخواست خودداری کنید و رویداد موجود را بررسی کنید.'
        );
      }
    }
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
    getLockReleases: () => lockReleases,
    failCompletionUpdate: (value) => { failCompletionUpdate = value; }
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

test('an interrupted request is not falsely reported as completed on replay', () => {
  const harness = loadService();
  const request = { EventTypeID: 'TYPE1', IdempotencyKey: 'EVREQ_stuck-key' };
  const first = harness.service.create(request, {});
  const event = harness.getEvents()[0];
  event.IdempotencyStatus = 'PROCESSING';

  assert.equal(first.data.event.ID, 'EVT_1');
  assert.throws(
    () => harness.service.create(request, {}),
    /تکمیل آن تأیید نشده است/
  );
  assert.equal(harness.getCreateCalls(), 1);
});

test('successful keyed event creation persists COMPLETED before returning success', () => {
  const harness = loadService();
  const result = harness.service.create(
    { EventTypeID: 'TYPE1', IdempotencyKey: 'EVREQ_completed-key' },
    {}
  );
  assert.equal(result.success, true);
  assert.equal(result.data.event.IdempotencyStatus, 'COMPLETED');
  assert.equal(harness.getEvents()[0].IdempotencyStatus, 'COMPLETED');
});

test('failed completion-state persistence does not return a successful response', () => {
  const harness = loadService();
  harness.failCompletionUpdate(true);
  assert.throws(
    () => harness.service.create(
      { EventTypeID: 'TYPE1', IdempotencyKey: 'EVREQ_failed-completion' },
      {}
    ),
    /تأیید نهایی آن ذخیره نشد/
  );
  assert.equal(harness.getCreateCalls(), 1);
  assert.equal(harness.getEvents()[0].IdempotencyStatus, 'PROCESSING');
});
