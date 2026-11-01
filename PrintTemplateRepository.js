const PrintTemplateRepository = {
  SHEET: '36_PrintTemplates',

  listByTenant: function(tenantId) {
    return GoogleSheetsRepository.getAll(this.SHEET).filter(function(row) {
      return String(row.TenantID) === String(tenantId);
    });
  },

  findById: function(id) {
    return GoogleSheetsRepository.findById(this.SHEET, id);
  },

  insert: function(row) {
    return GoogleSheetsRepository.insert(this.SHEET, row);
  },

  update: function(id, patch) {
    return GoogleSheetsRepository.updateById(this.SHEET, id, patch);
  }
};
