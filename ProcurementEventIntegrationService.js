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
    if (['NONE', 'CREATE_NEED', 'RECORD_RECEIPT'].indexOf(action) < 0) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات تأمین معتبر نیست.');
    }
    var map = this._map_(body.FieldMap || body.FieldMapJSON);
    var required = action === 'CREATE_NEED'
      ? ['ItemName', 'Unit', 'RequestedQuantity']
      : (action === 'RECORD_RECEIPT' ? ['PurchaseOrderItemID', 'QuantityReceived'] : []);
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
