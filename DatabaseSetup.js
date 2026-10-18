
/**
 * Production Management System
 * Database Setup - Version 1.1.0
 * ایجاد شیت‌های دیتابیس بدون حذف اطلاعات موجود
 */

const APP_CONFIG = {

  VERSION: '1.1.1',

  DEFAULT_TENANT: {
    NAME: 'شرکت اصلی',
    CODE: 'MAIN',
    TIMEZONE: 'Asia/Tehran',
    STATUS: 'ACTIVE'
  },

  SHEETS: {

    TENANTS: {
      name: '01_Tenants',
      headers: ['ID','Name','Code','Timezone','Status','CreatedAt','UpdatedAt']
    },

    USERS: {
      name: '02_Users',
      headers: ['ID','TenantID','Name','Username','PasswordHash','DepartmentID','Status','CreatedAt','UpdatedAt']
    },

    DEPARTMENTS: {
      name: '03_Departments',
      headers: ['ID','TenantID','Name','Code','Status','CreatedAt','UpdatedAt']
    },

    ROLES: {
      name: '04_Roles',
      headers: ['ID','TenantID','Name','Code','Status','CreatedAt','UpdatedAt']
    },

    PERMISSIONS: {
      name: '05_Permissions',
      headers: ['ID','Code','Name','Module','Description','Status']
    },

    USER_ROLES: {
      name: '06_UserRoles',
      headers: ['ID','TenantID','UserID','RoleID','CreatedAt']
    },

    ROLE_PERMISSIONS: {
      name: '07_RolePermissions',
      headers: ['ID','TenantID','RoleID','PermissionID','CreatedAt']
    },

    PROJECTS: {
      name: '08_Projects',
      headers: ['ID','TenantID','ProjectCode','Title','Description','WorkflowID','WorkflowVersion','CurrentStepID','Status','CreatedBy','CreatedAt','UpdatedAt','Quantity']
    },

    WORKFLOWS: {
      name: '09_Workflows',
      headers: ['ID','TenantID','Name','Code','Version','Status','CreatedAt','UpdatedAt']
    },

    WORKFLOW_STEPS: {
      name: '10_WorkflowSteps',
      headers: ['ID','TenantID','WorkflowID','Name','Code','StepOrder','Status','CreatedAt','UpdatedAt']
    },

    EVENT_TYPES: {
      name: '11_EventTypes',
      headers: ['ID','TenantID','Name','Code','Version','Description','DepartmentID','Category','WorkflowStepID','MovesProjectToStep','AllowAttachments','Status','CreatedAt','UpdatedAt']
    },

    EVENT_FIELDS: {
      name: '12_EventFields',
      headers: ['ID','TenantID','EventTypeID','Name','Code','FieldType','IsRequired','DefaultValue','Options','ValidationRule','FieldOrder','Status','CreatedAt','UpdatedAt']
    },

    EVENTS: {
      name: '13_Events',
      headers: ['ID','TenantID','ProjectID','EventTypeID','EventTypeVersion','PerformedBy','CreatedBy','DepartmentID','OccurredAt','CreatedAt','Description','Status']
    },

    EVENT_DATA: {
      name: '14_EventData',
      headers: ['ID','EventID','DataJSON','CreatedAt']
    },

    ATTACHMENTS: {
      name: '15_Attachments',
      headers: ['ID','TenantID','EntityType','EntityID','FileName','MimeType','FileSize','StorageProvider','StorageKey','UploadedBy','UploadedAt','Status']
    },

    AUDIT_LOGS: {
      name: '16_AuditLogs',
      headers: ['ID','TenantID','UserID','Action','EntityType','EntityID','OldData','NewData','Reason','CreatedAt']
    },

    WORKFLOW_STEP_DEPARTMENTS: {
      name: '17_WorkflowStepDepartments',
      headers: [
        'ID',
        'TenantID',
        'WorkflowID',
        'WorkflowStepID',
        'DepartmentID',
        'Status',
        'CreatedAt',
        'UpdatedAt'
      ]
    },

    EVENT_TYPE_PROCUREMENT_SETTINGS: {
      name: '23_EventTypeProcurementSettings',
      headers: ['ID','TenantID','EventTypeID','Action','FieldMapJSON','Status','CreatedBy','CreatedAt','UpdatedAt']
    },

    MATERIAL_NEEDS: {
      name: '18_MaterialNeeds',
      headers: ['ID','TenantID','ProjectID','SourceEventID','ItemName','ItemCode','Unit','RequestedQuantity','NeededBy','Status','Notes','CreatedBy','CreatedAt','UpdatedAt']
    },

    PURCHASE_ORDERS: {
      name: '19_PurchaseOrders',
      headers: ['ID','TenantID','OrderNumber','SupplierName','OrderDate','ExpectedDeliveryDate','Status','Notes','CreatedBy','CreatedAt','UpdatedAt']
    },

    PURCHASE_ORDER_ITEMS: {
      name: '20_PurchaseOrderItems',
      headers: ['ID','TenantID','PurchaseOrderID','MaterialNeedID','ItemName','ItemCode','Unit','OrderedQuantity','UnitPrice','Notes','CreatedAt','UpdatedAt']
    },

    PURCHASE_ALLOCATIONS: {
      name: '21_PurchaseAllocations',
      headers: ['ID','TenantID','PurchaseOrderItemID','ProjectID','MaterialNeedID','AllocatedQuantity','CreatedAt']
    },

    MATERIAL_RECEIPTS: {
      name: '22_MaterialReceipts',
      headers: ['ID','TenantID','PurchaseOrderItemID','ProjectID','QuantityReceived','ReceivedAt','WarehouseDepartmentID','SourceEventID','Notes','ReceivedBy','CreatedAt']
    }
  },

  STATUS: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    ON_HOLD: 'ON_HOLD',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    VOID: 'VOID',
    DELETED: 'DELETED'
  },

  FIELD_TYPES: [
    'text','number','date','datetime','select','textarea','boolean'
  ],

  ATTACHMENT_ENTITY_TYPES: ['PROJECT','EVENT'],

  STORAGE_PROVIDERS: ['GOOGLE_DRIVE'],

  CATEGORIES: [
    'PROCESS','MATERIAL','QUALITY','WAREHOUSE','ADMIN','SYSTEM'
  ]
};


