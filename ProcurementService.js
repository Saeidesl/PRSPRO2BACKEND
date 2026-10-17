/**
 * PROCUREMENT SERVICE
 * Read-only first slice: dashboard and tenant-scoped lists.
 * Mutations are intentionally added in a separate implementation step.
 */
const ProcurementService = {
  _user_: function(params) {
    return AccessControlService.getCurrentUser(params || {});
  },

  _active_: function(status) {
    var value = String(status || 'ACTIVE').toUpperCase();
    return value !== 'CANCELLED' && value !== 'VOID' && value !== 'DELETED';
  },

  listNeeds: function(params) {
    var user = this._user_(params);
    return Response.success(ProcurementRepository.getNeeds(user.TenantID));
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
