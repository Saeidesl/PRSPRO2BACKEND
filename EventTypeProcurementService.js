/**
 * EVENT TYPE PROCUREMENT INTEGRATION
 * Configuration is stored separately so the existing EventTypes sheet schema
 * remains unchanged. FieldMapJSON maps procurement properties to dynamic field codes.
 */
const EventTypeProcurementService = {
  SHEET: '23_EventTypeProcurementSettings',
  ACTIONS: ['NONE', 'CREATE_NEED', 'RECORD_RECEIPT'],

  _user_: function(params) {
    return AccessControlService.getCurrentUser(params || {});
  },

  _find_: function(eventTypeId, tenantId) {
    return GoogleSheetsRepository.getAll(this.SHEET).filter(function(row) {
      return String(row.TenantID) === String(tenantId) &&
        String(row.EventTypeID) === String(eventTypeId) &&
        String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    })[0] || null;
  },

  _parseMap_: function(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (!value) return {};
    try {
      var parsed = JSON.parse(String(value));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تنظیمات اتصال تأمین معتبر نیست.');
    }
  },

  get: function(eventTypeId, params) {
    var user = this._user_(params);
    var eventType = EventTypeRepository.findById(eventTypeId);
    if (!eventType || String(eventType.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع رویداد پیدا نشد.');
    }
    var setting = this._find_(eventTypeId, user.TenantID);
    if (!setting) {
      return Response.success({
        EventTypeID: eventTypeId,
        Action: 'NONE',
        FieldMap: {}
      });
    }
    return Response.success({
      EventTypeID: setting.EventTypeID,
      Action: String(setting.Action || 'NONE').toUpperCase(),
      FieldMap: this._parseMap_(setting.FieldMapJSON)
    });
  },

  save: function(eventTypeId, body, params) {
    var user = AccessControlService.require(params || {}, 'EVENT_TYPE_MANAGE');
    body = body || {};
    var eventType = EventTypeRepository.findById(eventTypeId);
    if (!eventType || String(eventType.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع رویداد پیدا نشد.');
    }
    var action = String(body.Action || 'NONE').toUpperCase();
    if (this.ACTIONS.indexOf(action) < 0) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات اتصال تأمین معتبر نیست.');
    }
    var fieldMap = this._parseMap_(body.FieldMap || {});
    var fields = EventFieldRepository.findByEventTypeId(eventTypeId) || [];
    var activeCodes = Object.create(null);
    fields.forEach(function(field) {
      if (String(field.TenantID) === String(user.TenantID) &&
          String(field.Status || '').toUpperCase() === 'ACTIVE') {
        activeCodes[String(field.Code)] = true;
      }
    });
    Object.keys(fieldMap).forEach(function(key) {
      if (typeof fieldMap[key] !== 'string' || !fieldMap[key].trim()) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نگاشت هر فیلد باید کد فیلد پویا باشد.');
      }
      fieldMap[key] = fieldMap[key].trim();
      if (key !== 'ProjectID' && key !== 'Notes' && key !== 'ItemCode' &&
          key !== 'NeededBy' && key !== 'ReceivedAt' &&
          !activeCodes[fieldMap[key]]) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
          'کد فیلد پویا برای نگاشت تأمین معتبر یا فعال نیست: ' + fieldMap[key]);
      }
      if (activeCodes[fieldMap[key]] === false) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
          'فیلد انتخاب‌شده غیرفعال است: ' + fieldMap[key]);
      }
    });
    if (action === 'CREATE_NEED' &&
        (!fieldMap.ItemName || !fieldMap.Unit || !fieldMap.RequestedQuantity)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
        'برای ایجاد نیاز، نگاشت نام ملزوم، واحد و مقدار موردنیاز الزامی است.');
    }
    if (action === 'RECORD_RECEIPT' &&
        (!fieldMap.PurchaseOrderItemID || !fieldMap.QuantityReceived)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
        'برای ثبت رسید، نگاشت شناسه قلم سفارش و مقدار تحویل الزامی است.');
    }

    var now = new Date().toISOString();
    var existing = this._find_(eventTypeId, user.TenantID);
    var record = {
      ID: existing ? existing.ID : 'ETPS_' + Utilities.getUuid().replace(/-/g, ''),
      TenantID: user.TenantID,
      EventTypeID: eventTypeId,
      Action: action,
      FieldMapJSON: JSON.stringify(fieldMap),
      Status: 'ACTIVE',
      CreatedBy: existing ? existing.CreatedBy : user.ID,
      CreatedAt: existing ? existing.CreatedAt : now,
      UpdatedAt: now
    };
    if (existing) {
      GoogleSheetsRepository.updateById(this.SHEET, existing.ID, record);
    } else {
      GoogleSheetsRepository.insert(this.SHEET, record);
    }
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID,
      Action: existing ? 'UPDATE' : 'CREATE',
      EntityType: 'EVENT_TYPE_PROCUREMENT_SETTING',
      EntityID: record.ID, OldData: existing, NewData: record
    });
    return Response.success({
      EventTypeID: eventTypeId, Action: action, FieldMap: fieldMap
    });
  },

  applyToEvent: function(eventType, createdEvent, dynamicData, user, requestParams) {
    var setting = this._find_(eventType.ID, user.TenantID);
    var action = setting ? String(setting.Action || 'NONE').toUpperCase() : 'NONE';
    if (!setting || action === 'NONE') return { status: 'NOT_CONFIGURED' };
    if (!dynamicData || typeof dynamicData !== 'object' || Array.isArray(dynamicData)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
        'برای اتصال تأمین، اطلاعات پویای رویداد باید ثبت شده باشد.');
    }
    var map = this._parseMap_(setting.FieldMapJSON);
    function valueFor(property) {
      var code = map[property];
      return code ? dynamicData[code] : '';
    }
    if (action === 'CREATE_NEED') {
      var need = {
        ItemName: valueFor('ItemName'),
        ItemCode: valueFor('ItemCode'),
        Unit: valueFor('Unit'),
        RequestedQuantity: valueFor('RequestedQuantity'),
        NeededBy: valueFor('NeededBy'),
        Notes: valueFor('Notes'),
        ProjectID: createdEvent.ProjectID || valueFor('ProjectID') || '',
        SourceEventID: createdEvent.ID
      };
      var response = ProcurementService.createNeed(need, requestParams || {});
      return { status: 'COMPLETED', action: action, result: response };
    }
    if (action === 'RECORD_RECEIPT') {
      var receipt = {
        PurchaseOrderItemID: valueFor('PurchaseOrderItemID'),
        QuantityReceived: valueFor('QuantityReceived'),
        ProjectID: createdEvent.ProjectID || valueFor('ProjectID') || '',
        ReceivedAt: valueFor('ReceivedAt') || createdEvent.OccurredAt,
        WarehouseDepartmentID: createdEvent.DepartmentID || '',
        SourceEventID: createdEvent.ID,
        Notes: valueFor('Notes')
      };
      var result = ProcurementService.createReceipt(receipt, requestParams || {});
      return { status: 'COMPLETED', action: action, result: result };
    }
    throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات اتصال تأمین پشتیبانی نمی‌شود.');
  }
};
