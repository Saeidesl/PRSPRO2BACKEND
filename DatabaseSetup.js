
/**
 * Production Management System
 * Database Setup - Version 1.1.0
 * ایجاد شیت‌های دیتابیس بدون حذف اطلاعات موجود
 */

const APP_CONFIG = {

  VERSION: '1.1.4',

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
      headers: ['ID','TenantID','ProjectCode','Title','Description','WorkflowID','WorkflowVersion','CurrentStepID','Status','CreatedBy','CreatedAt','UpdatedAt','Quantity','ColorSizeJSON','AvailableDepartmentIDs','AllowedUserIDs','NotifyEnabled','CurrentStepStatus']
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
      headers: ['ID','TenantID','Name','Code','Version','Description','DepartmentID','Category','WorkflowStepID','MovesProjectToStep','AllowAttachments','Status','CreatedAt','UpdatedAt','ConnectionType','TargetDepartmentID','TargetProjectStatus','AllowedDepartmentIDs','AllowedUserIDs','AvailableDepartmentIDs','AllowVoid','UseProjectColors','UseProjectSizes','TrackVariantQuantity','TargetStepStatus','IsWorkCompletion']
    },

    EVENT_FIELDS: {
      name: '12_EventFields',
      headers: ['ID','TenantID','EventTypeID','Name','Code','FieldType','IsRequired','DefaultValue','Options','ValidationRule','FieldOrder','Status','CreatedAt','UpdatedAt']
    },

    EVENTS: {
      name: '13_Events',
      headers: ['ID','TenantID','ProjectID','EventTypeID','EventTypeVersion','PerformedBy','CreatedBy','DepartmentID','OccurredAt','CreatedAt','Description','Status','Color','Size','VariantQuantity','PreviousStepID','PreviousProjectStatus','PreviousAvailableDepartmentIDs','PreviousSnapshotCaptured','VariantDetailsJSON','PreviousCurrentStepStatus']
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
      headers: ['ID','TenantID','ProjectID','SourceEventID','ItemName','ItemCode','Unit','RequestedQuantity','NeededBy','Status','Notes','CreatedBy','CreatedAt','UpdatedAt','MaterialSpecID','SpecificationRevision','CalculationID','BasisQuantity','NeedType','CalculationKey']
    },

    PROJECT_STATUSES: {
      name: '18_ProjectStatuses',
      headers: ['ID','TenantID','Code','Name','Status','CreatedAt','UpdatedAt']
    },

    PROJECT_MATERIAL_SPECS: {
      name: '24_ProjectMaterialSpecs',
      headers: ['ID','TenantID','ProjectID','SpecKey','ItemName','ItemCode','Unit','ConsumptionPerUnit','WastagePercent','EarlyOrderPolicy','EarlyOrderQuantity','Status','Revision','Notes','CreatedBy','CreatedAt','UpdatedAt']
    },

    MATERIAL_NEED_CALCULATIONS: {
      name: '25_MaterialNeedCalculations',
      headers: ['ID','TenantID','ProjectID','MaterialSpecID','MaterialNeedID','SourceEventID','SourceEventVersion','CalculationKey','BasisQuantity','ConsumptionPerUnit','WastagePercent','CalculatedQuantity','PreviousCalculatedQuantity','VarianceQuantity','CalculationType','Status','CreatedBy','CreatedAt']
    },

    PURCHASE_ORDERS: {
      name: '19_PurchaseOrders',
      headers: ['ID','TenantID','OrderNumber','SupplierName','OrderDate','ExpectedDeliveryDate','Status','Notes','CreatedBy','CreatedAt','UpdatedAt','IdempotencyKey']
    },

    PURCHASE_ORDER_ITEMS: {
      name: '20_PurchaseOrderItems',
      headers: ['ID','TenantID','PurchaseOrderID','MaterialNeedID','ItemName','ItemCode','Unit','OrderedQuantity','UnitPrice','Notes','CreatedAt','UpdatedAt','SurplusQuantity','SurplusCost']
    },

    PURCHASE_ALLOCATIONS: {
      name: '21_PurchaseAllocations',
      headers: ['ID','TenantID','PurchaseOrderItemID','ProjectID','MaterialNeedID','AllocatedQuantity','CreatedAt']
    },

    MATERIAL_RECEIPTS: {
      name: '22_MaterialReceipts',
      headers: ['ID','TenantID','PurchaseOrderItemID','ProjectID','QuantityReceived','ReceivedAt','WarehouseDepartmentID','SourceEventID','Notes','ReceivedBy','CreatedAt','IdempotencyKey']
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
/**
 * بازسازی کامل شیت‌های دیتابیس از ابتدا.
 * این عملیات همه شیت‌های موجود در فایل متصل را حذف می‌کند؛ فقط پس از تأیید صریح اجرا شود.
 */
function resetDatabaseSheets() {
  const ui = SpreadsheetApp.getUi();
  const choice = ui.alert(
    'بازسازی کامل دیتابیس',
    'هشدار: تمام شیت‌های این فایل Google Sheets حذف و از نو ساخته می‌شوند. ' +
      'این عملیات قابل بازگشت نیست. فقط در صورتی ادامه بده که مطمئنی اطلاعاتی برای نگهداری وجود ندارد.',
    ui.ButtonSet.YES_NO
  );

  if (choice !== ui.Button.YES) {
    ui.alert('عملیات لغو شد. هیچ شیتی تغییر نکرد.');
    return;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('فایل Google Sheets پیدا نشد.');

    const definitions = Object.values(APP_CONFIG.SHEETS);
    if (!definitions.length) throw new Error('تعریف شیت‌ها خالی است.');

    // Google Sheets اجازه حذف آخرین شیت را نمی‌دهد؛ یک شیت موقت را نگه می‌داریم.
    const sheets = ss.getSheets();
    if (!sheets.length) throw new Error('هیچ شیتی برای شروع بازسازی پیدا نشد.');
    const keeper = sheets[0];

    sheets.forEach(function(sheet) {
      if (sheet.getSheetId() !== keeper.getSheetId()) {
        ss.deleteSheet(sheet);
      }
    });

    const temporaryName = '__DB_RESET_TEMP__';
    const existingTemporary = ss.getSheetByName(temporaryName);
    if (existingTemporary && existingTemporary.getSheetId() !== keeper.getSheetId()) {
      ss.deleteSheet(existingTemporary);
    }
    keeper.setName(temporaryName);
    keeper.clear();
    if (keeper.getFilter()) keeper.getFilter().remove();
    keeper.getBandings().forEach(function(banding) { banding.remove(); });
    keeper.getMergedRanges().forEach(function(range) { range.breakApart(); });

    definitions.forEach(function(definition) {
      const sheet = ss.insertSheet(definition.name);
      if (sheet.getMaxColumns() < definition.headers.length) {
        sheet.insertColumnsAfter(
          sheet.getMaxColumns(),
          definition.headers.length - sheet.getMaxColumns()
        );
      }
      sheet.getRange(1, 1, 1, definition.headers.length)
        .setValues([definition.headers]);
    });

    ss.deleteSheet(keeper);

    applyAllFormatting_(ss);
    applyAllValidations_(ss);
    seedInitialData_(ss);
    saveSetupMetadata_(ss);

    ui.alert(
      'بازسازی کامل شد',
      'همه شیت‌های دیتابیس با سرستون‌های استاندارد ساخته شدند و داده‌های پایه ایجاد شدند. اکنون می‌توانی checkDatabaseHealth را اجرا کنی.',
      ui.ButtonSet.OK
    );
    Logger.log('بازسازی کامل دیتابیس انجام شد. تعداد شیت‌های تعریف‌شده: ' + definitions.length);
  } catch (error) {
    Logger.log(error.stack || error);
    SpreadsheetApp.getUi().alert(
      'خطا در بازسازی دیتابیس',
      error.message || String(error),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    throw error;
  } finally {
    lock.releaseLock();
  }
}


/**
 * ایجاد دسترسی اولیه مدیر سیستم پس از بازسازی دیتابیس.
 * بدون رابط کاربری هم از ویرایشگر Apps Script قابل اجراست.
 * رمز عبور تصادفی تولید می‌شود و فقط در Execution log نمایش داده می‌شود.
 * اجرای مجدد، در صورت وجود حساب فعال ADMIN، حساب جدید نمی‌سازد.
 */
function bootstrapAdminAccess() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error('Spreadsheet پیدا نشد. این تابع را از پروژه Apps Script متصل به فایل دیتابیس اجرا کن.');
    }

    const tenantSheet = ss.getSheetByName(APP_CONFIG.SHEETS.TENANTS.name);
    const departmentSheet = ss.getSheetByName(APP_CONFIG.SHEETS.DEPARTMENTS.name);
    const userSheet = ss.getSheetByName(APP_CONFIG.SHEETS.USERS.name);
    if (!tenantSheet || !departmentSheet || !userSheet) {
      throw new Error('شیت‌های Tenant، Departments یا Users پیدا نشدند. ابتدا resetDatabaseSheets یا setupDatabase را کامل اجرا کن.');
    }

    seedTenant_(ss);

    const tenantRows = tenantSheet.getLastRow() > 1
      ? tenantSheet.getRange(2, 1, tenantSheet.getLastRow() - 1, 7).getValues()
      : [];
    const tenant = tenantRows.find(function(row) {
      return String(row[2] || '').trim() === APP_CONFIG.DEFAULT_TENANT.CODE &&
        String(row[4] || '').toUpperCase() === 'ACTIVE';
    }) || tenantRows.find(function(row) {
      return String(row[4] || '').toUpperCase() === 'ACTIVE';
    });
    if (!tenant) throw new Error('هیچ Tenant فعالی پیدا نشد.');

    const tenantId = String(tenant[0]);
    let departments = departmentSheet.getLastRow() > 1
      ? departmentSheet.getRange(2, 1, departmentSheet.getLastRow() - 1, 7).getValues()
      : [];
    let adminDepartment = departments.find(function(row) {
      return String(row[1]) === tenantId &&
        String(row[3] || '').trim().toUpperCase() === 'ADMIN';
    });

    if (!adminDepartment) {
      const departmentId = generateId_('DEP');
      const now = nowISO_();
      departmentSheet.appendRow([
        departmentId, tenantId, 'مدیریت سیستم', 'ADMIN', 'ACTIVE', now, now
      ]);
      adminDepartment = [departmentId, tenantId, 'مدیریت سیستم', 'ADMIN', 'ACTIVE', now, now];
    }

    const userRows = userSheet.getLastRow() > 1
      ? userSheet.getRange(2, 1, userSheet.getLastRow() - 1, 9).getValues()
      : [];
    const activeAdmin = userRows.find(function(row) {
      if (String(row[1]) !== tenantId || String(row[5]) !== String(adminDepartment[0])) return false;
      return String(row[6] || '').toUpperCase() === 'ACTIVE';
    });

    if (activeAdmin) {
      Logger.log('حساب مدیر فعال از قبل وجود دارد. نام کاربری: ' + String(activeAdmin[3]));
      Logger.log('برای امنیت، رمز عبور جدید تولید نشد. اگر رمز را نمی‌دانی، باید روند بازنشانی رمز اجرا شود.');
      return;
    }

    const username = 'admin';
    const usernameExists = userRows.some(function(row) {
      return String(row[1]) === tenantId &&
        String(row[3] || '').trim().toLowerCase() === username;
    });
    if (usernameExists) {
      throw new Error('نام کاربری admin قبلاً برای حساب دیگری استفاده شده است. ابتدا نام کاربری تکراری را در شیت 02_Users بررسی و اصلاح کن، سپس دوباره اجرا کن.');
    }

    const password = Utilities.getUuid().replace(/-/g, '') +
      Utilities.getUuid().replace(/-/g, '').substring(0, 8);
    const now = nowISO_();
    userSheet.appendRow([
      'USR_' + Utilities.getUuid().replace(/-/g, ''),
      tenantId,
      'مدیر سیستم',
      username,
      AuthService.hashPassword_(password),
      String(adminDepartment[0]),
      'ACTIVE',
      now,
      now
    ]);

    Logger.log('حساب مدیر سیستم ایجاد شد.');
    Logger.log('نام کاربری: ' + username);
    Logger.log('رمز عبور موقت: ' + password);
    Logger.log('این رمز را همین حالا در محل امن نگه دار؛ فقط در Execution log همین اجرا نمایش داده می‌شود. بعد از ورود، آن را از بخش مدیریت کاربران تغییر بده.');
  } finally {
    lock.releaseLock();
  }
}


