/**
 * ADMIN PROJECT DELETION
 * Performs a tenant-scoped, dependency-aware soft delete and trashes attached Drive files.
 * This service must only be called after an explicit admin check in Router.
 */
const ProjectDeletionService = {
  SHEETS: {
    EVENTS: '13_Events',
    EVENT_DATA: '14_EventData',
    ATTACHMENTS: '15_Attachments',
    NEEDS: '18_MaterialNeeds',
    ORDERS: '19_PurchaseOrders',
    ITEMS: '20_PurchaseOrderItems',
    ALLOCATIONS: '21_PurchaseAllocations',
    RECEIPTS: '22_MaterialReceipts',
    SPECS: '24_ProjectMaterialSpecs',
    CALCULATIONS: '25_MaterialNeedCalculations'
  },

  _same: function(a, b) { return String(a == null ? '' : a) === String(b == null ? '' : b); },
  _active: function(row) { return String(row && row.Status || '').toUpperCase() !== String(Constants.STATUS.DELETED).toUpperCase(); },
  _rows: function(sheet) {
    try { return GoogleSheetsRepository.getAll(sheet) || []; }
    catch (e) { return []; }
  },
  _projectContext: function(projectId, params) {
    Validator.required(projectId, 'شناسه پروژه');
    var user = AccessControlService.getCurrentUser(params || {});
    if (!AccessControlService.isAdmin(user)) {
      throw ErrorHandler.create(Constants.ERROR.PERMISSION_DENIED, 'فقط مدیر سامانه می‌تواند پروژه را حذف کند.');
    }
    var project = ProjectRepository.findById(projectId);
    if (!project || !this._same(project.TenantID, user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه مورد نظر پیدا نشد.');
    }
    return { user: user, project: project };
  },

  _collect: function(project) {
    var self = this;
    var events = this._rows(this.SHEETS.EVENTS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) && self._same(r.ProjectID, project.ID);
    });
    var eventIds = Object.create(null);
    events.forEach(function(r) { eventIds[String(r.ID)] = true; });
    var eventData = this._rows(this.SHEETS.EVENT_DATA).filter(function(r) {
      return self._active(r) && eventIds[String(r.EventID)];
    });
    var needs = this._rows(this.SHEETS.NEEDS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) && self._same(r.ProjectID, project.ID);
    });
    var needIds = Object.create(null);
    needs.forEach(function(r) { needIds[String(r.ID)] = true; });
    var orders = this._rows(this.SHEETS.ORDERS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) && self._same(r.ProjectID, project.ID);
    });
    var orderIds = Object.create(null);
    orders.forEach(function(r) { orderIds[String(r.ID)] = true; });
    var items = this._rows(this.SHEETS.ITEMS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) &&
        (orderIds[String(r.PurchaseOrderID || r.OrderID || '')] || self._same(r.ProjectID, project.ID));
    });
    var itemIds = Object.create(null);
    items.forEach(function(r) { itemIds[String(r.ID)] = true; });
    var allocations = this._rows(this.SHEETS.ALLOCATIONS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) &&
        (needIds[String(r.MaterialNeedID || '')] || itemIds[String(r.PurchaseOrderItemID || '')] ||
         orderIds[String(r.PurchaseOrderID || r.OrderID || '')] || self._same(r.ProjectID, project.ID));
    });
    var receipts = this._rows(this.SHEETS.RECEIPTS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) &&
        (itemIds[String(r.PurchaseOrderItemID || '')] || orderIds[String(r.PurchaseOrderID || r.OrderID || '')] ||
         self._same(r.ProjectID, project.ID));
    });
    var specs = this._rows(this.SHEETS.SPECS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) && self._same(r.ProjectID, project.ID);
    });
    var calculations = this._rows(this.SHEETS.CALCULATIONS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) &&
        (self._same(r.ProjectID, project.ID) || eventIds[String(r.SourceEventID || '')] ||
         needs.some(function(n) { return self._same(n.ID, r.MaterialNeedID); }));
    });
    var attachments = this._rows(this.SHEETS.ATTACHMENTS).filter(function(r) {
      if (!self._active(r) || !self._same(r.TenantID, project.TenantID)) return false;
      var type = String(r.EntityType || '').toUpperCase();
      return (type === 'PROJECT' && self._same(r.EntityID, project.ID)) ||
        (type === 'EVENT' && eventIds[String(r.EntityID)]);
    });
    return { events: events, eventData: eventData, needs: needs, orders: orders, items: items,
      allocations: allocations, receipts: receipts, specs: specs, calculations: calculations, attachments: attachments };
  },

  preview: function(projectId, params) {
    var context = this._projectContext(projectId, params);
    var rows = this._collect(context.project);
    return Response.success({
      project: { ID: context.project.ID, ProjectCode: context.project.ProjectCode, ProjectName: context.project.ProjectName || context.project.Name },
      counts: {
        events: rows.events.length, eventData: rows.eventData.length, attachments: rows.attachments.length,
        materialNeeds: rows.needs.length, purchaseOrders: rows.orders.length, purchaseOrderItems: rows.items.length,
        allocations: rows.allocations.length, receipts: rows.receipts.length,
        materialSpecifications: rows.specs.length, materialCalculations: rows.calculations.length
      },
      confirmationCode: String(context.project.ProjectCode || '')
    });
  },

  remove: function(projectId, confirmationCode, params) {
    var context = this._projectContext(projectId, params);
    var project = context.project;
    if (!confirmationCode || String(confirmationCode).trim() !== String(project.ProjectCode || '').trim()) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای حذف، کد پروژه را دقیقاً وارد کنید.');
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'عملیات دیگری در حال اجراست؛ دوباره تلاش کنید.');
    }
    try {
      // Revalidate project and dependencies while holding the script lock.
      context = this._projectContext(projectId, params);
      project = context.project;
      var rows = this._collect(project);
      var self = this;
      var failed = [];
      function softDelete(sheet, list) {
        list.forEach(function(row) {
          try { GoogleSheetsRepository.deleteById(sheet, row.ID); }
          catch (error) { failed.push({ sheet: sheet, id: String(row.ID), message: String(error && error.message || error) }); }
        });
      }
      softDelete(this.SHEETS.EVENT_DATA, rows.eventData);
      softDelete(this.SHEETS.RECEIPTS, rows.receipts);
      softDelete(this.SHEETS.ALLOCATIONS, rows.allocations);
      softDelete(this.SHEETS.ITEMS, rows.items);
      softDelete(this.SHEETS.ORDERS, rows.orders);
      softDelete(this.SHEETS.NEEDS, rows.needs);
      softDelete(this.SHEETS.CALCULATIONS, rows.calculations);
      softDelete(this.SHEETS.SPECS, rows.specs);
      softDelete(this.SHEETS.ATTACHMENTS, rows.attachments);
      // Trash Drive files only after their attachment records have been soft-deleted.
      rows.attachments.forEach(function(attachment) {
        var key = attachment.StorageKey || attachment.FileID || attachment.DriveFileId;
        if (!key) return;
        try { StorageRepository.delete(key); }
        catch (error) { failed.push({ sheet: self.SHEETS.ATTACHMENTS, id: String(attachment.ID), message: 'حذف فایل Drive ناموفق بود: ' + String(error && error.message || error) }); }
      });
      softDelete(this.SHEETS.EVENTS, rows.events);
      if (!failed.length) {
        try { ProjectRepository.delete(project.ID); }
        catch (error) { failed.push({ sheet: '08_Projects', id: String(project.ID), message: String(error && error.message || error) }); }
      }
      AuditService.log({
        TenantID: context.user.TenantID, UserID: context.user.ID, Action: 'ADMIN_PROJECT_CASCADE_DELETE',
        EntityType: 'PROJECT', EntityID: String(project.ID),
        NewData: { ProjectCode: String(project.ProjectCode || ''), deletedCounts: {
          events: rows.events.length, eventData: rows.eventData.length, attachments: rows.attachments.length,
          materialNeeds: rows.needs.length, purchaseOrders: rows.orders.length, purchaseOrderItems: rows.items.length,
          allocations: rows.allocations.length, receipts: rows.receipts.length,
          materialSpecifications: rows.specs.length, materialCalculations: rows.calculations.length
        }, failedCount: failed.length }
      });
      if (failed.length) {
        throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'حذف پروژه کامل نشد؛ برخی رکوردها یا فایل‌ها حذف نشدند. برای جلوگیری از پنهان شدن خطا، عملیات را دوباره بدون بررسی اجرا نکنید. جزئیات: ' + JSON.stringify(failed.slice(0, 10)));
      }
      return Response.success({ projectId: String(project.ID), deleted: true });
    } finally {
      lock.releaseLock();
    }
  }
};
