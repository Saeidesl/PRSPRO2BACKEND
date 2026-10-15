/**
 * افزودن مجوزهای مستقل نمایش بخش‌های سایدبار
 * بدون حذف یا تغییر اطلاعات موجود
 */
function addSidebarPermissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('05_Permissions');

  if (!sheet) {
    throw new Error('شیت 05_Permissions پیدا نشد.');
  }

  const permissions = [
    ['SIDEBAR_DASHBOARD_VIEW', 'نمایش داشبورد', 'SIDEBAR', 'اجازه نمایش داشبورد'],
    ['SIDEBAR_PROJECTS_VIEW', 'نمایش پروژه‌ها', 'SIDEBAR', 'اجازه نمایش پروژه‌ها'],
    ['SIDEBAR_EVENTS_VIEW', 'نمایش رویدادها', 'SIDEBAR', 'اجازه نمایش رویدادها'],
    ['SIDEBAR_WORKFLOWS_VIEW', 'نمایش گردش‌کارها', 'SIDEBAR', 'اجازه نمایش گردش‌کارها'],
    ['SIDEBAR_EVENT_TYPES_VIEW', 'نمایش انواع رویداد', 'SIDEBAR', 'اجازه نمایش انواع رویداد'],
    ['SIDEBAR_ATTACHMENTS_VIEW', 'نمایش فایل‌ها', 'SIDEBAR', 'اجازه نمایش فایل‌ها'],
    ['SIDEBAR_REPORTS_VIEW', 'نمایش گزارش‌ها', 'SIDEBAR', 'اجازه نمایش گزارش‌ها'],
    ['SIDEBAR_USERS_VIEW', 'نمایش کاربران', 'SIDEBAR', 'اجازه نمایش کاربران'],
    ['SIDEBAR_DEPARTMENTS_VIEW', 'نمایش واحدها', 'SIDEBAR', 'اجازه نمایش واحدها'],
    ['SIDEBAR_ROLES_VIEW', 'نمایش نقش‌ها', 'SIDEBAR', 'اجازه نمایش نقش‌ها'],
    ['SIDEBAR_PERMISSIONS_VIEW', 'نمایش دسترسی‌ها', 'SIDEBAR', 'اجازه نمایش دسترسی‌ها'],
    ['SIDEBAR_AUDIT_VIEW', 'نمایش گزارش فعالیت‌ها', 'SIDEBAR', 'اجازه نمایش گزارش فعالیت‌ها'],
    ['SIDEBAR_SETTINGS_VIEW', 'نمایش تنظیمات', 'SIDEBAR', 'اجازه نمایش تنظیمات'],
    ['SIDEBAR_ADMIN_VIEW', 'نمایش مدیریت سامانه', 'SIDEBAR', 'اجازه نمایش مدیریت سامانه'],
    ['SIDEBAR_PROJECT_STATUSES_VIEW', 'نمایش وضعیت‌های پروژه', 'SIDEBAR', 'اجازه نمایش وضعیت‌های پروژه']
  ];

  const existingData = sheet.getDataRange().getValues();
  const existingCodes = new Set();

  for (let i = 1; i < existingData.length; i++) {
    existingCodes.add(String(existingData[i][1] || '').trim());
  }

  const rows = [];

  permissions.forEach(function (permission) {
    if (existingCodes.has(permission[0])) return;

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

  Logger.log('مجوزهای جدید سایدبار اضافه شدند: ' + rows.length);
}