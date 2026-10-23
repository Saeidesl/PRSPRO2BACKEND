/**
 * Configurable bridge from dynamic events to procurement records.
 * FieldMap values must be active EventField.Code values for the event type.
 */
const ProcurementEventIntegrationService = {
  SHEET: '23_EventTypeProcurementSettings',

  _map_: function(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    try {
      var parsed = JSON.parse(String(value || '{}'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      return parsed;
    } catch (error) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نگاشت فیلدهای تأمین معتبر نیست.');
    }
  },

  _find_: function(eventTypeId, tenantId) {
    return (GoogleSheetsRepository.getAll(this.SHEET) || []).find(function(row) {
      return String(row.EventTypeID) === String(eventTypeId) &&
        String(row.TenantID) === String(tenantId) &&
        String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }) || null;
  },

  get: function(eventTypeId, params) {
    var user = AccessControlService.require(params || {}, 'EVENT_TYPE_MANAGE');
    var type = EventTypeRepository.findById(eventTypeId);
    if (!type || String(type.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع رویداد پیدا نشد.');
    }
    var row = this._find_(eventTypeId, user.TenantID);
    if (!row) return Response.success({ EventTypeID: eventTypeId, Action: 'NONE', FieldMap: {} });
    var result = Object.assign({}, row);
    result.FieldMap = this._map_(row.FieldMapJSON);
    delete result.FieldMapJSON;
    return Response.success(result);
  },

  save: function(eventTypeId, body, params) {
    var user = AccessControlService.require(params || {}, 'EVENT_TYPE_MANAGE');
    var type = EventTypeRepository.findById(eventTypeId);
    if (!type || String(type.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع رویداد پیدا نشد.');
    }
    body = body || {};
    var action = String(body.Action || 'NONE').toUpperCase();
    if (['NONE', 'CREATE_NEED', 'RECORD_RECEIPT', 'RECALCULATE_CONFIRMED_NEEDS'].indexOf(action) < 0) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات تأمین معتبر نیست.');
    }
    var map = this._map_(body.FieldMap || body.FieldMapJSON);
    var required = action === 'CREATE_NEED'
      ? ['ItemName', 'Unit', 'RequestedQuantity']
      : (action === 'RECORD_RECEIPT' ? ['PurchaseOrderItemID', 'QuantityReceived'] :
        (action === 'RECALCULATE_CONFIRMED_NEEDS' ? ['ConfirmedQuantity'] : []));
    required.forEach(function(key) {
      if (!map[key] || typeof map[key] !== 'string') {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نگاشت فیلد الزامی است: ' + key);
      }
    });
    var fields = EventFieldRepository.findByEventTypeId(eventTypeId) || [];
    var codes = {};
    fields.forEach(function(field) {
      if (String(field.TenantID) === String(user.TenantID) &&
          String(field.Status || '').toUpperCase() === 'ACTIVE') codes[String(field.Code)] = true;
    });
    Object.keys(map).forEach(function(key) {
      if (typeof map[key] !== 'string' || !codes[map[key]]) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کد فیلد فعال و معتبری انتخاب کنید: ' + key);
      }
    });
    var now = new Date().toISOString();
    var existing = this._find_(eventTypeId, user.TenantID);
    var record = {
      ID: existing ? existing.ID : 'PSET_' + Utilities.getUuid().replace(/-/g, ''),
      TenantID: user.TenantID, EventTypeID: eventTypeId, Action: action,
      FieldMapJSON: JSON.stringify(map), Status: 'ACTIVE',
      CreatedBy: existing ? existing.CreatedBy : user.ID,
      CreatedAt: existing ? existing.CreatedAt : now, UpdatedAt: now
    };
    var saved = existing
      ? GoogleSheetsRepository.updateById(this.SHEET, existing.ID, record)
      : GoogleSheetsRepository.insert(this.SHEET, record);
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID,
      Action: existing ? 'UPDATE' : 'CREATE',
      EntityType: 'EVENT_TYPE_PROCUREMENT_SETTINGS', EntityID: record.ID,
      OldData: existing, NewData: saved
    });
    var output = Object.assign({}, saved);
    output.FieldMap = map;
    delete output.FieldMapJSON;
    return Response.success(output);
  },

  validate: function(eventType, dynamicData, projectId, params) {
    var user = AccessControlService.getCurrentUser(params || {});
    var row = this._find_(eventType.ID, user.TenantID);
    if (!row || String(row.Action || 'NONE').toUpperCase() === 'NONE') return true;
    var map = this._map_(row.FieldMapJSON);
    dynamicData = dynamicData || {};
    function read(key) {
      var code = map[key];
      return code && dynamicData[code] !== undefined && dynamicData[code] !== null
        ? dynamicData[code] : '';
    }
    var action = String(row.Action).toUpperCase();
    var required = action === 'CREATE_NEED'
      ? ['ItemName', 'Unit', 'RequestedQuantity']
      : (action === 'RECORD_RECEIPT' ? ['PurchaseOrderItemID', 'QuantityReceived'] :
        (action === 'RECALCULATE_CONFIRMED_NEEDS' ? ['ConfirmedQuantity'] : []));
    required.forEach(function(key) {
      var value = read(key);
      if (String(value === undefined || value === null ? '' : value).trim() === '') {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
          'برای اجرای عملیات تأمین، مقدار فیلد مربوط به ' + key + ' الزامی است.');
      }
    });
    var quantityKey = action === 'CREATE_NEED' ? 'RequestedQuantity' :
      (action === 'RECALCULATE_CONFIRMED_NEEDS' ? 'ConfirmedQuantity' : 'QuantityReceived');
    var quantity = Number(read(quantityKey));
    if (!isFinite(quantity) || quantity <= 0) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مقدار تأمین باید عددی بزرگ‌تر از صفر باشد.');
    }
    if (action === 'RECALCULATE_CONFIRMED_NEEDS') {
      if (!projectId) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'محاسبه نیاز قطعی فقط برای رویداد مرتبط با پروژه مجاز است.');
      }
      var confirmedProject = ProjectRepository.findById(projectId);
      if (!confirmedProject || String(confirmedProject.TenantID) !== String(user.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(confirmedProject, user)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه برای محاسبه نیاز قطعی معتبر نیست.');
      }
    }
    if (action === 'CREATE_NEED') {
      var mappedProjectId = projectId || read('ProjectID');
      if (mappedProjectId) {
        var project = ProjectRepository.findById(mappedProjectId);
        if (!project || String(project.TenantID) !== String(user.TenantID)) {
          throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه نگاشت‌شده برای نیاز ملزومات معتبر نیست.');
        }
      }
    }

    // Validate receipt references and remaining quantity before the production
    // event is persisted. This prevents predictable integration failures from
    // leaving an event that looks successful without a matching receipt.
    if (action === 'RECORD_RECEIPT') {
      var itemId = read('PurchaseOrderItemID');
      var item = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, itemId);
      if (!item || String(item.TenantID) !== String(user.TenantID)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قلم سفارش برای ثبت دریافت معتبر نیست.');
      }
      var order = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ORDERS, item.PurchaseOrderID);
      if (!order || String(order.TenantID) !== String(user.TenantID) ||
          String(order.Status || '').toUpperCase() === 'CANCELLED') {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'سفارش خرید برای ثبت دریافت معتبر یا فعال نیست.');
      }
      var priorReceived = ProcurementRepository.getReceipts(user.TenantID)
        .filter(function(receipt) {
          return String(receipt.PurchaseOrderItemID) === String(item.ID);
        })
        .reduce(function(sum, receipt) {
          return sum + (Number(receipt.QuantityReceived) || 0);
        }, 0);
      if (priorReceived + quantity > (Number(item.OrderedQuantity) || 0)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
          'مقدار دریافت از باقیمانده قلم سفارش بیشتر است.');
      }
      var mappedProjectIdForReceipt = projectId || read('ProjectID');
      if (mappedProjectIdForReceipt) {
        var receiptProject = ProjectRepository.findById(mappedProjectIdForReceipt);
        if (!receiptProject || String(receiptProject.TenantID) !== String(user.TenantID)) {
          throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه ثبت دریافت معتبر نیست.');
        }
      }
    }
    return true;
  },

  apply: function(eventType, event, dynamicData, params) {
    var user = AccessControlService.getCurrentUser(params || {});
    var row = this._find_(eventType.ID, user.TenantID);
    if (!row || String(row.Action || 'NONE').toUpperCase() === 'NONE') return null;
    var map = this._map_(row.FieldMapJSON);
    dynamicData = dynamicData || {};
    function read(key) {
      var code = map[key];
      return code && dynamicData[code] !== undefined && dynamicData[code] !== null
        ? dynamicData[code] : '';
    }
    if (String(row.Action).toUpperCase() === 'CREATE_NEED') {
      return ProcurementService.createNeed({
        ProjectID: event.ProjectID || read('ProjectID') || '',
        SourceEventID: event.ID, ItemName: read('ItemName'),
        ItemCode: read('ItemCode'), Unit: read('Unit'),
        RequestedQuantity: read('RequestedQuantity'),
        NeededBy: read('NeededBy'), Notes: read('Notes')
      }, params);
    }
    if (String(row.Action).toUpperCase() === 'RECALCULATE_CONFIRMED_NEEDS') {
      if (!event.ProjectID) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'رویداد مبنای تعداد قطعی باید به پروژه متصل باشد.');
      }
      return MaterialPlanningService.recalculateProjectNeeds(
        event.ProjectID, event.ID, read('ConfirmedQuantity'),
        event.EventTypeVersion || eventType.Version || '', params
      );
    }
    if (String(row.Action).toUpperCase() === 'RECORD_RECEIPT') {
      return ProcurementService.createReceipt({
        PurchaseOrderItemID: read('PurchaseOrderItemID'),
        QuantityReceived: read('QuantityReceived'),
        ProjectID: event.ProjectID || read('ProjectID') || '',
        ReceivedAt: event.OccurredAt || '',
        WarehouseDepartmentID: event.DepartmentID || '',
        SourceEventID: event.ID, Notes: read('Notes')
      }, params);
    }
    throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات تأمین پشتیبانی نمی‌شود.');
  }
};
