const GoogleSheetsRepository = {
  _spreadsheet: null,
  _spreadsheetId: null,
  _sheetCache: {},
  _headerCache: {},
  _requestRecordCache: {},

  resetRequestCache: function() {
    this._requestRecordCache = {};
  },

  _invalidateSheetRecordCache: function(sheetName) {
    var prefix = String(sheetName) + '|';
    var cache = this._requestRecordCache;

    Object.keys(cache).forEach(function(key) {
      if (key.indexOf(prefix) === 0) {
        delete cache[key];
      }
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

    console.log(JSON.stringify(log));
  },

  _rowToObject: function(headers, row) {
    const item = {};
    for (let i = 0; i < headers.length; i++) {
      item[headers[i]] = row[i];
    }
    return item;
  },

  _findRowNumber: function(sheet, headers, fieldName, value) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2 || headers.length === 0) return -1;

    const columnIndex = headers.indexOf(fieldName);
    if (columnIndex === -1) return -1;

    const values = sheet.getRange(
      2, columnIndex + 1, lastRow - 1, 1
    ).getValues();

    const target = String(value);

    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === target) return i + 2;
    }

    return -1;
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
      const sheet = this.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      const headers = this.getHeaders(sheetName);
      if (headers.length === 0) return [];

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
        value
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
        id
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
        value
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
          id
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