/**
 * راه‌اندازی دیتابیس
 */
function setupDatabase() {

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      throw new Error(
        'Spreadsheet پیدا نشد. اسکریپت را از داخل Google Sheet اجرا کن.'
      );
    }

    createAllSheets_(ss);
    applyAllFormatting_(ss);
    applyAllValidations_(ss);
    seedInitialData_(ss);
    saveSetupMetadata_(ss);

   Logger.log(
  'راه‌اندازی با موفقیت انجام شد. ساختار شیت‌های تعریف‌شده بررسی و تنظیم شد.'
);
  } catch (error) {

    Logger.log(error.stack || error);

   Logger.log(
  'خطا در راه‌اندازی دیتابیس: ' + error.message
);

    throw error;

  } finally {
    lock.releaseLock();
  }
}


/**
 * ایجاد شیت‌ها و بررسی سرستون‌ها
 */
function createAllSheets_(ss) {

  Object.values(APP_CONFIG.SHEETS).forEach(function(definition) {

    let sheet = ss.getSheetByName(definition.name);

    if (!sheet) {
      sheet = ss.insertSheet(definition.name);
    }

    ensureHeaders_(sheet, definition.headers);
  });
}


/**
 * ایجاد سرستون برای شیت خالی و افزودن ستون‌های جدید فقط در انتهای ساختار.
 * مغایرت‌های غیر افزایشی متوقف می‌شوند تا از جابه‌جایی یا حذف اطلاعات جلوگیری شود.
 */
