
const WorkflowStepDepartmentRepository = {
  SHEET_NAME: '17_WorkflowStepDepartments',

  getAll: function() {
    return GoogleSheetsRepository.getAll(this.SHEET_NAME);
  },

  findById: function(id) {
    return GoogleSheetsRepository.findById(this.SHEET_NAME, id);
  },

  findByWorkflowId: function(workflowId) {
    return this.getAll().filter(function(item) {
      return String(item.WorkflowID) === String(workflowId);
    });
  },

  findByDepartmentAndWorkflow: function(departmentId, workflowId) {
    const items = this.getAll();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (
        String(item.DepartmentID) === String(departmentId) &&
        String(item.WorkflowID) === String(workflowId) &&
        String(item.Status).toUpperCase() === 'ACTIVE'
      ) {
        return item;
      }
    }

    return null;
  },

  findByStepId: function(stepId) {
    return this.getAll().filter(function(item) {
      return (
        String(item.WorkflowStepID) === String(stepId) &&
        String(item.Status).toUpperCase() === 'ACTIVE'
      );
    });
  },

  insert: function(data) {
    return GoogleSheetsRepository.insert(this.SHEET_NAME, data);
  },

  update: function(id, data) {
    return GoogleSheetsRepository.updateById(
      this.SHEET_NAME,
      id,
      data
    );
  }
};
