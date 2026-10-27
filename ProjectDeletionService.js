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
  _active: function(row) {
    var status = String(row && row.Status || '').toUpperCase();
    return status !== String(Constants.STATUS.DELETED).toUpperCase() && status !== String(Constants.STATUS.VOID).toUpperCase();
  },
  _rows: function(sheet) {
    // Never turn a schema/read failure into an empty dependency list.
    return GoogleSheetsRepository.getAll(sheet) || [];
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
    // Procurement orders are not project-owned in the database schema.
    // Link project rows through material needs and allocations; preserve general/shared
    // orders and line items if another project still uses them.
    var allOrders = this._rows(this.SHEETS.ORDERS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID);
    });
    var allItems = this._rows(this.SHEETS.ITEMS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID);
    });
    var allAllocations = this._rows(this.SHEETS.ALLOCATIONS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID);
    });
    var projectAllocations = allAllocations.filter(function(r) {
      return self._same(r.ProjectID, project.ID) ||
        needIds[String(r.MaterialNeedID || '')];
    });
    var projectAllocationIds = Object.create(null);
    projectAllocations.forEach(function(r) { projectAllocationIds[String(r.ID)] = true; });
    var projectItemIds = Object.create(null);
    projectAllocations.forEach(function(r) {
      if (r.PurchaseOrderItemID) projectItemIds[String(r.PurchaseOrderItemID)] = true;
    });
    var items = allItems.filter(function(r) {
      return needIds[String(r.MaterialNeedID || '')] || projectItemIds[String(r.ID)];
    });
    items.forEach(function(r) { projectItemIds[String(r.ID)] = true; });
    var allocations = projectAllocations;
    var otherAllocationsByItem = Object.create(null);
    allAllocations.forEach(function(r) {
      if (projectAllocationIds[String(r.ID)]) return;
      if (r.PurchaseOrderItemID) otherAllocationsByItem[String(r.PurchaseOrderItemID)] = true;
    });
    // Do not remove order lines allocated to another project.
    items = items.filter(function(r) { return !otherAllocationsByItem[String(r.ID)]; });
    var itemIds = Object.create(null);
    items.forEach(function(r) { itemIds[String(r.ID)] = true; });
    allocations = allocations.filter(function(r) {
      return !r.PurchaseOrderItemID || itemIds[String(r.PurchaseOrderItemID)] ||
        self._same(r.ProjectID, project.ID) || needIds[String(r.MaterialNeedID || '')];
    });
    var orderIds = Object.create(null);
    items.forEach(function(r) {
      var orderId = r.PurchaseOrderID || r.OrderID;
      if (orderId) orderIds[String(orderId)] = true;
    });
    // A purchase order can contain general or other-project items. Only cascade-delete
    // an order when every active item on it is being removed and no other allocation remains.
    var orders = allOrders.filter(function(order) {
      var id = String(order.ID);
      if (!orderIds[id]) return false;
      var activeItems = allItems.filter(function(item) {
        return self._same(item.PurchaseOrderID || item.OrderID, order.ID);
      });
      if (!activeItems.length) return false;
      return activeItems.every(function(item) {
        return !!itemIds[String(item.ID)] && !otherAllocationsByItem[String(item.ID)];
      });
    });
    var receiptItems = Object.create(null);
    items.forEach(function(r) { receiptItems[String(r.ID)] = true; });
    var receipts = this._rows(this.SHEETS.RECEIPTS).filter(function(r) {
      return self._active(r) && self._same(r.TenantID, project.TenantID) &&
        ((r.PurchaseOrderItemID && receiptItems[String(r.PurchaseOrderItemID)]) ||
         self._same(r.ProjectID, project.ID) ||
         orderIds[String(r.PurchaseOrderID || r.OrderID || '')]);
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
    if (typeof MaterialPlanningService !== 'undefined' && MaterialPlanningService &&
        typeof MaterialPlanningService._ensureSchema_ === 'function') {
      MaterialPlanningService._ensureSchema_();
    }
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
    if (typeof MaterialPlanningService !== 'undefined' && MaterialPlanningService &&
        typeof MaterialPlanningService._ensureSchema_ === 'function') {
      MaterialPlanningService._ensureSchema_();
    }
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
      function softDelete(sheet, list, statusMarker) {
        if (!list.length) return;
        // Several legacy child sheets (event data, order items, allocations and receipts)
        // have no Status column. Add it before using the repository's soft-delete contract;
        // otherwise deleteById would appear to succeed while leaving the row active.
        try {
          GoogleSheetsRepository.ensureColumn(sheet, 'Status');
        } catch (schemaError) {
          list.forEach(function(row) {
            failed.push({ sheet: sheet, id: String(row.ID), message: 'ستون وضعیت برای حذف نرم آماده نشد: ' + String(schemaError && schemaError.message || schemaError) });
          });
          return;
        }
        list.forEach(function(row) {
          try {
            // 13_Events has a sheet-level validation rule that permits ACTIVE/VOID only.
            // Use VOID for event rows instead of writing the invalid DELETED value.
            var result = statusMarker
              ? GoogleSheetsRepository.updateById(sheet, row.ID, { Status: statusMarker })
              : GoogleSheetsRepository.deleteById(sheet, row.ID);
            if (!result) throw new Error('رکورد برای حذف پیدا نشد یا به‌روزرسانی نشد.');
          } catch (error) {
            failed.push({ sheet: sheet, id: String(row.ID), message: String(error && error.message || error) });
          }
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
      softDelete(this.SHEETS.EVENTS, rows.events, Constants.STATUS.VOID);
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