function ensureHeaders_(sheet, headers) {

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  const current = sheet
    .getRange(1, 1, 1, headers.length)
    .getValues()[0];

  const hasHeaders = current.some(function(value) {
    return String(value).trim() !== '';
  });

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const firstBlank = current.findIndex(function(value) {
    return String(value).trim() === '';
  });
  const appendOnly = firstBlank > 0 &&
    current.slice(firstBlank).every(function(value) {
      return String(value).trim() === '';
    }) &&
    headers.slice(0, firstBlank).every(function(header, index) {
      return String(current[index]).trim() === header;
    });

  // Safe schema extension: add only new trailing columns. Never reorder or overwrite existing data.
  if (appendOnly) {
    sheet.getRange(1, firstBlank + 1, 1, headers.length - firstBlank)
      .setValues([headers.slice(firstBlank)]);
    return;
  }

  const mismatch = headers.some(function(header, index) {
    return String(current[index]).trim() !== header;
  });

  if (mismatch) {
    throw new Error(
      'سرستون‌های شیت "' + sheet.getName() +
      '" با ساختار مورد انتظار مطابقت ندارند. ' +
      'برای محافظت از اطلاعات، عملیات متوقف شد.'
    );
  }
}


/**
 * قالب‌بندی شیت‌ها
 */
function applyAllFormatting_(ss) {

  Object.values(APP_CONFIG.SHEETS).forEach(function(definition) {

    const sheet = ss.getSheetByName(definition.name);
    if (!sheet) return;

    const count = definition.headers.length;

    sheet.getRange(1, 1, 1, count)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true)
      .setBackground('#eeeeee');

    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 32);
    sheet.autoResizeColumns(1, count);

    for (let column = 1; column <= count; column++) {
      if (sheet.getColumnWidth(column) < 100) {
        sheet.setColumnWidth(column, 120);
      }
    }

    if (!sheet.getFilter()) {
      sheet.getRange(
        1,
        1,
        Math.max(sheet.getLastRow(), 1),
        count
      ).createFilter();
    }

    try {
      sheet.setRightToLeft(true);
    } catch (error) {
      Logger.log('RTL skipped: ' + sheet.getName());
    }
  });
}


/**
 * اعتبارسنجی‌های اولیه
 */
function applyAllValidations_(ss) {

  setListValidation_(ss, '01_Tenants', 5, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '02_Users', 7, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '03_Departments', 5, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '04_Roles', 5, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '05_Permissions', 6, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '08_Projects', 9, ['ACTIVE','ON_HOLD','COMPLETED','CANCELLED']);
  setListValidation_(ss, '09_Workflows', 6, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '10_WorkflowSteps', 7, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '11_EventTypes', 8, APP_CONFIG.CATEGORIES);
  setBooleanValidation_(ss, '11_EventTypes', 10);
  setBooleanValidation_(ss, '11_EventTypes', 11);
  setListValidation_(ss, '11_EventTypes', 12, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '12_EventFields', 6, APP_CONFIG.FIELD_TYPES);
  setBooleanValidation_(ss, '12_EventFields', 7);
  setListValidation_(ss, '12_EventFields', 12, ['ACTIVE','INACTIVE']);
  setListValidation_(ss, '13_Events', 12, ['ACTIVE','VOID']);
  setListValidation_(ss, '15_Attachments', 3, APP_CONFIG.ATTACHMENT_ENTITY_TYPES);
  setListValidation_(ss, '15_Attachments', 8, APP_CONFIG.STORAGE_PROVIDERS);
  setListValidation_(ss, '15_Attachments', 12, ['ACTIVE','DELETED']);
  setListValidation_(ss, '17_WorkflowStepDepartments', 6, ['ACTIVE','INACTIVE']);
}


function setListValidation_(ss, sheetName, column, values) {

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const range = sheet.getRange(
    2,
    column,
    Math.max(sheet.getMaxRows() - 1, 1),
    1
  );

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();

  range.setDataValidation(rule);
}


function setBooleanValidation_(ss, sheetName, column) {

  setListValidation_(ss, sheetName, column, ['TRUE','FALSE']);
}


