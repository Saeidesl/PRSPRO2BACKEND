# ARCHITECTURE2 — نقشه معماری چرخه طرح تا تولید PMS

> تاریخ بررسی: 2026-10-29  
> شاخه بررسی‌شده: `main`  
> مخزن بک‌اند: `Saeidesl/PRSPRO2BACKEND`  
> مخزن فرانت‌اند: `Saeidesl/PRSPRO2`  
> این سند نقشه پایه برای فاز «پرونده طرح، پیش‌تولید و تبدیل به تولید» است. موارد زیر از سورس و اسناد موجود استخراج شده‌اند؛ بررسی ایستا به معنی اجرای موفق روی Apps Script یا دیتابیس زنده نیست.

## 1. تصمیم معماری هدف

- به‌جای ساخت یک پروژه مستقل فقط در زمان تأیید، یک پرونده واحد از مرحله انتخاب طرح ایجاد می‌شود.
- پرونده از ابتدا یک شناسه داخلی ثابت و یکتا دارد. کد پروژه تولیدی بعد از تأیید و تکمیل اطلاعات لازم به آن پرونده مرتبط می‌شود.
- رویدادها، فرم‌ها، درخواست ملزومات، تصاویر، شناسنامه‌ها و تاریخچه باید به شناسه پایدار پرونده/اجرای تولید متصل باشند؛ نباید با تبدیل وضعیت، ارتباط داده‌های قبلی از بین برود.
- «طرح/مدل» از «اجرای سفارش تولید» تفکیک شود تا سفارش تکراری، اطلاعات تاریخی را بازنویسی نکند و بتواند از مرحله مناسب شروع شود.
- تأیید و عدم تأیید دو مسیر مشخص‌اند: تأیید، فرم اطلاعات تولید را باز می‌کند و اطلاعات کد، تعداد، رنگ‌بندی و سایزبندی را ثبت می‌کند؛ عدم تأیید، دلیل را ثبت و پرونده را حفظ می‌کند.
- فرم‌ساز پویا و اتصال فرم به رویداد بخشی از نقشه کلی است، اما بعد از تثبیت مدل پرونده و جریان تأیید پیاده‌سازی می‌شود.
- این تصمیم‌ها طرح هدف‌اند؛ قبل از کدنویسی باید با قراردادهای واقعی API، داده‌های موجود و وابستگی‌های فرم فعلی تطبیق داده شوند.

## 2. معماری فعلی — بک‌اند

### پشته و مسیر داده
- Google Apps Script V8 و Google Sheets.
- `Router.js` مسیرهای API را dispatch و کنترل‌های دسترسی را اعمال می‌کند.
- سرویس‌ها منطق کسب‌وکار را اجرا می‌کنند و Repositoryها از طریق `GoogleSheetsRepository.js` با شیت‌ها کار می‌کنند.
- پاسخ‌ها و خطاها از ابزارهای مشترک مانند `Response.js`, `ErrorHandler.js`, `Constants.js`, `Validator.js` و `RequestParser.js` عبور می‌کنند.
- مرزبندی tenant و مجوز پروژه باید در سمت سرور اعمال شود؛ کنترل‌های UI به‌تنهایی کافی نیستند.

### پروژه‌ها
- `ProjectService.js`: منطق پروژه، lookupهای فرم، دسترسی پروژه، داشبورد و داده‌های مرتبط. تابع `projectFormLookups(params)` فهرست واحدها، کاربران، گردش‌کارها و وضعیت‌های فعال پروژه را برای فرم فعلی آماده می‌کند.
- `ProjectRepository.js`: شیت `08_Projects`; توابع `getAll`, `findById`, `findByProjectCode`, `existsByProjectCode`, `insert`, `update`, `delete`.
- `ProjectValidator.js`: اعتبارسنجی پروژه؛ قرارداد دقیق باید هنگام اجرای فاز از سورس کامل دوباره بررسی شود.
- شیت فعلی پروژه‌ها در `DatabaseSetup.js` دارای ستون‌های `ID, TenantID, ProjectCode, Title, Description, WorkflowID, WorkflowVersion, CurrentStepID, Status, CreatedBy, CreatedAt, UpdatedAt, Quantity, ColorSizeJSON, AvailableDepartmentIDs, AllowedUserIDs, NotifyEnabled, CurrentStepStatus` است.
- نتیجه: مدل فعلی پروژه از قبل `ID` داخلی، `ProjectCode`, `Quantity` و `ColorSizeJSON` دارد؛ امکان استفاده مجدد محتمل است، اما اجازه خالی بودن کد و تبدیل وضعیت باید با اعتبارسنجی، یکتایی کد و تمام مصرف‌کنندگان پروژه بررسی شود.

