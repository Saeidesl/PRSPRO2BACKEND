const DesignCaseRepository = {
  SHEET_NAME: '26_DesignCases',
  getAll: function() { return GoogleSheetsRepository.getAll(this.SHEET_NAME); },
  findById: function(id) { return GoogleSheetsRepository.findById(this.SHEET_NAME, id); },
  insert: function(record) { return GoogleSheetsRepository.insert(this.SHEET_NAME, record); },
  update: function(id, data) { return GoogleSheetsRepository.updateById(this.SHEET_NAME, id, data); }
};

const DesignCaseHistoryRepository = {
  SHEET_NAME: '27_DesignCaseHistory',
  getAll: function() { return GoogleSheetsRepository.getAll(this.SHEET_NAME); },
  insert: function(record) { return GoogleSheetsRepository.insert(this.SHEET_NAME, record); },
  findByDesignCaseId: function(id) {
    return this.getAll().filter(function(row) { return String(row.DesignCaseID) === String(id); })
      .sort(function(a,b) { return Number(a.Revision || 0) - Number(b.Revision || 0); });
  }
};
