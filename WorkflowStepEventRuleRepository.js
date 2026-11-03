const WorkflowStepEventRuleRepository = {
  SHEET_NAME: '37_WorkflowStepEventRules',
  REQUIRED_COLUMNS: [
    'ID','TenantID','WorkflowID','WorkflowVersion','WorkflowStepID','EventTypeID',
    'RequirementMode','DataSource','SequenceMode','GroupKey','GroupOrder','EventOrder',
    'Status','CreatedAt','UpdatedAt'
  ],

  ensureSchema: function() {
    this.REQUIRED_COLUMNS.forEach(function(column) {
      GoogleSheetsRepository.ensureColumn(WorkflowStepEventRuleRepository.SHEET_NAME, column);
    });
  },

  getAll: function() {
    this.ensureSchema();
    return GoogleSheetsRepository.getAll(this.SHEET_NAME);
  },

  findByWorkflowVersion: function(workflowId, version) {
    return this.getAll().filter(function(item) {
      return String(item.WorkflowID) === String(workflowId) &&
        Number(item.WorkflowVersion || 1) === Number(version);
    });
  },

  findByStepAndVersion: function(stepId, version) {
    return this.getAll().filter(function(item) {
      return String(item.WorkflowStepID) === String(stepId) &&
        Number(item.WorkflowVersion || 1) === Number(version);
    });
  },

  replaceForStepVersion: function(stepId, version, tenantId, records) {
    this.ensureSchema();
    const existing = this.findByStepAndVersion(stepId, version).filter(function(item) {
      return String(item.TenantID) === String(tenantId) &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    });
    existing.forEach(function(item) {
      GoogleSheetsRepository.updateById(WorkflowStepEventRuleRepository.SHEET_NAME, item.ID, {
        Status: 'INACTIVE',
        UpdatedAt: new Date().toISOString()
      });
    });
    if (!records.length) return [];
    return GoogleSheetsRepository.insertMany(this.SHEET_NAME, records);
  }
};