### رویدادها و داده‌های پویا
- `EventService.js`: ثبت/فهرست رویداد، کنترل دسترسی پروژه و تغییر وضعیت/مرحله پروژه بر اساس تنظیمات نوع رویداد؛ رویداد می‌تواند با `TargetProjectStatus`, `TargetStepStatus`, `TargetDepartmentID` و `MovesProjectToStep` جریان پروژه را تغییر دهد.
- `EventTypeService.js`, `EventTypeRepository.js`, `EventFieldService.js`, `EventFieldRepository.js`: تعریف نوع رویداد و فیلدهای پویای وابسته.
- `EventDataService.js`, `EventDataRepository.js`: داده‌های تکمیلی رویداد؛ شیت `14_EventData` دارای `ID, EventID, DataJSON, CreatedAt` است.
- `EventRepository.js`: شیت `13_Events`; رویدادها به `ProjectID` و `EventTypeID` مرتبط‌اند و دارای `VariantDetailsJSON` و کلیدهای idempotency هستند.
- `AttachmentService.js`, `AttachmentRepository.js`, `AttachmentValidator.js`: پیوست‌ها در شیت `15_Attachments` با `EntityType`, `EntityID` و `AttachmentType` نگهداری می‌شوند؛ انواع مستندشده شامل `PROFILE`, `SEWING_PASSPORT`, `CUTTING_PASSPORT` هستند.
- اتصال فرم پویای اختصاصی به رویداد هنوز باید از نظر قرارداد نمایش فرم، اعتبارسنجی و ذخیره داده در تسک‌های مربوطه دقیق شود.

### ملزومات و محاسبات
- `MaterialPlanningService.js`: `listSpecifications`, `createSpecification`, `reviseSpecification`, `listCalculationHistory`, `recordCalculation`, `recalculateProjectNeeds`, `markEventVoided`.
- `ProcurementService.js`: میزکار و گزارش‌ها، نیازها، سفارش‌ها، دریافت‌ها و عملیات idempotent با قفل.
- `ProcurementRepository.js`: خواندن شیت‌های نیاز/سفارش/اقلام/تخصیص/دریافت.
- `ProcurementEventIntegrationService.js`: اتصال تنظیمات نوع رویداد به عملیات تأمین از طریق `FieldMapJSON`.
- شیت‌های مرتبط: `18_MaterialNeeds`, `19_PurchaseOrders`, `20_PurchaseOrderItems`, `21_PurchaseAllocations`, `22_MaterialReceipts`, `23_EventTypeProcurementSettings`, `24_ProjectMaterialSpecs`, `25_MaterialNeedCalculations`.
- مدل محاسبه فعلی از `ProjectID`, نسخه مشخصات، مقدار مبنا، مصرف استاندارد، ضایعات و سابقه محاسبه استفاده می‌کند. لازم است سناریوی پیش‌تولید و سفارش تکراری بدون ایجاد نیازهای تولیدی زودهنگام یا تکراری به این مدل متصل شود.

### گزارش و امنیت
- `ReportService.js`, `ReportRepository.js`: گزارش پروژه و داده‌های رویداد/تأمین.
- `AccessControlService.js`, `PermissionService.js`, `RolePermissionService.js`, `AuditService.js`, `AuditRepository.js`: احراز هویت، مجوزها و سابقه تغییرات.
- `GoogleSheetsRepository.js`: `getAll`, `findById`, `findRowByValue`, `insert`, `insertMany`, `updateById`, `deleteById`, کش سطح درخواست و ثبت زمان عملیات. هر تغییر باید سیاست cache invalidation و کنترل رقابت را رعایت کند.
- `DatabaseSetup.js`: تعریف شیت‌ها و سرستون‌ها. تغییر schema باید افزایشی، idempotent و بدون حذف داده موجود باشد.

## 3. معماری فعلی — فرانت‌اند

### ساختار
- HTML/CSS/JavaScript ساده؛ صفحات در `pages/`, ماژول‌ها در `js/modules/`, زیرساخت مشترک در `js/core/`.
- `js/core/api.js`: `request`, `get`, `post`, `put`, `delete`, `getCached`, `getFresh`, `extractData`, `invalidate`, `invalidateMany`.
- `js/core/router.js`: `loadPage()`, `initPageModule()`, `navigate()`, `hasRouteAccess()`, `getUser()`, `isAdmin()`.
- `js/components/layout.js`: منو و کنترل نمایش بر اساس مجوز.
- فایل‌های اصلی فرانت‌اند شامل `index.html`, `pages/projects.html`, `pages/project-detail.html`, `pages/dashboard.html`, `js/modules/projects.js`, `js/modules/project-detail.js`, `js/modules/events.js`, `js/modules/event-types.js`, `js/modules/material-planning.js`, `js/modules/project-images.js`, `css/project-form.css` و `css/unified-theme.css` هستند.

