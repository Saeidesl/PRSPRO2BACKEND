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

  cloneWorkflowVersion: function(workflowId, fromVersion, toVersion, tenantId) {
    this.ensureSchema();
    const existingDraft = this.findByWorkflowVersion(workflowId, toVersion).filter(function(item) {
      return String(item.TenantID) === String(tenantId) &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    });
    if (existingDraft.length) return existingDraft;
    const source = this.findByWorkflowVersion(workflowId, fromVersion).filter(function(item) {
      return String(item.TenantID) === String(tenantId) &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    });
    if (!source.length) return [];
    const now = new Date().toISOString();
    const copies = source.map(function(item) {
      return {
        ID: 'WFER_' + Utilities.getUuid().replace(/-/g, ''),
        TenantID: tenantId,
        WorkflowID: workflowId,
        WorkflowVersion: toVersion,
        WorkflowStepID: item.WorkflowStepID,
        EventTypeID: item.EventTypeID,
        RequirementMode: item.RequirementMode,
        DataSource: item.DataSource,
        SequenceMode: item.SequenceMode,
        GroupKey: item.GroupKey,
        GroupOrder: item.GroupOrder,
        EventOrder: item.EventOrder,
        Status: 'ACTIVE',
        CreatedAt: now,
        UpdatedAt: now
      };
    });
    return GoogleSheetsRepository.insertMany(this.SHEET_NAME, copies);
  },

  replaceForStepVersion: function(workflowId, stepId, version, tenantId, records) {
    this.ensureSchema();
    const sheet = GoogleSheetsRepository.getSheet(this.SHEET_NAME);
    const headers = GoogleSheetsRepository.getHeaders(this.SHEET_NAME);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const lastRow = sheet.getLastRow();
      const values = lastRow > 1
        ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
        : [];
      const statusIndex = headers.indexOf('Status');
      const tenantIndex = headers.indexOf('TenantID');
      const workflowIndex = headers.indexOf('WorkflowID');
      const stepIndex = headers.indexOf('WorkflowStepID');
      const versionIndex = headers.indexOf('WorkflowVersion');
      const updatedIndex = headers.indexOf('UpdatedAt');
      const now = new Date().toISOString();
      let changed = false;
      values.forEach(function(row) {
        if (String(row[tenantIndex]) === String(tenantId) &&
            String(row[workflowIndex]) === String(workflowId) &&
            String(row[stepIndex]) === String(stepId) &&
            Number(row[versionIndex] || 1) === Number(version) &&
            String(row[statusIndex] || 'ACTIVE').toUpperCase() === 'ACTIVE') {
          row[statusIndex] = 'INACTIVE';
          row[updatedIndex] = now;
          changed = true;
        }
      });
      if (changed) sheet.getRange(2, 1, values.length, headers.length).setValues(values);
      if (records.length) {
        const rows = records.map(function(record) {
          return headers.map(function(header) { return record[header] !== undefined ? record[header] : ''; });
        });
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
      }
      if (typeof GoogleSheetsRepository._invalidateSheetRecordCache === 'function') {
        GoogleSheetsRepository._invalidateSheetRecordCache(this.SHEET_NAME);
      }
      return records;
    } finally {
      lock.releaseLock();
    }
  }
};
