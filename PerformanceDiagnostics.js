/**
 * Request-scoped diagnostics for procurement read endpoints.
 * Writes compact timing summaries to a dedicated spreadsheet tab and, optionally, to logs.
 * Metrics are observational only and do not alter procurement business data.
 */
var PerformanceDiagnostics = {
  _active: null,
  _sheetName: 'PMS_PerformanceDiagnostics',
  _headers: [
    'Timestamp', 'Endpoint', 'ElapsedMs', 'RepositoryOperationCount',
    'RepositoryElapsedMs', 'CacheHitCount', 'CacheMissCount', 'Errors',
    'OperationsByType', 'DurationMsByType', 'OperationsBySheet', 'DurationMsBySheet'
  ],

  _loggingEnabled_: function() {
    try {
      return !!(AppConfig && (
        AppConfig.PERFORMANCE_LOG_TO_CONSOLE === true ||
        (AppConfig.PERFORMANCE && AppConfig.PERFORMANCE.LOG_TO_CONSOLE === true)
      ));
    } catch (error) {
      return false;
    }
  },

  beginRequest: function(endpoint) {
    this._active = {
      endpoint: String(endpoint || ''),
      startedAt: Date.now(),
      elapsedMs: 0,
      repositoryOperationCount: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
      operationsByType: Object.create(null),
      durationMsByType: Object.create(null),
      operationsBySheet: Object.create(null),
      durationMsBySheet: Object.create(null),
      repositoryElapsedMs: 0,
      errors: 0
    };
  },

  record: function(operation, sheetName, elapsedMs, extra) {
    var current = this._active;
    if (!current) return;

    var operationName = String(operation || 'unknown');
    var sheet = String(sheetName || '');
    var duration = Math.max(0, Number(elapsedMs) || 0);
    current.repositoryOperationCount++;
    current.repositoryElapsedMs += duration;
    current.operationsByType[operationName] = (current.operationsByType[operationName] || 0) + 1;
    current.durationMsByType[operationName] = (current.durationMsByType[operationName] || 0) + duration;
    if (sheet) {
      current.operationsBySheet[sheet] = (current.operationsBySheet[sheet] || 0) + 1;
      current.durationMsBySheet[sheet] = (current.durationMsBySheet[sheet] || 0) + duration;
    }

    if (extra && extra.cacheHit === true) current.cacheHitCount++;
    else if (extra && extra.cacheHit === false) current.cacheMissCount++;
  },

  recordEndpointError: function() {
    if (this._active) this._active.errors++;
  },

  _writeSummaryToSheet_: function(summary) {
    // Do not use GoogleSheetsRepository here: doing so would recursively add
    // diagnostic repository timings to the same request.
    if (typeof SpreadsheetApp === 'undefined' || !SpreadsheetApp) return false;

    var spreadsheetId = '';
    try {
      spreadsheetId = AppConfig && AppConfig.DATABASE
        ? String(AppConfig.DATABASE.SPREADSHEET_ID || '')
        : '';
    } catch (configError) {}

    var spreadsheet = null;
    if (spreadsheetId) {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } else {
      // Reuse the exact spreadsheet resolved by the repository. In web-app
      // executions, getActiveSpreadsheet() can be null even when repository
      // operations have already resolved the database spreadsheet.
      try {
        if (typeof GoogleSheetsRepository !== 'undefined' &&
            GoogleSheetsRepository &&
            typeof GoogleSheetsRepository.getSpreadsheet === 'function') {
          spreadsheet = GoogleSheetsRepository.getSpreadsheet();
        }
      } catch (repositoryError) {
        // Try Apps Script's active-spreadsheet fallback below.
      }
      if (!spreadsheet) spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    }
    if (!spreadsheet) throw new Error('Spreadsheet unavailable for performance diagnostics');

    var sheet = spreadsheet.getSheetByName(this._sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(this._sheetName);

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, this._headers.length).setValues([this._headers]);
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date().toISOString(),
      summary.endpoint,
      summary.elapsedMs,
      summary.repositoryOperationCount,
      summary.repositoryElapsedMs,
      summary.cacheHitCount,
      summary.cacheMissCount,
      summary.errors,
      JSON.stringify(summary.operationsByType),
      JSON.stringify(summary.durationMsByType),
      JSON.stringify(summary.operationsBySheet),
      JSON.stringify(summary.durationMsBySheet)
    ]);

    // Keep this temporary diagnostic tab bounded.
    var lastRow = sheet.getLastRow();
    if (lastRow > 501 && typeof sheet.deleteRows === 'function') {
      sheet.deleteRows(2, lastRow - 501);
    }
    return true;
  },

  finishRequest: function(elapsedMs) {
    var current = this._active;
    if (!current) return null;

    current.elapsedMs = Number(elapsedMs) || (Date.now() - current.startedAt);
    current.type = 'PROCUREMENT_ENDPOINT_TIMING';
    this._active = null;

    if (this._loggingEnabled_()) {
      if (typeof console !== 'undefined' && console.log) {
        console.log(JSON.stringify(current));
      }
      try {
        this._writeSummaryToSheet_(current);
      } catch (error) {
        // Diagnostic failures must never fail a user-facing procurement request.
        try {
          if (typeof console !== 'undefined' && console.error) {
            console.error('PERFORMANCE_DIAGNOSTICS_PERSIST_FAILED: ' + String(error && error.message || error));
          }
        } catch (ignored) {}
      }
    }
    return current;
  }
};
