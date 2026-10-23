/**
 * PROCUREMENT SERVICE
 * Tenant-scoped procurement needs, purchase orders and material receipts.
 */
const ProcurementService = {
  _user_: function(params) {
    return AccessControlService.getCurrentUser(params || {});
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

  _isProjectVisible_: function(projectId, user) {
    if (!projectId) return true;
    var project = ProjectRepository.findById(projectId);
    return !!project && String(project.TenantID) === String(user.TenantID) &&
      ProjectService._isProjectAvailableToUser_(project, user);
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

  createNeed: function(body, params) {
    body = body || {};
    var user = this._user_(params);
    Validator.required(body.ItemName, 'نام ملزوم');
    Validator.required(body.Unit, 'واحد اندازه‌گیری');
    var quantity = this._number_(body.RequestedQuantity, 'مقدار موردنیاز', false);
    this._validateProject_(body.ProjectID, user.TenantID, user);
    this._validateEvent_(body.SourceEventID, user.TenantID, user);
    if (body.SourceEventID) {
      var replayNeed = ProcurementRepository.getNeeds(user.TenantID).find(function(need) {
        return String(need.SourceEventID || '') === String(body.SourceEventID) &&
          String(need.ProjectID || '') === String(body.ProjectID || '') &&
          String(need.ItemName || '').trim() === String(body.ItemName).trim() &&
          String(need.Unit || '').trim() === String(body.Unit).trim() &&
          String(need.Status || '').toUpperCase() !== 'DELETED';
      });
      if (replayNeed) return Response.success(Object.assign({ IdempotentReplay: true }, replayNeed));
    }

    var now = this._now_();
    var record = {
      ID: this._id_('NEED'),
      TenantID: user.TenantID,
      ProjectID: body.ProjectID || '',
      SourceEventID: body.SourceEventID || '',
      ItemName: String(body.ItemName).trim(),
      ItemCode: this._itemCode_(),
      Unit: String(body.Unit).trim(),
      RequestedQuantity: quantity,
      NeededBy: body.NeededBy || '',
      Status: 'ACTIVE',
      Notes: String(body.Notes || ''),
      CreatedBy: user.ID,
      CreatedAt: now,
      UpdatedAt: now
    };
    GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.NEEDS, record);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'CREATE',EntityType:'MATERIAL_NEED',EntityID:record.ID,NewData:record});
    return Response.success(record);
  },

  createOrder: function(body, params) {
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
        return Response.success({ Order: replayOrder, Items: replayItems, IdempotentReplay: true });
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
      Status: 'ACTIVE',
      Notes: String(body.Notes || ''),
      CreatedBy: user.ID,
      CreatedAt: now,
      UpdatedAt: now,
      IdempotencyKey: idempotencyKey
    };

    // Google Sheets has no multi-sheet transaction. Validate the full payload before writing.
    GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.ORDERS, order);
    var createdItems = [];
    try {
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
        GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.ITEMS, row);
        createdItems.push(row);

        entry.allocations.forEach(function(allocation) {
          GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.ALLOCATIONS, {
            ID: self._id_('ALLOC'),
            TenantID: user.TenantID,
            PurchaseOrderItemID: row.ID,
            ProjectID: allocation.ProjectID,
            MaterialNeedID: allocation.MaterialNeedID,
            AllocatedQuantity: allocation.AllocatedQuantity,
            CreatedAt: now
          });
        });
      });
    } catch (error) {
      // Keep the order visible for recovery instead of deleting partial audit history.
      GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, {
        Status: 'NEEDS_REVIEW',
        Notes: (order.Notes ? order.Notes + '\n' : '') + 'ثبت اقلام ناقص ماند؛ نیازمند بررسی: ' + String(error.message || error)
      });
      throw error;
    }

    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'CREATE',EntityType:'PURCHASE_ORDER',EntityID:order.ID,NewData:{order:order,items:createdItems}});
    return Response.success({Order:order,Items:createdItems});
  },

  createReceipt: function(body, params) {
    body = body || {};
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ثبت دریافت دیگری در حال انجام است؛ چند لحظه بعد دوباره تلاش کنید.');
    }
    try {
      var user = this._user_(params);
      var idempotencyKey = String(body.IdempotencyKey || '').trim();
      if (idempotencyKey) {
        var replayReceipt = ProcurementRepository.getReceipts(user.TenantID).find(function(existing) {
          return String(existing.IdempotencyKey || '') === idempotencyKey;
        });
        if (replayReceipt) return Response.success(Object.assign({ IdempotentReplay: true }, replayReceipt));
      }
      return this._createReceiptUnlocked_(body, params);
    } finally {
      lock.releaseLock();
    }
  },

  createReceiptsBatch: function(body, params) {
    body = body || {};
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
      var allAllocations = ProcurementRepository.getAllocations(user.TenantID);

      existingReceipts.forEach(function(receipt) {
        var itemKey = String(receipt.PurchaseOrderItemID || '');
        var quantity = Number(receipt.QuantityReceived) || 0;
        if (!itemKey) return;
        receivedByItem[itemKey] = (receivedByItem[itemKey] || 0) + quantity;
        var projectKey = itemKey + '|' + String(receipt.ProjectID || '');
        receivedByItemProject[projectKey] = (receivedByItemProject[projectKey] || 0) + quantity;
      });
      allAllocations.forEach(function(allocation) {
        var key = String(allocation.PurchaseOrderItemID || '');
        if (!key) return;
        if (!allocationsByItem[key]) allocationsByItem[key] = [];
        allocationsByItem[key].push(allocation);
      });

      entries.forEach(function(entry) {
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
        if (prior + plannedByItem[key] > ordered) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مجموع دریافت‌های انتخاب‌شده از مقدار باقیمانده سفارش «' + String(item.ItemName || '') + '» بیشتر است.');
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
          quantity: quantity
        });
      }, this);

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
          Notes: String(entry.body.Notes || ''),
          ReceivedBy: user.ID,
          CreatedAt: now
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
          GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, updated);
        }
        updatedOrders[orderKey] = true;
      });

      created.forEach(function(receipt) {
        AuditService.log({
          TenantID: user.TenantID,
          UserID: user.ID,
          Action: 'CREATE',
          EntityType: 'MATERIAL_RECEIPT',
          EntityID: receipt.ID,
          NewData: receipt
        });
      });
      return Response.success(created);
    } finally {
      lock.releaseLock();
    }
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
      if (eventReceiptReplay) return Response.success(Object.assign({ IdempotentReplay: true }, eventReceiptReplay));
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
      return String(allocation.PurchaseOrderItemID || '') === String(item.ID);
    });
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
        return String(receipt.PurchaseOrderItemID) === String(item.ID) && String(receipt.ProjectID || '') === String(projectId);
      }).reduce(function(sum, receipt) {
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

    var allPriorReceipts = ProcurementRepository.getReceipts(user.TenantID);
    var prior = allPriorReceipts.filter(function(receipt) {
      return String(receipt.PurchaseOrderItemID) === String(item.ID);
    }).reduce(function(sum, receipt) {
      return sum + (Number(receipt.QuantityReceived) || 0);
    }, 0);
    var ordered = Number(item.OrderedQuantity) || 0;
    if (prior + quantity > ordered) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مقدار تحویل جدید از مقدار باقیمانده سفارش بیشتر است.');
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
      Notes: String(body.Notes || ''),
      ReceivedBy: user.ID,
      CreatedAt: now,
      IdempotencyKey: String(body.IdempotencyKey || '')
    };
    this._validateEvent_(receipt.SourceEventID, user.TenantID, user);
    GoogleSheetsRepository.insert(ProcurementRepository.SHEETS.RECEIPTS, receipt);

    var allItems = ProcurementRepository.getItems(user.TenantID).filter(function(candidate) {
      return String(candidate.PurchaseOrderID) === String(order.ID);
    });
    var allReceipts = ProcurementRepository.getReceipts(user.TenantID);
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
    GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, updated);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'CREATE',EntityType:'MATERIAL_RECEIPT',EntityID:receipt.ID,NewData:receipt});
    return Response.success(receipt);
  },

  listNeeds: function(params) {
    var user = this._user_(params);
    var needs = ProcurementRepository.getNeeds(user.TenantID);
    var items = ProcurementRepository.getItems(user.TenantID);
    var orders = ProcurementRepository.getOrders(user.TenantID);
    var allocations = ProcurementRepository.getAllocations(user.TenantID);
    var receipts = ProcurementRepository.getReceipts(user.TenantID);
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
      return !superseded && this._isProjectVisible_(need.ProjectID, user);
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
      copy.ProcurementStatus = received >= requested ? 'RECEIVED'
        : (ordered >= requested ? (received > 0 ? 'PARTIALLY_RECEIVED' : 'ORDERED')
        : (ordered > 0 ? 'PARTIALLY_ORDERED' : (received > 0 ? 'PARTIALLY_RECEIVED' : 'NEEDS_PURCHASE')));
      return copy;
    }));
  },

  listOrders: function(params) {
    var user = this._user_(params);
    var orders = ProcurementRepository.getOrders(user.TenantID);
    var items = ProcurementRepository.getItems(user.TenantID);
    var receipts = ProcurementRepository.getReceipts(user.TenantID);
    var allocations = ProcurementRepository.getAllocations(user.TenantID);
    var needs = ProcurementRepository.getNeeds(user.TenantID);
    var allocationsByItem = {};
    var needsById = {};
    var itemsByOrder = {};
    var receiptsByItem = {};

    allocations.forEach(function(allocation) {
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
      return ids.every(function(id) { return this._isProjectVisible_(id, user); }, this);
    }, this);
    return Response.success(visibleOrders);
  },

  /**
   * Combined procurement workspace response. Reuses request-scoped sheet caches
   * so the frontend can render the main screen with one backend round-trip.
   */
  workspace: function(params) {
    var dashboardResponse = this.dashboard(params);
    var needsResponse = this.listNeeds(params);
    var ordersResponse = this.listOrders(params);
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
    var user = this._user_(params);
    var needsResponse = this.listNeeds(params);
    var ordersResponse = this.listOrders(params);
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
    var calculations = GoogleSheetsRepository.getAll('25_MaterialNeedCalculations').filter(function(row) {
      return String(row.TenantID || '') === String(user.TenantID || '') &&
        !!projectById[String(row.ProjectID || '')];
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

  dashboard: function(params) {
    var user = this._user_(params);
    var needs = ProcurementRepository.getNeeds(user.TenantID);
    var allOrders = ProcurementRepository.getOrders(user.TenantID);
    var allItems = ProcurementRepository.getItems(user.TenantID);
    var allReceipts = ProcurementRepository.getReceipts(user.TenantID);

    // Reuse the same visibility rules as the procurement workspace before
    // computing aggregate counts, so hidden-project records cannot affect totals.
    needs = needs.filter(function(need) {
      return this._isProjectVisible_(need.ProjectID, user);
    }, this);
    var visibleOrdersResponse = this.listOrders(params);
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
          return this._active_(row.Status);
        }, this).length,
        activeOrders: orders.filter(function(row) {
          return this._active_(row.Status);
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
