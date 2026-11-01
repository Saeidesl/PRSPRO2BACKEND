const PrintTemplateRepository = {
  SHEET_NAME: '36_PrintTemplates',

  HEADERS: ['ID','TenantID','Name','Description','LayoutJSON','Version','Status','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt'],

  ensureSheet_: function() {
    var spreadsheet = GoogleSheetsRepository.getSpreadsheet();
    var sheet = spreadsheet.getSheetByName(this.SHEET_NAME);
    if (!sheet) {
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet = spreadsheet.getSheetByName(this.SHEET_NAME);
        if (!sheet) {
          sheet = spreadsheet.insertSheet(this.SHEET_NAME);
          sheet.getRange(1, 1, 1, this.HEADERS.length).setValues([this.HEADERS]);
          sheet.setFrozenRows(1);
          sheet.getRange(1, 1, 1, this.HEADERS.length).setFontWeight('bold').setWrap(true);
        }
      } finally { lock.releaseLock(); }
      delete GoogleSheetsRepository._sheetCache[this.SHEET_NAME];
      delete GoogleSheetsRepository._headerCache[this.SHEET_NAME];
    }
    this.HEADERS.forEach(function(header) {
      GoogleSheetsRepository.ensureColumn(this.SHEET_NAME, header);
    }, this);
    return sheet;
  },

  getAll: function() {
    this.ensureSheet_();
    return GoogleSheetsRepository.getAll(this.SHEET_NAME);
  },

  findById: function(id) {
    this.ensureSheet_();
    return GoogleSheetsRepository.findById(this.SHEET_NAME, id);
  },

  insert: function(record) {
    this.ensureSheet_();
    return GoogleSheetsRepository.insert(this.SHEET_NAME, record);
  },

  update: function(id, patch) {
    this.ensureSheet_();
    return GoogleSheetsRepository.updateById(this.SHEET_NAME, id, patch);
  }
};
