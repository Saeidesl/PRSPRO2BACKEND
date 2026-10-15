function addProjectStatusManagePermission() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('05_Permissions');

  if (!sheet) throw new Error('شیت 05_Permissions پیدا نشد.');

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col = name => headers.indexOf(name);

  ['Code', 'Name', 'Module', 'Description', 'Status'].forEach(name => {
    if (col(name) < 0) {
      throw new Error('ستون ' + name + ' پیدا نشد.');
    }
  });

  if (data.slice(1).some(row =>
    String(row[col('Code')]).trim() === 'PROJECT_STATUS_MANAGE'
  )) {
    Logger.log('مجوز از قبل وجود دارد.');
    return;
  }

  const row = Array(headers.length).fill('');
  if (col('ID') >= 0) {
    row[col('ID')] = 'PER_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  }

  row[col('Code')] = 'PROJECT_STATUS_MANAGE';
  row[col('Name')] = 'مدیریت وضعیت‌های پروژه';
  row[col('Module')] = 'PROJECT';
  row[col('Description')] = 'ایجاد و ویرایش وضعیت‌های پروژه';
  row[col('Status')] = 'ACTIVE';

  sheet.appendRow(row);
  Logger.log('مجوز با موفقیت ثبت شد.');
}