/**
 * ترمیم دسترسی حساب مدیر پس از ورود اولیه.
 * داده‌های موجود را حذف نمی‌کند؛ نقش مدیر را ایجاد/تکمیل و به حساب ADMIN متصل می‌کند.
 */
function repairAdminAccess() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('فایل دیتابیس پیدا نشد.');

    seedInitialData_(ss);

    const tenantSheet = ss.getSheetByName('01_Tenants');
    const deptSheet = ss.getSheetByName('03_Departments');
    const usersSheet = ss.getSheetByName('02_Users');
    const rolesSheet = ss.getSheetByName('04_Roles');
    const permissionsSheet = ss.getSheetByName('05_Permissions');
    const userRolesSheet = ss.getSheetByName('06_UserRoles');
    const rolePermissionsSheet = ss.getSheetByName('07_RolePermissions');
    [tenantSheet, deptSheet, usersSheet, rolesSheet, permissionsSheet, userRolesSheet, rolePermissionsSheet]
      .forEach(function(sheet) { if (!sheet) throw new Error('یکی از شیت‌های لازم برای دسترسی مدیر وجود ندارد.'); });

    const read = function(sheet, width) {
      return sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues() : [];
    };
    const tenants = read(tenantSheet, 7);
    const tenant = tenants.find(function(r) {
      return String(r[2] || '').trim() === 'MAIN' && String(r[4] || '').toUpperCase() === 'ACTIVE';
    }) || tenants.find(function(r) { return String(r[4] || '').toUpperCase() === 'ACTIVE'; });
    if (!tenant) throw new Error('شرکت فعال پیدا نشد.');
    const tenantId = String(tenant[0]);

    const adminDept = read(deptSheet, 7).find(function(r) {
      return String(r[1]) === tenantId && String(r[3] || '').trim().toUpperCase() === 'ADMIN'
        && String(r[4] || '').toUpperCase() === 'ACTIVE';
    });
    if (!adminDept) throw new Error('واحد فعال ADMIN پیدا نشد. ابتدا bootstrapAdminAccess را اجرا کن.');

    const allUserRows = read(usersSheet, 9);
    let adminUser = allUserRows.find(function(r) {
      return String(r[1]) === tenantId &&
        String(r[3] || '').trim().toLowerCase() === 'admin' &&
        String(r[6] || '').toUpperCase() === 'ACTIVE';
    });

    if (adminUser && String(adminUser[5]) !== String(adminDept[0])) {
      const userHeaders = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
      const departmentColumn = userHeaders.indexOf('DepartmentID') + 1;
      const userRowIndex = allUserRows.findIndex(function(r) {
        return String(r[0]) === String(adminUser[0]);
      }) + 2;
      if (departmentColumn < 1 || userRowIndex < 2) {
        throw new Error('ستون DepartmentID یا ردیف حساب admin پیدا نشد.');
      }
      usersSheet.getRange(userRowIndex, departmentColumn).setValue(String(adminDept[0]));
      adminUser[5] = String(adminDept[0]);
      Logger.log('واحد حساب admin به ADMIN اصلاح شد.');
    }

    if (!adminUser) {
      adminUser = allUserRows.find(function(r) {
        return String(r[1]) === tenantId &&
          String(r[5]) === String(adminDept[0]) &&
          String(r[6] || '').toUpperCase() === 'ACTIVE';
      });
    }
    if (!adminUser) {
      throw new Error('کاربر فعال admin در شرکت انتخاب‌شده پیدا نشد. بررسی کن ردیف کاربر admin در شیت 02_Users فعال باشد و TenantID آن با شرکت فعال مطابقت داشته باشد.');
    }

    const now = nowISO_();
    const roles = read(rolesSheet, 7);
    let role = roles.find(function(r) {
      return String(r[1]) === tenantId && ['SYS_ADMIN', 'ADMIN'].indexOf(String(r[3] || '').toUpperCase()) >= 0;
    });
    if (!role) {
      const newRole = ['ROL_' + Utilities.getUuid().replace(/-/g, ''), tenantId, 'مدیر سیستم', 'SYS_ADMIN', 'ACTIVE', now, now];
      rolesSheet.appendRow(newRole);
      role = newRole;
    } else if (String(role[4] || '').toUpperCase() !== 'ACTIVE') {
      const headers = rolesSheet.getRange(1, 1, 1, rolesSheet.getLastColumn()).getValues()[0];
      const statusCol = headers.indexOf('Status') + 1;
      if (statusCol > 0) rolesSheet.getRange(roles.findIndex(function(r) { return String(r[0]) === String(role[0]); }) + 2, statusCol).setValue('ACTIVE');
      role[4] = 'ACTIVE';
    }
    const roleId = String(role[0]);

    const permissionRows = read(permissionsSheet, 6);
    const activePermissions = permissionRows.filter(function(r) { return String(r[5] || '').toUpperCase() === 'ACTIVE' && r[0]; });
    const rolePermRows = read(rolePermissionsSheet, 5);
    const linkedPermissionIds = new Set(rolePermRows.filter(function(r) {
      return String(r[1]) === tenantId && String(r[2]) === roleId;
    }).map(function(r) { return String(r[3]); }));
    activePermissions.forEach(function(p) {
      if (!linkedPermissionIds.has(String(p[0]))) {
        rolePermissionsSheet.appendRow(['RP_' + Utilities.getUuid().replace(/-/g, ''), tenantId, roleId, String(p[0]), now]);
      }
    });

    const userRoleRows = read(userRolesSheet, 5);
    const alreadyAssigned = userRoleRows.some(function(r) {
      return String(r[1]) === tenantId && String(r[2]) === String(adminUser[0]) && String(r[3]) === roleId;
    });
    if (!alreadyAssigned) {
      userRolesSheet.appendRow(['UR_' + Utilities.getUuid().replace(/-/g, ''), tenantId, String(adminUser[0]), roleId, now]);
    }

    Logger.log('ترمیم دسترسی مدیر انجام شد.');
    Logger.log('نام کاربری مدیر: ' + String(adminUser[3]));
    Logger.log('کد واحد: ADMIN');
    Logger.log('نقش: ' + String(role[2]) + ' (' + String(role[3]) + ')');
    Logger.log('تعداد مجوزهای فعال متصل به نقش: ' + activePermissions.length);
    Logger.log('اکنون از برنامه خارج شو و دوباره وارد شو؛ اگر صفحه همچنان محدود است، صفحه را کامل تازه‌سازی کن.');
  } finally {
    lock.releaseLock();
  }
}


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
    backfillPurchaseOrderSurplus_(ss);
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
  // Header rows must accept column names even if an older setup applied data validation there.
  const existingLastColumn = Math.max(sheet.getLastColumn(), headers.length, 1);
  sheet.getRange(1, 1, 1, existingLastColumn).clearDataValidations();

  const currentLastColumn = sheet.getLastColumn();
  const current = currentLastColumn > 0
    ? sheet.getRange(1, 1, 1, currentLastColumn).getDisplayValues()[0]
        .map(function(value) { return String(value).trim(); })
    : [];
  const hasHeaders = current.some(function(value) { return value !== ''; });

  if (!hasHeaders) {
    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        headers.length - sheet.getMaxColumns()
      );
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  // Existing installations may have appended newer columns in a different order.
  // The repository maps records by header name, so preserve every existing column and
  // append only missing required headers. Never reorder, overwrite, or delete user data.
  const seen = Object.create(null);
  current.forEach(function(header) {
    if (!header) return;
    if (seen[header]) {
      throw new Error(
        'شیت "' + sheet.getName() + '" دارای سرستون تکراری "' + header +
        '" است. برای جلوگیری از آسیب به اطلاعات، عملیات متوقف شد.'
      );
    }
    seen[header] = true;
  });

  const missing = headers.filter(function(header) {
    return current.indexOf(header) === -1;
  });

  if (missing.length) {
    const startColumn = Math.max(sheet.getLastColumn(), 0) + 1;
    const requiredLastColumn = startColumn + missing.length - 1;
    if (sheet.getMaxColumns() < requiredLastColumn) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        requiredLastColumn - sheet.getMaxColumns()
      );
    }
    sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
  }
}


