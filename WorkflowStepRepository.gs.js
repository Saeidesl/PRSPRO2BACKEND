const WorkflowStepRepository = {

  SHEET_NAME: '10_WorkflowSteps',

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


  findByWorkflowId: function(workflowId) {

    const items = this.getAll();

    return items.filter(function(item) {

      return String(item.WorkflowID) === String(workflowId);

    }).sort(function(a, b) {

      return Number(a.StepOrder || 0) -
             Number(b.StepOrder || 0);

    });

  },


  findFirstByWorkflowId: function(workflowId) {

    const steps = this.findByWorkflowId(
      workflowId
    );

    return steps.length > 0
      ? steps[0]
      : null;

  },


  findByCode: function(workflowId, code) {

    const steps = this.findByWorkflowId(
      workflowId
    );

    for (let i = 0; i < steps.length; i++) {

      if (
        String(steps[i].Code) ===
        String(code)
      ) {

        return steps[i];

      }

    }

    return null;
  },


  insert: function(step) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      step
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