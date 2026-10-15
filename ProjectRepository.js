const ProjectRepository = {

  SHEET_NAME: '08_Projects',

  getAll: function() {
    return GoogleSheetsRepository.getAll(this.SHEET_NAME);
  },

  findById: function(id) {
    return GoogleSheetsRepository.findById(
      this.SHEET_NAME,
      id
    );
  },

  findByProjectCode: function(projectCode) {
    return GoogleSheetsRepository.findOne(
      this.SHEET_NAME,
      'ProjectCode',
      projectCode
    );
  },

  existsByProjectCode: function(projectCode) {
    return GoogleSheetsRepository.exists(
      this.SHEET_NAME,
      'ProjectCode',
      projectCode
    );
  },

  insert: function(project) {
    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      project
    );
  },

  update: function(id, data) {
    return GoogleSheetsRepository.updateById(
      this.SHEET_NAME,
      id,
      data
    );
  },

  delete: function(id) {
    return GoogleSheetsRepository.deleteById(
      this.SHEET_NAME,
      id
    );
  }

};