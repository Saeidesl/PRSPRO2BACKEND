/**
 * Persistent, tenant-scoped print template management.
 * Layouts contain presentation metadata only; project/form values are resolved at print time.
 */
const PrintTemplateService = {
  MAX_LAYOUT_LENGTH: 40000,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,

  _user_: function(params) {
    var user = AccessControlService.getCurrentUser(params || {});
    if (!user || !user.ID || !user.TenantID) {
      throw ErrorHandler.create(Constants.ERROR.UNAUTHORIZED, 'دسترسی معتبر نیست.');
    }
    return user;
  },

  _parseLayout_: function(value) {
    var layout = value;
    if (typeof layout === 'string') {
      try { layout = JSON.parse(layout); }
      catch (error) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار قالب چاپ معتبر نیست.');
      }
    }
    if (!layout || typeof layout !== 'object' || Array.isArray(layout) ||
        !Array.isArray(layout.elements) || layout.elements.length > 200) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'قالب باید شامل فهرست معتبر اجزای چاپ باشد.');
    }
    var normalized = {
      version: Number(layout.version || 2),
      orientation: String(layout.orientation || 'portrait').toLowerCase(),
      elements: layout.elements
    };
    if (normalized.version < 1 || normalized.version > 10 ||
        ['portrait', 'landscape'].indexOf(normalized.orientation) < 0) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نسخه یا جهت صفحه قالب معتبر نیست.');
    }
    var json = JSON.stringify(normalized);
    if (json.length > this.MAX_LAYOUT_LENGTH) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حجم قالب بیش از حد مجاز است. اجزای اضافی را حذف کنید.');
    }
    return { value: normalized, json: json };
  },

  _validateName_: function(value) {
    var name = String(value || '').trim();
    if (!name || name.length > this.MAX_NAME_LENGTH) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام قالب الزامی است و نباید بیشتر از ۱۰۰ نویسه باشد.');
    }
    return name;
  },

  _find_: function(id, tenantId) {
    var item = PrintTemplateRepository.findById(id);
    if (!item || String(item.TenantID) !== String(tenantId) ||
        String(item.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قالب چاپ موردنظر پیدا نشد.');
    }
    return item;
  },

  _public_: function(item) {
    var result = Object.assign({}, item);
    try { result.Layout = JSON.parse(String(item.LayoutJSON || '{}')); }
    catch (error) { result.Layout = {version: 1, orientation: 'portrait', elements: []}; }
    delete result.LayoutJSON;
    return result;
  },

  list: function(params) {
    var user = this._user_(params);
    var items = PrintTemplateRepository.getAll().filter(function(item) {
      return String(item.TenantID) === String(user.TenantID) &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }).sort(function(a, b) {
      return String(a.Name || '').localeCompare(String(b.Name || ''), 'fa');
    });
    return Response.success(items.map(this._public_.bind(this)));
  },

  get: function(id, params) {
    var user = this._user_(params);
    return Response.success(this._public_(this._find_(id, user.TenantID)));
  },

  create: function(data, params) {
    var user = this._user_(params);
    data = data || {};
    var name = this._validateName_(data.Name);
    var description = String(data.Description || '').trim();
    if (description.length > this.MAX_DESCRIPTION_LENGTH) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'توضیحات قالب بیش از حد طولانی است.');
    }
    var layout = this._parseLayout_(data.Layout || data.LayoutJSON);
    var duplicate = PrintTemplateRepository.getAll().some(function(item) {
      return String(item.TenantID) === String(user.TenantID) &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
        String(item.Name || '').trim().toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
      throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'قالب فعالی با این نام از قبل وجود دارد.');
    }
    var now = new Date().toISOString();
    var id = 'PTM_' + Utilities.getUuid().replace(/-/g, '').substring(0, 16).toLowerCase();
    var record = {
      ID: id, TenantID: user.TenantID, Name: name, Description: description,
      LayoutJSON: layout.json, Version: layout.value.version, Status: 'ACTIVE',
      CreatedBy: user.ID, CreatedAt: now, UpdatedBy: user.ID, UpdatedAt: now
    };
    PrintTemplateRepository.insert(record);
    if (typeof AuditService !== 'undefined' && AuditService.log) {
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,
        EntityType:'PRINT_TEMPLATE',EntityID:id,NewData:{ID:id,Name:name,Version:record.Version},
        Reason:'ایجاد قالب چاپ مشترک'});
    }
    return Response.success(this._public_(record), {message:'قالب چاپ ذخیره شد.'});
  },

  update: function(id, data, params) {
    var user = this._user_(params);
    data = data || {};
    var current = this._find_(id, user.TenantID);
    var patch = {UpdatedBy:user.ID,UpdatedAt:new Date().toISOString()};
    if (data.Name !== undefined) {
      patch.Name = this._validateName_(data.Name);
      var duplicate = PrintTemplateRepository.getAll().some(function(item) {
        return String(item.ID) !== String(id) && String(item.TenantID) === String(user.TenantID) &&
          String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
          String(item.Name || '').trim().toLowerCase() === patch.Name.toLowerCase();
      });
      if (duplicate) throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'قالب فعالی با این نام از قبل وجود دارد.');
    }
    if (data.Description !== undefined) {
      patch.Description = String(data.Description || '').trim();
      if (patch.Description.length > this.MAX_DESCRIPTION_LENGTH) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'توضیحات قالب بیش از حد طولانی است.');
      }
    }
    if (data.Layout !== undefined || data.LayoutJSON !== undefined) {
      var layout = this._parseLayout_(data.Layout !== undefined ? data.Layout : data.LayoutJSON);
      patch.LayoutJSON = layout.json;
      patch.Version = layout.value.version;
    }
    var updated = PrintTemplateRepository.update(id, patch);
    if (typeof AuditService !== 'undefined' && AuditService.log) {
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.UPDATE,
        EntityType:'PRINT_TEMPLATE',EntityID:id,OldData:{Name:current.Name,Version:current.Version},
        NewData:{Name:updated.Name,Version:updated.Version},Reason:'ویرایش قالب چاپ'});
    }
    return Response.success(this._public_(updated), {message:'قالب چاپ به‌روزرسانی شد.'});
  },

  remove: function(id, params) {
    var user = this._user_(params);
    var current = this._find_(id, user.TenantID);
    var updated = PrintTemplateRepository.update(id, {
      Status:'INACTIVE',UpdatedBy:user.ID,UpdatedAt:new Date().toISOString()
    });
    if (typeof AuditService !== 'undefined' && AuditService.log) {
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.DELETE,
        EntityType:'PRINT_TEMPLATE',EntityID:id,OldData:{Name:current.Name},
        NewData:{Status:'INACTIVE'},Reason:'غیرفعال‌سازی قالب چاپ'});
    }
    return Response.success({ID:updated.ID,Status:updated.Status},{message:'قالب چاپ غیرفعال شد.'});
  }
};
