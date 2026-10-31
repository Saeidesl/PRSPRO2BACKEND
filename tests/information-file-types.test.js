'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadInformationTypeValidator() {
  const context = {
    Validator: {
      object: value => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object'); },
      required: value => { if (value === undefined || value === null || value === '') throw new Error('required'); },
      string: value => { if (typeof value !== 'string') throw new Error('string'); },
      enum: (value, allowed) => { if (!allowed.includes(value)) throw new Error('enum'); },
      boolean: () => {}
    },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR' }, STATUS: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } },
    String, Number, Array, Object, isFinite, RegExp, JSON
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'InformationTypeValidator.js'), 'utf8') + '\nthis.__validator=InformationTypeValidator;', context);
  return context.__validator;
}

function loadProjectInformationService(attachment) {
  const context = {
    AttachmentRepository: { findById: id => attachment && String(attachment.ID) === String(id) ? attachment : null },
    AttachmentValidator: { FILE_TYPES: { 'image/png': ['png'], 'application/pdf': ['pdf'] } },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND' } },
    String, Number, Array, Object, JSON, isFinite, Date
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'ProjectInformationService.js'), 'utf8') + '\nthis.__service=ProjectInformationService;', context);
  return context.__service;
}

test('image and file are accepted as information and column data types', () => {
  const validator = loadInformationTypeValidator();
  for (const dataType of ['image', 'file']) {
    assert.equal(validator.validateDefinition({ Name: 'فایل مرجع', Code: 'ReferenceFile', Cardinality: 'SINGLE', DataType: dataType }, false), true);
    assert.equal(validator.validateColumn({ Name: 'پیوست', Code: 'Attachment', DataType: dataType }, false), true);
  }
});

test('project information stores canonical metadata for a valid project image or file', () => {
  for (const [dataType, mime, name] of [['image', 'image/png', 'sample.png'], ['file', 'application/pdf', 'spec.pdf']]) {
    const attachment = { ID: 'A1', TenantID: 'T1', EntityType: 'PROJECT', EntityID: 'P1', AttachmentType: 'INFORMATION', Status: 'ACTIVE', FileName: name, MimeType: mime, FileSize: 123 };
    const service = loadProjectInformationService(attachment);
    const result = service._scalar({ AttachmentID: 'A1', FileName: 'forged.pdf', MimeType: 'application/pdf' }, dataType, {}, [], 'پیوست', { projectId: 'P1', tenantId: 'T1' });
    assert.equal(result.AttachmentID, 'A1');
    assert.equal(result.FileName, name);
    assert.equal(result.MimeType, mime);
  }
});

test('image fields reject non-image files and attachments outside the current project or tenant', () => {
  const pdf = { ID: 'A1', TenantID: 'T1', EntityType: 'PROJECT', EntityID: 'P1', AttachmentType: 'INFORMATION', Status: 'ACTIVE', FileName: 'spec.pdf', MimeType: 'application/pdf', FileSize: 123 };
  assert.throws(() => loadProjectInformationService(pdf)._scalar({ AttachmentID: 'A1' }, 'image', {}, [], 'تصویر', { projectId: 'P1', tenantId: 'T1' }), /فقط تصویر مجاز است/);
  assert.throws(() => loadProjectInformationService(pdf)._scalar({ AttachmentID: 'A1' }, 'file', {}, [], 'فایل', { projectId: 'P2', tenantId: 'T1' }), /به این پروژه تعلق ندارد/);
  assert.throws(() => loadProjectInformationService(pdf)._scalar({ AttachmentID: 'A1' }, 'file', {}, [], 'فایل', { projectId: 'P1', tenantId: 'T2' }), /به این پروژه تعلق ندارد/);
});

test('only active INFORMATION attachments can be referenced', () => {
  const attachment = { ID: 'A1', TenantID: 'T1', EntityType: 'PROJECT', EntityID: 'P1', AttachmentType: 'PROJECT_DOCUMENT', Status: 'ACTIVE', FileName: 'spec.pdf', MimeType: 'application/pdf', FileSize: 123 };
  assert.throws(() => loadProjectInformationService(attachment)._scalar({ AttachmentID: 'A1' }, 'file', {}, [], 'فایل', { projectId: 'P1', tenantId: 'T1' }), /به این پروژه تعلق ندارد/);
});
