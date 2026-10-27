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

  // Legacy rows without Status remain active. Explicitly deleted/voided rows
  // stay in Sheets for history but are excluded from operational calculations.
  _isOperationalRow_: function(row) {
    var status = String(row && row.Status || 'ACTIVE').trim().toUpperCase();
    return status !== 'DELETED' && status !== 'VOID' && status !== 'CANCELLED';
  },

  getItems: function(tenantId) {
    return this.getTenantRows(this.SHEETS.ITEMS, tenantId).filter(this._isOperationalRow_);
  },

  getAllocations: function(tenantId) {
    return this.getTenantRows(this.SHEETS.ALLOCATIONS, tenantId).filter(this._isOperationalRow_);
  },

  getReceipts: function(tenantId) {
    return this.getTenantRows(this.SHEETS.RECEIPTS, tenantId);
  }
};
