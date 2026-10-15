
/**
 * ============================================================
 * ROLE PERMISSION REPOSITORY
 * ============================================================
 */

const RolePermissionRepository = {

  SHEET_NAME: '07_RolePermissions',

  getAll: function() {
    return GoogleSheetsRepository.getAll(
      this.SHEET_NAME
    );
  },

  findByRoleId: function(roleId) {
    return this.getAll().filter(function(item) {
      return String(item.RoleID) === String(roleId);
    });
  },

  findByPermissionId: function(permissionId) {
    return this.getAll().filter(function(item) {
      return String(item.PermissionID) === String(permissionId);
    });
  },

  find: function(roleId, permissionId) {
    const items = this.getAll();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (
        String(item.RoleID) === String(roleId) &&
        String(item.PermissionID) === String(permissionId)
      ) {
        return item;
      }
    }

    return null;
  },

  exists: function(roleId, permissionId) {
    return !!this.find(roleId, permissionId);
  },

  insert: function(data) {
    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      data
    );
  },

  /**
   * افزودن چند ارتباط با یک عملیات نوشتن
   */
  insertMany: function(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = GoogleSheetsRepository.getSheet(
        this.SHEET_NAME
      );

      const headers = GoogleSheetsRepository.getHeaders(
        this.SHEET_NAME
      );

      if (
        headers.length === 0 ||
        headers.indexOf('ID') === -1 ||
        headers.indexOf('TenantID') === -1 ||
        headers.indexOf('RoleID') === -1 ||
        headers.indexOf('PermissionID') === -1
      ) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'ساختار شیت دسترسی‌های نقش معتبر نیست.'
        );
      }

      const rows = items.map(function(item) {
        return headers.map(function(header) {
          return item[header] !== undefined
            ? item[header]
            : '';
        });
      });

      const startRow = sheet.getLastRow() + 1;

      sheet.getRange(
        startRow,
        1,
        rows.length,
        headers.length
      ).setValues(rows);

      SpreadsheetApp.flush();

      if (
        typeof GoogleSheetsRepository._invalidateSheetRecordCache ===
        'function'
      ) {
        GoogleSheetsRepository._invalidateSheetRecordCache(
          this.SHEET_NAME
        );
      }

      return items;

    } finally {
      lock.releaseLock();
    }
  },

  /**
   * حذف چند ارتباط با یک عملیات حذف ردیف
   * شناسه‌ها باید از قبل اعتبارسنجی شده باشند.
   */
  deleteMany: function(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        deletedIds: [],
        deletedCount: 0
      };
    }

    const uniqueIds = [];
    const seenIds = {};

    ids.forEach(function(id) {
      const key = String(id);

      if (
        key &&
        !Object.prototype.hasOwnProperty.call(seenIds, key)
      ) {
        seenIds[key] = true;
        uniqueIds.push(key);
      }
    });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = GoogleSheetsRepository.getSheet(
        this.SHEET_NAME
      );

      const headers = GoogleSheetsRepository.getHeaders(
        this.SHEET_NAME
      );

      const idColumn = headers.indexOf('ID');

      if (idColumn === -1) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'ستون شناسه در شیت دسترسی‌های نقش پیدا نشد.'
        );
      }

      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        return {
          deletedIds: [],
          deletedCount: 0
        };
      }

      const idValues = sheet.getRange(
        2,
        idColumn + 1,
        lastRow - 1,
        1
      ).getValues();

      const targets = [];
      const targetSet = {};

      for (let i = 0; i < idValues.length; i++) {
        const id = String(idValues[i][0]);

        if (
          Object.prototype.hasOwnProperty.call(seenIds, id)
        ) {
          targets.push(i + 2);
          targetSet[id] = true;
        }
      }

      /*
       * حذف از پایین به بالا تا جابه‌جایی ردیف‌ها
       * باعث حذف اشتباه نشود.
       */
      targets.sort(function(a, b) {
        return b - a;
      });

      targets.forEach(function(rowNumber) {
        sheet.deleteRow(rowNumber);
      });

      SpreadsheetApp.flush();

      if (
        typeof GoogleSheetsRepository._invalidateSheetRecordCache ===
        'function'
      ) {
        GoogleSheetsRepository._invalidateSheetRecordCache(
          this.SHEET_NAME
        );
      }

      const deletedIds = uniqueIds.filter(function(id) {
        return Object.prototype.hasOwnProperty.call(
          targetSet,
          id
        );
      });

      return {
        deletedIds: deletedIds,
        deletedCount: deletedIds.length
      };

    } finally {
      lock.releaseLock();
    }
  },

  /**
   * حذف یک ارتباط؛ برای سازگاری با کدهای فعلی
   */
  delete: function(id) {
    const result = this.deleteMany([id]);

    if (result.deletedCount === 0) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'ارتباط نقش و دسترسی پیدا نشد.'
      );
    }

    return {
      success: true,
      id: String(id)
    };
  }

};