/**
 * اطلاعات اولیه
 */
function seedInitialData_(ss) {

  seedTenant_(ss);
  seedPermissions_(ss);
}


function seedTenant_(ss) {

  const sheet = ss.getSheetByName('01_Tenants');
  if (!sheet || sheet.getLastRow() > 1) return;

  const now = nowISO_();

  sheet.appendRow([
    generateId_('TEN'),
    APP_CONFIG.DEFAULT_TENANT.NAME,
    APP_CONFIG.DEFAULT_TENANT.CODE,
    APP_CONFIG.DEFAULT_TENANT.TIMEZONE,
    APP_CONFIG.DEFAULT_TENANT.STATUS,
    now,
    now
  ]);
}


/**
 * افزودن Permissionهای اولیه بدون تکرار
 */
function seedPermissions_(ss) {

  const sheet = ss.getSheetByName('05_Permissions');
  if (!sheet) return;

  const permissions = [
    ['PROJECT_VIEW','مشاهده پروژه','PROJECT','مشاهده پروژه‌ها'],
    ['PROJECT_CREATE','ایجاد پروژه','PROJECT','ایجاد پروژه جدید'],
    ['PROJECT_EDIT','ویرایش پروژه','PROJECT','ویرایش اطلاعات پروژه'],
    ['PROJECT_STATUS_CHANGE','تغییر وضعیت پروژه','PROJECT','تغییر وضعیت پروژه'],
    ['PROJECT_STATUS_MANAGE', 'مدیریت وضعیت‌های پروژه', 'PROJECT', 'ایجاد و ویرایش وضعیت‌های پروژه'],
    ['EVENT_VIEW','مشاهده رویدادها','EVENT','مشاهده Eventها'],
    ['EVENT_CREATE','ثبت رویداد','EVENT','ثبت Event جدید'],
    ['EVENT_EDIT','ویرایش رویداد','EVENT','اصلاح Event'],
    ['EVENT_VOID','باطل کردن رویداد','EVENT','باطل کردن Event'],
    ['ATTACHMENT_VIEW','مشاهده فایل‌ها','ATTACHMENT','مشاهده فایل‌های پیوست'],
    ['ATTACHMENT_UPLOAD','آپلود فایل','ATTACHMENT','آپلود فایل'],
    ['ATTACHMENT_DELETE','حذف فایل','ATTACHMENT','حذف فایل'],
    ['ATTACHMENT_MANAGE','مدیریت فایل‌ها','ATTACHMENT','مدیریت کامل فایل‌ها'],
    ['USER_VIEW','مشاهده کاربران','USER','مشاهده کاربران'],
    ['USER_CREATE','ایجاد کاربر','USER','ایجاد کاربر'],
    ['USER_EDIT','ویرایش کاربر','USER','ویرایش کاربر'],
    ['ROLE_VIEW','مشاهده نقش‌ها','ROLE','مشاهده Roleها'],
    ['ROLE_MANAGE','مدیریت نقش‌ها','ROLE','ایجاد و ویرایش Roleها'],
    ['PERMISSION_VIEW','مشاهده دسترسی‌ها','PERMISSION','مشاهده Permissionها'],
    ['PERMISSION_MANAGE','مدیریت دسترسی‌ها','PERMISSION','مدیریت Permissionها'],
    ['DEPARTMENT_VIEW','مشاهده واحدها','DEPARTMENT','مشاهده واحدها'],
    ['DEPARTMENT_MANAGE','مدیریت واحدها','DEPARTMENT','مدیریت واحدها'],
    ['EVENT_TYPE_VIEW','مشاهده نوع رویداد','EVENT_TYPE','مشاهده Event Typeها'],
    ['EVENT_TYPE_MANAGE','مدیریت نوع رویداد','EVENT_TYPE','مدیریت Event Typeها'],
    ['WORKFLOW_VIEW','مشاهده گردش‌کارها','WORKFLOW','مشاهده Workflowها'],
    ['WORKFLOW_MANAGE','مدیریت گردش‌کارها','WORKFLOW','مدیریت Workflowها'],
    ['REPORT_VIEW','مشاهده گزارش‌ها','REPORT','مشاهده گزارش‌ها'],
    ['PROCUREMENT_VIEW','مشاهده پیگیری تأمین','PROCUREMENT','مشاهده نیازها، سفارش‌ها و رسیدهای ملزومات'],
    ['PROCUREMENT_MANAGE','مدیریت پیگیری تأمین','PROCUREMENT','ثبت و مدیریت نیازها، سفارش‌های خرید و رسیدهای ملزومات'],
    ['AUDIT_VIEW','مشاهده تاریخچه تغییرات','AUDIT','مشاهده Audit Log'],
    ['SYSTEM_SETTINGS','تنظیمات سیستم','SYSTEM','مدیریت تنظیمات سیستم']
  ];

  const data = sheet.getDataRange().getValues();
  const existing = new Set();

  for (let i = 1; i < data.length; i++) {
    const code = String(data[i][1] || '').trim();
    if (code) existing.add(code);
  }

  const rows = [];

  permissions.forEach(function(permission) {
    if (existing.has(permission[0])) return;

    rows.push([
      generateId_('PER'),
      permission[0],
      permission[1],
      permission[2],
      permission[3],
      'ACTIVE'
    ]);
  });

  if (rows.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      6
    ).setValues(rows);
  }
}


