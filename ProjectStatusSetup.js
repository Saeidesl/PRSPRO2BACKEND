/**
 * ارتقای وضعیت‌های پروژه
 * ایجاد شیت وضعیت‌ها و حفظ اطلاعات قبلی
 */

function setupProjectStatuses() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      throw new Error('فایل Google Sheets پیدا نشد.');
    }

    const statusSheetName = '18_ProjectStatuses';
    const headers = [
      'ID',
      'TenantID',
      'Code',
      'Name',
      'Status',
      'CreatedAt',
      'UpdatedAt'
    ];

    // ایجاد شیت در صورت نبودن
    let statusSheet = ss.getSheetByName(statusSheetName);

    if (!statusSheet) {
      statusSheet = ss.insertSheet(statusSheetName);
    }

    // بررسی سرستون‌ها بدون دست‌زدن به اطلاعات موجود
    if (statusSheet.getMaxColumns() < headers.length) {
      statusSheet.insertColumnsAfter(
        statusSheet.getMaxColumns(),
        headers.length - statusSheet.getMaxColumns()
      );
    }

    const currentHeaders = statusSheet
      .getRange(1, 1, 1, headers.length)
      .getDisplayValues()[0]
      .map(function (value) {
        return String(value).trim();
      });

    const hasHeaders = currentHeaders.some(Boolean);

    if (!hasHeaders) {
      statusSheet
        .getRange(1, 1, 1, headers.length)
        .setValues([headers]);
    } else {
      const valid = headers.every(function (header, index) {
        return currentHeaders[index] === header;
      });

      if (!valid) {
        throw new Error(
          'سرستون‌های شیت وضعیت‌ها با ساختار مورد انتظار مطابقت ندارند. ' +
          'برای محافظت از اطلاعات، عملیات متوقف شد.'
        );
      }
    }

    // اطمینان از وجود شرکت پیش‌فرض
    const tenantSheet = ss.getSheetByName('01_Tenants');

    if (!tenantSheet) {
      throw new Error('شیت 01_Tenants پیدا نشد.');
    }

    if (tenantSheet.getLastRow() < 2) {
      if (typeof seedTenant_ === 'function') {
        seedTenant_(ss);
      }
    }

    const tenantRows = tenantSheet.getLastRow() >= 2
      ? tenantSheet
          .getRange(2, 1, tenantSheet.getLastRow() - 1, 7)
          .getValues()
      : [];

    const tenants = tenantRows.filter(function (row) {
      return row[0] && String(row[4]).toUpperCase() === 'ACTIVE';
    });

    if (tenants.length === 0) {
      throw new Error(
        'شرکت فعال پیدا نشد. ابتدا اطلاعات شرکت را بررسی کن.'
      );
    }

    // وضعیت‌های پیش‌فرض؛ کدها با پروژه‌های قبلی سازگارند
    const defaults = [
      ['ACTIVE', 'فعال'],
      ['ON_HOLD', 'متوقف'],
      ['COMPLETED', 'تکمیل‌شده'],
      ['CANCELLED', 'لغوشده']
    ];

    const existingRows = statusSheet.getLastRow() >= 2
      ? statusSheet
          .getRange(2, 1, statusSheet.getLastRow() - 1, 7)
          .getValues()
      : [];

    const existingKeys = new Set();

    existingRows.forEach(function (row) {
      const tenantId = String(row[1] || '').trim();
      const code = String(row[2] || '').trim();

      if (tenantId && code) {
        existingKeys.add(tenantId + '|' + code);
      }
    });

    const now = new Date().toISOString();
    const newRows = [];

    tenants.forEach(function (tenant) {
      const tenantId = String(tenant[0]);

      defaults.forEach(function (item) {
        const code = item[0];
        const key = tenantId + '|' + code;

        if (existingKeys.has(key)) return;

        newRows.push([
          'PST_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12),
          tenantId,
          code,
          item[1],
          'ACTIVE',
          now,
          now
        ]);

        existingKeys.add(key);
      });
    });

    if (newRows.length > 0) {
      statusSheet
        .getRange(
          statusSheet.getLastRow() + 1,
          1,
          newRows.length,
          headers.length
        )
        .setValues(newRows);
    }

    // قالب‌بندی شیت وضعیت‌ها
    statusSheet
      .getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true)
      .setBackground('#eeeeee');

    statusSheet.setFrozenRows(1);
    statusSheet.setRowHeight(1, 32);
    statusSheet.setRightToLeft(true);
    statusSheet.autoResizeColumns(1, headers.length);

    if (!statusSheet.getFilter()) {
      statusSheet
        .getRange(
          1,
          1,
          Math.max(statusSheet.getLastRow(), 1),
          headers.length
        )
        .createFilter();
    }

    // حذف فهرست ثابت وضعیت پروژه‌ها؛ داده‌های موجود دست‌نخورده می‌مانند
    const projectSheet = ss.getSheetByName('08_Projects');

    if (!projectSheet) {
      throw new Error('شیت 08_Projects پیدا نشد.');
    }

    if (projectSheet.getMaxRows() > 1) {
      projectSheet
        .getRange(2, 9, projectSheet.getMaxRows() - 1, 1)
        .clearDataValidations();
    }

    Logger.log(
      'ارتقای وضعیت پروژه‌ها با موفقیت انجام شد. ' +
      'وضعیت‌های جدید اضافه‌شده: ' + newRows.length
    );

    Logger.log(
  'ارتقا با موفقیت انجام شد. ' +
  'شیت 18_ProjectStatuses آماده است. ' +
  'تعداد وضعیت‌های جدید: ' + newRows.length
);
  

  } catch (error) {
    Logger.log('خطا در ارتقای وضعیت‌ها: ' + error.message);
    throw error;
  } finally {
    lock.releaseLock();
  }
}