/**
 * Backfill surplus fields for historical purchase-order items.
 * Existing nonblank values are preserved. Only missing surplus values are filled.
 */
function backfillPurchaseOrderSurplus_(ss) {
  const needsSheet = ss.getSheetByName('18_MaterialNeeds');
  const itemsSheet = ss.getSheetByName('20_PurchaseOrderItems');
  const allocationsSheet = ss.getSheetByName('21_PurchaseAllocations');
  if (!needsSheet || !itemsSheet || !allocationsSheet) return;

  const needHeaders = needsSheet.getRange(1, 1, 1, needsSheet.getLastColumn()).getValues()[0];
  const itemHeaders = itemsSheet.getRange(1, 1, 1, itemsSheet.getLastColumn()).getValues()[0];
  const allocationHeaders = allocationsSheet.getRange(1, 1, 1, allocationsSheet.getLastColumn()).getValues()[0];
  const surplusIndex = itemHeaders.indexOf('SurplusQuantity');
  const surplusCostIndex = itemHeaders.indexOf('SurplusCost');
  if (surplusIndex < 0 || surplusCostIndex < 0 || itemsSheet.getLastRow() < 2) return;

  function indexOf(headers, name) { return headers.indexOf(name); }
  function cell(row, headers, name) {
    const index = indexOf(headers, name);
    return index < 0 ? '' : row[index];
  }

  const needRows = needsSheet.getLastRow() > 1
    ? needsSheet.getRange(2, 1, needsSheet.getLastRow() - 1, needHeaders.length).getValues() : [];
  const needById = {};
  needRows.forEach(function(row) {
    const id = String(cell(row, needHeaders, 'ID') || '');
    if (id) needById[id] = {
      requested: Math.max(0, Number(cell(row, needHeaders, 'RequestedQuantity')) || 0)
    };
  });

  const allocationRows = allocationsSheet.getLastRow() > 1
    ? allocationsSheet.getRange(2, 1, allocationsSheet.getLastRow() - 1, allocationHeaders.length).getValues() : [];
  const allocationsByItem = {};
  allocationRows.forEach(function(row) {
    const itemId = String(cell(row, allocationHeaders, 'PurchaseOrderItemID') || '');
    if (!itemId) return;
    if (!allocationsByItem[itemId]) allocationsByItem[itemId] = [];
    allocationsByItem[itemId].push({
      needId: String(cell(row, allocationHeaders, 'MaterialNeedID') || ''),
      quantity: Math.max(0, Number(cell(row, allocationHeaders, 'AllocatedQuantity')) || 0)
    });
  });

  const lastRow = itemsSheet.getLastRow();
  const itemRows = itemsSheet.getRange(2, 1, lastRow - 1, itemHeaders.length).getValues();
  const indexedRows = itemRows.map(function(row, offset) {
    return { row: row, sheetRow: offset + 2 };
  }).sort(function(a, b) {
    return String(cell(a.row, itemHeaders, 'CreatedAt') || '').localeCompare(
      String(cell(b.row, itemHeaders, 'CreatedAt') || '')
    ) || a.sheetRow - b.sheetRow;
  });
  const fulfilledByNeed = {};

  indexedRows.forEach(function(entry) {
    const row = entry.row;
    const itemId = String(cell(row, itemHeaders, 'ID') || '');
    const quantity = Math.max(0, Number(cell(row, itemHeaders, 'OrderedQuantity')) || 0);
    const needId = String(cell(row, itemHeaders, 'MaterialNeedID') || '');
    const allocations = allocationsByItem[itemId] || [];
    let allocatedToNeeds = 0;

    if (allocations.length) {
      allocations.forEach(function(allocation) {
        if (!allocation.needId || !needById[allocation.needId]) return;
        const need = needById[allocation.needId];
        const alreadyFulfilled = Math.max(0, fulfilledByNeed[allocation.needId] || 0);
        const fulfilled = Math.min(allocation.quantity, Math.max(0, need.requested - alreadyFulfilled));
        fulfilledByNeed[allocation.needId] = alreadyFulfilled + fulfilled;
        allocatedToNeeds += fulfilled;
      });
    } else if (needId && needById[needId]) {
      const need = needById[needId];
      const alreadyFulfilled = Math.max(0, fulfilledByNeed[needId] || 0);
      allocatedToNeeds = Math.min(quantity, Math.max(0, need.requested - alreadyFulfilled));
      fulfilledByNeed[needId] = alreadyFulfilled + allocatedToNeeds;
    }

    // New rows already have explicit values (including zero); preserve them.
    if (row[surplusIndex] !== '' && row[surplusIndex] !== null && row[surplusIndex] !== undefined) return;

    const surplus = (allocations.length || needId)
      ? Math.max(0, quantity - allocatedToNeeds)
      : 0;
    const unitPrice = cell(row, itemHeaders, 'UnitPrice');
    const surplusCost = unitPrice === '' || unitPrice === null || unitPrice === undefined
      ? '' : surplus * (Number(unitPrice) || 0);
    itemsSheet.getRange(entry.sheetRow, surplusIndex + 1).setValue(surplus);
    itemsSheet.getRange(entry.sheetRow, surplusCostIndex + 1).setValue(surplusCost);
  });
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
  setListValidation_(ss, '17_WorkflowStepDepartments', 6, ['ACTIVE','INACTIVE','DELETED']);
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
  seedProjectStatuses_(ss);
}

