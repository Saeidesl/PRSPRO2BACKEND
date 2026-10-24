/**
 * MATERIAL PLANNING SERVICE
 * Versioned project material specifications and immutable calculation history.
 *
 * Existing material needs/orders/receipts are intentionally left intact. Legacy
 * needs are not assigned invented per-unit consumption rates.
 */
const MaterialPlanningService = {
  SHEETS: {
    SPECS: '24_ProjectMaterialSpecs',
    CALCULATIONS: '25_MaterialNeedCalculations'
  },

  _user_: function(params) {
    var user = AccessControlService.getCurrentUser(params || {});
    this._ensureSchema_();
    return user;
  },

  _schemaReady: false,

  /**
   * Additive, lazy migration for the material-planning schema. It only creates
   * missing material-planning sheets and appends missing headers; existing rows
   * and existing column order are preserved.
   */
  _ensureSchema_: function() {
    if (this._schemaReady) return true;
    // Node unit tests intentionally do not provide Apps Script globals.
    if (typeof APP_CONFIG === 'undefined' || typeof SpreadsheetApp === 'undefined' ||
        typeof ensureHeaders_ !== 'function') return false;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'آماده‌سازی ساختار ملزومات با عملیات دیگری تداخل دارد؛ دوباره تلاش کنید.');
    }
    try {
      if (this._schemaReady) return true;
      var ss = GoogleSheetsRepository.getSpreadsheet();
      var definitions = [
        APP_CONFIG.SHEETS.MATERIAL_NEEDS,
        APP_CONFIG.SHEETS.PURCHASE_ORDERS,
        APP_CONFIG.SHEETS.MATERIAL_RECEIPTS,
        APP_CONFIG.SHEETS.PROJECT_MATERIAL_SPECS,
        APP_CONFIG.SHEETS.MATERIAL_NEED_CALCULATIONS
      ];
      definitions.forEach(function(definition) {
        if (!definition) throw ErrorHandler.create(Constants.ERROR.INTERNAL_ERROR, 'تعریف شیت موردنیاز برای برنامه‌ریزی ملزومات پیدا نشد.');
        var sheet = ss.getSheetByName(definition.name);
        if (!sheet) sheet = ss.insertSheet(definition.name);
        ensureHeaders_(sheet, definition.headers);
      });
      GoogleSheetsRepository._sheetCache = {};
      GoogleSheetsRepository._headerCache = {};
      GoogleSheetsRepository.resetRequestCache();
      this._schemaReady = true;
      return true;
    } finally {
      lock.releaseLock();
    }
  },

  _id_: function(prefix) {
    return prefix + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  },

  _now_: function() {
    return new Date().toISOString();
  },

  _number_: function(value, label, min, max) {
    if (value === undefined || value === null || String(value).trim() === '') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فیلد عددی الزامی است: ' + label);
    }
    var n = Number(value);
    if (!isFinite(n) || n < min || (max !== null && n > max)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مقدار معتبر نیست: ' + label);
    }
    return n;
  },

  _project_: function(projectId, user) {
    Validator.required(projectId, 'شناسه پروژه');
    var project = ProjectRepository.findById(projectId);
    if (!project || String(project.TenantID) !== String(user.TenantID) ||
        !ProjectService._isProjectAvailableToUser_(project, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه مورد نظر پیدا نشد.');
    }
    return project;
  },

  _specsForProject_: function(projectId, tenantId) {
    return GoogleSheetsRepository.getAll(this.SHEETS.SPECS).filter(function(row) {
      return String(row.TenantID) === String(tenantId) &&
        String(row.ProjectID) === String(projectId);
    });
  },

  listSpecifications: function(projectId, params) {
    var user = this._user_(params);
    this._project_(projectId, user);
    var rows = this._specsForProject_(projectId, user.TenantID);
    var latestByKey = Object.create(null);
    rows.forEach(function(row) {
      var key = String(row.SpecKey || row.ID);
      var revision = Number(row.Revision) || 1;
      if (!latestByKey[key] || revision > (Number(latestByKey[key].Revision) || 1)) {
        latestByKey[key] = row;
      }
    });
    var result = Object.keys(latestByKey).map(function(key) {
      return Object.assign({}, latestByKey[key]);
    }).filter(function(row) {
      return String(row.Status || 'ACTIVE').toUpperCase() !== 'DELETED';
    }).sort(function(a, b) {
      return String(a.ItemName || '').localeCompare(String(b.ItemName || ''), 'fa');
    });
    return Response.success({ items: result, total: result.length });
  },

  createSpecification: function(projectId, body, params) {
    var user = this._user_(params);
    this._project_(projectId, user);
    body = body || {};
    Validator.required(body.ItemName, 'نام ملزوم');
    Validator.required(body.Unit, 'واحد اندازه‌گیری');
    var itemName = String(body.ItemName).trim();
    var unit = String(body.Unit).trim();
    if (itemName.length > 160 || unit.length > 40) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام ملزوم یا واحد اندازه‌گیری بیش از حد طولانی است.');
    }
    var consumption = this._number_(body.ConsumptionPerUnit, 'مصرف برای هر واحد', 0.0000001, null);
    var wastage = body.WastagePercent === undefined || body.WastagePercent === null ||
      String(body.WastagePercent).trim() === '' ? 0 :
      this._number_(body.WastagePercent, 'درصد ضایعات', 0, 100);
    var policy = 'DISABLED';
    var earlyQuantity = '';

    var now = this._now_();
    var specKey = String(body.SpecKey || this._id_('MSK'));
    var existing = this._specsForProject_(projectId, user.TenantID).filter(function(row) {
      return String(row.SpecKey || '') === specKey;
    });
    if (existing.length) {
      throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'شناسه مشخصات مصرف از قبل وجود دارد.');
    }
    var record = {
      ID: this._id_('MSPEC'),
      TenantID: user.TenantID,
      ProjectID: String(projectId),
      SpecKey: specKey,
      ItemName: itemName,
      ItemCode: 'MAT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase(),
      Unit: unit,
      ConsumptionPerUnit: consumption,
      WastagePercent: wastage,
      EarlyOrderPolicy: policy,
      EarlyOrderQuantity: earlyQuantity,
      Status: 'ACTIVE',
      Revision: 1,
      Notes: String(body.Notes || ''),
      CreatedBy: user.ID,
      CreatedAt: now,
      UpdatedAt: now
    };
    GoogleSheetsRepository.insert(this.SHEETS.SPECS, record);
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID, Action: 'CREATE',
      EntityType: 'PROJECT_MATERIAL_SPEC', EntityID: record.ID, NewData: record
    });
    return Response.success(record);
  },

  reviseSpecification: function(specId, body, params) {
    var user = this._user_(params);
    var current = GoogleSheetsRepository.findById(this.SHEETS.SPECS, specId);
    if (!current || String(current.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مشخصات مصرف پیدا نشد.');
    }
    this._project_(current.ProjectID, user);
    if (String(current.Status || '').toUpperCase() === 'DELETED') {
      throw ErrorHandler.create(Constants.ERROR.INVALID_STATUS, 'مشخصات حذف‌شده قابل ویرایش نیست.');
    }
    body = body || {};
    var specKey = String(current.SpecKey || current.ID);
    var all = this._specsForProject_(current.ProjectID, user.TenantID).filter(function(row) {
      return String(row.SpecKey || row.ID) === specKey;
    });
    var latestRevision = all.reduce(function(max, row) {
      return Math.max(max, Number(row.Revision) || 1);
    }, 1);
    if (Number(current.Revision || 1) !== latestRevision ||
        String(current.Status || 'ACTIVE').toUpperCase() === 'SUPERSEDED') {
      throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'این نسخه دیگر آخرین نسخه نیست؛ اطلاعات را تازه‌سازی کنید.');
    }

    var itemName = String(body.ItemName === undefined ? current.ItemName : body.ItemName).trim();
    var unit = String(body.Unit === undefined ? current.Unit : body.Unit).trim();
    Validator.required(itemName, 'نام ملزوم');
    Validator.required(unit, 'واحد اندازه‌گیری');
    if (itemName.length > 160 || unit.length > 40) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام ملزوم یا واحد اندازه‌گیری بیش از حد طولانی است.');
    }
    var consumption = this._number_(body.ConsumptionPerUnit === undefined ? current.ConsumptionPerUnit : body.ConsumptionPerUnit,
      'مصرف برای هر واحد', 0.0000001, null);
    var wastageInput = body.WastagePercent === undefined ? current.WastagePercent : body.WastagePercent;
    var wastage = wastageInput === undefined || wastageInput === null || String(wastageInput).trim() === ''
      ? 0 : this._number_(wastageInput, 'درصد ضایعات', 0, 100);
    var policy = 'DISABLED';
    var earlyQuantity = '';

    var now = this._now_();
    var record = {
      ID: this._id_('MSPEC'),
      TenantID: user.TenantID,
      ProjectID: String(current.ProjectID),
      SpecKey: specKey,
      ItemName: itemName,
      ItemCode: String(current.ItemCode || ''),
      Unit: unit,
      ConsumptionPerUnit: consumption,
      WastagePercent: wastage,
      EarlyOrderPolicy: policy,
      EarlyOrderQuantity: earlyQuantity,
      Status: 'ACTIVE',
      Revision: latestRevision + 1,
      Notes: String(body.Notes === undefined ? current.Notes || '' : body.Notes || ''),
      CreatedBy: user.ID,
      CreatedAt: now,
      UpdatedAt: now
    };
    // The new highest revision is authoritative even if marking the old row fails.
    GoogleSheetsRepository.insert(this.SHEETS.SPECS, record);
    var previous = Object.assign({}, current, { Status: 'SUPERSEDED', UpdatedAt: now });
    GoogleSheetsRepository.updateById(this.SHEETS.SPECS, current.ID, previous);
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID, Action: 'REVISE',
      EntityType: 'PROJECT_MATERIAL_SPEC', EntityID: record.ID,
      OldData: current, NewData: record, Reason: 'ایجاد نسخه جدید مشخصات مصرف'
    });
    return Response.success(record);
  },

  listCalculationHistory: function(projectId, params) {
    var user = this._user_(params);
    this._project_(projectId, user);
    var rows = GoogleSheetsRepository.getAll(this.SHEETS.CALCULATIONS).filter(function(row) {
      return String(row.TenantID) === String(user.TenantID) &&
        String(row.ProjectID) === String(projectId);
    });
    rows.sort(function(a, b) {
      return new Date(b.CreatedAt || 0).getTime() - new Date(a.CreatedAt || 0).getTime();
    });
    return Response.success({ items: rows, total: rows.length });
  },

  /**
   * Append-only calculation ledger. Callers must supply a stable CalculationKey
   * for the event/specification revision/basis quantity tuple to make retries safe.
   */
  recordCalculation: function(data, params) {
    data = data || {};
    var user = this._user_(params);
    this._project_(data.ProjectID, user);
    Validator.required(data.CalculationKey, 'کلید محاسبه');
    var key = String(data.CalculationKey).trim();
    if (key.length > 240) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کلید محاسبه بیش از حد طولانی است.');
    }
    var existing = GoogleSheetsRepository.getAll(this.SHEETS.CALCULATIONS).find(function(row) {
      return String(row.TenantID) === String(user.TenantID) && String(row.CalculationKey) === key;
    });
    if (existing) return Response.success(Object.assign({ IdempotentReplay: true }, existing));

    var basis = this._number_(data.BasisQuantity, 'تعداد مبنا', 0, null);
    var consumption = this._number_(data.ConsumptionPerUnit, 'مصرف برای هر واحد', 0, null);
    var wastage = this._number_(data.WastagePercent === undefined ? 0 : data.WastagePercent, 'درصد ضایعات', 0, 100);
    var calculated = data.CalculatedQuantityOverride !== undefined && data.CalculatedQuantityOverride !== null && String(data.CalculatedQuantityOverride).trim() !== ''
      ? this._number_(data.CalculatedQuantityOverride, 'مقدار محاسبه‌شده', 0, null)
      : Math.ceil(basis * consumption * (1 + wastage / 100) * 10000) / 10000;
    var previous = data.PreviousCalculatedQuantity === undefined || data.PreviousCalculatedQuantity === ''
      ? 0 : this._number_(data.PreviousCalculatedQuantity, 'نیاز قبلی', 0, null);
    var record = {
      ID: this._id_('MCALC'),
      TenantID: user.TenantID,
      ProjectID: String(data.ProjectID),
      MaterialSpecID: String(data.MaterialSpecID || ''),
      MaterialNeedID: String(data.MaterialNeedID || ''),
      SourceEventID: String(data.SourceEventID || ''),
      SourceEventVersion: String(data.SourceEventVersion || ''),
      CalculationKey: key,
      BasisQuantity: basis,
      ConsumptionPerUnit: consumption,
      WastagePercent: wastage,
      CalculatedQuantity: calculated,
      PreviousCalculatedQuantity: previous,
      VarianceQuantity: calculated - previous,
      CalculationType: String(data.CalculationType || 'CONFIRMED').toUpperCase(),
      Status: 'RECORDED',
      CreatedBy: user.ID,
      CreatedAt: this._now_()
    };
    GoogleSheetsRepository.insert(this.SHEETS.CALCULATIONS, record);
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID, Action: 'CREATE',
      EntityType: 'MATERIAL_NEED_CALCULATION', EntityID: record.ID, NewData: record
    });
    return Response.success(record);
  },

  recalculateProjectNeeds: function(projectId, sourceEventId, confirmedQuantity, sourceEventVersion, params) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'محاسبه نیازهای ملزومات دیگری در حال انجام است؛ دوباره تلاش کنید.');
    }
    try {
      return this._recalculateProjectNeedsUnlocked_(projectId, sourceEventId, confirmedQuantity, sourceEventVersion, params);
    } finally {
      lock.releaseLock();
    }
  },

  _recalculateProjectNeedsUnlocked_: function(projectId, sourceEventId, confirmedQuantity, sourceEventVersion, params) {
    var user = this._user_(params);
    this._project_(projectId, user);
    var quantity = this._number_(confirmedQuantity, 'تعداد قطعی تولید', 0.0000001, null);
    Validator.required(sourceEventId, 'رویداد مبنای تعداد قطعی');
    var sourceEvent = EventRepository.findById(sourceEventId);
    if (!sourceEvent || String(sourceEvent.TenantID) !== String(user.TenantID) ||
        String(sourceEvent.ProjectID || '') !== String(projectId)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مبنای محاسبه با پروژه مطابقت ندارد.');
    }
    var allSpecs = this._specsForProject_(projectId, user.TenantID);
    var latestByKey = Object.create(null);
    allSpecs.forEach(function(spec) {
      var key = String(spec.SpecKey || spec.ID);
      var revision = Number(spec.Revision) || 1;
      if (!latestByKey[key] || revision > (Number(latestByKey[key].Revision) || 1)) latestByKey[key] = spec;
    });
    var specs = Object.keys(latestByKey).map(function(key) { return latestByKey[key]; })
      .filter(function(spec) { return String(spec.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'; });
    if (!specs.length) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای این پروژه مشخصات فعال مصرف ملزومات تعریف نشده است.');

    var needs = GoogleSheetsRepository.getAll('18_MaterialNeeds').filter(function(need) {
      return String(need.TenantID) === String(user.TenantID) && String(need.ProjectID) === String(projectId);
    });
    var results = [];
    var self = this;
    specs.forEach(function(spec) {
      var existingNeed = needs.find(function(need) {
        return String(need.MaterialSpecID || '') === String(spec.ID) &&
          String(need.NeedType || '').toUpperCase() === 'CONFIRMED' &&
          ['CANCELLED', 'SUPERSEDED', 'DELETED'].indexOf(String(need.Status || 'ACTIVE').toUpperCase()) === -1;
      }) || null;
      if (!existingNeed) {
        var priorSpecIds = allSpecs.filter(function(priorSpec) {
          return String(priorSpec.SpecKey || priorSpec.ID) === String(spec.SpecKey || spec.ID) &&
            String(priorSpec.ID) !== String(spec.ID);
        }).map(function(priorSpec) { return String(priorSpec.ID); });
        var priorNeed = needs.find(function(need) {
          return priorSpecIds.indexOf(String(need.MaterialSpecID || '')) !== -1 &&
            String(need.NeedType || '').toUpperCase() === 'CONFIRMED' &&
            String(need.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
        });
        if (priorNeed) {
          GoogleSheetsRepository.updateById('18_MaterialNeeds', priorNeed.ID, Object.assign({}, priorNeed, {
            Status: 'SUPERSEDED', UpdatedAt: self._now_(),
            Notes: String(priorNeed.Notes || '') + ' | نسخه مشخصات مصرف جایگزین شد'
          }));
        }
      }
      var estimatedNeed = needs.find(function(need) {
        return String(need.MaterialSpecKey || '') === String(spec.SpecKey || spec.ID) &&
          String(need.NeedType || '').toUpperCase() === 'ESTIMATED' &&
          String(need.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
      });
      if (estimatedNeed) {
        GoogleSheetsRepository.updateById('18_MaterialNeeds', estimatedNeed.ID, Object.assign({}, estimatedNeed, {
          Status: 'SUPERSEDED', UpdatedAt: self._now_(),
          Notes: String(estimatedNeed.Notes || '') + ' | نیاز قطعی ثبت شد'
        }));
      }
      var previousQuantity = existingNeed ? Number(existingNeed.RequestedQuantity) || 0 : 0;
      var key = [String(user.TenantID), String(projectId), String(sourceEventId),
        String(spec.SpecKey || spec.ID), String(spec.Revision || 1), String(quantity)].join('|');
      var calcResponse = self.recordCalculation({
        ProjectID: projectId, MaterialSpecID: spec.ID,
        MaterialNeedID: existingNeed ? existingNeed.ID : '',
        SourceEventID: sourceEventId, SourceEventVersion: sourceEventVersion || '',
        CalculationKey: key, BasisQuantity: quantity,
        ConsumptionPerUnit: spec.ConsumptionPerUnit, WastagePercent: spec.WastagePercent || 0,
        PreviousCalculatedQuantity: previousQuantity, CalculationType: 'CONFIRMED'
      }, params);
      var calculation = calcResponse && calcResponse.data ? calcResponse.data : calcResponse;
      var now = self._now_();
      var needRecord = existingNeed ? Object.assign({}, existingNeed, {
        SourceEventID: sourceEventId, ItemName: spec.ItemName, ItemCode: spec.ItemCode,
        Unit: spec.Unit, RequestedQuantity: calculation.CalculatedQuantity, Status: 'ACTIVE',
        Notes: 'محاسبه‌شده بر اساس تعداد قطعی ' + quantity, UpdatedAt: now,
        MaterialSpecKey: String(spec.SpecKey || spec.ID), SpecificationRevision: spec.Revision || 1, CalculationID: calculation.ID,
        BasisQuantity: quantity, NeedType: 'CONFIRMED', CalculationKey: key
      }) : {
        ID: self._id_('NEED'), TenantID: user.TenantID, ProjectID: String(projectId),
        SourceEventID: sourceEventId, ItemName: spec.ItemName, ItemCode: spec.ItemCode,
        Unit: spec.Unit, RequestedQuantity: calculation.CalculatedQuantity, NeededBy: '',
        Status: 'ACTIVE', Notes: 'محاسبه‌شده بر اساس تعداد قطعی ' + quantity,
        CreatedBy: user.ID, CreatedAt: now, UpdatedAt: now,
        MaterialSpecID: spec.ID, MaterialSpecKey: String(spec.SpecKey || spec.ID), SpecificationRevision: spec.Revision || 1,
        CalculationID: calculation.ID, BasisQuantity: quantity,
        NeedType: 'CONFIRMED', CalculationKey: key
      };
      if (existingNeed) GoogleSheetsRepository.updateById('18_MaterialNeeds', existingNeed.ID, needRecord);
      else {
        GoogleSheetsRepository.insert('18_MaterialNeeds', needRecord);
        needs.push(needRecord);
      }
      GoogleSheetsRepository.updateById(self.SHEETS.CALCULATIONS, calculation.ID,
        Object.assign({}, calculation, { MaterialNeedID: needRecord.ID }));
      results.push({
        MaterialNeedID: needRecord.ID, MaterialSpecID: spec.ID, ItemName: spec.ItemName,
        Unit: spec.Unit, RequestedQuantity: calculation.CalculatedQuantity,
        PreviousQuantity: previousQuantity, VarianceQuantity: calculation.CalculatedQuantity - previousQuantity,
        CalculationID: calculation.ID, IdempotentReplay: calculation.IdempotentReplay === true
      });
    });
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID, Action: 'RECALCULATE',
      EntityType: 'PROJECT_MATERIAL_NEEDS', EntityID: String(projectId),
      NewData: { SourceEventID: sourceEventId, BasisQuantity: quantity, Results: results }
    });
    return Response.success({ ProjectID: String(projectId), SourceEventID: sourceEventId,
      BasisQuantity: quantity, items: results });
  },


  markEventVoided: function(eventId, params) {
    var user = this._user_(params);
    Validator.required(eventId, 'شناسه رویداد');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'ثبت وضعیت نیازهای متاثر از ابطال رویداد با عملیات دیگری تداخل دارد.');
    }
    try {
      var calculations = GoogleSheetsRepository.getAll(this.SHEETS.CALCULATIONS).filter(function(row) {
        return String(row.TenantID) === String(user.TenantID) &&
          String(row.SourceEventID || '') === String(eventId) &&
          String(row.Status || '').toUpperCase() !== 'SOURCE_EVENT_VOIDED';
      });
      var affected = Object.create(null);
      calculations.forEach(function(row) {
        GoogleSheetsRepository.updateById(this.SHEETS.CALCULATIONS, row.ID, Object.assign({}, row, {
          Status: 'SOURCE_EVENT_VOIDED'
        }));
        if (row.MaterialNeedID) affected[String(row.MaterialNeedID)] = true;
      }, this);
      var needs = GoogleSheetsRepository.getAll('18_MaterialNeeds').filter(function(need) {
        return String(need.TenantID) === String(user.TenantID) &&
          String(need.SourceEventID || '') === String(eventId) &&
          String(need.NeedType || '').toUpperCase() === 'CONFIRMED' &&
          String(need.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
      });
      needs.forEach(function(need) {
        GoogleSheetsRepository.updateById('18_MaterialNeeds', need.ID, Object.assign({}, need, {
          Status: 'NEEDS_REVIEW',
          UpdatedAt: this._now_(),
          Notes: String(need.Notes || '') + ' | رویداد مبنا باطل شده؛ نیاز باید با رویداد معتبر جدید بازبینی شود'
        }));
      }, this);
      AuditService.log({
        TenantID: user.TenantID, UserID: user.ID, Action: 'SOURCE_EVENT_VOIDED',
        EntityType: 'PROJECT_MATERIAL_NEEDS', EntityID: String(eventId),
        NewData: { AffectedCalculationCount: calculations.length, AffectedNeedCount: needs.length }
      });
      return Response.success({ EventID: String(eventId), AffectedCalculationCount: calculations.length, AffectedNeedCount: needs.length });
    } finally {
      lock.releaseLock();
    }
  },

};