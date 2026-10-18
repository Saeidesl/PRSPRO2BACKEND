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

  _validateProject_: function(projectId, tenantId) {
    if (!projectId) return null;
    var project = ProjectRepository.findById(projectId);
    if (!project || String(project.TenantID) !== String(tenantId)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه معتبر نیست.');
    }
    return project;
  },

  _validateEvent_: function(eventId, tenantId) {
    if (!eventId) return null;
    var event = EventRepository.findById(eventId);
    if (!event || String(event.TenantID) !== String(tenantId)) {
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
    this._validateProject_(body.ProjectID, user.TenantID);
    this._validateEvent_(body.SourceEventID, user.TenantID);

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
    body = body || {};
    var user = this._user_(params);
    if (!Array.isArray(body.Items) || !body.Items.length) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'سفارش باید دست‌کم یک قلم داشته باشد.');
    }

    var self = this;
    // Validate and normalize the entire order graph before the first write.
    // Google Sheets cannot atomically commit across multiple sheets.
    var normalized = body.Items.map(function(item) {
      if (!item || !String(item.ItemName || '').trim() || !String(item.Unit || '').trim()) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام و واحد هر قلم سفارش الزامی است.');
      }

      var quantity = self._number_(item.OrderedQuantity, 'مقدار سفارش', false);
      var price = item.UnitPrice === '' || item.UnitPrice === undefined || item.UnitPrice === null
        ? '' : self._number_(item.UnitPrice, 'قیمت واحد', true);
      var project = self._validateProject_(item.ProjectID, user.TenantID);
      var needId = item.MaterialNeedID || '';
      var need = null;

      if (needId) {
        need = GoogleSheetsRepository.findById(ProcurementRepository.SHEETS.NEEDS, needId);
        if (!need || String(need.TenantID) !== String(user.TenantID)) {
          throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نیاز مرتبط با قلم سفارش معتبر نیست.');
        }
      }

      var allocations = Array.isArray(item.Allocations) ? item.Allocations : [];
      if (!allocations.length && item.ProjectID) {
        allocations = [{
          ProjectID: item.ProjectID,
          MaterialNeedID: needId,
          AllocatedQuantity: quantity
        }];
      }

      var normalizedAllocations = allocations.map(function(allocation) {
        if (!allocation || typeof allocation !== 'object') {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تخصیص قلم سفارش معتبر نیست.');
        }
        var allocationProject = self._validateProject_(allocation.ProjectID, user.TenantID);
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
        allocations: normalizedAllocations
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
      UpdatedAt: now
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
    var user = this._user_(params);
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
    this._validateProject_(projectId, user.TenantID);

    var prior = ProcurementRepository.getReceipts(user.TenantID).filter(function(receipt) {
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
      CreatedAt: now
    };
    this._validateEvent_(receipt.SourceEventID, user.TenantID);
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
    updated.Status = allReceived >= allOrdered ? 'RECEIVED' :
      (allReceived > 0 ? 'PARTIALLY_RECEIVED' : 'ACTIVE');
    updated.UpdatedAt = now;
    GoogleSheetsRepository.updateById(ProcurementRepository.SHEETS.ORDERS, order.ID, updated);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'CREATE',EntityType:'MATERIAL_RECEIPT',EntityID:receipt.ID,NewData:receipt});
    return Response.success(receipt);
  },

  listNeeds: function(params) {
    var user = this._user_(params);
    var needs = ProcurementRepository.getNeeds(user.TenantID);
    var items = ProcurementRepository.getItems(user.TenantID);
    var allocations = ProcurementRepository.getAllocations(user.TenantID);
    var receipts = ProcurementRepository.getReceipts(user.TenantID);
    var itemById = {};
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
      if (needId) orderedByNeed[needId] = (orderedByNeed[needId] || 0) +
        (Number(allocation.AllocatedQuantity) || 0);
    });
    items.forEach(function(item) {
      var itemId = String(item.ID);
      if ((allocationsByItem[itemId] || []).length) return;
      var needId = String(item.MaterialNeedID || '');
      if (needId) orderedByNeed[needId] = (orderedByNeed[needId] || 0) +
        (Number(item.OrderedQuantity) || 0);
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
        linkedAllocations.forEach(function(allocation) {
          var needId = String(allocation.MaterialNeedID || '');
          if (!needId) return;
          var share = allocatedTotal > 0
            ? itemReceived * (Number(allocation.AllocatedQuantity) || 0) / allocatedTotal
            : 0;
          receivedByNeed[needId] = (receivedByNeed[needId] || 0) + share;
        });
      } else {
        var needId = String(item.MaterialNeedID || '');
        if (needId) receivedByNeed[needId] = (receivedByNeed[needId] || 0) + itemReceived;
      }
    });

    return Response.success(needs.map(function(need) {
      var copy = Object.assign({}, need);
      var requested = Math.max(0, Number(need.RequestedQuantity) || 0);
      var ordered = Math.min(requested, Math.max(0, orderedByNeed[String(need.ID)] || 0));
      var received = Math.min(ordered, Math.max(0, receivedByNeed[String(need.ID)] || 0));
      copy.OrderedQuantity = ordered;
      copy.ReceivedQuantity = received;
      copy.RemainingToOrderQuantity = Math.max(0, requested - ordered);
      copy.RemainingDeliveryQuantity = Math.max(0, ordered - received);
      copy.ProcurementStatus = received >= requested ? 'RECEIVED'
        : (ordered >= requested ? (received > 0 ? 'PARTIALLY_RECEIVED' : 'ORDERED')
        : (ordered > 0 ? 'PARTIALLY_ORDERED' : 'NEEDS_PURCHASE'));
      return copy;
    }));
  },

  listOrders: function(params) {
    var user = this._user_(params);
    var orders = ProcurementRepository.getOrders(user.TenantID);
    var items = ProcurementRepository.getItems(user.TenantID);
    var receipts = ProcurementRepository.getReceipts(user.TenantID);
    var itemsByOrder = {};
    var receiptsByItem = {};

    items.forEach(function(item) {
      var key = String(item.PurchaseOrderID || '');
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push(item);
    });
    receipts.forEach(function(receipt) {
      var key = String(receipt.PurchaseOrderItemID || '');
      if (!key) return;
      receiptsByItem[key] = (receiptsByItem[key] || 0) +
        (Number(receipt.QuantityReceived) || 0);
    });

    return Response.success(orders.map(function(order) {
      var copy = Object.assign({}, order);
      copy.Items = (itemsByOrder[String(order.ID)] || []).map(function(item) {
        var itemCopy = Object.assign({}, item);
        itemCopy.ReceivedQuantity = receiptsByItem[String(item.ID)] || 0;
        itemCopy.RemainingQuantity = Math.max(
          0, (Number(item.OrderedQuantity) || 0) - itemCopy.ReceivedQuantity
        );
        return itemCopy;
      });
      return copy;
    }));
  },

  dashboard: function(params) {
    var user = this._user_(params);
    var needs = ProcurementRepository.getNeeds(user.TenantID);
    var orders = ProcurementRepository.getOrders(user.TenantID);
    var items = ProcurementRepository.getItems(user.TenantID);
    var receipts = ProcurementRepository.getReceipts(user.TenantID);
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
    items.forEach(function(item) {
      var ordered = Math.max(0, Number(item.OrderedQuantity) || 0);
      var received = Math.max(0, receivedByItem[String(item.ID)] || 0);
      orderedQuantity += ordered;
      receivedQuantity += Math.min(received, ordered);
      pendingQuantity += Math.max(0, ordered - received);
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
        receiptRecords: receipts.length
      },
      recentNeeds: needs.slice(-10).reverse(),
      recentOrders: orders.slice(-10).reverse()
    });
  }
};
