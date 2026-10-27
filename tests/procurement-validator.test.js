'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadValidator() {
  const context = {
    Constants: { ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR' } },
    ErrorHandler: { create: (_code, message) => new Error(message) },
    Number, String, Object, Array, Date, isFinite
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'ProcurementValidator.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__validator = ProcurementValidator;', context);
  return context.__validator;
}

test('accepts a valid project or general order payload without changing legacy quantity representation', () => {
  const validator = loadValidator();
  assert.equal(validator.validateOrder({
    SupplierName: 'تأمین‌کننده',
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: '12.5', UnitPrice: '0' }]
  }), true);
});

test('rejects missing order rows, missing item names, and non-finite or non-positive quantities', () => {
  const validator = loadValidator();
  assert.throws(() => validator.validateOrder({ Items: [] }), /دست‌کم یک قلم/);
  assert.throws(() => validator.validateOrder({ Items: [{ Unit: 'متر', OrderedQuantity: 1 }] }), /نام/);
  assert.throws(() => validator.validateOrder({ Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: -1 }] }), /مقدار عددی/);
  assert.throws(() => validator.validateOrder({ Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 'Infinity' }] }), /مقدار عددی/);
  assert.throws(() => validator.validateOrder({ Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: '' }] }), /عدد معتبر/);
});

test('rejects oversized text and malformed allocation collections before service writes', () => {
  const validator = loadValidator();
  assert.throws(() => validator.validateOrder({
    SupplierName: 'x'.repeat(201),
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 1 }]
  }), /بیشتر از 200/);
  assert.throws(() => validator.validateOrder({
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 1, Allocations: {} }]
  }), /باید آرایه باشد/);
  assert.throws(() => validator.validateOrder({
    Items: [{ ItemName: 'پارچه', Unit: 'متر', OrderedQuantity: 1, Allocations: [{ AllocatedQuantity: 0 }] }]
  }), /مقدار عددی/);
});

test('validates single and batch receipts consistently', () => {
  const validator = loadValidator();
  assert.equal(validator.validateReceipt({
    PurchaseOrderItemID: 'POI_123abc', QuantityReceived: '2.25', Notes: ''
  }), true);
  assert.equal(validator.validateReceiptBatch({
    Receipts: [{ PurchaseOrderItemID: 'POI_123abc', QuantityReceived: 2 }]
  }), true);
  assert.throws(() => validator.validateReceipt({
    PurchaseOrderItemID: 'POI_123abc', QuantityReceived: 0
  }), /مقدار عددی/);
  assert.throws(() => validator.validateReceiptBatch({ Receipts: [{}] }), /شناسه قلم سفارش/);
});