/**
 * ذخیره اطلاعات راه‌اندازی
 */
function saveSetupMetadata_(ss) {

  PropertiesService.getScriptProperties().setProperties({
    DATABASE_SETUP_VERSION: APP_CONFIG.VERSION,
    DATABASE_SETUP_AT: nowISO_(),
    DATABASE_SPREADSHEET_ID: ss.getId()
  });
}


/**
 * ابزارهای کمکی
 */
function generateId_(prefix) {

  return prefix + '_' + Utilities.getUuid()
    .replace(/-/g, '')
    .substring(0, 8)
    .toLowerCase();
}


function nowISO_() {
  return new Date().toISOString();
}


/**
 * بررسی سلامت 17 شیت
 */
function checkDatabaseHealth() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const definitions = Object.values(APP_CONFIG.SHEETS);
  const results = [];

  definitions.forEach(function(definition) {

    const sheet = ss.getSheetByName(definition.name);

    if (!sheet) {
      results.push(definition.name + ': MISSING');
      return;
    }

    const headers = sheet.getRange(
      1,
      1,
      1,
      definition.headers.length
    ).getValues()[0];

    const valid = definition.headers.every(function(header, index) {
      return String(headers[index]).trim() === header;
    });

    if (!valid) {
      results.push(definition.name + ': INVALID_HEADERS');
    }
  });

  if (results.length) {
    SpreadsheetApp.getUi().alert(
      'مشکلات دیتابیس:\n\n' + results.join('\n')
    );
  } else {
    SpreadsheetApp.getUi().alert(
      'بررسی سلامت موفق بود.\n\nتمام شیت‌های تعریف‌شده و سرستون‌های آن‌ها صحیح هستند.'
    );
  }
}


/**
 * منوی سیستم
 */
function onOpen() {

  SpreadsheetApp.getUi()
    .createMenu('سیستم تولید')
    .addItem('راه‌اندازی / بررسی دیتابیس', 'setupDatabase')
    .addItem('بررسی سلامت دیتابیس', 'checkDatabaseHealth')
    .addToUi();
}

/**
 * ارتقای ساختار تنظیمات نوع رویداد
 * بدون حذف یا تغییر اطلاعات موجود
 */
