/**
 * PROCUREMENT SERVICE
 * Tenant-scoped procurement needs, purchase orders and material receipts.
 */
const ProcurementService = {
  _user_: function(params) {
    var user = AccessControlService.getCurrentUser(params || {});
    if (typeof MaterialPlanningService !== 'undefined' && MaterialPlanningService &&
        typeof MaterialPlanningService._ensureSchema_ === 'function') {
      MaterialPlanningService._ensureSchema_();
    }
    return user;
  },

  _active_: function(status) {
    var value = String(status || 'ACTIVE').toUpperCase();
    return value !== 'CANCELLED' && value !== 'VOID' && value !== 'DELETED';
  },

  _id_: function(prefix) {
    return prefix + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toLowerCase();
  },

  _itemCode_: function() {
    return 'MAT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
  },

  _needKey_: function(need, projectId) {
    if (need && need.MaterialSpecKey) {
      return 'SPEC|' + String(projectId || need.ProjectID || '') + '|' + String(need.MaterialSpecKey);
    }
    return 'NEED|' + String(need && need.ID || '');
  },

  _now_: function() {
    return new Date().toISOString();
  },

  _number_: function(value, fieldName, allowZero) {
    var number = Number(value);
    if (!isFinite(number) || number < 0 || (!allowZero && number <= 0)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
        'مقدار عددی معتبر نیست: ' + fieldName);
    }
    return number;
  },

  _isProjectVisible_: function(projectId, user, visibilityCache) {
    if (!projectId) return true;
    var key = String(projectId);
    var visibleKey = '$pms_visible|' + key;
    if (visibilityCache && Object.prototype.hasOwnProperty.call(visibilityCache, visibleKey)) {
      return visibilityCache[visibleKey];
    }

    var project = null;
    var projectIndex = visibilityCache && visibilityCache.$pms_projectIndex;
    if (projectIndex) {
      project = projectIndex[key] || null;
    } else {
      var lookupCount = visibilityCache
        ? Number(visibilityCache.$pms_projectLookupCount) || 0
        : 0;
      // For a small number of project checks, a targeted lookup is cheaper.
      // Once a request touches a third distinct project, load the project sheet
      // once and reuse the index instead of issuing one row lookup per project.
      if (lookupCount >= 2 && typeof ProjectRepository.getAll === 'function') {
        projectIndex = Object.create(null);
        ProjectRepository.getAll().forEach(function(row) {
          if (row && row.ID !== undefined && row.ID !== null) {
            projectIndex[String(row.ID)] = row;
          }
        });
        if (visibilityCache) visibilityCache.$pms_projectIndex = projectIndex;
        project = projectIndex[key] || null;
      } else {
        project = ProjectRepository.findById(projectId);
        if (visibilityCache) visibilityCache.$pms_projectLookupCount = lookupCount + 1;
      }
    }

    var visible = !!project && String(project.TenantID) === String(user.TenantID) &&
      ProjectService._isProjectAvailableToUser_(project, user);
    if (visibilityCache) visibilityCache[visibleKey] = visible;
    return visible;
  },

  _validateProject_: function(projectId, tenantId, user) {
    if (!projectId) return null;
    var project = ProjectRepository.findById(projectId);
    if (!project || String(project.TenantID) !== String(tenantId) ||
        (user && !ProjectService._isProjectAvailableToUser_(project, user))) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه معتبر نیست.');
    }
    return project;
  },

  _validateEvent_: function(eventId, tenantId, user) {
    if (!eventId) return null;
    var event = EventRepository.findById(eventId);
    if (!event || String(event.TenantID) !== String(tenantId) ||
        (event.ProjectID && user &&
          !this._isProjectVisible_(event.ProjectID, user))) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد منبع معتبر نیست.');
    }
    return event;
  },

  createOrder: function(body, params) {
    if (typeof MaterialPlanningService !== 'undefined' && MaterialPlanningService &&
        typeof MaterialPlanningService._ensureSchema_ === 'function') MaterialPlanningService._ensureSchema_();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ثبت سفارش دیگری در حال انجام است؛ چند لحظه بعد دوباره تلاش کنید.');
    }
    try {
      return this._createOrderUnlocked_(body, params);
    } finally {
      lock.releaseLock();
    }
  },

  _createOrderUnlocked_: function(body, params) {
    body = body || {};
    var user = this._user_(params);
    var idempotencyKey = String(body.IdempotencyKey || '').trim();
    if (idempotencyKey) {
      var replayOrder = ProcurementRepository.getOrders(user.TenantID).find(function(existing) {
        return String(existing.IdempotencyKey || '') === idempotencyKey;
      });
      if (replayOrder) {
        var replayItems = ProcurementRepository.getItems(user.TenantID).filter(function(item) {
          return String(item.PurchaseOrderID) === String(replayOrder.ID);
        });
        return Response.success({
          Order: replayOrder,
          Items: replayItems,
          IdempotentReplay: true,
          RecoveryRequired: String(replayOrder.Status || '').toUpperCase() === 'NEEDS_REVIEW'
        });
      }
    }
    if (!Array.isArray(body.Items) || !body.Items.length) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'سفارش باید دست‌کم یک قلم داشته باشد.');
    }

    var self = this;
    var existingNeeds = ProcurementRepository.getNeeds(user.TenantID);
    var existingItems = ProcurementRepository.getItems(user.TenantID);
    var existingOrders = ProcurementRepository.getOrders(user.TenantID);
    var existingOrderById = Object.create(null);
    existingOrders.forEach(function(existingOrder) {
      existingOrderById[String(existingOrder.ID)] = existingOrder;
    });
    var countableExistingItemIds = Object.create(null);
    existingItems.forEach(function(existingItem) {
      var parent = existingOrderById[String(existingItem.PurchaseOrderID || '')];
      var status = String(parent && parent.Status || '').toUpperCase();
      if (parent && ['CANCELLED', 'VOID', 'DELETED', 'NEEDS_REVIEW'].indexOf(status) === -1) {
        countableExistingItemIds[String(existingItem.ID)] = true;
      }
    });
    var existingAllocations = ProcurementRepository.getAllocations(user.TenantID).filter(function(allocation) {
      if (!ProcurementService._active_(allocation.Status)) return false;
      return !!countableExistingItemIds[String(allocation.PurchaseOrderItemID || '')];
    });
    var existingNeedById = Object.create(null);
    existingNeeds.forEach(function(need) { existingNeedById[String(need.ID)] = need; });
    var orderedByNeedBeforeOrder = {};
    existingAllocations.forEach(function(allocation) {
      var needId = String(allocation.MaterialNeedID || '');
      var linkedNeed = existingNeedById[needId];
      var key = linkedNeed ? this._needKey_(linkedNeed, allocation.ProjectID || linkedNeed.ProjectID) : ('NEED|' + needId);
      if (needId) orderedByNeedBeforeOrder[key] =
        (orderedByNeedBeforeOrder[key] || 0) + (Number(allocation.AllocatedQuantity) || 0);
    }, this);
    var allocationsByExistingItem = {};
    existingAllocations.forEach(function(allocation) {
      var itemId = String(allocation.PurchaseOrderItemID || '');
      allocationsByExistingItem[itemId] = true;
    });
    existingItems.forEach(function(item) {
      var itemId = String(item.ID || '');
      if (!countableExistingItemIds[itemId] || allocationsByExistingItem[itemId]) return;
      var needId = String(item.MaterialNeedID || '');
      if (needId) {
        var linkedNeed = existingNeedById[needId];
        var key = linkedNeed ? self._needKey_(linkedNeed, linkedNeed.ProjectID || item.ProjectID) : ('NEED|' + needId);
        var legacySurplus = item.SurplusQuantity === undefined || item.SurplusQuantity === null
          ? 0 : Math.max(0, Number(item.SurplusQuantity) || 0);
        orderedByNeedBeforeOrder[key] = (orderedByNeedBeforeOrder[key] || 0) +
          Math.max(0, (Number(item.OrderedQuantity) || 0) - legacySurplus);
      }
    });
    // Validate and normalize the entire order graph before the first write.
    // Google Sheets cannot atomically commit across multiple sheets.
    var normalized = body.Items.map(function(item) {
      if (!item || !String(item.ItemName || '').trim() || !String(item.Unit || '').trim()) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام و واحد هر قلم سفارش الزامی است.');
      }

      var quantity = self._number_(item.OrderedQuantity, 'مقدار سفارش', false);
      var price = item.UnitPrice === '' || item.UnitPrice === undefined || item.UnitPrice === null
        ? '' : self._number_(item.UnitPrice, 'قیمت واحد', true);
      // A project-level order header is the default for each line unless a line explicitly overrides it.
      var project = self._validateProject_(item.ProjectID || body.ProjectID, user.TenantID, user);
      var needId = item.MaterialNeedID || '';
      var need = null;

      if (needId) {
        need = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.NEEDS, needId);
        if (!need || String(need.TenantID) !== String(user.TenantID)) {
          throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نیاز مرتبط با قلم سفارش معتبر نیست.');
        }
        if (['NEEDS_REVIEW', 'SUPERSEDED', 'CANCELLED', 'DELETED'].indexOf(String(need.Status || 'ACTIVE').toUpperCase()) !== -1) {
          throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'این نیاز باید پیش از سفارش جدید بازبینی یا به‌روزرسانی شود.');
        }
        if (need.ProjectID && (!project || String(need.ProjectID) !== String(project.ID))) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نیاز پروژه‌ای را نمی‌توان در سفارش عمومی یا سفارش پروژه‌ای دیگر ثبت کرد.');
        }
      }

      var allocations = Array.isArray(item.Allocations) ? item.Allocations : [];
      var requestedNeedAllocation = 0;
      var surplusQuantity = 0;
      if (!allocations.length && project) {
        if (need) {
          var requested = Math.max(0, Number(need.RequestedQuantity) || 0);
          var needAllocationKey = self._needKey_(need, project.ID);
          var alreadyAllocated = Math.max(0, orderedByNeedBeforeOrder[needAllocationKey] || 0);
          var remainingNeed = Math.max(0, requested - alreadyAllocated);
          requestedNeedAllocation = Math.min(quantity, remainingNeed);
          surplusQuantity = Math.max(0, quantity - requestedNeedAllocation);
          if (requestedNeedAllocation > 0) {
            allocations = [{
              ProjectID: project.ID,
              MaterialNeedID: needId,
              AllocatedQuantity: requestedNeedAllocation
            }];
            orderedByNeedBeforeOrder[needAllocationKey] =
              alreadyAllocated + requestedNeedAllocation;
          }
        } else {
          // A new line on a project order is an unplanned/surplus purchase,
          // not a modification of the project's saved material needs.
          surplusQuantity = quantity;
          allocations = [{
            ProjectID: project.ID,
            MaterialNeedID: '',
            AllocatedQuantity: quantity
          }];
        }
      }

      var normalizedAllocations = allocations.map(function(allocation) {
        if (!allocation || typeof allocation !== 'object') {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تخصیص قلم سفارش معتبر نیست.');
        }
        var allocationProject = self._validateProject_(allocation.ProjectID, user.TenantID, user);
        var allocationQuantity = self._number_(allocation.AllocatedQuantity, 'مقدار تخصیص', false);
        var allocationNeedId = allocation.MaterialNeedID || needId || '';
        var allocationNeed = null;

        if (allocationNeedId) {
          allocationNeed = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.NEEDS, allocationNeedId);
          if (!allocationNeed || String(allocationNeed.TenantID) !== String(user.TenantID)) {
            throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نیاز مرتبط با تخصیص معتبر نیست.');
          }
        }
        if (allocationNeed && allocationNeed.ProjectID &&
            (!allocationProject ||
             String(allocationNeed.ProjectID) !== String(allocationProject.ID))) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'پروژه تخصیص با پروژه نیاز ملزومات مطابقت ندارد.');
        }
        return {
          ProjectID: allocationProject ? allocationProject.ID : '',
          MaterialNeedID: allocationNeedId,
          AllocatedQuantity: allocationQuantity
        };
      });

      var totalAllocated = normalizedAllocations.reduce(function(sum, allocation) {
        return sum + allocation.AllocatedQuantity;
      }, 0);
      if (totalAllocated > quantity) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مجموع تخصیص‌ها از مقدار قلم سفارش بیشتر است.');
      }

      if (need && project && need.ProjectID &&
          String(need.ProjectID) !== String(project.ID)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'پروژه قلم سفارش با پروژه نیاز ملزومات مطابقت ندارد.');
      }

      return {
        source: item,
        need: need,
        quantity: quantity,
        price: price,
        project: project,
        allocations: normalizedAllocations,
        surplusQuantity: surplusQuantity,
        surplusCost: price === '' ? '' : surplusQuantity * price
      };
    });

    var now = this._now_();
    var order = {
      ID: this._id_('PO'),
      TenantID: user.TenantID,
      OrderNumber: String(body.OrderNumber || '').trim() || this._id_('PO-NO').toUpperCase(),
      SupplierName: String(body.SupplierName || '').trim(),
      OrderDate: body.OrderDate || now,
      ExpectedDeliveryDate: body.ExpectedDeliveryDate || '',
      // Start in a non-countable recovery state until every item/allocation write succeeds.
      Status: 'NEEDS_REVIEW',
      Notes: String(body.Notes || ''),
      CreatedBy: user.ID,
      CreatedAt: now,
      UpdatedAt: now,
      IdempotencyKey: idempotencyKey
    };

    // Google Sheets has no multi-sheet transaction. Validate the full payload before writing.
    var createdItems = [];
    var createdAllocationIds = [];
    var failureStage = 'ORDER_HEADER_INSERT';
    try {
      GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.ORDERS, order);
      failureStage = 'ORDER_ITEM_INSERT';
      normalized.forEach(function(entry) {
        var item = entry.source;
        var row = {
          ID: self._id_('POI'),
          TenantID: user.TenantID,
          PurchaseOrderID: order.ID,
          MaterialNeedID: item.MaterialNeedID || '',
          ItemName: String(item.ItemName).trim(),
          ItemCode: entry.need && String(entry.need.ItemCode || '').trim()
            ? String(entry.need.ItemCode).trim() : self._itemCode_(),
          Unit: String(item.Unit).trim(),
          OrderedQuantity: entry.quantity,
          UnitPrice: entry.price,
          SurplusQuantity: entry.surplusQuantity,
          SurplusCost: entry.surplusCost,
          Notes: String(item.Notes || ''),
          CreatedAt: now,
          UpdatedAt: now
        };
        failureStage = 'ORDER_ITEM_INSERT';
        GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.ITEMS, row);
        createdItems.push(row);

        entry.allocations.forEach(function(allocation) {
          failureStage = 'ORDER_ALLOCATION_INSERT';
          var allocationRow = {
            ID: self._id_('ALLOC'),
            TenantID: user.TenantID,
            PurchaseOrderItemID: row.ID,
            ProjectID: allocation.ProjectID,
            MaterialNeedID: allocation.MaterialNeedID,
            AllocatedQuantity: allocation.AllocatedQuantity,
            CreatedAt: now
          };
          GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.ALLOCATIONS, allocationRow);
          createdAllocationIds.push(allocationRow.ID);
        });
      });

      // Promote to ACTIVE only after all item and allocation writes have succeeded.
      failureStage = 'ORDER_ACTIVATION';
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, {
        Status: 'ACTIVE',
        UpdatedAt: now
      });
      order.Status = 'ACTIVE';
      order.UpdatedAt = now;
    } catch (error) {
      // Keep the original failure visible and mark the order for manual reconciliation.
      var recoveryWriteError = '';
      try {
        GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, {
          Status: 'NEEDS_REVIEW',
          Notes: (order.Notes ? order.Notes + '\n' : '') + 'ثبت سفارش ناقص ماند؛ مرحله: ' + failureStage + '؛ نیازمند بررسی: ' + String(error.message || error),
          UpdatedAt: this._now_()
        });
      } catch (recoveryError) {
        recoveryWriteError = String(recoveryError && (recoveryError.message || recoveryError) || recoveryError);
      }
      // Audit every failed multi-sheet order write, even when the recovery status write succeeds.
      try {
        AuditService.log({
          TenantID: user.TenantID,
          UserID: user.ID,
          Action: 'RECOVERY_REQUIRED',
          EntityType: 'PURCHASE_ORDER',
          EntityID: order.ID,
          NewData: {
            Status: 'NEEDS_REVIEW',
            FailureStage: failureStage,
            OriginalError: String(error && (error.message || error) || error),
            RecoveryWriteError: recoveryWriteError,
            CreatedItemIDs: createdItems.map(function(item) { return item.ID; }),
            CreatedAllocationIDs: createdAllocationIds
          }
        });
      } catch (auditError) {}
      throw error;
    }

    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'CREATE',EntityType:'PURCHASE_ORDER',EntityID:order.ID,NewData:{order:order,items:createdItems}});
    return Response.success({Order:order,Items:createdItems});
  },

  createReceipt: function(body, params) {
    body = body || {};
    if (typeof MaterialPlanningService !== 'undefined' && MaterialPlanningService &&
        typeof MaterialPlanningService._ensureSchema_ === 'function') MaterialPlanningService._ensureSchema_();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ثبت دریافت دیگری در حال انجام است؛ چند لحظه بعد دوباره تلاش کنید.');
    }
    try {
      var user = this._user_(params);
      var idempotencyKey = String(body.IdempotencyKey || '').trim();
      if (idempotencyKey) {
        var replayReceipt = ProcurementRepository.getReceipts(user.TenantID).find(function(existing) {
          return ProcurementService._active_(existing.Status) && String(existing.IdempotencyKey || '') === idempotencyKey;
        }, this);
        if (replayReceipt) {
          var replayItem = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, replayReceipt.PurchaseOrderItemID);
          if (replayItem) this._reconcileReceiptOrderStatus_(replayItem.PurchaseOrderID, user.TenantID, this._now_());
          return Response.success(Object.assign({ IdempotentReplay: true }, replayReceipt));
        }
      }
      return this._createReceiptUnlocked_(body, params);
    } finally {
      lock.releaseLock();
    }
  },

  createReceiptsBatch: function(body, params) {
    body = body || {};
    if (typeof MaterialPlanningService !== 'undefined' && MaterialPlanningService &&
        typeof MaterialPlanningService._ensureSchema_ === 'function') MaterialPlanningService._ensureSchema_();
    var entries = body.Receipts;
    if (!Array.isArray(entries) || !entries.length) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای ثبت دریافت، حداقل یک قلم لازم است.');
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ثبت دریافت دیگری در حال انجام است؛ چند لحظه بعد دوباره تلاش کنید.');
    }
    try {
      var user = this._user_(params);
      var itemsById = {};
      var ordersById = {};
      var allocationsByItem = {};
      var receivedByItem = {};
      var receivedByItemProject = {};
      var plannedByItem = {};
      var plannedByItemProject = {};
      var normalizedEntries = [];
      var existingReceipts = ProcurementRepository.getReceipts(user.TenantID);
      var existingReceiptByKey = Object.create(null);
      existingReceipts.forEach(function(receipt) {
        if (ProcurementService._active_(receipt.Status) && receipt.IdempotencyKey) existingReceiptByKey[String(receipt.IdempotencyKey)] = receipt;
      });
      var replayedReceipts = [];
      var requestKeysInBatch = Object.create(null);
      var allAllocations = ProcurementRepository.getAllocations(user.TenantID);

      existingReceipts.forEach(function(receipt) {
        if (!ProcurementService._active_(receipt.Status)) return;
        var itemKey = String(receipt.PurchaseOrderItemID || '');
        var quantity = Number(receipt.QuantityReceived) || 0;
        if (!itemKey) return;
        receivedByItem[itemKey] = (receivedByItem[itemKey] || 0) + quantity;
        var projectKey = itemKey + '|' + String(receipt.ProjectID || '');
        receivedByItemProject[projectKey] = (receivedByItemProject[projectKey] || 0) + quantity;
      });
      allAllocations = allAllocations.filter(function(allocation) { return ProcurementService._active_(allocation.Status); }, this);
      allAllocations.forEach(function(allocation) {
        var key = String(allocation.PurchaseOrderItemID || '');
        if (!key) return;
        if (!allocationsByItem[key]) allocationsByItem[key] = [];
        allocationsByItem[key].push(allocation);
      });

      entries.forEach(function(entry) {
        if (entry && entry.IdempotencyKey) {
          var requestKey = String(entry.IdempotencyKey).trim();
          if (existingReceiptByKey[requestKey]) {
            replayedReceipts.push(existingReceiptByKey[requestKey]);
            return;
          }
          if (requestKeysInBatch[requestKey]) {
            throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'کلید تکراری در درخواست دریافت وجود دارد.');
          }
          requestKeysInBatch[requestKey] = true;
        }
        if (!entry || !entry.PurchaseOrderItemID) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'قلم یکی از دریافت‌ها مشخص نشده است.');
        }
        var quantity = this._number_(entry.QuantityReceived, 'مقدار تحویل', false);
        var key = String(entry.PurchaseOrderItemID);
        var item = itemsById[key] || GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, key);
        if (!item || String(item.TenantID) !== String(user.TenantID)) {
          throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قلم سفارش معتبر نیست.');
        }
        var orderKey = String(item.PurchaseOrderID || '');
        var order = ordersById[orderKey] || GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ORDERS, orderKey);
        if (!order || String(order.TenantID) !== String(user.TenantID) || String(order.Status).toUpperCase() === 'CANCELLED') {
          throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'سفارش خرید معتبر یا فعال نیست.');
        }
        var projectId = entry.ProjectID || '';
        this._validateProject_(projectId, user.TenantID, user);
        this._validateEvent_(entry.SourceEventID || '', user.TenantID, user);

        var prior = receivedByItem[key] || 0;
        var ordered = Math.max(0, Number(item.OrderedQuantity) || 0);
        plannedByItem[key] = (plannedByItem[key] || 0) + quantity;
        var overReceiptOverride = null;
        if (prior + plannedByItem[key] > ordered) {
          var overrideReason = String(entry.OverReceiptReason || '').trim();
          if (entry.AllowOverReceipt !== true || !overrideReason) {
            throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مجموع دریافت‌های انتخاب‌شده از مقدار باقیمانده سفارش «' + String(item.ItemName || '') + '» بیشتر است. برای استثنا باید AllowOverReceipt=true و دلیل صریح ثبت شود.');
          }
          overReceiptOverride = {
            PreviousReceivedQuantity: prior,
            OrderedQuantity: ordered,
            RequestedQuantity: quantity,
            CumulativeReceivedQuantity: prior + plannedByItem[key],
            ExcessQuantity: prior + plannedByItem[key] - ordered,
            Reason: overrideReason
          };
        }

        var allocations = allocationsByItem[key] || [];
        var projectKey = key + '|' + String(projectId);
        if (allocations.length) {
          if (!projectId) {
            // Unallocated surplus may be received as general warehouse stock, but only
            // up to the portion of the order that is not allocated to any project.
            var allocatedTotal = allocations.reduce(function(sum, allocation) {
              return sum + Math.max(0, Number(allocation.AllocatedQuantity) || 0);
            }, 0);
            var unallocatedQuantity = Math.max(0, ordered - allocatedTotal);
            plannedByItemProject[projectKey] = (plannedByItemProject[projectKey] || 0) + quantity;
            if (unallocatedQuantity <= 0 ||
                (receivedByItemProject[projectKey] || 0) + plannedByItemProject[projectKey] > unallocatedQuantity) {
              throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای این قلم سهم عمومیِ دریافت‌نشده وجود ندارد؛ پروژه تخصیص‌یافته را انتخاب کنید.');
            }
          } else {
            var allocated = allocations.filter(function(allocation) {
              return String(allocation.ProjectID || '') === String(projectId);
            }).reduce(function(sum, allocation) {
              return sum + Math.max(0, Number(allocation.AllocatedQuantity) || 0);
            }, 0);
            if (allocated <= 0) {
              throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'این قلم سفارش به پروژه انتخاب‌شده تخصیص نیافته است.');
            }
            plannedByItemProject[projectKey] = (plannedByItemProject[projectKey] || 0) + quantity;
            if ((receivedByItemProject[projectKey] || 0) + plannedByItemProject[projectKey] > allocated) {
              throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مجموع دریافت از سهم تخصیص‌یافته پروژه برای قلم «' + String(item.ItemName || '') + '» بیشتر است.');
            }
          }
        } else {
          var expectedProjectId = item.ProjectID || order.ProjectID || '';
          if (expectedProjectId && String(projectId) !== String(expectedProjectId)) {
            throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'پروژه دریافت با پروژه مرتبط با قلم سفارش مطابقت ندارد.');
          }
        }

        itemsById[key] = item;
        ordersById[orderKey] = order;
        normalizedEntries.push({
          item: item,
          order: order,
          body: entry,
          projectId: projectId,
          quantity: quantity,
          overReceiptOverride: overReceiptOverride
        });
      }, this);

      if (!normalizedEntries.length) {
        replayedReceipts.forEach(function(receipt) {
          var replayItem = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, receipt.PurchaseOrderItemID);
          if (replayItem) this._reconcileReceiptOrderStatus_(replayItem.PurchaseOrderID, user.TenantID, this._now_());
        }, this);
        return Response.success(replayedReceipts.map(function(receipt) {
          return Object.assign({ IdempotentReplay: true }, receipt);
        }));
      }
      var now = this._now_();
      var created = normalizedEntries.map(function(entry) {
        return {
          ID: this._id_('REC'),
          TenantID: user.TenantID,
          PurchaseOrderItemID: entry.item.ID,
          ProjectID: entry.projectId,
          QuantityReceived: entry.quantity,
          ReceivedAt: entry.body.ReceivedAt || now,
          WarehouseDepartmentID: entry.body.WarehouseDepartmentID || '',
          SourceEventID: entry.body.SourceEventID || '',
          Notes: String(entry.body.Notes || '') + (entry.overReceiptOverride ? '\n[OVER_RECEIPT_OVERRIDE] ' + entry.overReceiptOverride.Reason : ''),
          ReceivedBy: user.ID,
          CreatedAt: now,
          IdempotencyKey: String(entry.body.IdempotencyKey || '')
        };
      }, this);

      // One sheet write instead of re-reading and re-writing receipt totals per line.
      GoogleSheetsRepository.insertMany(ProcurementRepository.SHEETS.RECEIPTS, created);

      var allItems = ProcurementRepository.getItems(user.TenantID);
      var itemsByOrder = {};
      allItems.forEach(function(item) {
        var orderKey = String(item.PurchaseOrderID || '');
        if (!itemsByOrder[orderKey]) itemsByOrder[orderKey] = [];
        itemsByOrder[orderKey].push(item);
      });
      var receiptTotals = Object.assign({}, receivedByItem);
      created.forEach(function(receipt) {
        var key = String(receipt.PurchaseOrderItemID || '');
        receiptTotals[key] = (receiptTotals[key] || 0) + (Number(receipt.QuantityReceived) || 0);
      });

      var updatedOrders = {};
      normalizedEntries.forEach(function(entry) {
        var order = entry.order;
        var orderKey = String(order.ID);
        if (updatedOrders[orderKey]) return;
        var orderItems = itemsByOrder[orderKey] || [];
        var orderedTotal = 0;
        var receivedTotal = 0;
        orderItems.forEach(function(item) {
          orderedTotal += Math.max(0, Number(item.OrderedQuantity) || 0);
          receivedTotal += Math.min(Math.max(0, Number(item.OrderedQuantity) || 0), receiptTotals[String(item.ID)] || 0);
        });
        if (String(order.Status || '').toUpperCase() !== 'NEEDS_REVIEW') {
          var updated = Object.assign({}, order);
          updated.Status = orderedTotal > 0 && receivedTotal >= orderedTotal ? 'RECEIVED' :
            (receivedTotal > 0 ? 'PARTIALLY_RECEIVED' : 'ACTIVE');
          updated.UpdatedAt = now;
          try {
            GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, updated);
          } catch (statusError) {
            try {
              AuditService.log({
                TenantID: user.TenantID,
                UserID: user.ID,
                Action: 'RECOVERY_REQUIRED',
                EntityType: 'PURCHASE_ORDER',
                EntityID: order.ID,
                NewData: {
                  FailureStage: 'RECEIPT_ORDER_STATUS_UPDATE',
                  OriginalError: String(statusError && (statusError.message || statusError) || statusError),
                  ReceiptIDs: created.filter(function(receipt) { return String(receipt.PurchaseOrderItemID) === String(entry.item.ID); }).map(function(receipt) { return receipt.ID; })
                }
              });
            } catch (auditError) {}
            throw statusError;
          }
        }
        updatedOrders[orderKey] = true;
      });

      replayedReceipts.forEach(function(receipt) {
        var replayItem = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, receipt.PurchaseOrderItemID);
        if (!replayItem) return;
        var replayOrderId = String(replayItem.PurchaseOrderID || '');
        if (updatedOrders[replayOrderId]) return;
        this._reconcileReceiptOrderStatus_(replayOrderId, user.TenantID, now);
      }, this);

      created.forEach(function(receipt, index) {
        var createdEntry = normalizedEntries[index];
        if (createdEntry && createdEntry.overReceiptOverride) {
          AuditService.log({
            TenantID: user.TenantID,
            UserID: user.ID,
            Action: 'OVER_RECEIPT_OVERRIDE',
            EntityType: 'MATERIAL_RECEIPT',
            EntityID: receipt.ID,
            NewData: { Receipt: receipt, Override: createdEntry.overReceiptOverride }
          });
        }
        AuditService.log({
          TenantID: user.TenantID,
          UserID: user.ID,
          Action: 'CREATE',
          EntityType: 'MATERIAL_RECEIPT',
          EntityID: receipt.ID,
          NewData: receipt
        });
      });
      return Response.success(created.concat(replayedReceipts));
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Reconcile the parent order after a receipt write or idempotent replay.
   * Receipt rows are the source of truth; a prior status update may have failed
   * after the receipt was persisted, so retries must repair the derived status.
   */
  _reconcileReceiptOrderStatus_: function(orderId, tenantId, now) {
    var order = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ORDERS, orderId);
    if (!order || String(order.TenantID) !== String(tenantId)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'سفارش دریافت برای بازیابی پیدا نشد.');
    }
    if (['NEEDS_REVIEW', 'CANCELLED'].indexOf(String(order.Status || '').toUpperCase()) !== -1) return order;

    var items = ProcurementRepository.getItems(tenantId).filter(function(item) {
      return String(item.PurchaseOrderID || '') === String(orderId);
    });
    var receipts = ProcurementRepository.getReceipts(tenantId).filter(function(receipt) { return ProcurementService._active_(receipt.Status); }, this);
    var orderedTotal = 0;
    var receivedTotal = 0;
    items.forEach(function(item) {
      var ordered = Math.max(0, Number(item.OrderedQuantity) || 0);
      orderedTotal += ordered;
      receivedTotal += receipts.filter(function(receipt) {
        return String(receipt.PurchaseOrderItemID || '') === String(item.ID);
      }).reduce(function(sum, receipt) {
        return sum + (Number(receipt.QuantityReceived) || 0);
      }, 0);
    });

    var status = orderedTotal > 0 && receivedTotal >= orderedTotal ? 'RECEIVED' :
      (receivedTotal > 0 ? 'PARTIALLY_RECEIVED' : 'ACTIVE');
    if (String(order.Status || '').toUpperCase() !== status) {
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, {
        Status: status,
        UpdatedAt: now || this._now_()
      });
    }
    return Object.assign({}, order, { Status: status, UpdatedAt: now || this._now_() });
  },

  _createReceiptUnlocked_: function(body, params) {
    body = body || {};
    var user = this._user_(params);
    if (body.SourceEventID) {
      var eventReceiptReplay = ProcurementRepository.getReceipts(user.TenantID).find(function(existing) {
        return String(existing.SourceEventID || '') === String(body.SourceEventID) &&
          String(existing.PurchaseOrderItemID || '') === String(body.PurchaseOrderItemID || '') &&
          String(existing.Status || '').toUpperCase() !== 'VOID';
      });
      if (eventReceiptReplay) {
        var eventReplayItem = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, eventReceiptReplay.PurchaseOrderItemID);
        if (eventReplayItem) this._reconcileReceiptOrderStatus_(eventReplayItem.PurchaseOrderID, user.TenantID, this._now_());
        return Response.success(Object.assign({ IdempotentReplay: true }, eventReceiptReplay));
      }
    }
    Validator.required(body.PurchaseOrderItemID, 'قلم سفارش');
    var quantity = this._number_(body.QuantityReceived, 'مقدار تحویل', false);
    var item = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, body.PurchaseOrderItemID);
    if (!item || String(item.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قلم سفارش معتبر نیست.');
    }
    var order = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ORDERS, item.PurchaseOrderID);
    if (!order || String(order.TenantID) !== String(user.TenantID) || String(order.Status).toUpperCase() === 'CANCELLED') {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'سفارش خرید معتبر یا فعال نیست.');
    }
    var projectId = body.ProjectID || '';
    this._validateProject_(projectId, user.TenantID, user);

    var itemAllocations = ProcurementRepository.getAllocations(user.TenantID).filter(function(allocation) {
      return ProcurementService._active_(allocation.Status) && String(allocation.PurchaseOrderItemID || '') === String(item.ID);
    }, this);
    if (itemAllocations.length) {
      if (!projectId) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای دریافت این قلم باید پروژه تخصیص‌یافته انتخاب شود.');
      }
      var allocatedToProject = itemAllocations.filter(function(allocation) {
        return String(allocation.ProjectID || '') === String(projectId);
      }).reduce(function(sum, allocation) {
        return sum + Math.max(0, Number(allocation.AllocatedQuantity) || 0);
      }, 0);
      if (allocatedToProject <= 0) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'این قلم سفارش به پروژه انتخاب‌شده تخصیص نیافته است.');
      }
      var projectReceived = ProcurementRepository.getReceipts(user.TenantID).filter(function(receipt) {
        return ProcurementService._active_(receipt.Status) && String(receipt.PurchaseOrderItemID) === String(item.ID) && String(receipt.ProjectID || '') === String(projectId);
      }, this).reduce(function(sum, receipt) {
        return sum + (Number(receipt.QuantityReceived) || 0);
      }, 0);
      if (projectReceived + quantity > allocatedToProject) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مقدار دریافت از سهم تخصیص‌یافته این پروژه بیشتر است.');
      }
    } else {
      var expectedProjectId = item.ProjectID || order.ProjectID || '';
      if (expectedProjectId && String(projectId) !== String(expectedProjectId)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'پروژه دریافت با پروژه مرتبط با قلم سفارش مطابقت ندارد.');
      }
    }

    var allPriorReceipts = ProcurementRepository.getReceipts(user.TenantID).filter(function(receipt) { return ProcurementService._active_(receipt.Status); }, this);
    var prior = allPriorReceipts.filter(function(receipt) {
      return String(receipt.PurchaseOrderItemID) === String(item.ID);
    }).reduce(function(sum, receipt) {
      return sum + (Number(receipt.QuantityReceived) || 0);
    }, 0);
    var ordered = Math.max(0, Number(item.OrderedQuantity) || 0);
    var overReceiptOverride = null;
    if (prior + quantity > ordered) {
      var overrideReason = String(body.OverReceiptReason || '').trim();
      if (body.AllowOverReceipt !== true || !overrideReason) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مقدار تحویل جدید از مقدار باقیمانده سفارش بیشتر است. برای استثنا باید AllowOverReceipt=true و دلیل صریح ثبت شود.');
      }
      overReceiptOverride = {
        PreviousReceivedQuantity: prior,
        OrderedQuantity: ordered,
        RequestedQuantity: quantity,
        CumulativeReceivedQuantity: prior + quantity,
        ExcessQuantity: prior + quantity - ordered,
        Reason: overrideReason
      };
    }

    var now = this._now_();
    var receipt = {
      ID: this._id_('REC'),
      TenantID: user.TenantID,
      PurchaseOrderItemID: item.ID,
      ProjectID: projectId,
      QuantityReceived: quantity,
      ReceivedAt: body.ReceivedAt || now,
      WarehouseDepartmentID: body.WarehouseDepartmentID || '',
      SourceEventID: body.SourceEventID || '',
      Notes: String(body.Notes || '') + (overReceiptOverride ? '\n[OVER_RECEIPT_OVERRIDE] ' + overReceiptOverride.Reason : ''),
      ReceivedBy: user.ID,
      CreatedAt: now,
      IdempotencyKey: String(body.IdempotencyKey || '')
    };
    this._validateEvent_(receipt.SourceEventID, user.TenantID, user);
    GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.RECEIPTS, receipt);

    var allItems = ProcurementRepository.getItems(user.TenantID).filter(function(candidate) {
      return String(candidate.PurchaseOrderID) === String(order.ID);
    });
    var allReceipts = ProcurementRepository.getReceipts(user.TenantID).filter(function(existingReceipt) { return ProcurementService._active_(existingReceipt.Status); }, this);
    var allReceived = 0;
    var allOrdered = 0;
    allItems.forEach(function(candidate) {
      allOrdered += Math.max(0, Number(candidate.OrderedQuantity) || 0);
      allReceived += allReceipts.filter(function(existingReceipt) {
        return String(existingReceipt.PurchaseOrderItemID) === String(candidate.ID);
      }).reduce(function(sum, existingReceipt) {
        return sum + (Number(existingReceipt.QuantityReceived) || 0);
      }, 0);
    });
    var updated = Object.assign({}, order);
    if (String(order.Status || '').toUpperCase() !== 'NEEDS_REVIEW') {
      updated.Status = allReceived >= allOrdered ? 'RECEIVED' :
        (allReceived > 0 ? 'PARTIALLY_RECEIVED' : 'ACTIVE');
    }
    updated.UpdatedAt = now;
    try {
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, updated);
    } catch (statusError) {
      try {
        AuditService.log({
          TenantID: user.TenantID,
          UserID: user.ID,
          Action: 'RECOVERY_REQUIRED',
          EntityType: 'MATERIAL_RECEIPT',
          EntityID: receipt.ID,
          NewData: {
            FailureStage: 'RECEIPT_ORDER_STATUS_UPDATE',
            PurchaseOrderID: order.ID,
            OriginalError: String(statusError && (statusError.message || statusError) || statusError)
          }
        });
      } catch (auditError) {}
      throw statusError;
    }
    if (overReceiptOverride) {
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: 'OVER_RECEIPT_OVERRIDE',
        EntityType: 'MATERIAL_RECEIPT',
        EntityID: receipt.ID,
        NewData: { Receipt: receipt, Override: overReceiptOverride }
      });
    }
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'CREATE',EntityType:'MATERIAL_RECEIPT',EntityID:receipt.ID,NewData:receipt});
    return Response.success(receipt);
  },


  cancelOrder: function(orderId, body, params) {
    body = body || {};
    var user = this._user_(params);
    var reason = String(body.Reason || body.reason || '').trim();
    if (!reason) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای لغو سفارش، دلیل الزامی است.');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات تأمین دیگری در حال انجام است؛ دوباره تلاش کنید.');
    try {
      var order = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ORDERS, orderId);
      if (!order || String(order.TenantID) !== String(user.TenantID)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'سفارش معتبر نیست.');
      var status = String(order.Status || '').toUpperCase();
      if (status === 'CANCELLED') return Response.success(Object.assign({ IdempotentReplay: true }, order));
      if (status === 'NEEDS_REVIEW') throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'سفارش نیازمند بررسی است؛ پیش از لغو باید وضعیت آن تعیین تکلیف شود.');
      var itemIds = ProcurementRepository.getItems(user.TenantID).filter(function(item) {
        return String(item.PurchaseOrderID) === String(order.ID);
      }).map(function(item) { return String(item.ID); });
      var activeReceipt = ProcurementRepository.getReceipts(user.TenantID).find(function(receipt) {
        return ProcurementService._active_(receipt.Status) && itemIds.indexOf(String(receipt.PurchaseOrderItemID || '')) !== -1;
      }, this);
      if (activeReceipt) throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'سفارش دارای دریافت فعال است؛ ابتدا رسیدهای مرتبط را با دلیل ابطال کنید.');
      var now = this._now_();
      var updated = Object.assign({}, order, {
        Status: 'CANCELLED',
        Notes: String(order.Notes || '') + (String(order.Notes || '').trim() ? '\n' : '') + '[CANCELLED] ' + reason,
        UpdatedAt: now
      });
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, updated);
      AuditService.log({ TenantID: user.TenantID, UserID: user.ID, Action: 'CANCEL', EntityType: 'PURCHASE_ORDER', EntityID: order.ID, OldData: order, NewData: updated, Reason: reason });
      return Response.success(updated);
    } finally {
      lock.releaseLock();
    }
  },

  reviseOrderItemQuantity: function(itemId, body, params) {
    body = body || {};
    var user = this._user_(params);
    var reason = String(body.Reason || body.reason || '').trim();
    if (!reason) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای اصلاح مقدار سفارش، دلیل الزامی است.');
    var quantity = this._number_(body.OrderedQuantity, 'مقدار سفارش اصلاح‌شده', false);
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات تأمین دیگری در حال انجام است؛ دوباره تلاش کنید.');
    try {
      var item = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, itemId);
      if (!item || String(item.TenantID) !== String(user.TenantID)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قلم سفارش معتبر نیست.');
      var order = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ORDERS, item.PurchaseOrderID);
      if (!order || String(order.TenantID) !== String(user.TenantID) || ['CANCELLED', 'NEEDS_REVIEW'].indexOf(String(order.Status || '').toUpperCase()) !== -1) {
        throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'سفارش برای اصلاح فعال یا قابل بررسی نیست.');
      }
      var receipts = ProcurementRepository.getReceipts(user.TenantID).filter(function(receipt) {
        return ProcurementService._active_(receipt.Status) && String(receipt.PurchaseOrderItemID) === String(item.ID);
      }, this);
      if (receipts.length) throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'قلم دارای دریافت فعال است؛ ابتدا دریافت‌ها را با حفظ سابقه ابطال کنید.');
      var allocations = ProcurementRepository.getAllocations(user.TenantID).filter(function(allocation) {
        return ProcurementService._active_(allocation.Status) && String(allocation.PurchaseOrderItemID) === String(item.ID);
      }, this);
      var allocated = allocations.reduce(function(sum, allocation) {
        return sum + Math.max(0, Number(allocation.AllocatedQuantity) || 0);
      }, 0);
      if (quantity < allocated) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مقدار اصلاح‌شده از مجموع تخصیص‌های فعال کمتر است.');
      var now = this._now_();
      var oldItem = Object.assign({}, item);
      var surplus = Math.max(0, quantity - allocated);
      var updated = Object.assign({}, item, {
        OrderedQuantity: quantity,
        SurplusQuantity: surplus,
        SurplusCost: item.UnitPrice === '' || item.UnitPrice === null || item.UnitPrice === undefined ? '' : surplus * (Number(item.UnitPrice) || 0),
        Notes: String(item.Notes || '') + (String(item.Notes || '').trim() ? '\n' : '') + '[REVISED] ' + reason,
        UpdatedAt: now
      });
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ITEMS, item.ID, updated);
      AuditService.log({ TenantID: user.TenantID, UserID: user.ID, Action: 'REVISE', EntityType: 'PURCHASE_ORDER_ITEM', EntityID: item.ID, OldData: oldItem, NewData: updated, Reason: reason });
      return Response.success(updated);
    } finally {
      lock.releaseLock();
    }
  },

  voidReceipt: function(receiptId, body, params) {
    body = body || {};
    var user = this._user_(params);
    var reason = String(body.Reason || body.reason || '').trim();
    if (!reason) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای ابطال رسید، دلیل الزامی است.');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات تأمین دیگری در حال انجام است؛ دوباره تلاش کنید.');
    try {
      var receipt = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.RECEIPTS, receiptId);
      if (!receipt || String(receipt.TenantID) !== String(user.TenantID)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رسید معتبر نیست.');
      if (!ProcurementService._active_(receipt.Status)) {
        var replayItem = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, receipt.PurchaseOrderItemID);
        if (replayItem && String(replayItem.TenantID) === String(user.TenantID)) {
          this._reconcileReceiptOrderStatus_(replayItem.PurchaseOrderID, user.TenantID, this._now_());
        }
        return Response.success(Object.assign({ IdempotentReplay: true }, receipt));
      }
      var item = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, receipt.PurchaseOrderItemID);
      if (!item || String(item.TenantID) !== String(user.TenantID)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قلم سفارش رسید معتبر نیست.');
      var now = this._now_();
      var updated = Object.assign({}, receipt, {
        Status: 'VOID', VoidedAt: now, VoidedBy: user.ID, VoidReason: reason,
        Notes: String(receipt.Notes || '') + (String(receipt.Notes || '').trim() ? '\n' : '') + '[VOID] ' + reason
      });
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.RECEIPTS, receipt.ID, updated);
      AuditService.log({ TenantID: user.TenantID, UserID: user.ID, Action: 'VOID', EntityType: 'MATERIAL_RECEIPT', EntityID: receipt.ID, OldData: receipt, NewData: updated, Reason: reason });
      this._reconcileReceiptOrderStatus_(item.PurchaseOrderID, user.TenantID, now);
      return Response.success(updated);
    } finally {
      lock.releaseLock();
    }
  },

  voidAllocation: function(allocationId, body, params) {
    body = body || {};
    var user = this._user_(params);
    var reason = String(body.Reason || body.reason || '').trim();
    if (!reason) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای لغو تخصیص، دلیل الزامی است.');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'عملیات تأمین دیگری در حال انجام است؛ دوباره تلاش کنید.');
    try {
      var allocation = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ALLOCATIONS, allocationId);
      if (!allocation || String(allocation.TenantID) !== String(user.TenantID)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'تخصیص معتبر نیست.');
      if (!ProcurementService._active_(allocation.Status)) return Response.success(Object.assign({ IdempotentReplay: true }, allocation));
      var item = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.ITEMS, allocation.PurchaseOrderItemID);
      if (!item || String(item.TenantID) !== String(user.TenantID)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'قلم سفارش تخصیص معتبر نیست.');
      var activeReceipt = ProcurementRepository.getReceipts(user.TenantID).find(function(receipt) {
        return ProcurementService._active_(receipt.Status) && String(receipt.PurchaseOrderItemID) === String(item.ID) &&
          String(receipt.ProjectID || '') === String(allocation.ProjectID || '');
      }, this);
      if (activeReceipt) throw ErrorHandler.create(Constants.ERROR.CONFLICT, 'برای این تخصیص دریافت فعال وجود دارد؛ ابتدا رسید مربوطه را با دلیل ابطال کنید.');
      var now = this._now_();
      var updated = Object.assign({}, allocation, { Status: 'VOID', VoidedAt: now, VoidedBy: user.ID, VoidReason: reason });
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ALLOCATIONS, allocation.ID, updated);
      AuditService.log({ TenantID: user.TenantID, UserID: user.ID, Action: 'VOID', EntityType: 'PURCHASE_ALLOCATION', EntityID: allocation.ID, OldData: allocation, NewData: updated, Reason: reason });
      return Response.success(updated);
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Memoize tenant-scoped procurement collections for the lifetime of a read request.
   * Composite endpoints call multiple read services that otherwise fetch the same collections.
   * This cache is request-scoped only and must never survive the current API request.
   */
  _requestRows_: function(context, collection, tenantId) {
    context = context || {};
    var cache = context.procurementRows || (context.procurementRows = Object.create(null));
    var key = String(tenantId || '') + '|' + String(collection);
    if (!Object.prototype.hasOwnProperty.call(cache, key)) {
      var readers = {
        needs: 'getNeeds', orders: 'getOrders', items: 'getItems',
        allocations: 'getAllocations', receipts: 'getReceipts'
      };
      var reader = readers[collection];
      if (!reader || typeof ProcurementRepository[reader] !== 'function') {
        throw new Error('Unsupported procurement collection: ' + collection);
      }
      cache[key] = ProcurementRepository[reader](tenantId);
    }
    return cache[key];
  },

  listNeeds: function(params, sharedContext) {
    var context = sharedContext || {};
    var user = context.user || this._user_(params);
    context.user = user;
    var visibilityCache = context.projectVisibilityCache || (context.projectVisibilityCache = Object.create(null));
    var needs = this._requestRows_(context, 'needs', user.TenantID);
    var items = this._requestRows_(context, 'items', user.TenantID);
    var orders = this._requestRows_(context, 'orders', user.TenantID);
    var allocations = this._requestRows_(context, 'allocations', user.TenantID);
    var receipts = this._requestRows_(context, 'receipts', user.TenantID);
    var orderById = Object.create(null);
    orders.forEach(function(order) { orderById[String(order.ID)] = order; });
    var countableItemIds = Object.create(null);
    items.forEach(function(item) {
      var parent = orderById[String(item.PurchaseOrderID || '')];
      var status = String(parent && parent.Status || '').toUpperCase();
      if (parent && ['CANCELLED', 'VOID', 'DELETED', 'NEEDS_REVIEW'].indexOf(status) === -1) {
        countableItemIds[String(item.ID)] = true;
      }
    });
    var self = this;
    var itemById = {};
    var needById = Object.create(null);
    needs.forEach(function(need) { needById[String(need.ID)] = need; });
    var allocationsByItem = {};
    var orderedByNeed = {};
    var receivedByNeed = {};
    var receivedByItem = {};

    items.forEach(function(item) {
      itemById[String(item.ID)] = item;
    });
    allocations.forEach(function(allocation) {
      if (!ProcurementService._active_(allocation.Status)) return;
      var itemId = String(allocation.PurchaseOrderItemID || '');
      if (!allocationsByItem[itemId]) allocationsByItem[itemId] = [];
      allocationsByItem[itemId].push(allocation);
      var needId = String(allocation.MaterialNeedID || '');
      var linkedNeed = needById[needId];
      var effectiveKey = linkedNeed ? self._needKey_(linkedNeed, allocation.ProjectID || linkedNeed.ProjectID) : ('NEED|' + needId);
      if (needId && countableItemIds[itemId]) orderedByNeed[effectiveKey] = (orderedByNeed[effectiveKey] || 0) +
        (Number(allocation.AllocatedQuantity) || 0);
    });
    items.forEach(function(item) {
      var itemId = String(item.ID);
      if (!countableItemIds[itemId] || (allocationsByItem[itemId] || []).length) return;
      var needId = String(item.MaterialNeedID || '');
      if (needId) {
        var linkedNeed = needById[needId];
        var effectiveKey = linkedNeed ? self._needKey_(linkedNeed, linkedNeed.ProjectID || item.ProjectID) : ('NEED|' + needId);
        var legacyOrNewSurplus = item.SurplusQuantity === undefined || item.SurplusQuantity === null
          ? 0 : Math.max(0, Number(item.SurplusQuantity) || 0);
        orderedByNeed[effectiveKey] = (orderedByNeed[effectiveKey] || 0) +
          Math.max(0, (Number(item.OrderedQuantity) || 0) - legacyOrNewSurplus);
      }
    });
    receipts.forEach(function(receipt) {
      if (!ProcurementService._active_(receipt.Status)) return;
      var itemId = String(receipt.PurchaseOrderItemID || '');
      var quantity = Number(receipt.QuantityReceived) || 0;
      receivedByItem[itemId] = (receivedByItem[itemId] || 0) + quantity;
    });
    items.forEach(function(item) {
      var itemId = String(item.ID);
      var itemReceived = receivedByItem[itemId] || 0;
      var linkedAllocations = allocationsByItem[itemId] || [];
      if (linkedAllocations.length) {
        var allocatedTotal = linkedAllocations.reduce(function(sum, allocation) {
          return sum + Math.max(0, Number(allocation.AllocatedQuantity) || 0);
        }, 0);
        var receivedForNeeds = Math.min(itemReceived, allocatedTotal);
        linkedAllocations.forEach(function(allocation) {
          var needId = String(allocation.MaterialNeedID || '');
          if (!needId) return;
          var linkedNeed = needById[needId];
          var effectiveKey = linkedNeed ? self._needKey_(linkedNeed, allocation.ProjectID || linkedNeed.ProjectID) : ('NEED|' + needId);
          var share = allocatedTotal > 0
            ? receivedForNeeds * (Number(allocation.AllocatedQuantity) || 0) / allocatedTotal
            : 0;
          receivedByNeed[effectiveKey] = (receivedByNeed[effectiveKey] || 0) + share;
        });
      } else {
        var needId = String(item.MaterialNeedID || '');
        if (needId) {
          var linkedNeed = needById[needId];
          var effectiveKey = linkedNeed ? self._needKey_(linkedNeed, linkedNeed.ProjectID || item.ProjectID) : ('NEED|' + needId);
          var surplusForUnallocatedItem = item.SurplusQuantity === undefined || item.SurplusQuantity === null
            ? 0 : Math.max(0, Number(item.SurplusQuantity) || 0);
          var quantityForNeed = Math.max(0, (Number(item.OrderedQuantity) || 0) - surplusForUnallocatedItem);
          receivedByNeed[effectiveKey] = (receivedByNeed[effectiveKey] || 0) +
            Math.min(itemReceived, quantityForNeed);
        }
      }
    });

    var confirmedSpecKeys = Object.create(null);
    needs.forEach(function(need) {
      if (String(need.NeedType || '').toUpperCase() === 'CONFIRMED' &&
          String(need.Status || 'ACTIVE').toUpperCase() === 'ACTIVE' && need.MaterialSpecKey) {
        confirmedSpecKeys[String(need.ProjectID) + '|' + String(need.MaterialSpecKey)] = true;
      }
    });
    return Response.success(needs.filter(function(need) {
      var specKey = String(need.ProjectID || '') + '|' + String(need.MaterialSpecKey || '');
      var status = String(need.Status || 'ACTIVE').toUpperCase();
      var superseded = status === 'SUPERSEDED' ||
        (String(need.NeedType || '').toUpperCase() === 'ESTIMATED' && confirmedSpecKeys[specKey]);
      return !superseded && this._isProjectVisible_(need.ProjectID, user, visibilityCache);
    }, this).map(function(need) {
      var copy = Object.assign({}, need);
      var requested = Math.max(0, Number(need.RequestedQuantity) || 0);
      var needKey = self._needKey_(need, need.ProjectID);
      var rawOrdered = Math.max(0, orderedByNeed[needKey] || 0);
      var ordered = Math.min(requested, rawOrdered);
      var received = Math.min(requested, Math.max(0, receivedByNeed[needKey] || 0));
      copy.OverOrderedQuantity = Math.max(0, rawOrdered - requested);
      copy.OrderedQuantity = ordered;
      copy.ReceivedQuantity = received;
      copy.RemainingToOrderQuantity = Math.max(0, requested - Math.max(ordered, received));
      copy.RemainingDeliveryQuantity = Math.max(0, ordered - received);
      copy.ProcurementStatus = String(need.Status || '').toUpperCase() === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW'
        : (received >= requested ? 'RECEIVED'
        : (ordered >= requested ? (received > 0 ? 'PARTIALLY_RECEIVED' : 'ORDERED')
        : (ordered > 0 ? 'PARTIALLY_ORDERED' : (received > 0 ? 'PARTIALLY_RECEIVED' : 'NEEDS_PURCHASE'))));
      return copy;
    }));
  },

  listOrders: function(params, sharedContext) {
    var context = sharedContext || {};
    var user = context.user || this._user_(params);
    context.user = user;
    var visibilityCache = context.projectVisibilityCache || (context.projectVisibilityCache = Object.create(null));
    var orders = this._requestRows_(context, 'orders', user.TenantID);
    var items = this._requestRows_(context, 'items', user.TenantID);
    var receipts = this._requestRows_(context, 'receipts', user.TenantID);
    var allocations = this._requestRows_(context, 'allocations', user.TenantID);
    var needs = this._requestRows_(context, 'needs', user.TenantID);
    var allocationsByItem = {};
    var needsById = {};
    var itemsByOrder = {};
    var receiptsByItem = {};

    allocations.forEach(function(allocation) {
      if (!ProcurementService._active_(allocation.Status)) return;
      var itemId = String(allocation.PurchaseOrderItemID || '');
      if (!itemId) return;
      if (!allocationsByItem[itemId]) allocationsByItem[itemId] = [];
      allocationsByItem[itemId].push(allocation);
    });
    needs.forEach(function(need) {
      if (need && need.ID) needsById[String(need.ID)] = need;
    });

    items.forEach(function(item) {
      var key = String(item.PurchaseOrderID || '');
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push(item);
    });
    receipts.forEach(function(receipt) {
      if (!ProcurementService._active_(receipt.Status)) return;
      var key = String(receipt.PurchaseOrderItemID || '');
      if (!key) return;
      receiptsByItem[key] = receiptsByItem[key] || { quantity: 0, records: [] };
      receiptsByItem[key].quantity += Number(receipt.QuantityReceived) || 0;
      receiptsByItem[key].records.push({
        ID: receipt.ID || '',
        ProjectID: String(receipt.ProjectID || ''),
        QuantityReceived: Number(receipt.QuantityReceived) || 0,
        ReceivedAt: receipt.ReceivedAt || receipt.CreatedAt || '',
        Notes: receipt.Notes || ''
      });
    });
    Object.keys(receiptsByItem).forEach(function(key) {
      receiptsByItem[key].records.sort(function(a, b) {
        var aTime = new Date(a.ReceivedAt || 0).getTime() || 0;
        var bTime = new Date(b.ReceivedAt || 0).getTime() || 0;
        return aTime - bTime;
      });
    });

    var mappedOrders = orders.map(function(order) {
      var copy = Object.assign({}, order);
      copy.Items = (itemsByOrder[String(order.ID)] || []).map(function(item) {
        var itemCopy = Object.assign({}, item);
        var linkedAllocations = allocationsByItem[String(item.ID)] || [];
        var need = needsById[String(item.MaterialNeedID || '')];
        var projectIds = [];
        linkedAllocations.forEach(function(allocation) {
          var projectId = String(allocation.ProjectID || '');
          if (projectId && projectIds.indexOf(projectId) === -1) projectIds.push(projectId);
        });
        if (!projectIds.length && need && need.ProjectID) projectIds.push(String(need.ProjectID));
        if (!projectIds.length && order.ProjectID) projectIds.push(String(order.ProjectID));
        itemCopy.ProjectID = projectIds.length === 1 ? projectIds[0] : '';
        itemCopy.ProjectIDs = projectIds;
        itemCopy.Allocations = linkedAllocations.map(function(allocation) {
          return {
            ProjectID: String(allocation.ProjectID || ''),
            MaterialNeedID: String(allocation.MaterialNeedID || ''),
            AllocatedQuantity: Number(allocation.AllocatedQuantity) || 0
          };
        });
        var itemReceipts = receiptsByItem[String(item.ID)] || { quantity: 0, records: [] };
        itemCopy.ReceivedQuantity = itemReceipts.quantity || 0;
        itemCopy.Receipts = itemReceipts.records || [];
        itemCopy.RemainingQuantity = Math.max(
          0, (Number(item.OrderedQuantity) || 0) - itemCopy.ReceivedQuantity
        );
        return itemCopy;
      });
      var orderProjectIds = [];
      copy.Items.forEach(function(item) {
        (item.ProjectIDs || []).forEach(function(projectId) {
          if (projectId && orderProjectIds.indexOf(String(projectId)) === -1) orderProjectIds.push(String(projectId));
        });
      });
      copy.ProjectID = orderProjectIds.length === 1 ? orderProjectIds[0] : (order.ProjectID || '');
      copy.ProjectIDs = orderProjectIds;
      return copy;
    });
    // Orders allocated to any inaccessible project are omitted as a whole to
    // prevent leaking hidden project labels, item quantities, or receipt details.
    var visibleOrders = mappedOrders.filter(function(order) {
      var ids = Array.isArray(order.ProjectIDs) ? order.ProjectIDs : [];
      return ids.every(function(id) { return this._isProjectVisible_(id, user, visibilityCache); }, this);
    }, this);
    return Response.success(visibleOrders);
  },

  /**
   * Combined procurement workspace response. Reuses request-scoped sheet caches
   * so the frontend can render the main screen with one backend round-trip.
   */
  workspace: function(params) {
    var sharedContext = { projectVisibilityCache: Object.create(null) };
    var ordersResponse = this.listOrders(params, sharedContext);
    var needsResponse = this.listNeeds(params, sharedContext);
    var dashboardResponse = this.dashboard(params, ordersResponse, sharedContext);
    return Response.success({
      summary: dashboardResponse && dashboardResponse.data ? dashboardResponse.data.summary : {},
      needs: needsResponse && Array.isArray(needsResponse.data) ? needsResponse.data : [],
      orders: ordersResponse && Array.isArray(ordersResponse.data) ? ordersResponse.data : []
    });
  },

  /**
   * Full procurement reporting dataset. Only tenant-owned records are included.
   * Filtering and export are handled client-side after this one on-demand request.
   */
  reports: function(params) {
    var sharedContext = { projectVisibilityCache: Object.create(null) };
    var user = this._user_(params);
    sharedContext.user = user;
    var needsResponse = this.listNeeds(params, sharedContext);
    var ordersResponse = this.listOrders(params, sharedContext);
    var needs = needsResponse && Array.isArray(needsResponse.data) ? needsResponse.data : [];
    var orders = ordersResponse && Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
    var projects = ProjectRepository.getAll().filter(function(project) {
      return String(project.TenantID || '') === String(user.TenantID || '') &&
        ProjectService._isProjectAvailableToUser_(project, user);
    });
    var projectById = {};
    projects.forEach(function(project) {
      projectById[String(project.ID)] = {
        ID: project.ID,
        ProjectCode: project.ProjectCode || project.Code || '',
        Title: project.Title || project.Name || '',
        Quantity: project.Quantity !== undefined ? project.Quantity : (project.TotalQuantity || ''),
        Status: project.Status || ''
      };
    });

    needs = needs.map(function(need) {
      var copy = Object.assign({}, need);
      var project = projectById[String(need.ProjectID || '')];
      copy.ProjectCode = project ? project.ProjectCode : '';
      copy.ProjectTitle = project ? project.Title : '';
      return copy;
    });
    var materialSpecsById = Object.create(null);
    GoogleSheetsRepository.getAll('24_ProjectMaterialSpecs').forEach(function(spec) {
      if (String(spec.TenantID || '') === String(user.TenantID || '')) {
        materialSpecsById[String(spec.ID)] = spec;
      }
    });
    var calculations = GoogleSheetsRepository.getAll('25_MaterialNeedCalculations').filter(function(row) {
      return String(row.TenantID || '') === String(user.TenantID || '') &&
        !!projectById[String(row.ProjectID || '')];
    }).map(function(row) {
      var copy = Object.assign({}, row);
      var spec = materialSpecsById[String(row.MaterialSpecID || '')];
      copy.MaterialSpecName = spec ? spec.ItemName : '';
      copy.ItemCode = spec ? spec.ItemCode : '';
      copy.Unit = spec ? spec.Unit : '';
      copy.SpecificationRevision = spec ? spec.Revision : '';
      return copy;
    });

    orders = orders.map(function(order) {
      var copy = Object.assign({}, order);
      var ids = Array.isArray(order.ProjectIDs) ? order.ProjectIDs.slice() : [];
      if (!ids.length && order.ProjectID) ids.push(String(order.ProjectID));
      copy.ProjectLabels = ids.map(function(id) {
        var project = projectById[String(id)];
        return project ? [project.ProjectCode, project.Title].filter(Boolean).join(' — ') : String(id);
      });
      copy.Items = (Array.isArray(order.Items) ? order.Items : []).map(function(item) {
        var itemCopy = Object.assign({}, item);
        var itemIds = Array.isArray(item.ProjectIDs) ? item.ProjectIDs.slice() : [];
        if (!itemIds.length && item.ProjectID) itemIds.push(String(item.ProjectID));
        itemCopy.ProjectLabels = itemIds.map(function(id) {
          var project = projectById[String(id)];
          return project ? [project.ProjectCode, project.Title].filter(Boolean).join(' — ') : String(id);
        });
        return itemCopy;
      });
      return copy;
    });

    return Response.success({
      generatedAt: this._now_(),
      projects: projects.map(function(project) {
        return projectById[String(project.ID)];
      }),
      needs: needs,
      orders: orders,
      calculations: calculations
    });
  },

  dashboard: function(params, preparedOrdersResponse, sharedContext) {
    var context = sharedContext || {};
    var user = context.user || this._user_(params);
    context.user = user;
    var visibilityCache = context.projectVisibilityCache || (context.projectVisibilityCache = Object.create(null));
    var needs = this._requestRows_(context, 'needs', user.TenantID);
    var allOrders = this._requestRows_(context, 'orders', user.TenantID);
    var allItems = this._requestRows_(context, 'items', user.TenantID);
    var allReceipts = this._requestRows_(context, 'receipts', user.TenantID);

    // Reuse the same visibility rules as the procurement workspace before
    // computing aggregate counts, so hidden-project records cannot affect totals.
    needs = needs.filter(function(need) {
      return this._isProjectVisible_(need.ProjectID, user, visibilityCache);
    }, this);
    var visibleOrdersResponse = preparedOrdersResponse || this.listOrders(params, context);
    var visibleOrders = visibleOrdersResponse && Array.isArray(visibleOrdersResponse.data)
      ? visibleOrdersResponse.data : [];
    var visibleOrderIds = Object.create(null);
    var visibleItemIds = Object.create(null);
    visibleOrders.forEach(function(order) {
      visibleOrderIds[String(order.ID)] = true;
      (Array.isArray(order.Items) ? order.Items : []).forEach(function(item) {
        visibleItemIds[String(item.ID)] = true;
      });
    });
    var orders = allOrders.filter(function(order) {
      return !!visibleOrderIds[String(order.ID)];
    });
    var items = allItems.filter(function(item) {
      return !!visibleItemIds[String(item.ID)];
    });
    var receipts = allReceipts.filter(function(receipt) {
      return !!visibleItemIds[String(receipt.PurchaseOrderItemID || '')];
    });
    var receivedByItem = {};

    receipts.forEach(function(receipt) {
      var key = String(receipt.PurchaseOrderItemID || '');
      if (!key) return;
      receivedByItem[key] = (receivedByItem[key] || 0) +
        (Number(receipt.QuantityReceived) || 0);
    });

    var orderedQuantity = 0;
    var receivedQuantity = 0;
    var pendingQuantity = 0;
    var surplusLineCount = 0;
    var surplusCost = 0;
    var surplusQuantityByUnit = {};
    items.forEach(function(item) {
      var ordered = Math.max(0, Number(item.OrderedQuantity) || 0);
      var received = Math.max(0, receivedByItem[String(item.ID)] || 0);
      orderedQuantity += ordered;
      receivedQuantity += Math.min(received, ordered);
      pendingQuantity += Math.max(0, ordered - received);
      var surplus = Math.max(0, Number(item.SurplusQuantity) || 0);
      if (surplus > 0) {
        surplusLineCount++;
        if (item.UnitPrice !== '' && item.UnitPrice !== undefined && item.UnitPrice !== null) {
          surplusCost += surplus * (Number(item.UnitPrice) || 0);
        }
        var unit = String(item.Unit || 'بدون واحد');
        surplusQuantityByUnit[unit] = (surplusQuantityByUnit[unit] || 0) + surplus;
      }
    });

    return Response.success({
      summary: {
        activeNeeds: needs.filter(function(row) {
          return ProcurementService._active_(row.Status);
        }, this).length,
        activeOrders: orders.filter(function(row) {
          return ProcurementService._active_(row.Status);
        }, this).length,
        orderedQuantity: orderedQuantity,
        receivedQuantity: receivedQuantity,
        pendingDeliveryQuantity: pendingQuantity,
        receiptRecords: receipts.length,
        surplusLineCount: surplusLineCount,
        surplusCost: surplusCost,
        surplusQuantityByUnit: surplusQuantityByUnit
      },
      recentNeeds: needs.slice(-10).reverse(),
      recentOrders: orders.slice(-10).reverse()
    });
  }
};
