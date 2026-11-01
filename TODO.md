## 🎯 Current Objective

پیاده‌سازی زیرساخت بک‌اند برای «قالب‌های چاپی نام‌دار و قابل استفاده مجدد» در PMS؛ ذخیره مستقل از پروژه در Google Sheets، دسترسی tenant-scoped، APIهای مدیریت قالب و حفظ snapshot تعریف فرم برای چاپ پروژه‌های مختلف.

## 🗺️ Technical Spec & Architecture Map (DO NOT DELETE)

### مخازن و شاخه‌ها
- Backend: `Saeidesl/PRSPRO2BACKEND`
- Frontend: `Saeidesl/PRSPRO2`
- شاخه کاری: `feat/named-reusable-print-templates` در هر دو مخزن؛ پایه `main`.
- این فاز ادامه قابلیت طراحی/چاپ در فرانت‌اند است؛ مسیر فرم‌ها و رویدادهای موجود تغییر ماهوی نمی‌کنند.

### یافته‌های معماری
- پشته: Google Apps Script Runtime V8 و Google Sheets؛ همه درخواست‌ها از `Router.js` عبور می‌کنند.
- `DatabaseSetup.js`:
  - `APP_CONFIG.SHEETS` فهرست شیت‌ها و سرستون‌ها را نگهداری می‌کند.
  - `setupDatabase()` با `createAllSheets_(ss)` و `ensureHeaders_(sheet, headers)` شیت‌ها را افزایشی ایجاد/تکمیل می‌کند؛ استفاده از reset یا حذف شیت برای این قابلیت ممنوع است.
- فرم‌ها:
  - `FormRepository.js`: شیت‌های `32_Forms`, `33_FormFields`, `34_EventTypeForms`, `35_EventFormData`.
  - `FormService.js`: `getEventResponses(eventId, params)` پاسخ هر رویداد را همراه `Values` و `Definition` (از DefinitionSnapshotJSON) برمی‌گرداند؛ کنترل tenant و دسترسی پروژه در این سرویس انجام می‌شود.
  - `EventService.getProjectDetails(projectId, params)` و `Router.js` مسیر `GET /projects/:projectId/details` رویدادهای پروژه را فراهم می‌کنند.
- `Router.js`:
  - در `get(path, params)` مسیرهای GET؛ در `post(path, body, params)` مسیرهای ایجاد؛ در `put(path, body, params)` مسیرهای ویرایش تعریف شده‌اند.
  - مجوزهای موجود `PROJECT_VIEW`, `PROJECT_EDIT`, `SYSTEM_SETTINGS` استفاده می‌شوند؛ permission جدید اضافه نمی‌شود.
- الگوی repository: `GoogleSheetsRepository.getAll/findById/insert/updateById` و الگوی service: `AccessControlService.getCurrentUser`, `Response.success`, `ErrorHandler.create`.
- فایل `tests/forms-api-contract.test.js` و سایر آزمون‌های `tests/*.test.js` الگوی آزمون قراردادی/سورس را ارائه می‌دهند. CI در `backend-check.yml` آزمون‌های Node و syntax فایل‌های JS را اجرا می‌کند.

### طراحی فنی ذخیره قالب
- شیت جدید افزایشی: `36_PrintTemplates`.
- ستون‌ها: `ID,TenantID,Name,Version,TemplateJSON,Status,CreatedBy,CreatedAt,UpdatedBy,UpdatedAt`.
- فایل جدید `PrintTemplateRepository.js`: `listByTenant`, `findById`, `insert`, `update`.
- فایل جدید `PrintTemplateService.js`: `list`, `get`, `create`, `update`, اعتبارسنجی نام/نسخه/ساختار JSON/حجم و تعداد المان، یکتایی نام فعال در tenant و جلوگیری از دسترسی بین tenantها.
- API:
  - `GET /print-templates` با `PROJECT_VIEW`.
  - `GET /print-templates/:id` با `PROJECT_VIEW`.
  - `POST /print-templates` و `PUT /print-templates/:id` با `PROJECT_EDIT` یا `SYSTEM_SETTINGS`.
