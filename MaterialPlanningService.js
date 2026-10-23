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
    return AccessControlService.getCurrentUser(params || {});
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
    var policy = String(body.EarlyOrderPolicy || 'DISABLED').trim().toUpperCase();
    if (['DISABLED', 'ESTIMATE_ALLOWED', 'MANUAL_ALLOWED'].indexOf(policy) === -1) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'سیاست سفارش زودهنگام معتبر نیست.');
    }
    var earlyQuantity = '';
    if (policy === 'MANUAL_ALLOWED') {
      earlyQuantity = this._number_(body.EarlyOrderQuantity, 'مقدار سفارش زودهنگام', 0.0000001, null);
    } else if (body.EarlyOrderQuantity !== undefined && String(body.EarlyOrderQuantity).trim() !== '') {
      earlyQuantity = this._number_(body.EarlyOrderQuantity, 'مقدار سفارش زودهنگام', 0, null);
    }

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
      ItemCode: String(body.ItemCode || ('MAT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase())),
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
    var input = Object.assign({}, current, body);
    input.SpecKey = String(current.SpecKey || current.ID);
    var all = this._specsForProject_(current.ProjectID, user.TenantID).filter(function(row) {
      return String(row.SpecKey || row.ID) === input.SpecKey;
    });
    var latestRevision = all.reduce(function(max, row) {
      return Math.max(max, Number(row.Revision) || 1);
    }, 1);
    if (Number(current.Revision || 1) !== latestRevision) {
      throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'این نسخه دیگر آخرین نسخه نیست؛ اطلاعات را تازه‌سازی کنید.');
    }

    // Create a new immutable revision. The list endpoint selects the highest revision,
    // so a failure while superseding the previous row cannot hide the new version.
    var createdResponse = this.createSpecification(current.ProjectID, {
      ItemName: input.ItemName,
      ItemCode: input.ItemCode,
      Unit: input.Unit,
      ConsumptionPerUnit: input.ConsumptionPerUnit,
      WastagePercent: input.WastagePercent,
      EarlyOrderPolicy: input.EarlyOrderPolicy,
      EarlyOrderQuantity: input.EarlyOrderQuantity,
      Notes: input.Notes,
      SpecKey: input.SpecKey + '_R' + (latestRevision + 1)
    }, params);
    var created = createdResponse && createdResponse.data ? createdResponse.data : createdResponse;
    created.SpecKey = input.SpecKey;
    created.Revision = latestRevision + 1;
    GoogleSheetsRepository.updateById(this.SHEETS.SPECS, created.ID, created);
    var previous = Object.assign({}, current, { Status: 'SUPERSEDED', UpdatedAt: this._now_() });
    GoogleSheetsRepository.updateById(this.SHEETS.SPECS, current.ID, previous);
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID, Action: 'REVISE',
      EntityType: 'PROJECT_MATERIAL_SPEC', EntityID: created.ID,
      OldData: current, NewData: created, Reason: 'ایجاد نسخه جدید مشخصات مصرف'
    });
    return Response.success(created);
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
    var calculated = Math.ceil(basis * consumption * (1 + wastage / 100) * 10000) / 10000;
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
  }
};
