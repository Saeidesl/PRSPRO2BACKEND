'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadReportService(overrides) {
  const fixtures = Object.assign({
    user: { ID: 'U1', TenantID: 'T1', DepartmentID: 'D1' },
    projects: [
      { ID: 'P1', TenantID: 'T1', ProjectCode: 'PR-1', Title: 'Test project', Quantity: 100, Status: 'ACTIVE', CreatedAt: '2026-01-01' },
      { ID: 'P2', TenantID: 'T2', ProjectCode: 'PR-2', Title: 'Other tenant project', Status: 'ACTIVE' },
      { ID: 'P3', TenantID: 'T1', ProjectCode: 'PR-3', Title: 'Hidden project', Status: 'ACTIVE' }
    ],
    events: [
      { ID: 'E1', TenantID: 'T1', ProjectID: 'P1', Status: 'ACTIVE', EventTypeName: 'Sewing', PerformedByName: 'User' },
      { ID: 'E2', TenantID: 'T1', ProjectID: 'P1', Status: 'VOID', EventTypeName: 'Voided event' },
      { ID: 'E3', TenantID: 'T1', ProjectID: 'P1', Status: 'CANCELLED', EventTypeName: 'Cancelled event' }
    ],
    procurement: {
      needs: [
        { ID: 'N1', ProjectID: 'P1', ItemName: 'Fabric' },
        { ID: 'N2', ProjectID: 'P3', ItemName: 'Other project fabric' }
      ],
      orders: [
        { ID: 'O1', ProjectID: 'P1', Status: 'ORDERED', Items: [{ ID: 'I1', ProjectID: 'P1', ItemName: 'Fabric' }] },
        { ID: 'O2', ProjectID: 'P3', Status: 'ORDERED', Items: [{ ID: 'I2', ProjectID: 'P3', ItemName: 'Other fabric' }] }
      ]
    }
  }, overrides || {});

  const context = {
    AccessControlService: {
      getCurrentUser: () => fixtures.user,
      isAdmin: () => false
    },
    ProjectRepository: {
      getAll: () => fixtures.projects,
      findById: (id) => fixtures.projects.find((p) => String(p.ID) === String(id)) || null
    },
    ProjectService: {
      _isProjectAvailableToUser_: (project) => project.ID !== 'P3'
    },
    EventService: {
      listByProject: () => ({ success: true, data: fixtures.events })
    },
    ProcurementService: {
      reports: () => ({ success: true, data: fixtures.procurement })
    },
    Response: { success: (data) => ({ success: true, data }) },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Constants: { ERROR: { NOT_FOUND: 'NOT_FOUND' } },
    Date,
    String,
    Array,
    Object,
    JSON,
    isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'ReportService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__ReportService = ReportService;', context);
  return { service: context.__ReportService, fixtures };
}

test('listReportProjects scopes results to the current tenant and visible projects', () => {
  const { service } = loadReportService();
  const result = service.listReportProjects({});
  assert.equal(result.success, true);
  assert.deepEqual(Array.from(result.data.items, (p) => p.ID), ['P1']);
  assert.equal(result.data.total, 1);
});

test('projectReport excludes void/cancelled events and scopes procurement to the selected project', () => {
  const { service } = loadReportService();
  const result = service.projectReport('P1', {});
  assert.equal(result.success, true);
  assert.equal(result.data.project.ID, 'P1');
  assert.deepEqual(Array.from(result.data.events, (event) => event.ID), ['E1']);
  assert.deepEqual(Array.from(result.data.procurement.needs, (need) => need.ID), ['N1']);
  assert.deepEqual(Array.from(result.data.procurement.orders, (order) => order.ID), ['O1']);
});

test('projectReport does not expose projects from another tenant', () => {
  const { service } = loadReportService();
  assert.throws(() => service.projectReport('P2', {}), /پروژه مورد نظر پیدا نشد/);
});

test('projectReport does not expose projects outside the current user access list', () => {
  const { service } = loadReportService();
  assert.throws(() => service.projectReport('P3', {}), /پروژه مورد نظر پیدا نشد/);
});