function upgradeEventTypeSettings() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      throw new Error('فایل Google Sheets پیدا نشد.');
    }

    const sheet = ss.getSheetByName('11_EventTypes');

    if (!sheet) {
      throw new Error('شیت 11_EventTypes پیدا نشد.');
    }

    const lastColumn = sheet.getLastColumn();

    if (lastColumn < 1) {
      throw new Error('سرستون‌های شیت پیدا نشدند.');
    }

    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(function(value) {
        return String(value).trim();
      });

    const newHeaders = [
      'TargetDepartmentID',
      'TargetProjectStatus',
      'AllowedDepartmentIDs',
      'AllowedUserIDs',
      'AvailableDepartmentIDs',
      'AllowVoid',
      'ConnectionType'
    ];

    const missingHeaders = newHeaders.filter(function(header) {
      return headers.indexOf(header) === -1;
    });

    if (missingHeaders.length > 0) {
      const startColumn = sheet.getLastColumn() + 1;

      sheet.getRange(
        1,
        startColumn,
        1,
        missingHeaders.length
      ).setValues([missingHeaders]);

      sheet.getRange(
        1,
        startColumn,
        1,
        missingHeaders.length
      )
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setWrap(true)
        .setBackground('#eeeeee');

      sheet.autoResizeColumns(
        startColumn,
        missingHeaders.length
      );
    }

    sheet.setFrozenRows(1);

    if (missingHeaders.indexOf('ConnectionType') >= 0) {
      const connectionTypeColumn = sheet.getLastColumn();
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const defaults = [];
        for (let row = 2; row <= lastRow; row++) defaults.push(['PROJECT']);
        sheet.getRange(2, connectionTypeColumn, lastRow - 1, 1).setValues(defaults);
      }
    }

    PropertiesService.getScriptProperties().setProperty(
      'EVENT_TYPE_SETTINGS_VERSION',
      '1.3.0'
    );

    Logger.log(
      missingHeaders.length
        ? 'ستون‌های جدید اضافه شدند: ' + missingHeaders.join(', ')
        : 'ستون‌های موردنیاز از قبل موجود بودند.'
    );

  } finally {
    lock.releaseLock();
  }
}



function upgradeEventRollbackSettings() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('13_Events');

    if (!sheet) {
      throw new Error('شیت 13_Events پیدا نشد.');
    }

    const lastColumn = sheet.getLastColumn();

    if (lastColumn < 1) {
      throw new Error('سرستون‌های شیت پیدا نشدند.');
    }

    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(function(value) {
        return String(value).trim();
      });

    const newHeaders = [
      'PreviousStepID',
      'PreviousProjectStatus',
      'PreviousAvailableDepartmentIDs'
    ];

    const missing = newHeaders.filter(function(header) {
      return headers.indexOf(header) === -1;
    });

    if (missing.length > 0) {
      const startColumn = sheet.getLastColumn() + 1;

      sheet.getRange(
        1,
        startColumn,
        1,
        missing.length
      ).setValues([missing]);

      sheet.getRange(
        1,
        startColumn,
        1,
        missing.length
      )
        .setFontWeight('bold')
        .setBackground('#eeeeee')
        .setWrap(true);

      sheet.autoResizeColumns(startColumn, missing.length);
    }

    sheet.setFrozenRows(1);

    Logger.log(
      missing.length
        ? 'ستون‌های سابقه اضافه شدند: ' + missing.join(', ')
        : 'ستون‌های سابقه از قبل وجود دارند.'
    );

  } finally {
    lock.releaseLock();
  }
}

/**
 * Diagnostic Project Statuses
 * بررسی فایل متصل و وضعیت‌های پروژه
 * این تابع فقط اطلاعات را می‌خواند و چیزی را تغییر نمی‌دهد.
 */

