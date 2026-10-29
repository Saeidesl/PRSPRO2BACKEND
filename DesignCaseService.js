const DesignCaseService = {
  STATUSES: ['DRAFT','IN_DESIGN','PATTERN_MAKING','MATERIALS_PENDING','SAMPLE_SEWING','REVISION_REQUIRED','READY_FOR_APPROVAL','REJECTED','APPROVED','ARCHIVED'],

  _user_: function(params) {
    return AccessControlService.getCurrentUser(params || {});
  },
  _id_: function(prefix) {
    return prefix + '_' + Utilities.getUuid().replace(/-/g, '').toUpperCase();
  },
  _clean_: function(value, max, label, required) {
    var text = String(value == null ? '' : value).trim();
    if (required && !text) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, label + ' الزامی است.');
    if (text.length > max) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, label + ' بیش از حد طولانی است.');
    return text;
  },
  _json_: function(value) {
    var parsed = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch (e) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار رنگ‌بندی و سایزبندی معتبر نیست.');
      }
    }
    if (!parsed || typeof parsed !== 'object') parsed = {};
    var colors = Array.isArray(parsed.colors) ? parsed.colors : [];
    var sizes = Array.isArray(parsed.sizes) ? parsed.sizes : [];
    if (colors.length > 100 || sizes.length > 100) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تعداد رنگ یا سایز بیش از حد مجاز است.');
    function clean(items, max) {
      var seen = Object.create(null);
      return items.map(function(item) {
        var text = String(item == null ? '' : item).trim();
        if (!text || text.length > max) return '';
        var key = text.toLocaleLowerCase();
        if (seen[key]) return '';
        seen[key] = true;
        return text;
      }).filter(Boolean);
    }
    return JSON.stringify({colors: clean(colors, 80), sizes: clean(sizes, 40)});
  },
  _tenantCase_: function(id, user) {
    var item = DesignCaseRepository.findById(id);
    if (!item || String(item.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پرونده طرح پیدا نشد.');
    }
    return item;
  },
  _recordHistory_: function(item, action, fromStatus, toStatus, reason, user, idempotencyKey) {
    var nextRevision = (Number(item.Revision) || 0) + 1;
    var snapshot = {};
    Object.keys(item).forEach(function(key) { snapshot[key] = item[key]; });
    snapshot.Status = toStatus;
    snapshot.Revision = nextRevision;
    DesignCaseRepository.appendHistory({
      ID: this._id_('DCH'), TenantID: user.TenantID, DesignCaseID: item.ID,
      Revision: nextRevision, Action: action, FromStatus: fromStatus || '',
      ToStatus: toStatus || '', Reason: reason || '', SnapshotJSON: JSON.stringify(snapshot),
      ActorUserID: user.ID, CreatedAt: new Date().toISOString(),
      IdempotencyKey: idempotencyKey || ''
    });
    return nextRevision;
  },
  list: function(params) {
    var user = this._user_(params);
    var rows = DesignCaseRepository.list().filter(function(item) {
      return String(item.TenantID) === String(user.TenantID) &&
        String(item.Status || '').toUpperCase() !== 'DELETED';
    });
    rows.sort(function(a,b) { return String(b.UpdatedAt || '').localeCompare(String(a.UpdatedAt || '')); });
    return Response.success({items: rows});
  },
  get: function(id, params) {
    var user = this._user_(params);
    var item = this._tenantCase_(id, user);
    var history = DesignCaseRepository.history(id).filter(function(row) {
      return String(row.TenantID) === String(user.TenantID);
    });
    return Response.success({item: item, history: history});
  },
  create: function(body, params) {
    var user = this._user_(params);
    var title = this._clean_(body.Title || body.title, 180, 'عنوان طرح', true);
    var now = new Date().toISOString();
    var id = this._id_('DC');
    var initialStatus = String(body.Status || 'DRAFT').toUpperCase();
    if (['DRAFT','IN_DESIGN'].indexOf(initialStatus) < 0) initialStatus = 'DRAFT';
    var item = {
      ID: id, TenantID: user.TenantID, DesignCode: this._clean_(body.DesignCode || body.designCode, 60, 'کد داخلی طرح', false) || id,
      Title: title, Description: this._clean_(body.Description || body.description, 3000, 'توضیحات', false),
      Status: initialStatus, Priority: String(body.Priority || 'NORMAL').toUpperCase(),
      RequestedBy: this._clean_(body.RequestedBy || body.requestedBy, 160, 'درخواست‌کننده', false),
      OwnerUserID: this._clean_(body.OwnerUserID || body.ownerUserId, 100, 'مسئول پرونده', false),
      OwnerDepartmentID: this._clean_(body.OwnerDepartmentID || body.ownerDepartmentId, 100, 'واحد مسئول', false),
      ProposedQuantity: Math.max(0, Number(body.ProposedQuantity || body.proposedQuantity) || 0),
      ColorSizeJSON: this._json_(body.ColorSizeJSON || body.colorSize || {colors:[],sizes:[]}),
      ReferenceAttachmentID: '', ReferenceImageURL: this._clean_(body.ReferenceImageURL || body.referenceImageURL, 1500, 'نشانی تصویر طرح', false),
      RejectionReason: '', ApprovedAt: '', ApprovedBy: '', CreatedBy: user.ID,
      CreatedAt: now, UpdatedAt: now, Revision: 1
    };
    var duplicate = DesignCaseRepository.list().some(function(row) {
      return String(row.TenantID) === String(user.TenantID) && String(row.DesignCode) === item.DesignCode;
    });
    if (duplicate) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کد داخلی طرح تکراری است.');
    DesignCaseRepository.insert(item);
    this._recordHistory_(item, 'CREATED', '', item.Status, '', user, '');
    AuditService.log({TenantID:user.TenantID, UserID:user.ID, Action:'DESIGN_CASE_CREATED', EntityType:'DESIGN_CASE', EntityID:id, NewData:item});
    return Response.success({item:item});
  },
  update: function(id, body, params) {
    var user = this._user_(params);
    var item = this._tenantCase_(id, user);
    if (['APPROVED','ARCHIVED'].indexOf(String(item.Status).toUpperCase()) >= 0) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'پرونده تأییدشده یا بایگانی‌شده قابل ویرایش نیست.');
    }
    var patch = {};
    if (body.Title !== undefined || body.title !== undefined) patch.Title = this._clean_(body.Title !== undefined ? body.Title : body.title, 180, 'عنوان طرح', true);
    if (body.Description !== undefined || body.description !== undefined) patch.Description = this._clean_(body.Description !== undefined ? body.Description : body.description, 3000, 'توضیحات', false);
    if (body.Priority !== undefined || body.priority !== undefined) patch.Priority = String(body.Priority || body.priority || 'NORMAL').toUpperCase();
    if (body.RequestedBy !== undefined || body.requestedBy !== undefined) patch.RequestedBy = this._clean_(body.RequestedBy !== undefined ? body.RequestedBy : body.requestedBy, 160, 'درخواست‌کننده', false);
    if (body.OwnerUserID !== undefined || body.ownerUserId !== undefined) patch.OwnerUserID = this._clean_(body.OwnerUserID !== undefined ? body.OwnerUserID : body.ownerUserId, 100, 'مسئول پرونده', false);
    if (body.OwnerDepartmentID !== undefined || body.ownerDepartmentId !== undefined) patch.OwnerDepartmentID = this._clean_(body.OwnerDepartmentID !== undefined ? body.OwnerDepartmentID : body.ownerDepartmentId, 100, 'واحد مسئول', false);
    if (body.ProposedQuantity !== undefined || body.proposedQuantity !== undefined) {
      var quantity = Number(body.ProposedQuantity !== undefined ? body.ProposedQuantity : body.proposedQuantity);
      if (!isFinite(quantity) || quantity < 0) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تعداد پیشنهادی معتبر نیست.');
      patch.ProposedQuantity = quantity;
    }
    if (body.ColorSizeJSON !== undefined || body.colorSize !== undefined) patch.ColorSizeJSON = this._json_(body.ColorSizeJSON !== undefined ? body.ColorSizeJSON : body.colorSize);
    if (body.ReferenceImageURL !== undefined || body.referenceImageURL !== undefined) patch.ReferenceImageURL = this._clean_(body.ReferenceImageURL !== undefined ? body.ReferenceImageURL : body.referenceImageURL, 1500, 'نشانی تصویر طرح', false);
    patch.UpdatedAt = new Date().toISOString();
    var fromStatus = String(item.Status || 'DRAFT');
    var newStatus = body.Status || body.status;
    if (newStatus !== undefined) {
      newStatus = String(newStatus).toUpperCase();
      if (this.STATUSES.indexOf(newStatus) < 0 || ['APPROVED','ARCHIVED','REJECTED'].indexOf(newStatus) >= 0) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'وضعیت انتخاب‌شده در این مرحله مجاز نیست.');
      }
      patch.Status = newStatus;
    }
    var revision = (Number(item.Revision) || 0) + 1;
    patch.Revision = revision;
    DesignCaseRepository.update(id, patch);
    var updated = this._tenantCase_(id, user);
    this._recordHistory_(updated, 'UPDATED', fromStatus, String(updated.Status || fromStatus), '', user, '');
    AuditService.log({TenantID:user.TenantID, UserID:user.ID, Action:'DESIGN_CASE_UPDATED', EntityType:'DESIGN_CASE', EntityID:id, OldData:item, NewData:updated});
    return Response.success({item:updated});
  },
  addEvent: function(id, body, params) {
    var user = this._user_(params);
    var item = this._tenantCase_(id, user);
    if (['APPROVED','ARCHIVED'].indexOf(String(item.Status).toUpperCase()) >= 0) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای پرونده تأییدشده یا بایگانی‌شده رویداد جدید ثبت نمی‌شود.');
    }
    var action = this._clean_(body.Action || body.action, 60, 'نوع اقدام', true).toUpperCase();
    var reason = this._clean_(body.Description || body.description || body.Reason || body.reason, 1500, 'شرح اقدام', true);
    var transitions = {
      START_DESIGN:'IN_DESIGN', START_PATTERN:'PATTERN_MAKING', REQUEST_MATERIALS:'MATERIALS_PENDING',
      START_SAMPLE:'SAMPLE_SEWING', REQUEST_REVISION:'REVISION_REQUIRED', RESUBMIT_SAMPLE:'SAMPLE_SEWING',
      READY_FOR_APPROVAL:'READY_FOR_APPROVAL'
    };
    if (!transitions[action]) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نوع اقدام معتبر نیست.');
    var fromStatus = String(item.Status || 'DRAFT');
    var toStatus = transitions[action];
    var now = new Date().toISOString();
    var patch = {Status:toStatus, UpdatedAt:now, Revision:(Number(item.Revision) || 0) + 1};
    DesignCaseRepository.update(id, patch);
    var updated = this._tenantCase_(id, user);
    this._recordHistory_(updated, action, fromStatus, toStatus, reason, user, body.IdempotencyKey || body.idempotencyKey || '');
    AuditService.log({TenantID:user.TenantID, UserID:user.ID, Action:'DESIGN_CASE_EVENT_'+action, EntityType:'DESIGN_CASE', EntityID:id, OldData:item, NewData:updated, Reason:reason});
    return Response.success({item:updated, event:{Action:action,Description:reason,ActorUserID:user.ID,CreatedAt:now}});
  }
};
