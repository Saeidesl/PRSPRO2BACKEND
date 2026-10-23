const EventTypeService = {

  ARRAY_FIELDS: [
    'AllowedDepartmentIDs',
    'AllowedUserIDs',
    'AvailableDepartmentIDs'
  ],

  _toBoolean_: function(value) {
    return value === true ||
      String(value).toLowerCase() === 'true';
  },

  _parseArray_: function(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];

    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },

  _normalize_: function(eventType) {
    if (!eventType) return eventType;

    const result = Object.assign({}, eventType);
    result.ConnectionType = String(result.ConnectionType || 'PROJECT').toUpperCase() === 'INDEPENDENT' ? 'INDEPENDENT' : 'PROJECT';
    const self = this;

    this.ARRAY_FIELDS.forEach(function(field) {
      result[field] = self._parseArray_(result[field]);
    });

    result.MovesProjectToStep =
      this._toBoolean_(result.MovesProjectToStep);

    result.AllowAttachments =
      this._toBoolean_(result.AllowAttachments);

    result.AllowVoid =
      this._toBoolean_(result.AllowVoid);
    result.UseProjectColors = this._toBoolean_(result.UseProjectColors);
    result.UseProjectSizes = this._toBoolean_(result.UseProjectSizes);
    result.TrackVariantQuantity = this._toBoolean_(result.TrackVariantQuantity);
    result.IsWorkCompletion = this._toBoolean_(result.IsWorkCompletion);

    return result;
  },

  _prepareForStorage_: function(data) {
    const result = Object.assign({}, data);
    const self = this;

    this.ARRAY_FIELDS.forEach(function(field) {
      if (result[field] !== undefined) {
        result[field] = JSON.stringify(
          self._parseArray_(result[field])
        );
      }
    });

    [
      'MovesProjectToStep',
      'AllowAttachments',
      'AllowVoid',
      'UseProjectColors',
      'UseProjectSizes',
      'TrackVariantQuantity',
      'IsWorkCompletion'
    ].forEach(function(field) {
      if (result[field] !== undefined) {
        result[field] = self._toBoolean_(result[field]);
      }
    });

    return result;
  },

  _validateDepartmentReference_: function(id, tenantId, fieldName) {
    if (!id) return;

    const department = DepartmentRepository.findById(id);

    if (
      !department ||
      String(department.TenantID) !== String(tenantId)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'واحد انتخاب‌شده معتبر نیست: ' + fieldName
      );
    }
  },

  // بررسی اعتبار وضعیت مقصد پروژه
  _validateProjectStatusReference_: function(code, tenantId) {
    if (
      code === undefined ||
      code === null ||
      String(code).trim() === ''
    ) {
      return;
    }

    const requestedCode = String(code).trim();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('18_ProjectStatuses');

    if (!sheet) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'شیت وضعیت‌های پروژه پیدا نشد: 18_ProjectStatuses'
      );
    }

    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'وضعیت پروژه انتخاب‌شده معتبر یا فعال نیست.'
      );
    }

    const headers = values[0].map(function(header) {
      return String(header).trim();
    });

    const codeIndex = headers.indexOf('Code');
    const tenantIndex = headers.indexOf('TenantID');
    const statusIndex = headers.indexOf('Status');

    if (
      codeIndex === -1 ||
      tenantIndex === -1 ||
      statusIndex === -1
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'ساختار شیت وضعیت‌های پروژه معتبر نیست.'
      );
    }

    const found = values.slice(1).some(function(row) {
      return (
        String(row[codeIndex]).trim() === requestedCode &&
        String(row[tenantIndex]) === String(tenantId) &&
        String(row[statusIndex]).trim().toUpperCase() === 'ACTIVE'
      );
    });

    if (!found) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'وضعیت مقصد انتخاب‌شده وجود ندارد، غیرفعال است یا متعلق به این مجموعه نیست.'
      );
    }
  },

  _validateReferences_: function(data, tenantId) {
    const self = this;

    if (data.TargetDepartmentID) {
      this._validateDepartmentReference_(
        data.TargetDepartmentID,
        tenantId,
        'TargetDepartmentID'
      );
    }

    if (data.DepartmentID) {
      this._validateDepartmentReference_(
        data.DepartmentID,
        tenantId,
        'DepartmentID'
      );
    }

    if (data.WorkflowStepID) {
      const step = WorkflowStepRepository.findById(
        data.WorkflowStepID
      );

      if (
        !step ||
        String(step.TenantID) !== String(tenantId)
      ) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'مرحله گردش‌کار مورد نظر پیدا نشد.'
        );
      }
    }

    // اعتبارسنجی وضعیت مقصد
    if (
      data.TargetProjectStatus !== undefined &&
      data.TargetProjectStatus !== null &&
      String(data.TargetProjectStatus).trim() !== ''
    ) {
      this._validateProjectStatusReference_(
        data.TargetProjectStatus,
        tenantId
      );
    }

    this.ARRAY_FIELDS.forEach(function(field) {
      if (data[field] === undefined) return;

      const ids = self._parseArray_(data[field]);

      ids.forEach(function(id) {
        if (field === 'AllowedUserIDs') {
          const user = UserRepository.findById(id);

          if (
            !user ||
            String(user.TenantID) !== String(tenantId)
          ) {
            throw ErrorHandler.create(
              Constants.ERROR.NOT_FOUND,
              'کاربر انتخاب‌شده معتبر نیست.'
            );
          }
        } else {
          self._validateDepartmentReference_(
            id,
            tenantId,
            field
          );
        }
      });
    });
  },

  list: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const isAdmin = AccessControlService.isAdmin(user);
    const canManageTypes = !isAdmin &&
      PermissionService.hasPermission(user.ID, 'EVENT_TYPE_MANAGE');
    const departmentId = String(user.DepartmentID || '');

    const eventTypes = EventTypeRepository.getAll();

    const filtered = eventTypes.filter(function(eventType) {
      if (String(eventType.TenantID) !== String(user.TenantID)) {
        return false;
      }

      if (isAdmin || canManageTypes) return true;

      if (String(eventType.Status || '').toUpperCase() !== 'ACTIVE') {
        return false;
      }

      const allowedDepartments =
        EventTypeService._parseArray_(
          eventType.AllowedDepartmentIDs
        );

      const allowedUsers =
        EventTypeService._parseArray_(
          eventType.AllowedUserIDs
        );

      if (allowedDepartments.length || allowedUsers.length) {
        return allowedDepartments.some(function(id) {
          return String(id) === departmentId;
        }) || allowedUsers.some(function(id) {
          return String(id) === String(user.ID);
        });
      }

      return !eventType.DepartmentID ||
        String(eventType.DepartmentID) === departmentId;
    }).map(function(eventType) {
      return EventTypeService._normalize_(eventType);
    });

    return Response.success({
      items: filtered,
      total: filtered.length
    });
  },

  get: function(id, params) {
    Validator.id(id, 'EventTypeID');

    const user = AccessControlService.getCurrentUser(params || {});
    const eventType = EventTypeRepository.findById(id);

    if (
      !eventType ||
      String(eventType.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نوع رویداد مورد نظر پیدا نشد.'
      );
    }

    const isAdmin = AccessControlService.isAdmin(user);
    const canManageTypes = !isAdmin &&
      PermissionService.hasPermission(user.ID, 'EVENT_TYPE_MANAGE');

    if (
      !isAdmin &&
      !canManageTypes &&
      String(eventType.Status || '').toUpperCase() !== 'ACTIVE'
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نوع رویداد مورد نظر پیدا نشد.'
      );
    }

    if (!isAdmin && !canManageTypes) {
      const allowedDepartments =
        this._parseArray_(eventType.AllowedDepartmentIDs);

      const allowedUsers =
        this._parseArray_(eventType.AllowedUserIDs);

      const departmentId = String(user.DepartmentID || '');
      const permitted =
        allowedDepartments.length || allowedUsers.length
          ? (
              allowedDepartments.some(function(departmentIdAllowed) {
                return String(departmentIdAllowed) === departmentId;
              }) ||
              allowedUsers.some(function(userId) {
                return String(userId) === String(user.ID);
              })
            )
          : (
              !eventType.DepartmentID ||
              String(eventType.DepartmentID) === departmentId
            );

      if (!permitted) {
        throw ErrorHandler.create(
          Constants.ERROR.PERMISSION_DENIED,
          'شما به این نوع رویداد دسترسی ندارید.'
        );
      }
    }

    return Response.success(this._normalize_(eventType));
  },

  create: function(data, params) {
    const user = AccessControlService.require(
      params || {},
      'EVENT_TYPE_MANAGE'
    );

    EventTypeValidator.validateCreate(data);

    if (!user.TenantID) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'Tenant کاربر مشخص نیست.'
      );
    }

    const eventTypes = EventTypeRepository.getAll();

    const duplicate = eventTypes.some(function(eventType) {
      return String(eventType.TenantID) === String(user.TenantID) &&
        String(eventType.Code) === String(data.Code);
    });

    if (duplicate) {
      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'کد نوع رویداد قبلاً در این Tenant ثبت شده است.'
      );
    }

    this._validateReferences_(data, user.TenantID);

    const now = new Date().toISOString();

    const eventType = {
      ID: Constants.ID_PREFIX.EVENT_TYPE + '_' +
        Utilities.getUuid().replace(/-/g, ''),
      TenantID: user.TenantID,
      Name: data.Name,
      Code: data.Code,
      ConnectionType: String(data.ConnectionType || 'PROJECT').toUpperCase() === 'INDEPENDENT' ? 'INDEPENDENT' : 'PROJECT',
      Version: data.Version || 1,
      Description: data.Description || '',
      DepartmentID: data.DepartmentID || '',
      Category: data.Category || '',
      WorkflowStepID: data.WorkflowStepID || '',
      MovesProjectToStep: this._toBoolean_(
        data.MovesProjectToStep
      ),
      AllowAttachments: this._toBoolean_(
        data.AllowAttachments
      ),
      TargetDepartmentID: data.TargetDepartmentID || '',
      TargetProjectStatus: data.TargetProjectStatus || '',
      TargetStepStatus: data.TargetStepStatus || '',
      AllowedDepartmentIDs: this._parseArray_(
        data.AllowedDepartmentIDs
      ),
      AllowedUserIDs: this._parseArray_(
        data.AllowedUserIDs
      ),
      AvailableDepartmentIDs: this._parseArray_(
        data.AvailableDepartmentIDs
      ),
      AllowVoid: this._toBoolean_(data.AllowVoid),
      UseProjectColors: this._toBoolean_(data.UseProjectColors),
      UseProjectSizes: this._toBoolean_(data.UseProjectSizes),
      TrackVariantQuantity: this._toBoolean_(data.TrackVariantQuantity),
      Status: data.Status || Constants.STATUS.ACTIVE,
      CreatedAt: now,
      UpdatedAt: now
    };

    const stored = this._prepareForStorage_(eventType);
    const created = EventTypeRepository.insert(stored);

    AuditService.log({
      TenantID: user.TenantID,
      UserID: user.ID,
      Action: Constants.ACTION.CREATE,
      EntityType: Constants.ENTITY.EVENT_TYPE,
      EntityID: created.ID,
      OldData: null,
      NewData: created,
      Reason: 'ایجاد نوع رویداد'
    });

    return Response.success(this._normalize_(created), {
      message: 'نوع رویداد با موفقیت ایجاد شد.'
    });
  },

  update: function(id, data, params) {
    Validator.id(id, 'EventTypeID');

    const user = AccessControlService.require(
      params || {},
      'EVENT_TYPE_MANAGE'
    );

    EventTypeValidator.validateUpdate(data);

    const existing = EventTypeRepository.findById(id);

    if (
      !existing ||
      String(existing.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نوع رویداد مورد نظر پیدا نشد.'
      );
    }

    if (
      data.Code !== undefined &&
      String(data.Code) !== String(existing.Code)
    ) {
      const eventTypes = EventTypeRepository.getAll();

      const duplicate = eventTypes.some(function(eventType) {
        return String(eventType.ID) !== String(id) &&
          String(eventType.TenantID) === String(user.TenantID) &&
          String(eventType.Code) === String(data.Code);
      });

      if (duplicate) {
        throw ErrorHandler.create(
          Constants.ERROR.DUPLICATE,
          'کد نوع رویداد قبلاً در این Tenant ثبت شده است.'
        );
      }
    }

    this._validateReferences_(data, user.TenantID);

    if (data.ConnectionType !== undefined) {
      data.ConnectionType = String(data.ConnectionType || 'PROJECT').toUpperCase();
    }

    const updateData = {};

    Object.keys(data).forEach(function(key) {
      if (
        key !== 'ID' &&
        key !== 'TenantID' &&
        key !== 'CreatedAt'
      ) {
        updateData[key] = data[key];
      }
    });

    const prepared = this._prepareForStorage_(updateData);
    prepared.UpdatedAt = new Date().toISOString();

    const updated = EventTypeRepository.update(id, prepared);

    AuditService.log({
      TenantID: user.TenantID,
      UserID: user.ID,
      Action: Constants.ACTION.UPDATE,
      EntityType: Constants.ENTITY.EVENT_TYPE,
      EntityID: id,
      OldData: existing,
      NewData: updated,
      Reason: data.Reason || 'ویرایش نوع رویداد'
    });

    return Response.success(this._normalize_(updated), {
      message: 'نوع رویداد با موفقیت ویرایش شد.'
    });
  }
};