function diagnoseProjectStatuses() {
  const result = {
    spreadsheetId: null,
    spreadsheetName: null,
    sheetFound: false,
    lastRow: 0,
    headers: [],
    tenantIds: [],
    matchingTenantCount: 0,
    rows: [],
    error: null
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      throw new Error(
        'فایل Google Sheets فعال پیدا نشد.'
      );
    }

    result.spreadsheetId = ss.getId();
    result.spreadsheetName = ss.getName();

    const sheet = ss.getSheetByName(
      '18_ProjectStatuses'
    );

    if (!sheet) {
      throw new Error(
        'شیت 18_ProjectStatuses در این فایل وجود ندارد.'
      );
    }

    result.sheetFound = true;
    result.lastRow = sheet.getLastRow();

    if (result.lastRow < 1) {
      throw new Error(
        'شیت وجود دارد اما خالی است.'
      );
    }

    const columnCount = Math.max(
      sheet.getLastColumn(),
      7
    );

    result.headers = sheet.getRange(
      1,
      1,
      1,
      columnCount
    ).getDisplayValues()[0];

    if (result.lastRow < 2) {
      console.log(
        JSON.stringify(result, null, 2)
      );
      return result;
    }

    const data = sheet.getRange(
      2,
      1,
      result.lastRow - 1,
      7
    ).getDisplayValues();

    const tenantCounts = {};

    data.forEach(function(row) {
      const tenantId = String(
        row[1] || ''
      ).trim();

      if (tenantId) {
        tenantCounts[tenantId] =
          (tenantCounts[tenantId] || 0) + 1;
      }

      result.rows.push({
        ID: row[0],
        TenantID: tenantId,
        Code: row[2],
        Name: row[3],
        Status: row[4]
      });
    });

    result.tenantIds = Object.keys(
      tenantCounts
    ).map(function(id) {
      return {
        tenantId: id,
        count: tenantCounts[id]
      };
    });

    result.matchingTenantCount = data.filter(
      function(row) {
        return String(row[1] || '').trim() ===
          'TEN_7e466e4d';
      }
    ).length;

  } catch (error) {
    result.error = error.message;
  }

  console.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}

function diagnoseProjectStatuses() {
  var result = {
    spreadsheetName: '',
    sheetFound: false,
    sheetTenantIds: [],
    userFound: false,
    userTenantId: '',
    userDepartmentCode: '',
    isAdmin: false,
    apiFilterMatchCount: 0,
    error: ''
  };

  try {
    // بررسی فایل متصل
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      throw new Error('فایل Google Sheets پیدا نشد.');
    }

    result.spreadsheetName = ss.getName();

    // پیدا کردن شیت وضعیت‌های پروژه
    var sheet = ss.getSheetByName('18_ProjectStatuses');

    if (!sheet) {
      throw new Error('شیت 18_ProjectStatuses پیدا نشد.');
    }

    result.sheetFound = true;

    // خواندن ردیف‌های شیت
    var lastRow = sheet.getLastRow();
    var rows = [];

    if (lastRow >= 2) {
      rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    }

    // شمارش وضعیت‌ها بر اساس شناسه شرکت
    var tenantCounts = {};

    for (var i = 0; i < rows.length; i++) {
      var tenantId = String(rows[i][1] || '').trim();

      if (tenantId !== '') {
        if (!tenantCounts[tenantId]) {
          tenantCounts[tenantId] = 0;
        }

        tenantCounts[tenantId]++;
      }
    }

    for (var id in tenantCounts) {
      if (Object.prototype.hasOwnProperty.call(tenantCounts, id)) {
        result.sheetTenantIds.push({
          tenantId: id,
          count: tenantCounts[id]
        });
      }
    }

    // بررسی کاربر بدون چاپ یا افشای توکن
    var user = AccessControlService.getCurrentUser({});

    result.userFound = !!user;
    result.userTenantId = String(user.TenantID || '');
    result.userDepartmentCode =
      AccessControlService.getDepartmentCode(user);
    result.isAdmin = AccessControlService.isAdmin(user);

    // شمارش ردیف‌هایی که با شرکت کاربر تطبیق دارند
    for (var j = 0; j < rows.length; j++) {
      if (String(rows[j][1]) === String(user.TenantID)) {
        result.apiFilterMatchCount++;
      }
    }

  } catch (error) {
    result.error = error && error.message
      ? error.message
      : String(error);
  }

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}