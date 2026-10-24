'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'MaterialPlanningService.js'),
  'utf8'
);

function createRuntime(sharedCache) {
  const counts = { locks: 0, sheetLookups: 0, headerChecks: 0 };
  const definitions = [
    '18_MaterialNeeds',
    '19_PurchaseOrders',
    '22_MaterialReceipts',
    '24_ProjectMaterialSpecs',
    '25_MaterialNeedCalculations'
  ].map(name => ({ name, headers: ['ID', 'TenantID'] }));
  const spreadsheet = {
    getSheetByName(name) {
      counts.sheetLookups++;
      return { name };
    }
  };
  const context = {
    APP_CONFIG: {
      SHEETS: {
        MATERIAL_NEEDS: definitions[0],
        PURCHASE_ORDERS: definitions[1],
        MATERIAL_RECEIPTS: definitions[2],
        PROJECT_MATERIAL_SPECS: definitions[3],
        MATERIAL_NEED_CALCULATIONS: definitions[4]
      }
    },
    SpreadsheetApp: {},
    CacheService: {
      getScriptCache: () => ({
        get: key => sharedCache[key] || null,
        put: (key, value) => { sharedCache[key] = value; }
      })
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { counts.locks++; return true; },
        releaseLock: () => true
      })
    },
    GoogleSheetsRepository: {
      getSpreadsheet: () => spreadsheet,
      _sheetCache: {},
      _headerCache: {},
      resetRequestCache: () => true
    },
    ensureHeaders_: () => { counts.headerChecks++; },
    Constants: { ERROR: { CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR' } },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Object, Array, String, Number, Date, JSON, Math, isFinite
  };
  vm.runInNewContext(source + '\nthis.__service = MaterialPlanningService;', context);
  return { service: context.__service, counts };
}

test('material schema readiness is shared across fresh Apps Script executions', () => {
  const scriptCache = Object.create(null);
  const first = createRuntime(scriptCache);

  assert.equal(first.service._ensureSchema_(), true);
  assert.equal(first.counts.locks, 1);
  assert.equal(first.counts.sheetLookups, 5);
  assert.equal(first.counts.headerChecks, 5);
  assert.equal(scriptCache.PMS_MATERIAL_SCHEMA_READY_V1, '1');

  // A separate VM models the fresh JavaScript context used by a new web request.
  const second = createRuntime(scriptCache);
  assert.equal(second.service._ensureSchema_(), true);
  assert.equal(second.counts.locks, 0);
  assert.equal(second.counts.sheetLookups, 0);
  assert.equal(second.counts.headerChecks, 0);
});

test('material schema migration still runs when the shared cache is empty', () => {
  const runtime = createRuntime(Object.create(null));
  assert.equal(runtime.service._ensureSchema_(), true);
  assert.equal(runtime.counts.locks, 1);
  assert.equal(runtime.counts.sheetLookups, 5);
  assert.equal(runtime.counts.headerChecks, 5);
});
