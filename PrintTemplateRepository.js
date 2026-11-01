const PrintTemplateRepository = {
  SHEET_NAME: '36_PrintTemplates',

  getAll: function() {
    return GoogleSheetsRepository.getAll(this.SHEET_NAME);
  },

  findById: function(id) {
    return GoogleSheetsRepository.findById(this.SHEET_NAME, id);
  },

  insert: function(record) {
    return GoogleSheetsRepository.insert(this.SHEET_NAME, record);
  },

  update: function(id, patch) {
    return GoogleSheetsRepository.updateById(this.SHEET_NAME, id, patch);
  }
};
