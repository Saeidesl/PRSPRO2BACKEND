const ProjectInformationRepository = {
  VALUE_SHEET: '30_ProjectInformation',
  HISTORY_SHEET: '31_ProjectInformationHistory',
  getAll: function() { return GoogleSheetsRepository.getAll(this.VALUE_SHEET); },
  findById: function(id) { return GoogleSheetsRepository.findById(this.VALUE_SHEET, id); },
  findByProject: function(projectId) { return this.getAll().filter(function(row) { return String(row.ProjectID) === String(projectId); }); },
  findAnyByProjectAndType: function(projectId,typeId) {
    return this.getAll().find(function(row) { return String(row.ProjectID)===String(projectId) && String(row.InformationTypeID)===String(typeId); }) || null;
  },
  findByProjectAndType: function(projectId,typeId) {
    return this.getAll().find(function(row) { return String(row.ProjectID)===String(projectId) && String(row.InformationTypeID)===String(typeId) && String(row.Status || 'ACTIVE')==='ACTIVE'; }) || null;
  },
  insert: function(row) { return GoogleSheetsRepository.insert(this.VALUE_SHEET,row); },
  update: function(id,data) { return GoogleSheetsRepository.updateById(this.VALUE_SHEET,id,data); },
  getAllHistory: function() { return GoogleSheetsRepository.getAll(this.HISTORY_SHEET); },
  findHistory: function(valueId) {
    return this.getAllHistory().filter(function(row) { return String(row.ProjectInformationID)===String(valueId); }).sort(function(a,b) { return Number(a.Revision || 0)-Number(b.Revision || 0); });
  },
  insertHistory: function(row) { return GoogleSheetsRepository.insert(this.HISTORY_SHEET,row); }
};