- TenantID، CreatedBy و UpdatedBy فقط از کاربر session سمت سرور استخراج شوند؛ ورودی کلاینت صرفاً Name، Version و Template payload را حمل کند.
- TemplateJSON باید ساختار نسخه‌دار داشته باشد و snapshot فرم را به همراه عناصر/چیدمان نگه دارد. مقدار پاسخ‌های پروژه در قالب ذخیره نشود؛ هنگام چاپ از داده‌های پروژه انتخابی خوانده می‌شود.
- کنترل payload شامل JSON parse معتبر، محدودیت طول نام، طول JSON، سقف تعداد عناصر، allow-list نوع عناصر و محدودیت عمق/اندازه snapshot؛ عدم پذیرش HTML اجرایی/اسکریپت.
- نام قالب در هر tenant یکتا باشد (مقایسه trim شده و case-insensitive)؛ به‌روزرسانی همان ID مجاز است. حذف نرم‌افزاری از طریق Status در آینده قابل افزودن است و در این فاز ضروری نیست.

### فایل‌ها و APIهای مرتبط
- `DatabaseSetup.js`: تعریف شیت و headerهای append-only.
- `PrintTemplateRepository.js` (جدید): عملیات شیت `36_PrintTemplates`.
- `PrintTemplateService.js` (جدید): منطق و اعتبارسنجی و دسترسی tenant.
- `Router.js`: GET/POST/PUT قالب‌ها.
- `FormService.js`, `FormRepository.js`: خواندن پاسخ‌ها و definition snapshot؛ فقط در صورت نیاز برای reuse data flow.
- `GoogleSheetsRepository.js`: لایه عمومی عملیات شیت.
- `tests/print-template-service.test.js` و `tests/print-template-api-contract.test.js` (جدید): تست‌های ساختار/قرارداد و tenant scope.
- فایل‌های front-end در ریپوی مقابل هستند و در TODO فرانت‌اند با جزئیات ثبت شده‌اند.

### قرارداد پاسخ و امنیت
- پاسخ API از `Response.success` استفاده کند.
- خطای عدم وجود/عدم دسترسی نباید وجود قالب در tenant دیگر را افشا کند؛ پاسخ NOT_FOUND مناسب است.
- فقط قالب‌های ACTIVE فهرست شوند.
- هیچ تغییر در داده‌های شیت‌های فرم و رویداد موجود انجام نشود؛ setup فقط شیت جدید را اضافه کند.
- شیت و APIهای جدید باید با multi-tenant و سازوکار موجود سازگار باشند.

## 📋 Macro-Task Queue & Implementation Log

- [x] تسک ۱ — کشف ساختار ذخیره‌سازی فرم‌ها، رویدادها، دیتابیس و الگوی API.
  - *Log:* `DatabaseSetup.js`, `Router.js`, `FormService.js`, `FormRepository.js`, `GoogleSheetsRepository.js` و معماری/تست‌های موجود بررسی شدند. پاسخ فرم رویداد با `FormID`, `Values`, `Definition` در `35_EventFormData` نگهداری می‌شود؛ شیت‌ها با `setupDatabase()` و `createAllSheets_()` افزایشی ایجاد می‌شوند. مسیرهای موجود `GET /projects/:id/details` و `GET /events/:eventId/forms` داده‌های پروژه و snapshot فرم را می‌دهند. شاخه کاری جدید در هر دو مخزن ساخته شد.
- [ ] تسک ۲ — ایجاد شیت، repository، service و APIهای tenant-scoped برای ذخیره/فهرست/دریافت/ویرایش قالب‌های چاپی نام‌دار.
- [ ] تسک ۳ — آزمون قرارداد API، امنیت tenant، اعتبارسنجی payload، سازگاری setup افزایشی و اتصال به فرانت‌اند.
