const DesignCaseService = {
  _materials_: function(value) {
    if (value === undefined || value === null || value === '') return [];
    var parsed;
    try {
      parsed = typeof value === 'string' ? JSON.parse(value) : value;
    } catch (error) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار فهرست ملزومات معتبر نیست.');
    }
    if (!Array.isArray(parsed) || parsed.length > 300) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست ملزومات معتبر نیست.');
    }
    return parsed.map(function(row) {
      row = row || {};
      var name = String(row.ItemName || row.name || '').trim();
      var unit = String(row.Unit || row.unit || '').trim();
      var quantity = row.RequiredQuantity !== undefined ? row.RequiredQuantity : row.quantity;
      if (!name || name.length > 160 || !unit || unit.length > 40 ||
          quantity === '' || quantity === undefined || quantity === null ||
          !isFinite(Number(quantity)) || Number(quantity) <= 0) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'هر قلم ملزومات باید نام، واحد و مقدار معتبر داشته باشد.');
      }
      return {
        ItemName: name,
        ItemCode: String(row.ItemCode || row.code || '').trim().substring(0, 80),
        Unit: unit,
        RequiredQuantity: Number(quantity),
        Description: String(row.Description || row.description || '').trim().substring(0, 500)
      };
    });
  },

  _visible_: function(record, user) {
    return !!record && String(record.TenantID) === String(user.TenantID);
  },

  _history_: function(record, action, fromStatus, toStatus, reason, user, key) {
    return DesignCaseHistoryRepository.insert({
      ID: 'DCH_' + Utilities.getUuid().replace(/-/g, ''),
      TenantID: record.TenantID,
      DesignCaseID: record.ID,
      Revision: Number(record.Revision || 1),
      Action: action,
      FromStatus: fromStatus || '',
      ToStatus: toStatus || '',
      Reason: reason || '',
      SnapshotJSON: JSON.stringify(record),
      ActorUserID: user.ID,
      CreatedAt: new Date().toISOString(),
      IdempotencyKey: key || ''
    });
  },

  list: function(params) {
    var user = AccessControlService.getCurrentUser(params || {});
    var records = (DesignCaseRepository.getAll() || []).filter(function(row) {
      return String(row.TenantID) === String(user.TenantID);
    });
    return Response.success(records);
  },

  get: function(id, params) {
    Validator.required(id, 'شناسه پرونده طرح');
    var user = AccessControlService.getCurrentUser(params || {});
    var record = DesignCaseRepository.findById(id);
    if (!this._visible_(record, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پرونده طرح مورد نظر پیدا نشد.');
    }
    var result = Object.assign({}, record);
    try { result.RequiredMaterials = JSON.parse(String(record.RequiredMaterialsJSON || '[]')); }
    catch (e) { result.RequiredMaterials = []; }
    result.History = DesignCaseHistoryRepository.findByDesignCaseId(id)
      .filter(function(row) { return String(row.TenantID) === String(user.TenantID); });
    return Response.success(result);
  },

  create: function(body, params) {
    Validator.object(body, 'designCase');
    var user = AccessControlService.getCurrentUser(params || {});
    var title = String(body.Title || body.title || '').trim();
    if (!title || title.length > 200) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام طرح الزامی است و باید حداکثر ۲۰۰ نویسه باشد.');
    }
    var key = String(body.IdempotencyKey || '').trim();
    if (key.length > 120) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه یکتای درخواست بیش از حد طولانی است.');
    var lock = LockService.getUserLock();
    lock.waitLock(30000);
    try {
      if (key) {
        var existing = (DesignCaseRepository.getAll() || []).find(function(row) {
          return String(row.TenantID) === String(user.TenantID) &&
            String(row.CreatedBy) === String(user.ID) && String(row.IdempotencyKey || '') === key;
        });
        if (existing) return Response.success(existing, {message:'این پرونده قبلاً ایجاد شده است.', idempotentReplay:true});
      }
      var materials = this._materials_(body.RequiredMaterials !== undefined ? body.RequiredMaterials : body.RequiredMaterialsJSON);
      var now = new Date().toISOString();
      var record = {
        ID: 'DSN_' + Utilities.getUuid().replace(/-/g, ''),
        TenantID: user.TenantID,
        Title: title,
        Description: String(body.Description || body.description || '').trim().substring(0, 2000),
        Status: 'DRAFT',
        Phase: 'DESIGN_PREPRODUCTION',
        RequiredMaterialsJSON: JSON.stringify(materials),
        PrimaryImageAttachmentID: '',
        WorkflowID: '',
        CurrentStepID: '',
        CreatedBy: user.ID,
        CreatedAt: now,
        UpdatedAt: now,
        Revision: 1,
        ApprovedAt: '',
        ApprovedBy: '',
        RejectionReason: '',
        IdempotencyKey: key,
        ProductionProjectID: '',
        ApprovalIdempotencyKey: '',
        ApprovalStatus: ''
      };
      var created = DesignCaseRepository.insert(record);
      this._history_(created, 'CREATED', '', 'DRAFT', '', user, key);
      AuditService.log({TenantID:user.TenantID, UserID:user.ID, Action:Constants.ACTION.CREATE,
        EntityType:'DESIGN_CASE', EntityID:created.ID, NewData:created, Reason:'ایجاد پرونده طرح و پیش‌تولید'});
      created.RequiredMaterials = materials;
      return Response.success(created, {message:'پرونده طرح ایجاد شد.'});
    } finally { lock.releaseLock(); }
  },

  approve: function(id, body, params) {
    Validator.required(id, 'شناسه پرونده طرح');
    Validator.object(body, 'productionDetails');
    var user = AccessControlService.getCurrentUser(params || {});
    var key = String(body.IdempotencyKey || '').trim();
    if (!key || key.length > 120) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه یکتای تأیید الزامی است.');
    }
    var projectCode = String(body.ProjectCode || '').trim();
    var quantity = Number(body.Quantity);
    if (!projectCode || projectCode.length > 100 || !isFinite(quantity) || quantity < 1 || Math.floor(quantity) !== quantity) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کد پروژه و تعداد تولید معتبر الزامی است.');
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var record = DesignCaseRepository.findById(id);
      if (!this._visible_(record, user)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پرونده طرح مورد نظر پیدا نشد.');
      }
      if (String(record.Status || '') === 'APPROVED' && record.ProductionProjectID) {
        var approvedProject = ProjectRepository.findById(record.ProductionProjectID);
        if (!approvedProject || String(approvedProject.TenantID) !== String(user.TenantID)) {
          throw ErrorHandler.create(Constants.ERROR.INTERNAL_ERROR, 'پرونده تأیید شده است اما پروژه تولیدی مرتبط پیدا نشد؛ نیازمند بررسی است.');
        }
        return Response.success({designCase:record, project:approvedProject, idempotentReplay:true},
          {message:'این پرونده قبلاً به تولید تبدیل شده است.'});
      }
      if (String(record.Status || '') !== 'READY_FOR_APPROVAL') {
        throw ErrorHandler.create(Constants.ERROR.INVALID_STATUS, 'ورود به تولید فقط پس از ثبت رویداد تأییدشده و رسیدن پرونده به مرحله آماده تأیید مجاز است.');
      }
      if (record.ApprovalIdempotencyKey && String(record.ApprovalIdempotencyKey) !== key) {
        throw ErrorHandler.create(Constants.ERROR.INVALID_STATUS, 'برای این پرونده قبلاً عملیات تأیید آغاز شده است؛ از ثبت درخواست جدید خودداری کنید.');
      }
      var existingCode = ProjectRepository.findByProjectCode(projectCode);
      if (existingCode && String(existingCode.TenantID) === String(user.TenantID)) {
        if (String(existingCode.DesignCaseID || '') === String(record.ID)) {
          var recovered = DesignCaseRepository.update(id, {
            Status:'APPROVED', Phase:'PRODUCTION', ProductionProjectID:existingCode.ID,
            ApprovalIdempotencyKey:key, ApprovalStatus:'COMPLETED',
            ApprovedAt:existingCode.CreatedAt || new Date().toISOString(), ApprovedBy:user.ID,
            UpdatedAt:new Date().toISOString(), WorkflowID:existingCode.WorkflowID || ''
          });
          this._history_(recovered, 'APPROVED', record.Status, 'APPROVED', 'بازیابی نتیجه تأیید قبلی', user, key);
          return Response.success({designCase:recovered, project:existingCode, idempotentReplay:true},
            {message:'نتیجه تبدیل قبلی بازیابی شد.'});
        }

        // Recover the narrow partial-failure window where ProjectService.create
        // succeeded but linking DesignCaseID to the new project did not.
        var processingAt = new Date(record.UpdatedAt || 0).getTime();
        var projectCreatedAt = new Date(existingCode.CreatedAt || 0).getTime();
        var requestedTitle = String(body.Title || record.Title).trim();
        var recoverableOrphan = String(record.ApprovalStatus || '').toUpperCase() === 'PROCESSING' &&
          String(record.ApprovalIdempotencyKey || '') === key &&
          !String(existingCode.DesignCaseID || '').trim() &&
          String(existingCode.CreatedBy || '') === String(user.ID) &&
          String(existingCode.Title || '').trim() === requestedTitle &&
          Number(existingCode.Quantity) === quantity &&
          processingAt > 0 && projectCreatedAt >= processingAt;
        if (recoverableOrphan) {
          var linkedProject = ProjectRepository.update(existingCode.ID, {
            DesignCaseID: record.ID, RunNumber: 1, SourceProjectID: ''
          });
          if (!linkedProject || String(linkedProject.DesignCaseID || '') !== String(record.ID)) {
            throw ErrorHandler.create(Constants.ERROR.INTERNAL_ERROR, 'پروژه تولید پیدا شد اما اتصال آن به پرونده طرح تأیید نشد؛ از ثبت مجدد با کد جدید خودداری کنید.');
          }
          var recoveredCase = DesignCaseRepository.update(id, {
            Status:'APPROVED', Phase:'PRODUCTION', ProductionProjectID:linkedProject.ID,
            ApprovalIdempotencyKey:key, ApprovalStatus:'COMPLETED',
            ApprovedAt:linkedProject.CreatedAt || new Date().toISOString(), ApprovedBy:user.ID,
            UpdatedAt:new Date().toISOString(), WorkflowID:linkedProject.WorkflowID || ''
          });
          this._history_(recoveredCase, 'APPROVED', record.Status, 'APPROVED', 'بازیابی پروژه ایجادشده پس از قطع اتصال پرونده', user, key);
          AuditService.log({TenantID:user.TenantID, UserID:user.ID, Action:Constants.ACTION.UPDATE,
            EntityType:'DESIGN_CASE', EntityID:id, OldData:record, NewData:recoveredCase,
            Reason:'بازیابی اتصال پروژه تولیدی ایجادشده قبلی'});
          return Response.success({designCase:recoveredCase, project:linkedProject, idempotentReplay:true},
            {message:'پروژه تولیدی قبلی با موفقیت بازیابی و به پرونده متصل شد.'});
        }
        throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'کد پروژه قبلاً استفاده شده است.');
      }
      var processingRecord = DesignCaseRepository.update(id, {
        ApprovalIdempotencyKey:key, ApprovalStatus:'PROCESSING', UpdatedAt:new Date().toISOString()
      });
      if (!processingRecord || String(processingRecord.ApprovalIdempotencyKey || '') !== key ||
          String(processingRecord.ApprovalStatus || '').toUpperCase() !== 'PROCESSING') {
        throw ErrorHandler.create(Constants.ERROR.INTERNAL_ERROR, 'ثبت وضعیت آغاز تأیید ناموفق بود؛ پروژه تولیدی ایجاد نشد.');
      }
      record = processingRecord;
      var projectResponse = ProjectService.create({
        ProjectCode: projectCode,
        Title: String(body.Title || record.Title).trim(),
        Description: String(body.Description !== undefined ? body.Description : record.Description || ''),
        Quantity: quantity,
        ColorSizeJSON: body.ColorSizeJSON || JSON.stringify({colors:[],sizes:[]}),
        WorkflowID: body.WorkflowID,
        AvailableDepartmentIDs: body.AvailableDepartmentIDs,
        AllowedUserIDs: body.AllowedUserIDs || [],
        NotifyEnabled: body.NotifyEnabled === undefined ? true : body.NotifyEnabled,
        Status: body.Status || ''
      }, params || {});
      if (!projectResponse || projectResponse.success !== true || !projectResponse.data) {
        throw ErrorHandler.create(Constants.ERROR.INTERNAL_ERROR, 'ایجاد پروژه تولیدی کامل نشد.');
      }
      var project = ProjectRepository.update(projectResponse.data.ID, {
        DesignCaseID: record.ID,
        RunNumber: 1,
        SourceProjectID: ''
      });
      // Never mark the design case approved unless the production link was persisted.
      if (!project ||
          String(project.ID || '') !== String(projectResponse.data.ID || '') ||
          String(project.DesignCaseID || '') !== String(record.ID) ||
          Number(project.RunNumber) !== 1 ||
          String(project.SourceProjectID || '') !== '') {
        throw ErrorHandler.create(Constants.ERROR.INTERNAL_ERROR,
          'پروژه تولیدی ایجاد شد اما اتصال آن به پرونده طرح تأیید نشد؛ درخواست را با همان کلید تأیید دوباره بررسی کنید.');
      }
      var now = new Date().toISOString();
      var approved = DesignCaseRepository.update(id, {
        Status:'APPROVED', Phase:'PRODUCTION', ProductionProjectID:project.ID,
        ApprovalIdempotencyKey:key, ApprovalStatus:'COMPLETED',
        ApprovedAt:now, ApprovedBy:user.ID, UpdatedAt:now, WorkflowID:project.WorkflowID || body.WorkflowID
      });
      this._history_(approved, 'APPROVED', record.Status, 'APPROVED', '', user, key);
      AuditService.log({TenantID:user.TenantID, UserID:user.ID, Action:Constants.ACTION.UPDATE,
        EntityType:'DESIGN_CASE', EntityID:id, OldData:record, NewData:approved,
        Reason:'تبدیل پرونده طرح به اولین اجرای تولید'});
      return Response.success({designCase:approved, project:project},
        {message:'پرونده با موفقیت به پروژه تولیدی تبدیل شد.'});
    } finally { lock.releaseLock(); }
  },

  update: function(id, body, params) {
    Validator.required(id, 'شناسه پرونده طرح');
    Validator.object(body, 'designCase');
    var user = AccessControlService.getCurrentUser(params || {});
    var lock = LockService.getUserLock();
    lock.waitLock(30000);
    try {
      var current = DesignCaseRepository.findById(id);
      if (!this._visible_(current, user)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پرونده طرح مورد نظر پیدا نشد.');
      }
      if (String(current.Status || '') === 'APPROVED') {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'پرونده تأییدشده فقط از مسیر سفارش تولید قابل استفاده است.');
      }
      if (body.ExpectedRevision !== undefined && Number(body.ExpectedRevision) !== Number(current.Revision || 1)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'پرونده توسط کاربر دیگری تغییر کرده است؛ صفحه را تازه‌سازی کنید.');
      }
      var patch = {UpdatedAt:new Date().toISOString(), Revision:Number(current.Revision || 1) + 1};
      if (body.Title !== undefined) {
        var title = String(body.Title || '').trim();
        if (!title || title.length > 200) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام طرح معتبر نیست.');
        patch.Title = title;
      }
      if (body.Description !== undefined) patch.Description = String(body.Description || '').trim().substring(0, 2000);
      if (body.RequiredMaterials !== undefined || body.RequiredMaterialsJSON !== undefined) {
        patch.RequiredMaterialsJSON = JSON.stringify(this._materials_(body.RequiredMaterials !== undefined ? body.RequiredMaterials : body.RequiredMaterialsJSON));
      }
      if (body.Status !== undefined && String(body.Status) !== String(current.Status || '')) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تغییر وضعیت فقط از طریق ثبت رویداد تنظیم‌شده مجاز است.');
      }
      var updated = DesignCaseRepository.update(id, patch);
      this._history_(updated, 'UPDATED', current.Status, updated.Status, String(body.Reason || '').substring(0,500), user, '');
      AuditService.log({TenantID:user.TenantID, UserID:user.ID, Action:Constants.ACTION.UPDATE,
        EntityType:'DESIGN_CASE', EntityID:id, OldData:current, NewData:updated, Reason:'ویرایش پرونده طرح'});
      updated.RequiredMaterials = JSON.parse(String(updated.RequiredMaterialsJSON || '[]'));
      return Response.success(updated, {message:'پرونده طرح به‌روزرسانی شد.'});
    } finally { lock.releaseLock(); }
  }
};
