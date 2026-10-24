const GoogleSheetsRepository = {
  _spreadsheet: null,
  _spreadsheetId: null,
  _sheetCache: {},
  _headerCache: {},
  _requestRecordCache: {},
  _requestListCache: {},
  _requestFindCache: {},
  _requestColumnIndexCache: {},

  resetRequestCache: function() {
    this._requestRecordCache = {};
    this._requestListCache = {};
    this._requestFindCache = {};
    this._requestColumnIndexCache = {};
  },

  _invalidateSheetRecordCache: function(sheetName) {
    var prefix = String(sheetName) + '|';
    delete this._requestListCache[String(sheetName)];

    [this._requestRecordCache, this._requestListCache, this._requestFindCache, this._requestColumnIndexCache].forEach(function(cache) {
      Object.keys(cache).forEach(function(key) {
        if (key.indexOf(prefix) === 0) delete cache[key];
      });
    });
  },

  _logTiming: function(operation, sheetName, startTime, extra) {
    var elapsedMs = Date.now() - startTime;

    var log = {
      type: 'SHEET_TIMING',
      operation: operation,
      sheet: sheetName || '',
      elapsedMs: elapsedMs
    };

    if (extra) {
      Object.keys(extra).forEach(function(key) {
        log[key] = extra[key];
      });
    }

    if (
      typeof PerformanceDiagnostics !== 'undefined' &&
      PerformanceDiagnostics &&
      typeof PerformanceDiagnostics.record === 'function'
    ) {
      PerformanceDiagnostics.record(
        operation,
        sheetName || '',
        elapsedMs,
        extra || null
      );
    }

    var consoleLoggingEnabled = false;
    try {
      consoleLoggingEnabled = !!(
        AppConfig && (
          AppConfig.PERFORMANCE_LOG_TO_CONSOLE === true ||
          (AppConfig.PERFORMANCE && AppConfig.PERFORMANCE.LOG_TO_CONSOLE === true)
        )
      );
    } catch (configError) {}

    if (consoleLoggingEnabled && typeof console !== 'undefined' && console.log) {
      console.log(JSON.stringify(log));
    }
  },

  _rowToObject: function(headers, row) {
    const item = {};
    for (let i = 0; i < headers.length; i++) {
      item[headers[i]] = row[i];
    }
    return item;
  },

  _findRowNumber: function(sheet, headers, fieldName, value, sheetName) {
    const normalizedSheetName = String(sheetName || '');
    const cacheKey = normalizedSheetName + '|' + String(fieldName) + '|' + String(value);
    if (normalizedSheetName && Object.prototype.hasOwnProperty.call(this._requestFindCache, cacheKey)) {
      return this._requestFindCache[cacheKey];
    }

    const columnCacheKey = normalizedSheetName + '|' + String(fieldName);
    const columnIndex = headers.indexOf(fieldName);
    if (columnIndex === -1) {
      if (normalizedSheetName) this._requestFindCache[cacheKey] = -1;
      return -1;
    }

    let columnIndexCache = this._requestColumnIndexCache[columnCacheKey];
    if (!columnIndexCache) {
      const lastRow = sheet.getLastRow();
      const values = lastRow < 2
        ? []
        : sheet.getRange(2, columnIndex + 1, lastRow - 1, 1).getValues();
      const rowByValue = Object.create(null);

      // Preserve the original behavior: if values are duplicated, return
      // the first matching row. Prefix keys to avoid object-prototype names.
      for (let i = 0; i < values.length; i++) {
        const valueKey = '
  },

  getSpreadsheet: function() {
    const startTime = Date.now();
    const spreadsheetId = AppConfig.DATABASE.SPREADSHEET_ID;

    if (
      this._spreadsheet &&
      this._spreadsheetId === spreadsheetId
    ) {
      return this._spreadsheet;
    }

    try {
      const spreadsheet = spreadsheetId
        ? SpreadsheetApp.openById(spreadsheetId)
        : SpreadsheetApp.getActiveSpreadsheet();

      if (!spreadsheet) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'فایل پایگاه داده پیدا نشد.'
        );
      }

      this._spreadsheet = spreadsheet;
      this._spreadsheetId = spreadsheetId;
      this._sheetCache = {};
      this._headerCache = {};
      this._requestRecordCache = {};

      return spreadsheet;
    } finally {
      this._logTiming('getSpreadsheet', '', startTime);
    }
  },

  getSheet: function(sheetName) {
    const startTime = Date.now();

    try {
      if (this._sheetCache[sheetName]) {
        return this._sheetCache[sheetName];
      }

      const sheet = this.getSpreadsheet().getSheetByName(sheetName);

      if (!sheet) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'شیت مورد نظر پیدا نشد: ' + sheetName
        );
      }

      this._sheetCache[sheetName] = sheet;
      return sheet;
    } finally {
      this._logTiming('getSheet', sheetName, startTime);
    }
  },

  getHeaders: function(sheetName) {
    const startTime = Date.now();

    try {
      if (this._headerCache[sheetName]) {
        return this._headerCache[sheetName];
      }

      const sheet = this.getSheet(sheetName);
      const lastColumn = sheet.getLastColumn();

      if (lastColumn === 0) {
        this._headerCache[sheetName] = [];
        return [];
      }

      const headers = sheet.getRange(
        1, 1, 1, lastColumn
      ).getValues()[0];

      this._headerCache[sheetName] = headers;
      return headers;
    } finally {
      this._logTiming('getHeaders', sheetName, startTime);
    }
  },

  getAll: function(sheetName) {
    const startTime = Date.now();

    try {
      const listKey = String(sheetName);
      if (Object.prototype.hasOwnProperty.call(this._requestListCache, listKey)) {
        return this._requestListCache[listKey].map(function(item) { return Object.assign({}, item); });
      }

      const sheet = this.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        this._requestListCache[listKey] = [];
        return [];
      }

      const headers = this.getHeaders(sheetName);
      if (headers.length === 0) {
        this._requestListCache[String(sheetName)] = [];
        return [];
      }

      const values = sheet.getRange(
        2, 1, lastRow - 1, headers.length
      ).getValues();

      const result = [];

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        let hasValue = false;

        for (let j = 0; j < row.length; j++) {
          if (row[j] !== '') {
            hasValue = true;
            break;
          }
        }

        if (hasValue) {
          result.push(this._rowToObject(headers, row));
        }
      }

      this._requestListCache[String(sheetName)] = result.map(function(item) {
        return Object.assign({}, item);
      });
      return result;
    } finally {
      this._logTiming('getAll', sheetName, startTime);
    }
  },

  findRowByValue: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      return this._findRowNumber(
        this.getSheet(sheetName),
        this.getHeaders(sheetName),
        fieldName,
        value,
        sheetName
      );
    } finally {
      this._logTiming(
        'findRowByValue:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  findById: function(sheetName, id) {
    const startTime = Date.now();
    const cacheKey = String(sheetName) + '|' + String(id);

    try {
      if (id === undefined || id === null || id === '') {
        return null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          this._requestRecordCache,
          cacheKey
        )
      ) {
        return this._requestRecordCache[cacheKey];
      }

      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      const rowNumber = this._findRowNumber(
        sheet,
        headers,
        'ID',
        id,
        sheetName
      );

      if (rowNumber === -1) {
        this._requestRecordCache[cacheKey] = null;
        return null;
      }

      const record = this._rowToObject(
        headers,
        sheet.getRange(
          rowNumber, 1, 1, headers.length
        ).getValues()[0]
      );

      this._requestRecordCache[cacheKey] = record;
      return record;
    } finally {
      this._logTiming('findById', sheetName, startTime);
    }
  },

  findOne: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      const rowNumber = this._findRowNumber(
        sheet,
        headers,
        fieldName,
        value,
        sheetName
      );

      if (rowNumber === -1) return null;

      return this._rowToObject(
        headers,
        sheet.getRange(
          rowNumber, 1, 1, headers.length
        ).getValues()[0]
      );
    } finally {
      this._logTiming(
        'findOne:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  exists: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      return this.findRowByValue(
        sheetName,
        fieldName,
        value
      ) !== -1;
    } finally {
      this._logTiming(
        'exists:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  insert: function(sheetName, data) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let writeMs = 0;
    let lockAcquired = false;

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);

      if (headers.length === 0) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'ساختار ستون‌های شیت مشخص نیست: ' + sheetName
        );
      }

      const row = headers.map(function(header) {
        return data[header] !== undefined
          ? data[header]
          : '';
      });

      const lock = LockService.getScriptLock();
      const lockStart = Date.now();

      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;

      try {
        const writeStart = Date.now();
        const targetRow = sheet.getLastRow() + 1;

        sheet.getRange(
          targetRow, 1, 1, row.length
        ).setValues([row]);

        writeMs = Date.now() - writeStart;

        this._invalidateSheetRecordCache(sheetName);

        return data;
      } finally {
        if (lockAcquired) {
          lock.releaseLock();
        }
      }
    } finally {
      this._logTiming('insert', sheetName, totalStart, {
        lockWaitMs: lockWaitMs,
        writeMs: writeMs
      });
    }
  },

  insertMany: function(sheetName, records) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let writeMs = 0;
    let lockAcquired = false;
    records = Array.isArray(records) ? records : [];
    if (!records.length) return [];

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      if (headers.length === 0) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'ساختار ستون‌های شیت مشخص نیست: ' + sheetName
        );
      }
      const rows = records.map(function(data) {
        return headers.map(function(header) {
          return data[header] !== undefined ? data[header] : '';
        });
      });

      const lock = LockService.getScriptLock();
      const lockStart = Date.now();
      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;
      try {
        const writeStart = Date.now();
        const targetRow = sheet.getLastRow() + 1;
        sheet.getRange(targetRow, 1, rows.length, headers.length).setValues(rows);
        writeMs = Date.now() - writeStart;
        this._invalidateSheetRecordCache(sheetName);
        return records;
      } finally {
        if (lockAcquired) lock.releaseLock();
      }
    } finally {
      this._logTiming('insertMany', sheetName, totalStart, {
        recordCount: records.length,
        lockWaitMs: lockWaitMs,
        writeMs: writeMs
      });
    }
  },

  updateById: function(sheetName, id, data) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let updateMs = 0;
    let lockAcquired = false;

    try {
      const lock = LockService.getScriptLock();
      const lockStart = Date.now();

      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;

      try {
        const updateStart = Date.now();
        const sheet = this.getSheet(sheetName);
        const headers = this.getHeaders(sheetName);

        if (
          headers.length === 0 ||
          headers.indexOf('ID') === -1
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.NOT_FOUND,
            'ساختار رکورد معتبر نیست: ' + sheetName
          );
        }

        const targetRow = this._findRowNumber(
          sheet,
          headers,
          'ID',
          id,
          sheetName
        );

        if (targetRow === -1) {
          throw ErrorHandler.create(
            Constants.ERROR.NOT_FOUND,
            'رکورد مورد نظر پیدا نشد.'
          );
        }

        const currentRow = sheet.getRange(
          targetRow, 1, 1, headers.length
        ).getValues()[0];

        const newRow = headers.map(function(header, index) {
          return data[header] !== undefined
            ? data[header]
            : currentRow[index];
        });

        sheet.getRange(
          targetRow, 1, 1, newRow.length
        ).setValues([newRow]);

        updateMs = Date.now() - updateStart;

        this._invalidateSheetRecordCache(sheetName);

        return this._rowToObject(headers, newRow);
      } finally {
        if (lockAcquired) {
          lock.releaseLock();
        }
      }
    } finally {
      this._logTiming('updateById', sheetName, totalStart, {
        lockWaitMs: lockWaitMs,
        updateMs: updateMs
      });
    }
  },

  deleteById: function(sheetName, id) {
    const startTime = Date.now();

    try {
      return this.updateById(sheetName, id, {
        Status: Constants.STATUS.DELETED
      });
    } finally {
      this._logTiming('deleteById', sheetName, startTime);
    }
  }
}; + String(values[i][0]);
        if (!Object.prototype.hasOwnProperty.call(rowByValue, valueKey)) {
          rowByValue[valueKey] = i + 2;
        }
      }

      columnIndexCache = { rowByValue: rowByValue };
      if (normalizedSheetName) {
        this._requestColumnIndexCache[columnCacheKey] = columnIndexCache;
      }
    }

    const targetKey = '
  },

  getSpreadsheet: function() {
    const startTime = Date.now();
    const spreadsheetId = AppConfig.DATABASE.SPREADSHEET_ID;

    if (
      this._spreadsheet &&
      this._spreadsheetId === spreadsheetId
    ) {
      return this._spreadsheet;
    }

    try {
      const spreadsheet = spreadsheetId
        ? SpreadsheetApp.openById(spreadsheetId)
        : SpreadsheetApp.getActiveSpreadsheet();

      if (!spreadsheet) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'فایل پایگاه داده پیدا نشد.'
        );
      }

      this._spreadsheet = spreadsheet;
      this._spreadsheetId = spreadsheetId;
      this._sheetCache = {};
      this._headerCache = {};
      this._requestRecordCache = {};

      return spreadsheet;
    } finally {
      this._logTiming('getSpreadsheet', '', startTime);
    }
  },

  getSheet: function(sheetName) {
    const startTime = Date.now();

    try {
      if (this._sheetCache[sheetName]) {
        return this._sheetCache[sheetName];
      }

      const sheet = this.getSpreadsheet().getSheetByName(sheetName);

      if (!sheet) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'شیت مورد نظر پیدا نشد: ' + sheetName
        );
      }

      this._sheetCache[sheetName] = sheet;
      return sheet;
    } finally {
      this._logTiming('getSheet', sheetName, startTime);
    }
  },

  getHeaders: function(sheetName) {
    const startTime = Date.now();

    try {
      if (this._headerCache[sheetName]) {
        return this._headerCache[sheetName];
      }

      const sheet = this.getSheet(sheetName);
      const lastColumn = sheet.getLastColumn();

      if (lastColumn === 0) {
        this._headerCache[sheetName] = [];
        return [];
      }

      const headers = sheet.getRange(
        1, 1, 1, lastColumn
      ).getValues()[0];

      this._headerCache[sheetName] = headers;
      return headers;
    } finally {
      this._logTiming('getHeaders', sheetName, startTime);
    }
  },

  getAll: function(sheetName) {
    const startTime = Date.now();

    try {
      const listKey = String(sheetName);
      if (Object.prototype.hasOwnProperty.call(this._requestListCache, listKey)) {
        return this._requestListCache[listKey].map(function(item) { return Object.assign({}, item); });
      }

      const sheet = this.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        this._requestListCache[listKey] = [];
        return [];
      }

      const headers = this.getHeaders(sheetName);
      if (headers.length === 0) {
        this._requestListCache[String(sheetName)] = [];
        return [];
      }

      const values = sheet.getRange(
        2, 1, lastRow - 1, headers.length
      ).getValues();

      const result = [];

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        let hasValue = false;

        for (let j = 0; j < row.length; j++) {
          if (row[j] !== '') {
            hasValue = true;
            break;
          }
        }

        if (hasValue) {
          result.push(this._rowToObject(headers, row));
        }
      }

      this._requestListCache[String(sheetName)] = result.map(function(item) {
        return Object.assign({}, item);
      });
      return result;
    } finally {
      this._logTiming('getAll', sheetName, startTime);
    }
  },

  findRowByValue: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      return this._findRowNumber(
        this.getSheet(sheetName),
        this.getHeaders(sheetName),
        fieldName,
        value,
        sheetName
      );
    } finally {
      this._logTiming(
        'findRowByValue:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  findById: function(sheetName, id) {
    const startTime = Date.now();
    const cacheKey = String(sheetName) + '|' + String(id);

    try {
      if (id === undefined || id === null || id === '') {
        return null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          this._requestRecordCache,
          cacheKey
        )
      ) {
        return this._requestRecordCache[cacheKey];
      }

      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      const rowNumber = this._findRowNumber(
        sheet,
        headers,
        'ID',
        id,
        sheetName
      );

      if (rowNumber === -1) {
        this._requestRecordCache[cacheKey] = null;
        return null;
      }

      const record = this._rowToObject(
        headers,
        sheet.getRange(
          rowNumber, 1, 1, headers.length
        ).getValues()[0]
      );

      this._requestRecordCache[cacheKey] = record;
      return record;
    } finally {
      this._logTiming('findById', sheetName, startTime);
    }
  },

  findOne: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      const rowNumber = this._findRowNumber(
        sheet,
        headers,
        fieldName,
        value,
        sheetName
      );

      if (rowNumber === -1) return null;

      return this._rowToObject(
        headers,
        sheet.getRange(
          rowNumber, 1, 1, headers.length
        ).getValues()[0]
      );
    } finally {
      this._logTiming(
        'findOne:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  exists: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      return this.findRowByValue(
        sheetName,
        fieldName,
        value
      ) !== -1;
    } finally {
      this._logTiming(
        'exists:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  insert: function(sheetName, data) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let writeMs = 0;
    let lockAcquired = false;

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);

      if (headers.length === 0) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'ساختار ستون‌های شیت مشخص نیست: ' + sheetName
        );
      }

      const row = headers.map(function(header) {
        return data[header] !== undefined
          ? data[header]
          : '';
      });

      const lock = LockService.getScriptLock();
      const lockStart = Date.now();

      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;

      try {
        const writeStart = Date.now();
        const targetRow = sheet.getLastRow() + 1;

        sheet.getRange(
          targetRow, 1, 1, row.length
        ).setValues([row]);

        writeMs = Date.now() - writeStart;

        this._invalidateSheetRecordCache(sheetName);

        return data;
      } finally {
        if (lockAcquired) {
          lock.releaseLock();
        }
      }
    } finally {
      this._logTiming('insert', sheetName, totalStart, {
        lockWaitMs: lockWaitMs,
        writeMs: writeMs
      });
    }
  },

  insertMany: function(sheetName, records) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let writeMs = 0;
    let lockAcquired = false;
    records = Array.isArray(records) ? records : [];
    if (!records.length) return [];

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      if (headers.length === 0) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'ساختار ستون‌های شیت مشخص نیست: ' + sheetName
        );
      }
      const rows = records.map(function(data) {
        return headers.map(function(header) {
          return data[header] !== undefined ? data[header] : '';
        });
      });

      const lock = LockService.getScriptLock();
      const lockStart = Date.now();
      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;
      try {
        const writeStart = Date.now();
        const targetRow = sheet.getLastRow() + 1;
        sheet.getRange(targetRow, 1, rows.length, headers.length).setValues(rows);
        writeMs = Date.now() - writeStart;
        this._invalidateSheetRecordCache(sheetName);
        return records;
      } finally {
        if (lockAcquired) lock.releaseLock();
      }
    } finally {
      this._logTiming('insertMany', sheetName, totalStart, {
        recordCount: records.length,
        lockWaitMs: lockWaitMs,
        writeMs: writeMs
      });
    }
  },

  updateById: function(sheetName, id, data) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let updateMs = 0;
    let lockAcquired = false;

    try {
      const lock = LockService.getScriptLock();
      const lockStart = Date.now();

      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;

      try {
        const updateStart = Date.now();
        const sheet = this.getSheet(sheetName);
        const headers = this.getHeaders(sheetName);

        if (
          headers.length === 0 ||
          headers.indexOf('ID') === -1
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.NOT_FOUND,
            'ساختار رکورد معتبر نیست: ' + sheetName
          );
        }

        const targetRow = this._findRowNumber(
          sheet,
          headers,
          'ID',
          id,
          sheetName
        );

        if (targetRow === -1) {
          throw ErrorHandler.create(
            Constants.ERROR.NOT_FOUND,
            'رکورد مورد نظر پیدا نشد.'
          );
        }

        const currentRow = sheet.getRange(
          targetRow, 1, 1, headers.length
        ).getValues()[0];

        const newRow = headers.map(function(header, index) {
          return data[header] !== undefined
            ? data[header]
            : currentRow[index];
        });

        sheet.getRange(
          targetRow, 1, 1, newRow.length
        ).setValues([newRow]);

        updateMs = Date.now() - updateStart;

        this._invalidateSheetRecordCache(sheetName);

        return this._rowToObject(headers, newRow);
      } finally {
        if (lockAcquired) {
          lock.releaseLock();
        }
      }
    } finally {
      this._logTiming('updateById', sheetName, totalStart, {
        lockWaitMs: lockWaitMs,
        updateMs: updateMs
      });
    }
  },

  deleteById: function(sheetName, id) {
    const startTime = Date.now();

    try {
      return this.updateById(sheetName, id, {
        Status: Constants.STATUS.DELETED
      });
    } finally {
      this._logTiming('deleteById', sheetName, startTime);
    }
  }
}; + String(value);
    const rowNumber = Object.prototype.hasOwnProperty.call(
      columnIndexCache.rowByValue,
      targetKey
    ) ? columnIndexCache.rowByValue[targetKey] : -1;

    if (normalizedSheetName) this._requestFindCache[cacheKey] = rowNumber;
    return rowNumber;
  },

  getSpreadsheet: function() {
    const startTime = Date.now();
    const spreadsheetId = AppConfig.DATABASE.SPREADSHEET_ID;

    if (
      this._spreadsheet &&
      this._spreadsheetId === spreadsheetId
    ) {
      return this._spreadsheet;
    }

    try {
      const spreadsheet = spreadsheetId
        ? SpreadsheetApp.openById(spreadsheetId)
        : SpreadsheetApp.getActiveSpreadsheet();

      if (!spreadsheet) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'فایل پایگاه داده پیدا نشد.'
        );
      }

      this._spreadsheet = spreadsheet;
      this._spreadsheetId = spreadsheetId;
      this._sheetCache = {};
      this._headerCache = {};
      this._requestRecordCache = {};

      return spreadsheet;
    } finally {
      this._logTiming('getSpreadsheet', '', startTime);
    }
  },

  getSheet: function(sheetName) {
    const startTime = Date.now();

    try {
      if (this._sheetCache[sheetName]) {
        return this._sheetCache[sheetName];
      }

      const sheet = this.getSpreadsheet().getSheetByName(sheetName);

      if (!sheet) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'شیت مورد نظر پیدا نشد: ' + sheetName
        );
      }

      this._sheetCache[sheetName] = sheet;
      return sheet;
    } finally {
      this._logTiming('getSheet', sheetName, startTime);
    }
  },

  getHeaders: function(sheetName) {
    const startTime = Date.now();

    try {
      if (this._headerCache[sheetName]) {
        return this._headerCache[sheetName];
      }

      const sheet = this.getSheet(sheetName);
      const lastColumn = sheet.getLastColumn();

      if (lastColumn === 0) {
        this._headerCache[sheetName] = [];
        return [];
      }

      const headers = sheet.getRange(
        1, 1, 1, lastColumn
      ).getValues()[0];

      this._headerCache[sheetName] = headers;
      return headers;
    } finally {
      this._logTiming('getHeaders', sheetName, startTime);
    }
  },

  getAll: function(sheetName) {
    const startTime = Date.now();

    try {
      const listKey = String(sheetName);
      if (Object.prototype.hasOwnProperty.call(this._requestListCache, listKey)) {
        return this._requestListCache[listKey].map(function(item) { return Object.assign({}, item); });
      }

      const sheet = this.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        this._requestListCache[listKey] = [];
        return [];
      }

      const headers = this.getHeaders(sheetName);
      if (headers.length === 0) {
        this._requestListCache[String(sheetName)] = [];
        return [];
      }

      const values = sheet.getRange(
        2, 1, lastRow - 1, headers.length
      ).getValues();

      const result = [];

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        let hasValue = false;

        for (let j = 0; j < row.length; j++) {
          if (row[j] !== '') {
            hasValue = true;
            break;
          }
        }

        if (hasValue) {
          result.push(this._rowToObject(headers, row));
        }
      }

      this._requestListCache[String(sheetName)] = result.map(function(item) {
        return Object.assign({}, item);
      });
      return result;
    } finally {
      this._logTiming('getAll', sheetName, startTime);
    }
  },

  findRowByValue: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      return this._findRowNumber(
        this.getSheet(sheetName),
        this.getHeaders(sheetName),
        fieldName,
        value,
        sheetName
      );
    } finally {
      this._logTiming(
        'findRowByValue:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  findById: function(sheetName, id) {
    const startTime = Date.now();
    const cacheKey = String(sheetName) + '|' + String(id);

    try {
      if (id === undefined || id === null || id === '') {
        return null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          this._requestRecordCache,
          cacheKey
        )
      ) {
        return this._requestRecordCache[cacheKey];
      }

      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      const rowNumber = this._findRowNumber(
        sheet,
        headers,
        'ID',
        id,
        sheetName
      );

      if (rowNumber === -1) {
        this._requestRecordCache[cacheKey] = null;
        return null;
      }

      const record = this._rowToObject(
        headers,
        sheet.getRange(
          rowNumber, 1, 1, headers.length
        ).getValues()[0]
      );

      this._requestRecordCache[cacheKey] = record;
      return record;
    } finally {
      this._logTiming('findById', sheetName, startTime);
    }
  },

  findOne: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      const rowNumber = this._findRowNumber(
        sheet,
        headers,
        fieldName,
        value,
        sheetName
      );

      if (rowNumber === -1) return null;

      return this._rowToObject(
        headers,
        sheet.getRange(
          rowNumber, 1, 1, headers.length
        ).getValues()[0]
      );
    } finally {
      this._logTiming(
        'findOne:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  exists: function(sheetName, fieldName, value) {
    const startTime = Date.now();

    try {
      return this.findRowByValue(
        sheetName,
        fieldName,
        value
      ) !== -1;
    } finally {
      this._logTiming(
        'exists:' + fieldName,
        sheetName,
        startTime
      );
    }
  },

  insert: function(sheetName, data) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let writeMs = 0;
    let lockAcquired = false;

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);

      if (headers.length === 0) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'ساختار ستون‌های شیت مشخص نیست: ' + sheetName
        );
      }

      const row = headers.map(function(header) {
        return data[header] !== undefined
          ? data[header]
          : '';
      });

      const lock = LockService.getScriptLock();
      const lockStart = Date.now();

      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;

      try {
        const writeStart = Date.now();
        const targetRow = sheet.getLastRow() + 1;

        sheet.getRange(
          targetRow, 1, 1, row.length
        ).setValues([row]);

        writeMs = Date.now() - writeStart;

        this._invalidateSheetRecordCache(sheetName);

        return data;
      } finally {
        if (lockAcquired) {
          lock.releaseLock();
        }
      }
    } finally {
      this._logTiming('insert', sheetName, totalStart, {
        lockWaitMs: lockWaitMs,
        writeMs: writeMs
      });
    }
  },

  insertMany: function(sheetName, records) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let writeMs = 0;
    let lockAcquired = false;
    records = Array.isArray(records) ? records : [];
    if (!records.length) return [];

    try {
      const sheet = this.getSheet(sheetName);
      const headers = this.getHeaders(sheetName);
      if (headers.length === 0) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'ساختار ستون‌های شیت مشخص نیست: ' + sheetName
        );
      }
      const rows = records.map(function(data) {
        return headers.map(function(header) {
          return data[header] !== undefined ? data[header] : '';
        });
      });

      const lock = LockService.getScriptLock();
      const lockStart = Date.now();
      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;
      try {
        const writeStart = Date.now();
        const targetRow = sheet.getLastRow() + 1;
        sheet.getRange(targetRow, 1, rows.length, headers.length).setValues(rows);
        writeMs = Date.now() - writeStart;
        this._invalidateSheetRecordCache(sheetName);
        return records;
      } finally {
        if (lockAcquired) lock.releaseLock();
      }
    } finally {
      this._logTiming('insertMany', sheetName, totalStart, {
        recordCount: records.length,
        lockWaitMs: lockWaitMs,
        writeMs: writeMs
      });
    }
  },

  updateById: function(sheetName, id, data) {
    const totalStart = Date.now();
    let lockWaitMs = 0;
    let updateMs = 0;
    let lockAcquired = false;

    try {
      const lock = LockService.getScriptLock();
      const lockStart = Date.now();

      lock.waitLock(10000);
      lockWaitMs = Date.now() - lockStart;
      lockAcquired = true;

      try {
        const updateStart = Date.now();
        const sheet = this.getSheet(sheetName);
        const headers = this.getHeaders(sheetName);

        if (
          headers.length === 0 ||
          headers.indexOf('ID') === -1
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.NOT_FOUND,
            'ساختار رکورد معتبر نیست: ' + sheetName
          );
        }

        const targetRow = this._findRowNumber(
          sheet,
          headers,
          'ID',
          id,
          sheetName
        );

        if (targetRow === -1) {
          throw ErrorHandler.create(
            Constants.ERROR.NOT_FOUND,
            'رکورد مورد نظر پیدا نشد.'
          );
        }

        const currentRow = sheet.getRange(
          targetRow, 1, 1, headers.length
        ).getValues()[0];

        const newRow = headers.map(function(header, index) {
          return data[header] !== undefined
            ? data[header]
            : currentRow[index];
        });

        sheet.getRange(
          targetRow, 1, 1, newRow.length
        ).setValues([newRow]);

        updateMs = Date.now() - updateStart;

        this._invalidateSheetRecordCache(sheetName);

        return this._rowToObject(headers, newRow);
      } finally {
        if (lockAcquired) {
          lock.releaseLock();
        }
      }
    } finally {
      this._logTiming('updateById', sheetName, totalStart, {
        lockWaitMs: lockWaitMs,
        updateMs: updateMs
      });
    }
  },

  deleteById: function(sheetName, id) {
    const startTime = Date.now();

    try {
      return this.updateById(sheetName, id, {
        Status: Constants.STATUS.DELETED
      });
    } finally {
      this._logTiming('deleteById', sheetName, startTime);
    }
  }
};