/**
 * PROCUREMENT REPOSITORY
 * Read-only data access for material needs, purchase orders and receipts.
 * Existing production/event repositories are intentionally not modified.
 */
const ProcurementRepository = {
  SHEETS: {
    NEEDS: '18_MaterialNeeds',
    ORDERS: '19_PurchaseOrders',
    ITEMS: '20_PurchaseOrderItems',
    ALLOCATIONS: '21_PurchaseAllocations',
    RECEIPTS: '22_MaterialReceipts'
  },

  getTenantRows: function(sheetName, tenantId) {
    return GoogleSheetsRepository.getAll(sheetName).filter(function(row) {
      return String(row.TenantID || '') === String(tenantId || '');
    });
  },

  getNeeds: function(tenantId) {
    return this.getTenantRows(this.SHEETS.NEEDS, tenantId);
  },

  getOrders: function(tenantId) {
    return this.getTenantRows(this.SHEETS.ORDERS, tenantId);
  },

  getItems: function(tenantId) {
    return this.getTenantRows(this.SHEETS.ITEMS, tenantId);
  },

  getAllocations: function(tenantId) {
    return this.getTenantRows(this.SHEETS.ALLOCATIONS, tenantId);
  },

  getReceipts: function(tenantId) {
    return this.getTenantRows(this.SHEETS.RECEIPTS, tenantId);
  }
};
