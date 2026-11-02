/**
 * Central tenant-scoped repository for reusable print templates.
 * The sheet is created additively on first use for installations that have not
 * yet run setupDatabase after this feature is deployed.
 */
const PrintTemplateRepository = {
  SHEET_NAME: '36_PrintTemplates',
  HEADERS: ['ID','TenantID','Code','Name','Description','Status','Version','DefinitionJSON','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt'],
  _schemaSpreadsheetId: '',

  ensureSchema: function() {
    const spreadsheet = GoogleSheetsRepository.getSpreadsheet();
    const spreadsheetId = spreadsheet.getId ? spreadsheet.getId() : '';
    if (this._schemaSpreadsheetId === spreadsheetId) return;
    let sheet = spreadsheet.getSheetByName(this.SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(this.SHEET_NAME);
      sheet.getRange(1, 1, 1, this.HEADERS.length).setValues([this.HEADERS]);
    } else {
      const lastColumn = sheet.getLastColumn();
      const current = lastColumn > 0
        ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) {
            return String(value || '').trim();
          })
        : [];
      const seen = Object.create(null);
      current.forEach(function(header) {
        if (!header) return;
        if (seen[header]) throw new Error('سرستون تکراری در شیت قالب‌ها: ' + header);
        seen[header] = true;
      });
      const missing = this.HEADERS.filter(function(header) { return current.indexOf(header) === -1; });
      if (missing.length) {
        const start = Math.max(lastColumn, 0) + 1;
        if (sheet.getMaxColumns && sheet.getMaxColumns() < start + missing.length - 1) {
          sheet.insertColumnsAfter(sheet.getMaxColumns(), start + missing.length - 1 - sheet.getMaxColumns());
        }
        sheet.getRange(1, start, 1, missing.length).setValues([missing]);
      }
    }
    if (GoogleSheetsRepository._sheetCache) GoogleSheetsRepository._sheetCache[this.SHEET_NAME] = sheet;
    if (GoogleSheetsRepository._headerCache) delete GoogleSheetsRepository._headerCache[this.SHEET_NAME];
    if (GoogleSheetsRepository._requestListCache) delete GoogleSheetsRepository._requestListCache[this.SHEET_NAME];
    this._schemaSpreadsheetId = spreadsheetId;
  },

  getAll: function() {
    this.ensureSchema();
    return GoogleSheetsRepository.getAll(this.SHEET_NAME);
  },
  findById: function(id) {
    this.ensureSchema();
    return GoogleSheetsRepository.findById(this.SHEET_NAME, id);
  },
  insert: function(row) {
    this.ensureSchema();
    return GoogleSheetsRepository.insert(this.SHEET_NAME, row);
  },
  update: function(id, patch) {
    this.ensureSchema();
    return GoogleSheetsRepository.updateById(this.SHEET_NAME, id, patch);
  }
};