/**
 * ایجاد وضعیت‌های پایه پروژه برای هر شرکت فعال؛ قابل اجرای مجدد و بدون تکرار.
 */
function seedProjectStatuses_(ss) {
  const sheet = ss.getSheetByName('18_ProjectStatuses');
  const tenantSheet = ss.getSheetByName('01_Tenants');
  if (!sheet || !tenantSheet) return;

  const tenants = tenantSheet.getLastRow() > 1
    ? tenantSheet.getRange(2, 1, tenantSheet.getLastRow() - 1, 7).getValues()
    : [];
  const existingRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues()
    : [];
  const existingKeys = new Set();

  existingRows.forEach(function(row) {
    const tenantId = String(row[1] || '').trim();
    const code = String(row[2] || '').trim();
    if (tenantId && code) existingKeys.add(tenantId + '|' + code);
  });

  const defaults = [
    ['ACTIVE', 'فعال'],
    ['ON_HOLD', 'متوقف'],
    ['COMPLETED', 'تکمیل‌شده'],
    ['CANCELLED', 'لغوشده']
  ];
  const now = nowISO_();
  const rows = [];

  tenants.forEach(function(tenant) {
    if (!tenant[0] || String(tenant[4] || '').toUpperCase() !== 'ACTIVE') return;
    const tenantId = String(tenant[0]);

    defaults.forEach(function(item) {
      const key = tenantId + '|' + item[0];
      if (existingKeys.has(key)) return;
      rows.push([
        'PST_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12),
        tenantId,
        item[0],
        item[1],
        'ACTIVE',
        now,
        now
      ]);
      existingKeys.add(key);
    });
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  }
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
    .addItem('حذف و بازسازی کامل شیت‌ها', 'resetDatabaseSheets')
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