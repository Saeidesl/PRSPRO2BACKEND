/**
 * Procurement API payload validation.
 * This layer checks payload shape and scalar constraints before service logic
 * performs tenant/project authorization or writes to Google Sheets.
 */
const ProcurementValidator = {
  LIMITS: {
    ORDER_NUMBER: 80,
    SUPPLIER_NAME: 200,
    ITEM_NAME: 200,
    ITEM_CODE: 80,
    UNIT: 40,
    NOTES: 2000,
    IDEMPOTENCY_KEY: 240,
    IDENTIFIER: 128,
    RECEIPT_BATCH_SIZE: 100
  },

  _fail_: function(message) {
    throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, message);
  },

  _object_: function(value, fieldName) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      this._fail_('ساختار فیلد «' + fieldName + '» معتبر نیست.');
    }
  },

  _text_: function(value, fieldName, required, maxLength) {
    if (value === undefined || value === null) {
      if (required) this._fail_('فیلد «' + fieldName + '» الزامی است.');
      return;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      this._fail_('فیلد «' + fieldName + '» باید متن باشد.');
    }
    var text = String(value).trim();
    if (required && !text) this._fail_('فیلد «' + fieldName + '» الزامی است.');
    if (maxLength && text.length > maxLength) {
      this._fail_('طول فیلد «' + fieldName + '» نباید بیشتر از ' + maxLength + ' نویسه باشد.');
    }
  },

  _quantity_: function(value, fieldName, allowZero) {
    if (value === '' || value === undefined || value === null || String(value).trim() === '') {
      this._fail_('فیلد «' + fieldName + '» باید عدد معتبر باشد.');
    }
    var number = Number(value);
    if (!isFinite(number) || number < 0 || (!allowZero && number <= 0)) {
      this._fail_('مقدار عددی معتبر نیست: ' + fieldName);
    }
  },

  _dateText_: function(value, fieldName) {
    if (value === undefined || value === null || value === '') return;
    if (typeof value !== 'string' && !(value instanceof Date)) {
      this._fail_('فیلد «' + fieldName + '» باید تاریخ متنی باشد.');
    }
    if (String(value).length > 80) {
      this._fail_('طول فیلد «' + fieldName + '» بیش از حد مجاز است.');
    }
  },

  validateOrder: function(body) {
    this._object_(body, 'سفارش');
    this._text_(body.OrderNumber, 'شماره سفارش', false, this.LIMITS.ORDER_NUMBER);
    this._text_(body.SupplierName, 'نام تأمین‌کننده', false, this.LIMITS.SUPPLIER_NAME);
    this._text_(body.Notes, 'توضیحات سفارش', false, this.LIMITS.NOTES);
    this._text_(body.IdempotencyKey, 'کلید جلوگیری از ثبت تکراری', false, this.LIMITS.IDEMPOTENCY_KEY);
    this._dateText_(body.OrderDate, 'تاریخ سفارش');
    this._dateText_(body.ExpectedDeliveryDate, 'تاریخ مورد انتظار تحویل');

    if (!Array.isArray(body.Items) || body.Items.length === 0) {
      this._fail_('سفارش باید دست‌کم یک قلم داشته باشد.');
    }
    if (body.Items.length > this.LIMITS.RECEIPT_BATCH_SIZE) {
      this._fail_('تعداد اقلام هر سفارش نباید بیشتر از ' + this.LIMITS.RECEIPT_BATCH_SIZE + ' باشد.');
    }

    body.Items.forEach(function(item, index) {
      var label = 'قلم ' + (index + 1);
      this._object_(item, label);
      this._text_(item.ItemName, label + '، نام', true, this.LIMITS.ITEM_NAME);
      this._text_(item.Unit, label + '، واحد', true, this.LIMITS.UNIT);
      this._text_(item.ItemCode, label + '، کد قلم', false, this.LIMITS.ITEM_CODE);
      this._text_(item.Notes, label + '، توضیحات', false, this.LIMITS.NOTES);
      this._text_(item.MaterialNeedID, label + '، شناسه نیاز', false, this.LIMITS.IDENTIFIER);
      this._text_(item.ProjectID, label + '، شناسه پروژه', false, this.LIMITS.IDENTIFIER);
      this._quantity_(item.OrderedQuantity, label + '، مقدار سفارش', false);
      if (item.UnitPrice !== undefined && item.UnitPrice !== null && item.UnitPrice !== '') {
        this._quantity_(item.UnitPrice, label + '، قیمت واحد', true);
      }
      if (item.Allocations !== undefined && !Array.isArray(item.Allocations)) {
        this._fail_(label + '، فهرست تخصیص‌ها باید آرایه باشد.');
      }
      (item.Allocations || []).forEach(function(allocation, allocationIndex) {
        this._object_(allocation, label + '، تخصیص ' + (allocationIndex + 1));
        this._text_(allocation.ProjectID, 'شناسه پروژه تخصیص', false, this.LIMITS.IDENTIFIER);
        this._text_(allocation.MaterialNeedID, 'شناسه نیاز تخصیص', false, this.LIMITS.IDENTIFIER);
        this._quantity_(allocation.AllocatedQuantity, 'مقدار تخصیص', false);
      }, this);
    }, this);
    return true;
  },

  validateReceipt: function(entry) {
    this._object_(entry, 'دریافت');
    this._text_(entry.PurchaseOrderItemID, 'شناسه قلم سفارش', true, this.LIMITS.IDENTIFIER);
    this._text_(entry.ProjectID, 'شناسه پروژه دریافت', false, this.LIMITS.IDENTIFIER);
    this._text_(entry.SourceEventID, 'شناسه رویداد منبع', false, this.LIMITS.IDENTIFIER);
    this._text_(entry.WarehouseDepartmentID, 'شناسه واحد دریافت‌کننده', false, this.LIMITS.IDENTIFIER);
    this._text_(entry.IdempotencyKey, 'کلید جلوگیری از ثبت تکراری', false, this.LIMITS.IDEMPOTENCY_KEY);
    this._text_(entry.Notes, 'توضیحات دریافت', false, this.LIMITS.NOTES);
    this._dateText_(entry.ReceivedAt, 'زمان دریافت');
    this._quantity_(entry.QuantityReceived, 'مقدار تحویل', false);
    return true;
  },

  validateReceiptBatch: function(body) {
    this._object_(body, 'درخواست دریافت گروهی');
    if (!Array.isArray(body.Receipts) || body.Receipts.length === 0) {
      this._fail_('برای ثبت دریافت، حداقل یک قلم لازم است.');
    }
    if (body.Receipts.length > this.LIMITS.RECEIPT_BATCH_SIZE) {
      this._fail_('تعداد ردیف‌های دریافت گروهی نباید بیشتر از ' + this.LIMITS.RECEIPT_BATCH_SIZE + ' باشد.');
    }
    body.Receipts.forEach(function(entry) {
      this.validateReceipt(entry);
    }, this);
    return true;
  }
};
