/**
 * Project Status Service
 * مدیریت وضعیت‌های قابل تنظیم پروژه
 */

const ProjectStatusService = {

  SHEET_NAME: '18_ProjectStatuses',

  HEADERS: [
    'ID',
    'TenantID',
    'Code',
    'Name',
    'Status',
    'CreatedAt',
    'UpdatedAt'
  ],

  /**
   * بررسی هویت کاربر و مجوز مدیریت وضعیت‌های پروژه
   */
  _getContext_: function(params) {
    params = params || {};

    const user = AccessControlService.getCurrentUser(params);

    if (!user || !user.TenantID) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'دسترسی معتبر نیست.'
      );
    }

    // مدیر سامانه دسترسی کامل دارد.
    // سایر کاربران باید مجوز مشخص مدیریت وضعیت‌ها را داشته باشند.
    if (!AccessControlService.isAdmin(user)) {
      PermissionService.requirePermission(
        user.ID,
        'PROJECT_STATUS_MANAGE'
      );
    }

    return user;
  },

  /**
   * دریافت شیت وضعیت‌های پروژه
   */
  _getSheet_: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss && ss.getSheetByName(this.SHEET_NAME);

    if (!sheet) {
      throw new Error(
        'شیت وضعیت‌های پروژه هنوز ساخته نشده است. ابتدا ارتقای دیتابیس را انجام دهید.'
      );
    }

    return sheet;
  },

  /**
   * خواندن وضعیت‌ها
   */
  _getRows_: function() {
    const sheet = this._getSheet_();
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return [];
    }

    return sheet.getRange(
      2,
      1,
      lastRow - 1,
      this.HEADERS.length
    ).getValues().map(function(row) {
      const item = {};

      ProjectStatusService.HEADERS.forEach(function(header, index) {
        item[header] = row[index];
      });

      return item;
    });
  },

  /**
   * یافتن وضعیت بر اساس شناسه و محدوده سازمان
   */
  _findById_: function(id, tenantId) {
    return this._getRows_().find(function(item) {
      return String(item.ID) === String(id) &&
        String(item.TenantID) === String(tenantId);
    }) || null;
  },

  /**
   * اعتبارسنجی نام وضعیت
   */
  _validateName_: function(name) {
    const value = String(name || '').trim();

    if (!value) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'نام وضعیت را وارد کنید.'
      );
    }

    if (value.length > 100) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'نام وضعیت نباید بیشتر از ۱۰۰ نویسه باشد.'
      );
    }

    return value;
  },

  /**
   * دریافت فهرست وضعیت‌های سازمان
   */
  list: function(params) {
    const user = this._getContext_(params);

    const items = this._getRows_()
      .filter(function(item) {
        return String(item.TenantID) === String(user.TenantID);
      })
      .sort(function(a, b) {
        return String(a.Name).localeCompare(String(b.Name), 'fa');
      });

    return Response.success(items);
  },

  /**
   * ایجاد وضعیت جدید
   */
  create: function(data, params) {
    const user = this._getContext_(params);
    data = data || {};

    const name = this._validateName_(data.Name);
    const rows = this._getRows_();

    const duplicate = rows.some(function(item) {
      return String(item.TenantID) === String(user.TenantID) &&
        String(item.Name).trim().toLowerCase() === name.toLowerCase() &&
        String(item.Status).toUpperCase() === 'ACTIVE';
    });

    if (duplicate) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'یک وضعیت فعال با این نام از قبل وجود دارد.'
      );
    }

    const now = new Date().toISOString();
    const id = Utilities.getUuid().replace(/-/g, '').substring(0, 12);

    const item = {
      ID: 'PST_' + id,
      TenantID: user.TenantID,
      Code: 'PST_' + id.toUpperCase(),
      Name: name,
      Status: 'ACTIVE',
      CreatedAt: now,
      UpdatedAt: now
    };

    this._getSheet_().appendRow(
      this.HEADERS.map(function(header) {
        return item[header];
      })
    );

    if (typeof AuditService !== 'undefined' && AuditService.log) {
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: Constants.ACTION.CREATE,
        EntityType: 'PROJECT_STATUS',
        EntityID: item.ID,
        NewData: item,
        Reason: 'ایجاد وضعیت پروژه'
      });
    }

    return Response.success(item);
  },

  /**
   * ویرایش وضعیت موجود
   */
  update: function(id, data, params) {
    const user = this._getContext_(params);
    data = data || {};

    if (!id) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'شناسه وضعیت مشخص نیست.'
      );
    }

    const sheet = this._getSheet_();
    const rows = this._getRows_();

    const index = rows.findIndex(function(item) {
      return String(item.ID) === String(id) &&
        String(item.TenantID) === String(user.TenantID);
    });

    if (index < 0) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'وضعیت مورد نظر پیدا نشد.'
      );
    }

    const current = rows[index];
    const updated = Object.assign({}, current);

    if (data.Name !== undefined) {
      updated.Name = this._validateName_(data.Name);

      const duplicate = rows.some(function(item) {
        return String(item.ID) !== String(id) &&
          String(item.TenantID) === String(user.TenantID) &&
          String(item.Name).trim().toLowerCase() ===
            updated.Name.toLowerCase() &&
          String(item.Status).toUpperCase() === 'ACTIVE';
      });

      if (duplicate) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'یک وضعیت فعال با این نام از قبل وجود دارد.'
        );
      }
    }

    if (data.Status !== undefined) {
      const status = String(data.Status).trim().toUpperCase();

      if (status !== 'ACTIVE' && status !== 'INACTIVE') {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'وضعیت فقط می‌تواند فعال یا غیرفعال باشد.'
        );
      }

      updated.Status = status;
    }

    // شناسه، کد، سازمان و تاریخ ایجاد قابل تغییر نیستند.
    updated.Code = current.Code;
    updated.ID = current.ID;
    updated.TenantID = current.TenantID;
    updated.CreatedAt = current.CreatedAt;
    updated.UpdatedAt = new Date().toISOString();

    const rowNumber = index + 2;

    sheet.getRange(
      rowNumber,
      1,
      1,
      this.HEADERS.length
    ).setValues([
      this.HEADERS.map(function(header) {
        return updated[header];
      })
    ]);

    if (typeof AuditService !== 'undefined' && AuditService.log) {
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: Constants.ACTION.UPDATE,
        EntityType: 'PROJECT_STATUS',
        EntityID: updated.ID,
        OldData: current,
        NewData: updated,
        Reason: 'ویرایش وضعیت پروژه'
      });
    }

    return Response.success(updated);
  }
};