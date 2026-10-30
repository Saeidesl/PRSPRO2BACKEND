const InformationTypeRepository = {
  TYPE_SHEET: '28_InformationTypes',
  COLUMN_SHEET: '29_InformationTypeColumns',
  getAll: function() { return GoogleSheetsRepository.getAll(this.TYPE_SHEET); },
  findById: function(id) { return GoogleSheetsRepository.findById(this.TYPE_SHEET, id); },
  findByCode: function(tenantId, code) {
    return this.getAll().find(function(row) { return String(row.TenantID) === String(tenantId) && String(row.Code).toLowerCase() === String(code).toLowerCase(); }) || null;
  },
  findByTenant: function(tenantId) { return this.getAll().filter(function(row) { return String(row.TenantID) === String(tenantId); }); },
  insert: function(row) { return GoogleSheetsRepository.insert(this.TYPE_SHEET, row); },
  update: function(id, data) { return GoogleSheetsRepository.updateById(this.TYPE_SHEET, id, data); },
  getAllColumns: function() { return GoogleSheetsRepository.getAll(this.COLUMN_SHEET); },
  findColumnById: function(id) { return GoogleSheetsRepository.findById(this.COLUMN_SHEET, id); },
  findColumns: function(typeId) {
    return this.getAllColumns().filter(function(row) { return String(row.InformationTypeID) === String(typeId); }).sort(function(a,b) { return Number(a.ColumnOrder || 0) - Number(b.ColumnOrder || 0); });
  },
  insertColumn: function(row) { return GoogleSheetsRepository.insert(this.COLUMN_SHEET, row); },
  updateColumn: function(id, data) { return GoogleSheetsRepository.updateById(this.COLUMN_SHEET, id, data); }
};
