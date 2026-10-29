const DesignCaseRepository = {
  CASES: '26_DesignCases',
  HISTORY: '27_DesignCaseHistory',

  list: function() {
    return GoogleSheetsRepository.getAll(this.CASES) || [];
  },
  findById: function(id) {
    return GoogleSheetsRepository.findById(this.CASES, id);
  },
  insert: function(record) {
    return GoogleSheetsRepository.insert(this.CASES, record);
  },
  update: function(id, data) {
    return GoogleSheetsRepository.updateById(this.CASES, id, data);
  },
  history: function(designCaseId) {
    return (GoogleSheetsRepository.getAll(this.HISTORY) || [])
      .filter(function(item) { return String(item.DesignCaseID) === String(designCaseId); })
      .sort(function(a, b) {
        return (Number(a.Revision) || 0) - (Number(b.Revision) || 0) ||
          String(a.CreatedAt || '').localeCompare(String(b.CreatedAt || ''));
      });
  },
  appendHistory: function(record) {
    return GoogleSheetsRepository.insert(this.HISTORY, record);
  }
};
