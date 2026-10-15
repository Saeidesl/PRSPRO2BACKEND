const WorkflowRepository = {

  SHEET_NAME: '09_Workflows',

  getAll: function() {

    return GoogleSheetsRepository.getAll(
      this.SHEET_NAME
    );

  },


  findById: function(id) {

    return GoogleSheetsRepository.findById(
      this.SHEET_NAME,
      id
    );

  },


  findByCode: function(code) {

    return GoogleSheetsRepository.findOne(
      this.SHEET_NAME,
      'Code',
      code
    );

  },


  existsByCode: function(code) {

    return GoogleSheetsRepository.exists(
      this.SHEET_NAME,
      'Code',
      code
    );

  },


  insert: function(workflow) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      workflow
    );

  },


  update: function(id, data) {

    return GoogleSheetsRepository.updateById(
      this.SHEET_NAME,
      id,
      data
    );

  }

};