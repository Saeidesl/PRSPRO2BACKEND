const EventTypeRepository = {

  SHEET_NAME: '11_EventTypes',


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


  findByWorkflowStepId: function(workflowStepId) {

    return GoogleSheetsRepository.findOne(
      this.SHEET_NAME,
      'WorkflowStepID',
      workflowStepId
    );

  },


  findByDepartmentId: function(departmentId) {

    return GoogleSheetsRepository.findOne(
      this.SHEET_NAME,
      'DepartmentID',
      departmentId
    );

  },


  insert: function(eventType) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      eventType
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