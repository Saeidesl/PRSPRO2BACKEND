const PrintTemplateService = {
  MAX_NAME_LENGTH: 100,
  MAX_TEMPLATE_LENGTH: 45000,
  MAX_ELEMENTS: 100,

  _user: function(params) {
    return AccessControlService.getCurrentUser(params || {});
  },

  _id: function() {
    return 'PT_' + Utilities.getUuid().replace(/-/g, '');
  },

  _template: function(row) {
    var parsed = {};
    try { parsed = JSON.parse(String(row.TemplateJSON || '{}')); } catch (error) {}
    return Object.assign({}, row, {Template: parsed});
  },

  _find: function(id, tenantId) {
    var row = PrintTemplateRepository.findById(id);
    if (!row || String(row.TenantID) !== String(tenantId) ||
        String(row.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قالب چاپ موردنظر پیدا نشد.');
    }
    return row;
  },

  _validate: function(data) {
    data = data || {};
    var name = String(data.Name || '').trim();
    if (!name || name.length > this.MAX_NAME_LENGTH) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام قالب باید بین ۱ تا ۱۰۰ نویسه باشد.');
    }

    var template = data.Template;
    if (typeof template === 'string') {
      try { template = JSON.parse(template); } catch (error) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار قالب معتبر نیست.');
      }
    }
    if (!template || typeof template !== 'object' || Array.isArray(template) ||
        Number(template.version) !== 1 || !Array.isArray(template.elements) ||
        template.elements.length > this.MAX_ELEMENTS) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار یا نسخه قالب معتبر نیست.');
    }

    var allowed = ['project', 'project-fields', 'text', 'line', 'form', 'form-field'];
    template.elements.forEach(function(item) {
      if (!item || typeof item !== 'object' || allowed.indexOf(String(item.type || '')) < 0) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'یکی از اجزای قالب معتبر نیست.');
      }
      if ((item.type === 'form' || item.type === 'form-field') &&
          (!item.formId || !item.formDefinition || typeof item.formDefinition !== 'object')) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تعریف یکی از فرم‌های قالب کامل نیست.');
      }
      if (item.type === 'form-field' && !item.fieldKey) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه فیلد قالب مشخص نیست.');
      }
      item.id = String(item.id || '').slice(0, 100);
      item.text = String(item.text || '').slice(0, 3000);
      item.title = String(item.title || '').slice(0, 200);
      var style = item.style && typeof item.style === 'object' ? item.style : {};
      var border = String(style.border || '0');
      var background = String(style.background || '#ffffff');
      item.style = {
        border: border === '0' || /^\\d{1,2}px solid #[0-9a-f]{3,8}$/i.test(border) ? border : '0',
        padding: Math.max(0, Math.min(60, Number(style.padding) || 0)),
        background: /^#[0-9a-f]{3,8}$/i.test(background) ? background : '#ffffff',
        fontSize: Math.max(8, Math.min(48, Number(style.fontSize) || 13)),
        align: ['right','left','center','justify'].indexOf(String(style.align || 'right')) >= 0 ? String(style.align || 'right') : 'right'
      };
      if (item.innerLayout && typeof item.innerLayout === 'object') {
        Object.keys(item.innerLayout).forEach(function(key) {
          var layout = item.innerLayout[key] || {};
          item.innerLayout[key] = {
            width: Math.max(40, Math.min(700, Number(layout.width) || 280)),
            x: Math.max(-300, Math.min(300, Number(layout.x) || 0)),
            y: Math.max(-300, Math.min(300, Number(layout.y) || 0))
          };
        });
      }
      if (item.tableLayout && typeof item.tableLayout === 'object') {
        Object.keys(item.tableLayout).forEach(function(key) {
          var layout = item.tableLayout[key] || {};
          var columns = {};
          Object.keys(layout.columns || {}).forEach(function(code) {
            columns[String(code).slice(0, 100)] = Math.max(5, Math.min(100, Number(layout.columns[code]) || 5));
          });
          item.tableLayout[key] = {
            width: Math.max(25, Math.min(100, Number(layout.width) || 100)),
            columns: columns
          };
        });
      }
    });

    var json = JSON.stringify({
      version: 1,
      orientation: String(template.orientation || 'portrait') === 'landscape' ? 'landscape' : 'portrait',
      elements: template.elements
    });
    if (json.length > this.MAX_TEMPLATE_LENGTH) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حجم قالب بیش از حد مجاز است؛ تعداد تصاویر و اجزای قالب را بررسی کن.');
    }
    return {Name: name, TemplateJSON: json, Version: 1};
  },

  list: function(params) {
    var user = this._user(params);
    var rows = PrintTemplateRepository.listByTenant(user.TenantID).filter(function(row) {
      return String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }).sort(function(a, b) {
      return String(a.Name || '').localeCompare(String(b.Name || ''), 'fa');
    }).map(function(row) {
      return {ID: row.ID, Name: row.Name, Version: Number(row.Version || 1), UpdatedAt: row.UpdatedAt || row.CreatedAt || ''};
    });
    return Response.success(rows);
  },

  get: function(id, params) {
    var user = this._user(params);
    return Response.success(this._template(this._find(id, user.TenantID)));
  },

  create: function(data, params) {
    var user = this._user(params);
    var clean = this._validate(data);
    var duplicate = PrintTemplateRepository.listByTenant(user.TenantID).some(function(row) {
      return String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
        String(row.Name || '').trim().toLocaleLowerCase() === clean.Name.toLocaleLowerCase();
    });
    if (duplicate) throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'قالبی با این نام قبلاً ذخیره شده است.');
    var now = new Date().toISOString();
    var row = {
      ID: this._id(), TenantID: user.TenantID, Name: clean.Name,
      Version: clean.Version, TemplateJSON: clean.TemplateJSON, Status: 'ACTIVE',
      CreatedBy: user.ID, CreatedAt: now, UpdatedBy: user.ID, UpdatedAt: now
    };
    var created = PrintTemplateRepository.insert(row);
    if (typeof AuditService !== 'undefined' && AuditService.log) {
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,EntityType:'PRINT_TEMPLATE',EntityID:created.ID,NewData:{Name:created.Name,Version:created.Version},Reason:'ذخیره قالب چاپ نام‌دار'});
    }
    return Response.success({ID:created.ID,Name:created.Name,Version:created.Version},{message:'قالب چاپ ذخیره شد.'});
  },

  update: function(id, data, params) {
    var user = this._user(params);
    var existing = this._find(id, user.TenantID);
    var clean = this._validate(data);
    var duplicate = PrintTemplateRepository.listByTenant(user.TenantID).some(function(row) {
      return String(row.ID) !== String(id) &&
        String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
        String(row.Name || '').trim().toLocaleLowerCase() === clean.Name.toLocaleLowerCase();
    });
    if (duplicate) throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'قالب دیگری با این نام وجود دارد.');
    var now = new Date().toISOString();
    var updated = PrintTemplateRepository.update(id, {
      Name: clean.Name, Version: clean.Version, TemplateJSON: clean.TemplateJSON,
      UpdatedBy: user.ID, UpdatedAt: now
    });
    if (typeof AuditService !== 'undefined' && AuditService.log) {
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.UPDATE,EntityType:'PRINT_TEMPLATE',EntityID:id,OldData:{Name:existing.Name},NewData:{Name:updated.Name,Version:updated.Version},Reason:'به‌روزرسانی قالب چاپ نام‌دار'});
    }
    return Response.success({ID:updated.ID,Name:updated.Name,Version:updated.Version},{message:'قالب چاپ به‌روزرسانی شد.'});
  }
};