### فرم فعلی پروژه و عملیات مرتبط
- `pages/projects.html`: صفحه فهرست پروژه و کنترل ایجاد پروژه.
- `js/modules/projects.js`: `Projects.init()`, `Projects.render()`, `Projects.openCreateForm(project, options)`, `Projects.openProjectEditForm(projectId, options)`, `Projects.applyFilters()`; فرم‌ها و مودال‌های ایجاد/ویرایش در زمان اجرا ساخته می‌شوند.
- شناسه‌های شناخته‌شده شامل `#project-create-modal`, `#project-edit-modal`, `#project-color-size-modal`, `#project-draft-material-specs-modal`, `#project-create-form` هستند.
- `css/project-form.css`: استایل فرم‌های پروژه.
- `js/modules/project-detail.js`: نمایش جزئیات و تصاویر شناسنامه برش/دوخت.
- قراردادهای موجود مثل منوی عملیات پروژه، رنگ‌بندی/سایزبندی، مشخصات ملزومات، تصویر پروفایل، شناسنامه‌ها، تنظیمات پروژه و cache-busting باید حفظ شوند.
- مستندات فعلی فرانت‌اند در `ARCHITECTURE.md` و `TODO1.md` موجود است؛ فاز استانداردسازی ظاهری پروژه‌ها در `TODO1.md` جداگانه در جریان است و نباید بازنویسی شود.

## 4. داده‌های کلیدی موجود و ارتباط هدف
- شناسۀ داخلی موجود پروژه `08_Projects.ID` است؛ کد قابل نمایش `ProjectCode` است. باید مشخص شود آیا این شناسه می‌تواند از مرحله پیش‌تولید ثابت بماند یا نیاز به entity مستقل برای طرح دارد.
- `ColorSizeJSON` داده رنگ/سایز پروژه را نگه می‌دارد؛ پیش از افزودن جدول/ساختار جدید باید شکل JSON، اعتبارسنجی و مصرف‌کنندگان آن بررسی شوند.
- رویدادها و EventData با شناسه‌های پروژه/رویداد مرتبط‌اند؛ انتقال به شناسه جدید نباید باعث شکستن گزارش‌ها، timeline، attachments یا نیازهای ملزومات شود.
- سفارش تکراری باید اجرای تولید جدید را از طرح/مدل تأییدشده جدا کند؛ داده‌های اجرای قبلی، رویدادها، مقادیر واقعی و محاسبات نباید بازنویسی شوند.
- کد پروژه باید یکتا و فقط یک بار تخصیص داده شود؛ مسیر تأیید باید در برابر ثبت تکراری، خطای نیمه‌کاره و درخواست هم‌زمان ایمن باشد.

## 5. نقشه اجرای این فاز
1. بررسی قرارداد کامل سرویس‌ها، اعتبارسنجی‌ها، endpointها و مصرف‌کنندگان فعلی پروژه/رویداد/رنگ‌وسایز/ملزومات.
2. تثبیت مدل داده طرح، اجرای تولید، شناسه داخلی و کد پروژه؛ تصمیم‌گیری با سازگاری داده‌های قبلی.
3. پیاده‌سازی پرونده اولیه طرح و گردش پیش‌تولید در UI و API.
4. پیاده‌سازی رویداد تأیید/عدم تأیید و فرم اطلاعات تولید، تخصیص امن کد و اتصال رنگ/سایز.
5. اتصال اطلاعات ساختاریافته به برش، ملزومات، محاسبات و گزارش‌ها.
6. پیاده‌سازی قابلیت فرم پویا و اتصال فرم به رویداد، پس از تثبیت مدل داده.
7. پشتیبانی از سفارش تکراری، آزمون رگرسیون و بهینه‌سازی.

## 6. محدودیت‌ها و معیارهای ایمنی
- هیچ داده واقعی حذف یا بازنویسی نشود؛ migrationها افزایشی و قابل تکرار باشند.
- هیچ کد پروژه قبل از تأیید صادر نشود؛ تأیید دوباره نباید کد دوم ایجاد کند.
- طرح ردشده و سابقه تصمیم/تغییرات حفظ شود.
- دسترسی tenant، نقش و پروژه در سمت سرور بررسی شود.
- مقدار برنامه‌ریزی‌شده از مقدار واقعی برش/دوخت/تولید جدا بماند.
- اطلاعات اجرای تولید قبلی هنگام تکرار سفارش تغییر نکند.
- هر تغییر API در هر دو مخزن هماهنگ شود؛ از لایه مرکزی `PMS.Api` در فرانت‌اند استفاده شود.
- هر گزارش تست باید روشن کند چه چیزی واقعاً اجرا شده و چه چیزی فقط به‌صورت ایستا بررسی شده است.
