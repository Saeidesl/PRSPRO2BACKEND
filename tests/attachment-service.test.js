'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadAttachmentService() {
  const context = {
    AccessControlService: { getCurrentUser: () => ({ ID: 'U1', TenantID: 'T1' }) },
    ProjectRepository: {
      findById: (id) => String(id) === 'P_PRIVATE'
        ? { ID: 'P_PRIVATE', TenantID: 'T1' }
        : (String(id) === 'P_VISIBLE' ? { ID: 'P_VISIBLE', TenantID: 'T1' } : null)
    },
    EventRepository: {
      findById: (id) => ({
        ID: String(id), TenantID: 'T1',
        ProjectID: String(id) === 'EV_PRIVATE' ? 'P_PRIVATE' : 'P_VISIBLE'
      }),
      findByEntity: () => []
    },
    ProjectService: {
      _isProjectAvailableToUser_: (project) => project.ID === 'P_VISIBLE'
    },
    AttachmentRepository: { findByEntity: () => [], getAll: () => [] },
    AttachmentValidator: { validateCreate: () => true },
    Validator: { required: (value, label) => {
      if (value === undefined || value === null || String(value) === '') throw new Error('required: ' + label);
    } },
    Constants: {
      STATUS: { DELETED: 'DELETED', ACTIVE: 'ACTIVE' },
      ERROR: { NOT_FOUND: 'NOT_FOUND', VALIDATION_ERROR: 'VALIDATION_ERROR', EVENT_NOT_FOUND: 'EVENT_NOT_FOUND' }
    },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Response: { success: (data) => ({ success: true, data }) },
    Date, Object, String, Array
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'AttachmentService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = AttachmentService;', context);
  return context.__service;
}

test('listing attachments for an event denies users without access to its project', () => {
  const service = loadAttachmentService();
  assert.throws(() => service.listByEntity('EVENT', 'EV_PRIVATE', {}), /رکورد مورد نظر پیدا نشد/);
});

test('uploading to an event denies users without access to its project', () => {
  const service = loadAttachmentService();
  assert.throws(() => service.upload({
    EntityType: 'EVENT', EntityID: 'EV_PRIVATE', FileName: 'x.txt',
    MimeType: 'text/plain', Base64: 'eA=='
  }, {}), /رکورد مورد نظر پیدا نشد/);
});

test('listing attachments remains available for an event in a visible project', () => {
  const service = loadAttachmentService();
  const result = service.listByEntity('EVENT', 'EV_VISIBLE', {});
  assert.equal(result.success, true);
  assert.deepEqual(Array.from(result.data), []);
});
