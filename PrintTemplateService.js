/**
 * Central reusable print-template library and project data resolver.
 * Template definitions never contain project values; values are resolved per output request.
 */
const PrintTemplateService = {
  _user: function(params) { return AccessControlService.getCurrentUser(params || {}); },
  _parse: function(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch (error) { return fallback; }
  },
  _id: function() { return 'PT_' + Utilities.getUuid().replace(/-/g, ''); },
  _now: function() { return new Date().toISOString(); },
  _template: function(id, tenantId) {
    const row = PrintTemplateRepository.findById(id);
    if (!row || String(row.TenantID) !== String(tenantId) || String(row.Status || 'ACTIVE') === 'DELETED') {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قالب موردنظر پیدا نشد.');
    }
    return row;
  },
  _definition: function(row) {
    return PrintTemplateValidator.parseDefinition(row.DefinitionJSON);
  },
  _public: function(row) {
    return {
      ID: row.ID, Code: row.Code, Name: row.Name, Description: row.Description || '',
      Status: row.Status || 'ACTIVE', Version: Number(row.Version || 1),
      Definition: this._definition(row), CreatedAt: row.CreatedAt || '', UpdatedAt: row.UpdatedAt || ''
    };
  },
  list: function(params) {
    const user = this._user(params);
    const rows = PrintTemplateRepository.getAll().filter(function(row) {
      return String(row.TenantID) === String(user.TenantID) &&
        String(row.Status || 'ACTIVE') === 'ACTIVE';
    }).sort(function(a,b) {
      return String(a.Name || '').localeCompare(String(b.Name || ''), 'fa');
    });
    return Response.success(rows.map(function(row) { return this._public(row); }, this));
  },
  get: function(id, params) {
    const user = this._user(params);
    return Response.success(this._public(this._template(id, user.TenantID)));
  },
  sources: function(params) {
    const user = this._user(params);
    const projectFields = [
      ['ID','شناسه داخلی پروژه'],['ProjectCode','کد پروژه'],['Title','نام پروژه'],
      ['Description','توضیحات'],['Status','وضعیت'],['Quantity','تعداد'],
      ['CreatedAt','تاریخ ایجاد'],['UpdatedAt','آخرین ویرایش'],['RecordState','وضعیت پرونده']
    ].map(function(item) { return { field: item[0], label: item[1], sourceType: 'PROJECT_FIELD' }; });
    const informationTypes = InformationTypeRepository.findByTenant(user.TenantID).filter(function(type) {
      return String(type.Status || 'ACTIVE') === 'ACTIVE';
    }).map(function(type) {
      return { ID: type.ID, Code: type.Code, Name: type.Name, DataType: type.DataType, Cardinality: type.Cardinality,
        Columns: InformationTypeRepository.findColumns(type.ID).filter(function(column) {
          return String(column.TenantID) === String(user.TenantID) && String(column.Status || 'ACTIVE') === 'ACTIVE';
        }).map(function(column) { return { ID: column.ID, Code: column.Code, Name: column.Name, DataType: column.DataType }; }) };
    });
    const forms = FormRepository.getForms().filter(function(form) {
      return String(form.TenantID) === String(user.TenantID) && String(form.Status || 'ACTIVE') === 'ACTIVE';
    }).map(function(form) {
      const fields = FormRepository.findFieldsByForm(form.ID).filter(function(field) {
        return String(field.TenantID) === String(user.TenantID) && String(field.Status || 'ACTIVE') === 'ACTIVE';
      }).map(function(field) {
        const type = InformationTypeRepository.findById(field.InformationTypeID);
        if (!type || String(type.TenantID) !== String(user.TenantID)) return null;
        return { ID: field.ID, InformationTypeID: type.ID, Code: type.Code, Name: field.LabelOverride || type.Name,
          DataType: type.DataType, Cardinality: type.Cardinality, GroupName: field.GroupName || '' };
      }).filter(Boolean);
      return { ID: form.ID, Code: form.Code, Name: form.Name, Version: Number(form.Version || 1), Fields: fields };
    });
    return Response.success({ projectFields: projectFields, informationTypes: informationTypes, forms: forms });
  },
  create: function(data, params) {
    const user = this._user(params);
    data = data || {};
    PrintTemplateValidator.validateMetadata(data, false);
    const code = String(data.Code).trim();
    const duplicate = PrintTemplateRepository.getAll().some(function(row) {
      return String(row.TenantID) === String(user.TenantID) &&
        String(row.Code || '').toLowerCase() === code.toLowerCase() &&
        String(row.Status || 'ACTIVE') !== 'DELETED';
    });
    if (duplicate) throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'کد قالب قبلاً استفاده شده است.');
    const now = this._now();
    const row = {
      ID: this._id(), TenantID: user.TenantID, Code: code, Name: String(data.Name).trim(),
      Description: String(data.Description || ''), Status: String(data.Status || 'ACTIVE').toUpperCase(),
      Version: 1, DefinitionJSON: JSON.stringify(PrintTemplateValidator.parseDefinition(data.Definition)),
      CreatedBy: user.ID, CreatedAt: now, UpdatedBy: user.ID, UpdatedAt: now
    };
    const created = PrintTemplateRepository.insert(row);
    AuditService.log({ TenantID: user.TenantID, UserID: user.ID, Action: Constants.ACTION.CREATE,
      EntityType: 'PRINT_TEMPLATE', EntityID: created.ID, NewData: this._public(row), Reason: 'ایجاد قالب چاپ مرکزی' });
    return Response.success(this._public(row), { message: 'قالب ایجاد شد.' });
  },
  update: function(id, data, params) {
    const user = this._user(params);
    data = data || {};
    const existing = this._template(id, user.TenantID);
    const previous = Object.assign({}, existing);
    PrintTemplateValidator.validateMetadata(data, true);
    if (data.Code !== undefined) {
      const code = String(data.Code).trim();
      const duplicate = PrintTemplateRepository.getAll().some(function(row) {
        return String(row.ID) !== String(id) && String(row.TenantID) === String(user.TenantID) &&
          String(row.Code || '').toLowerCase() === code.toLowerCase() && String(row.Status || 'ACTIVE') !== 'DELETED';
      });
      if (duplicate) throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'کد قالب قبلاً استفاده شده است.');
    }
    const patch = { UpdatedBy: user.ID, UpdatedAt: this._now(), Version: Number(existing.Version || 1) + 1 };
    ['Code','Name','Description','Status'].forEach(function(key) {
      if (data[key] !== undefined) patch[key] = key === 'Code' || key === 'Name' ? String(data[key]).trim() : data[key];
    });
    if (data.Definition !== undefined || data.DefinitionJSON !== undefined) {
      patch.DefinitionJSON = JSON.stringify(PrintTemplateValidator.parseDefinition(
        data.Definition !== undefined ? data.Definition : data.DefinitionJSON
      ));
    }
    const updated = PrintTemplateRepository.update(id, patch);
    const current = Object.assign({}, existing, patch);
    AuditService.log({ TenantID: user.TenantID, UserID: user.ID, Action: Constants.ACTION.UPDATE,
      EntityType: 'PRINT_TEMPLATE', EntityID: id, OldData: this._public(previous), NewData: this._public(current),
      Reason: 'ویرایش قالب چاپ مرکزی' });
    return Response.success(this._public(current), { message: 'قالب به‌روزرسانی شد.' });
  },
  deactivate: function(id, params) {
    const user = this._user(params);
    const existing = this._template(id, user.TenantID);
    const patch = { Status: 'DELETED', UpdatedBy: user.ID, UpdatedAt: this._now(),
      Version: Number(existing.Version || 1) + 1 };
    PrintTemplateRepository.update(id, patch);
    const updated = Object.assign({}, existing, patch);
    AuditService.log({ TenantID: user.TenantID, UserID: user.ID, Action: Constants.ACTION.DELETE,
      EntityType: 'PRINT_TEMPLATE', EntityID: id, OldData: this._public(existing), NewData: this._public(updated),
      Reason: 'غیرفعال‌سازی قالب چاپ مرکزی' });
    return Response.success({ ID: id, Status: 'DELETED' }, { message: 'قالب غیرفعال شد.' });
  },
  resolve: function(id, body, params) {
    const user = this._user(params);
    body = body || {};
    const template = this._template(id, user.TenantID);
    if (String(template.Status || 'ACTIVE') !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION, 'قالب غیرفعال است و قابل استفاده برای تولید سند نیست.');
    }
    Validator.required(body.ProjectID, 'ProjectID');
    const project = ProjectRepository.findById(body.ProjectID);
    if (!project || String(project.TenantID) !== String(user.TenantID) ||
        !ProjectService._isProjectAvailableToUser_(project, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه موردنظر پیدا نشد.');
    }
    const definition = this._definition(template);
    const projectFieldAllowList = {
      ID: true, ProjectCode: true, Title: true, Description: true, Status: true,
      Quantity: true, CreatedAt: true, UpdatedAt: true, RecordState: true
    };
    const infoTypes = InformationTypeRepository.findByTenant(user.TenantID);
    const infoById = Object.create(null);
    infoTypes.forEach(function(type) {
      if (String(type.Status || 'ACTIVE') === 'ACTIVE') infoById[String(type.ID)] = type;
    });
    const informationRows = ProjectInformationRepository.findByProject(body.ProjectID).filter(function(row) {
      return String(row.TenantID) === String(user.TenantID) && String(row.Status || 'ACTIVE') === 'ACTIVE';
    });
    const informationByType = Object.create(null);
    informationRows.forEach(function(row) { informationByType[String(row.InformationTypeID)] = row; });
    const events = EventRepository.findByProjectId(body.ProjectID).filter(function(event) {
      const status = String(event.Status || '').toUpperCase();
      return String(event.TenantID) === String(user.TenantID) && status !== 'VOID' &&
        status !== 'CANCELLED' && status !== 'CANCELED';
    });
    const eventIds = Object.create(null);
    events.forEach(function(event) { eventIds[String(event.ID)] = true; });
    const responses = FormRepository.getEventResponses().filter(function(row) {
      return String(row.TenantID) === String(user.TenantID) && !!eventIds[String(row.EventID)];
    });
    const resolved = Object.create(null);
    definition.bindings.forEach(function(binding) {
      let value = null;
      if (binding.sourceType === 'PROJECT_FIELD') {
        const field = String(binding.field || '');
        if (!projectFieldAllowList[field]) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فیلد پروژه در منبع قالب مجاز نیست.');
        value = project[field] !== undefined ? project[field] : null;
      } else if (binding.sourceType === 'PROJECT_INFORMATION') {
        const typeId = String(binding.informationTypeId || '');
        if (!infoById[typeId]) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع اطلاعات متصل به قالب پیدا نشد یا غیرفعال است.');
        const row = informationByType[typeId];
        value = row ? this._parse(row.ValueJSON, null) : null;
      } else {
        const formId = String(binding.formId || '');
        const matching = responses.filter(function(row) {
          return String(row.FormID) === formId &&
            (!binding.eventId || String(row.EventID) === String(binding.eventId)) &&
            (!binding.responseId || String(row.ID) === String(binding.responseId));
        }).map(function(row) {
          const event = events.find(function(item) { return String(item.ID) === String(row.EventID); });
          return {
            ID: row.ID, EventID: row.EventID, FormID: row.FormID, FormVersion: Number(row.FormVersion || 1),
            CreatedAt: row.CreatedAt || '', EventOccurredAt: event ? (event.OccurredAt || event.CreatedAt || '') : '',
            Values: this._parse(row.ResponseJSON, {}), Definition: this._parse(row.DefinitionSnapshotJSON, {})
          };
        }, this).sort(function(a,b) { return String(a.CreatedAt).localeCompare(String(b.CreatedAt)); });
        const pickValue = function(record) {
          if (binding.sourceType === 'EVENT_FORM_RESPONSE') return { ID: record.ID, EventID: record.EventID,
            FormID: record.FormID, FormVersion: record.FormVersion, CreatedAt: record.CreatedAt,
            Values: record.Values, Definition: record.Definition };
          const fields = record.Definition && Array.isArray(record.Definition.Fields) ? record.Definition.Fields : [];
          const selectedField = fields.find(function(field) {
            return String(field.ID || '') === String(binding.fieldId || '') ||
              String(field.InformationTypeID || '') === String(binding.informationTypeId || '');
          });
          const typeId = String(binding.informationTypeId || (selectedField && selectedField.InformationTypeID) || '');
          return typeId ? (record.Values[typeId] !== undefined ? record.Values[typeId] : null) : null;
        };
        const selection = String(binding.selection || 'LATEST').toUpperCase();
        if (selection === 'ALL') value = matching.map(pickValue);
        else if (selection === 'EVENT' || selection === 'RESPONSE') value = matching.length ? pickValue(matching[matching.length - 1]) : null;
        else value = matching.length ? pickValue(matching[matching.length - 1]) : null;
      }
      resolved[String(binding.id)] = value;
    }, this);
    return Response.success({
      template: { ID: template.ID, Code: template.Code, Name: template.Name, Version: Number(template.Version || 1) },
      project: { ID: project.ID, ProjectCode: project.ProjectCode || '', Title: project.Title || '' },
      data: resolved,
      resolvedAt: this._now()
    });
  }
};