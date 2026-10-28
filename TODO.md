# TODO — استانداردسازی توسعه‌پذیر تأمین ملزومات

> منبع واحد پیگیری کار برای استانداردسازی تأمین ملزومات در PMS. این فایل بازنویسی شده تا نقشه فنی، قراردادهای فعلی و دامنه تأییدشده در تمام تسک‌ها در دسترس باشد.
> تاریخ بازبینی نقشه: 2026-10-27
> ریپوزیتوری مرجع این فایل: `Saeidesl/PRSPRO2BACKEND`
> فرانت‌اند: `Saeidesl/PRSPRO2`

## هدف و معیارهای اولویت

1. سازگاری با پروژه‌ها، رویدادهای تولید، گردش کار، نقش‌ها/مجوزها و گزارش‌های فعلی.
2. سهولت استفاده و گردش کار روشن برای نیاز، سفارش و دریافت.
3. سرعت بالا و کاهش رفت‌وبرگشت‌های Google Sheets/API.
4. صحت داده، ثبت سوابق، بازیابی از خطا، کنترل هم‌زمانی و جلوگیری از عملیات تکراری.
5. ردیابی کسری، سفارش معوق، دریافت جزئی/کامل و هشدارهای اقدام فوری.

## محدوده قطعی انتخاب‌شده

### لیست الف — بهبود وضع موجود (همه انتخاب شده‌اند)
- [x] A1: کاهش خواندن‌های غیرضروری و تکراری Google Sheets.
- [x] A2: بهینه‌سازی API و بارگذاری صفحه.
- [x] A3: کش و سیاست روشن invalidation برای داده‌های تأمین.
- [x] A4: ابزار سنجش عملکرد و آزمون؛ هدف اولیه کمتر از ۳ ثانیه برای عملیات اصلی، مشروط به اندازه‌گیری.
- [x] A5: سازگاری داده و بازیابی عملیات چندمرحله‌ای سفارش/دریافت در خطا.
- [x] A6: استانداردسازی فرمول‌های نیاز، سفارش، تحویل و کسری.
- [x] A7: هماهنگی محاسبه نیاز با رویدادهای تولید و اصلاح/ابطال آن‌ها.
- [x] A8: idempotency، قفل و کنترل رقابت درخواست‌ها.
- [x] A9: ثبت سفارش مستقیماً از نیازهای منتخب.
- [x] A10: ثبت سریع و گروهی دریافت‌ها.
- [x] A11: جست‌وجو، فیلتر و حفظ وضعیت نمایش.
- [x] A12: UX واکنش‌گرا، فرم‌های ساده و پیام‌های قابل فهم.
- [x] A13: استانداردسازی شناسه، واحد، وضعیت و اعتبارسنجی داده.
- [x] A14: اعتبارسنجی قرارداد API در سمت سرور.
- [x] A15: آزمون‌های خودکار و رگرسیون.
- [x] A16: مجوزهای سمت سرور، مرزبندی tenant/project و audit.

### لیست ب — قابلیت‌های جدید انتخاب‌شده
- [x] B1: ایجاد سفارش از نیازها (با A9 یکپارچه شود؛ قابلیت تکراری جداگانه ساخته نشود).
- [x] B2: میزکار یکپارچه تأمین برای نیازها، سفارش‌ها، دریافت‌ها و اقدامات بعدی.
- [x] B3: ورود گروهی اقلام و دریافت گروهی.
- [x] B4: صف اقدام فوری (کسری باز، نیاز سفارش‌نشده، سفارش معوق و دریافت ناقص).
- [x] B7: اعلان‌های هوشمند برای موارد نیازمند پیگیری؛ کانال و سیاست ارسال باید با زیرساخت موجود سازگار باشد.
- [x] B8: گزارش‌های مدیریتی تأمین با فیلتر و اتصال به گزارش‌ساز موجود.

### خارج از محدوده
- انبارداری کامل شامل کاردکس/گردش موجودی، انتقال بین انبارها، چندانباره، شمارش موجودی و ارزش‌گذاری انبار در این مرحله پیاده‌سازی نمی‌شود.
- تنها توسعه‌پذیری آینده در مدل و مرزبندی دامنه در نظر گرفته شود؛ انبار یا موجودی فیزیکی را بدون تصمیم جداگانه به مدل فعلی اضافه نکنید.
- نام تأمین‌کننده و «واحد دریافت‌کننده/دپارتمان انبار» در داده فعلی وجود دارد؛ این موضوع به معنی پیاده‌سازی دفتر جامع تأمین‌کنندگان یا انبارداری نیست.
- هیچ مهاجرت مخرب، حذف رکورد، تغییر دستی داده واقعی یا انتشار به محیط زنده بدون بررسی اثر و مجوز لازم انجام نشود.

---

# Technical Spec & Architecture Map

> نقشه زیر بر اساس بررسی ایستای سورس موجود در شاخه `main` هر دو ریپوزیتوری تهیه شده است. این بررسی به‌تنهایی اثبات اجرای موفق در Google Apps Script یا داده زنده نیست. در تسک‌های اجرایی قراردادهای این بخش باید دوباره با تست/شواهد تأیید شوند و یافته‌های جدید همین‌جا ثبت شوند.

## 1. معماری و جریان داده

- بک‌اند: JavaScript سازگار با Google Apps Script V8، مسیریابی در `Router.js` و ذخیره‌سازی در Google Sheets با `GoogleSheetsRepository.js`.
- فرانت‌اند: HTML/CSS/JavaScript؛ صفحات در `pages/` و ماژول‌ها در `js/modules/`؛ درخواست‌ها از `js/core/api.js` و مسیریابی صفحه از `js/core/router.js`.
- جریان سفارش: `pages/procurement.html` → `js/modules/procurement.js` → `PMS.Api` → `Router.get/post` → `ProcurementService` → `ProcurementRepository` / `GoogleSheetsRepository` → شیت‌های نیاز/سفارش/ردیف/تخصیص/دریافت.
- جریان مشخصات و محاسبات: `js/modules/material-planning.js` → APIهای مشخصات/محاسبات پروژه → `MaterialPlanningService` → شیت‌های 24 و 25 و تولید/به‌روزرسانی نیازهای شیت 18.
- جریان رویداد: `js/modules/events.js` و `js/modules/event-types.js` → `EventService` و `ProcurementEventIntegrationService`; نگاشت قابل تنظیم از کد فیلدهای پویا به عملیات تأمین در شیت 23. رویدادها می‌توانند نیاز قطعی را محاسبه کنند یا دریافت را ثبت کنند. خطا و retry باید قابل ردیابی بماند.
- گزارش‌ها: `js/modules/reports.js` → `ReportService`; گزارش پروژه داده رویداد و داده تأمین را به هم وصل می‌کند. گزارش تأمین اختصاصی از `ProcurementService.reports` تغذیه می‌شود.
- مرز امنیت: تمام داده‌ها باید بر اساس `TenantID` و در موارد پروژه بر اساس دسترسی پروژه فیلتر شوند. مخفی‌کردن کنترل در فرانت‌اند جایگزین مجوز سمت سرور نیست.

## 2. فایل‌های اصلی بک‌اند

### مسیرها و کنترل دسترسی
- `Router.js`: dispatch متدهای GET/POST/PUT/DELETE؛ endpointها، permission gate و تبدیل درخواست به سرویس‌ها.
- `AccessControlService.js`: دریافت کاربر جاری، بررسی مجوزها و tenant؛ مجوزهای تأمین باید در Router و منطق سرویس هماهنگ بمانند.
- `PermissionService.js`, `RolePermissionService.js`, `RolePermissionRepository.js`, `PermissionRepository.js`: زیرساخت مجوز و اتصال نقش/مجوز؛ برای آزمون دسترسی استفاده شوند.
- `ErrorHandler.js`, `Response.js`, `Constants.js`, `Validator.js`, `RequestParser.js`: قرارداد خطا/پاسخ، ثابت‌ها و اعتبارسنجی عمومی؛ پاسخ‌های API فعلی غالباً در wrapper شامل `success/data` هستند و فرانت‌اند بعضی پاسخ‌ها را unwrap می‌کند.
- `AppConfig.gs.js`: تنظیمات؛ اطلاعات محرمانه/شناسه پایگاه داده نباید در گزارش یا مستندات ثبت شود.

### سرویس‌ها و repositoryهای تأمین
- `ProcurementService.js` — توابع کلیدی:
  - `_user_`, `_active_`, `_id_`, `_itemCode_`, `_needKey_`, `_now_`, `_number_`
  - `_isProjectVisible_`, `_validateProject_`, `_validateEvent_`
  - `createOrder`, `_createOrderUnlocked_`: ثبت سفارش، قفل اسکریپت، بررسی IdempotencyKey، ردیف‌های سفارش و تخصیص نیازها؛ اگر نوشتن چندشیتی نیمه‌کاره بماند، باید حالت قابل بازبینی و مسیر بازیابی داشته باشد چون Google Sheets تراکنش چندشیتی واقعی ندارد.
  - `createReceipt`, `createReceiptsBatch`, `_createReceiptUnlocked_`: دریافت تکی/گروهی، کنترل مقدار، تخصیص سفارش و IdempotencyKey.
  - `listNeeds`, `listOrders`, `workspace`, `reports`, `dashboard`: خروجی‌های خواندنی برای نیازها، سفارش‌ها، میزکار، گزارش و KPI.
- `ProcurementRepository.js`: repository خواندنی؛ `getTenantRows`, `getNeeds`, `getOrders`, `getItems`, `getAllocations`, `getReceipts`. فعلاً با `GoogleSheetsRepository.getAll` ردیف‌ها را می‌خواند و در لایه خود بر اساس tenant فیلتر می‌کند؛ یکی از اهداف A1/A4 سنجش و بهینه‌سازی این مسیر است.
- `MaterialPlanningService.js` — توابع کلیدی:
  - `_user_`, `_ensureSchema_`, `_id_`, `_now_`, `_number_`, `_project_`, `_specsForProject_`
  - `listSpecifications`, `createSpecification`, `reviseSpecification`
  - `listCalculationHistory`, `recordCalculation`, `recalculateProjectNeeds`, `_recalculateProjectNeedsUnlocked_`, `markEventVoided`
  - مشخصات مصرف نسخه‌دار است؛ سابقه محاسبات نگهداری می‌شود؛ محاسبات تکراری باید idempotent باشند و ابطال رویداد باید نیازهای مربوطه را برای بازبینی علامت بزند، نه اینکه سابقه حذف شود.
- `ProcurementEventIntegrationService.js` — `_map_`, `_find_`, `get`, `save`, `validate`, `apply`: تنظیمات اتصال نوع رویداد به تأمین، اعتبارسنجی کد فیلدهای پویا، عملیات `NONE`، `RECORD_RECEIPT` و `RECALCULATE_CONFIRMED_NEEDS`.
- `GoogleSheetsRepository.js` — `getSpreadsheet`, `getSheet`, `ensureColumn`, `getHeaders`, `getAll`, `findRowByValue`, `findById`, `findOne`, `exists`, `insert`, `insertMany`, `updateById`, `deleteById`, `resetRequestCache` و توابع داخلی cache/timing. کش سطح درخواست برای رکورد/لیست/find/column-index و log زمان عملیات شیت وجود دارد؛ invalidation بعد از نوشتن و اندازه واقعی خواندن‌ها باید آزموده شود.
- `DatabaseSetup.js`: تعاریف شیت‌ها و headerها، ایجاد/تکمیل headerها، validation و seed مجوزها. هیچ reset یا setup مخرب روی داده واقعی اجرا نشود.
- `EventService.js`: ایجاد/اصلاح/ابطال رویداد و retry اتصال تأمین؛ در ابطال رویداد تلاش برای بازبینی نیازهای ملزومات و audit خطا انجام می‌شود.
- `EventDataService.js`, `EventDataRepository.js`, `EventTypeService.js`, `EventTypeRepository.js`, `EventFieldService.js`, `EventFieldRepository.js`: داده پویا و تعریف نوع رویداد/فیلدهایی که تنظیمات تأمین به آن‌ها وابسته است.
- `ProjectService.js`, `ProjectRepository.js`, `ProjectValidator.js`: اطلاعات پروژه، دسترسی به پروژه و مقدار/وضعیت پروژه.
- `ReportService.js`, `ReportRepository.js`: گزارش پروژه و dashboard؛ `listReportProjects`, `projectReport`, `dashboard`, `getRecentEvents_`, `getRecentProjects_`. گزارش پروژه داده پروژه، رویدادها، نیازها، سفارش‌ها و محاسبات را کنار هم می‌آورد.
- `AuditService.js`, `AuditRepository.js`, `AuditValidator.js`: ثبت تغییرات مهم، خطاهای یکپارچه‌سازی و عملیات مدیریتی.
- `PerformanceDiagnostics.js`: تجمیع اندازه‌گیری‌های request-scoped برای endpointهای خواندنی تأمین؛ `beginRequest`, `record`, `recordEndpointError`, `finishRequest`. `GoogleSheetsRepository._logTiming` عملیات repository را به آن می‌فرستد. خروجی کنسول فقط وقتی تنظیم performance logging فعال باشد چاپ می‌شود. فعال‌سازی و مشاهده لاگ در محیط Apps Script هنوز تأیید نشده است.

## 3. ساختار داده Google Sheets — headerهای مشاهده‌شده

تعاریف زیر از `DatabaseSetup.js` در شاخه main خوانده شده‌اند. پیش از هر تغییر schema باید شیت واقعی و headerهای آن با احتیاط تطبیق داده شوند.

- `18_MaterialNeeds`: `ID, TenantID, ProjectID, SourceEventID, ItemName, ItemCode, Unit, RequestedQuantity, NeededBy, Status, Notes, CreatedBy, CreatedAt, UpdatedAt, MaterialSpecID, MaterialSpecKey, SpecificationRevision, CalculationID, BasisQuantity, NeedType, CalculationKey`.
- `19_PurchaseOrders`: `ID, TenantID, OrderNumber, SupplierName, OrderDate, ExpectedDeliveryDate, Status, Notes, CreatedBy, CreatedAt, UpdatedAt, IdempotencyKey`.
- `20_PurchaseOrderItems`: `ID, TenantID, PurchaseOrderID, MaterialNeedID, ItemName, ItemCode, Unit, OrderedQuantity, UnitPrice, Notes, CreatedAt, UpdatedAt, SurplusQuantity, SurplusCost`.
- `21_PurchaseAllocations`: `ID, TenantID, PurchaseOrderItemID, ProjectID, MaterialNeedID, AllocatedQuantity, CreatedAt`.
- `22_MaterialReceipts`: `ID, TenantID, PurchaseOrderItemID, ProjectID, QuantityReceived, ReceivedAt, WarehouseDepartmentID, SourceEventID, Notes, ReceivedBy, CreatedAt, IdempotencyKey`.
- `23_EventTypeProcurementSettings`: `ID, TenantID, EventTypeID, Action, FieldMapJSON, Status, CreatedBy, CreatedAt, UpdatedAt`.
- `24_ProjectMaterialSpecs`: `ID, TenantID, ProjectID, SpecKey, ItemName, ItemCode, Unit, ConsumptionPerUnit, WastagePercent, EarlyOrderPolicy, EarlyOrderQuantity, Status, Revision, Notes, CreatedBy, CreatedAt, UpdatedAt`.
- `25_MaterialNeedCalculations`: `ID, TenantID, ProjectID, MaterialSpecID, MaterialNeedID, SourceEventID, SourceEventVersion, CalculationKey, BasisQuantity, ConsumptionPerUnit, WastagePercent, CalculatedQuantity, PreviousCalculatedQuantity, VarianceQuantity, CalculationType, Status, CreatedBy, CreatedAt`.
- نکته بررسی: نام شیت `18_ProjectStatuses` نیز در تعریف موجود است؛ پیشوند شماره تکراری با `18_MaterialNeeds` به‌خودی‌خود مشکل عملکردی را ثابت نمی‌کند، اما باید در بررسی schema و ابزارهایی که بر شماره شیت تکیه می‌کنند مدنظر باشد.
- شناسه‌ها در داده‌های فعلی عمدتاً `ID` هستند؛ `TenantID` مرز چندمستاجری است؛ ارتباطات کلیدی از طریق `ProjectID`, `MaterialNeedID`, `PurchaseOrderID`, `PurchaseOrderItemID`, `SourceEventID`, `EventTypeID` و `MaterialSpecID` برقرار می‌شوند.
- مقادیر وضعیت و enumهای واقعی باید از منطق سرویس/داده موجود استخراج شوند؛ وضعیت جدید بدون مهاجرت، label قابل‌فهم، اعتبارسنجی و سازگاری با گزارش‌ها اضافه نشود.

## 4. قرارداد APIهای موجود و مرتبط

> این فهرست مسیرهای مشاهده‌شده در Router و فرانت‌اند است؛ قبل از تغییر هر payload باید شکل دقیق ورودی/خروجی از همان تابع سرویس و تست‌ها بررسی شود.

### تأمین
- `GET /procurement/workspace` → `ProcurementService.workspace(params)`; داده ترکیبی میزکار.
- `GET /procurement/dashboard` → `ProcurementService.dashboard(params)`; KPIهای تأمین.
- `GET /procurement/needs` → `ProcurementService.listNeeds(params)`.
- `GET /procurement/orders` → `ProcurementService.listOrders(params)`.
- `GET /procurement/reports` → `ProcurementService.reports(params)`.
- `POST /procurement/orders` → `ProcurementService.createOrder(body, params)`; فرانت‌اند payload شامل اقلام و `IdempotencyKey` می‌سازد.
- `POST /procurement/receipts` → `ProcurementService.createReceipt(body, params)`.
- `POST /procurement/receipts/batch` → `ProcurementService.createReceiptsBatch(body, params)`; UI با `{ Receipts: [...] }` ارسال می‌کند.
- `POST /events/:id/procurement-retry` → `EventService.retryProcurementIntegration(eventId, params)`.
- مجوزها: برای خواندن workspace/dashboard/needs/orders معمولاً `PROCUREMENT_VIEW` یا `PROCUREMENT_MANAGE`; گزارش `REPORT_VIEW` یا مجوز مشاهده/مدیریت تأمین؛ ایجاد سفارش/دریافت `PROCUREMENT_MANAGE`؛ retry در Router با `EVENT_EDIT` و در سرویس نیز بررسی نقش/مالکیت انجام می‌شود.

### مشخصات مصرف و تاریخچه محاسبه
- `GET /projects/:projectId/material-specifications` → `MaterialPlanningService.listSpecifications`.
- `POST /projects/:projectId/material-specifications` → `MaterialPlanningService.createSpecification`.
- `PUT /material-specifications/:id` → `MaterialPlanningService.reviseSpecification`.
- `GET /projects/:projectId/material-calculations` → `MaterialPlanningService.listCalculationHistory`.
- مجوزهای مشاهده/ثبت مشخصات از مسیرهای پروژه و `PROJECT_EDIT` کنترل می‌شوند؛ مالکیت/tenant پروژه باید در سرویس حفظ شود.

### اتصال رویداد به تأمین و رویدادهای مرتبط
- `GET /event-types/:eventTypeId/procurement` → `ProcurementEventIntegrationService.get`.
- `POST /event-types/:eventTypeId/procurement` → `ProcurementEventIntegrationService.save`.
- `GET /event-types/:eventTypeId/fields` و مسیرهای موجود `/event-fields/:id` برای خواندن/مدیریت فیلدهای پویا.
- `POST /events` → `EventService.create`; در مسیر ایجاد، اعتبارسنجی و اجرای اتصال تأمین باید با ترتیب ذخیره رویداد هماهنگ باشد.
- `GET /events/:id`, `GET /events/:id/data`, `POST /events/:id/data`, `PUT /events/:id/void`, `POST /events/:id/procurement-retry`.
- مجوزهای مهم: `EVENT_CREATE`, `EVENT_EDIT`, `EVENT_TYPE_MANAGE`; اعتبارسنجی field-map باید از کد فیلد فعال همان نوع رویداد و همان tenant استفاده کند.

### گزارش
- `GET /reports/projects` → `ReportService.listReportProjects`.
- `GET /reports/project/:projectId` → `ReportService.projectReport`; اطلاعات پروژه/رویداد/تأمین را تجمیع می‌کند.
- `GET /procurement/reports` → گزارش‌های نیاز/سفارش/محاسبات تأمین.
- `GET /dashboard` → `ReportService.dashboard`.
- مجوز گزارش پروژه: `REPORT_VIEW`.

## 5. فایل‌های اصلی فرانت‌اند

- `pages/procurement.html`: صفحه میزکار فعلی با تب‌های خلاصه، نیازها و سفارش‌ها/دریافت‌ها؛ KPI؛ فیلترهای جست‌وجو و وضعیت؛ دکمه سفارش پروژه‌ای، سفارش عمومی، ثبت دریافت و refresh؛ ریشه modal و بارگذاری `js/modules/procurement.js`.
- `js/modules/procurement.js`: ماژول اصلی UI؛ load از workspace/dashboard/needs/orders؛ render نیازها و سفارش‌ها، جست‌وجو/فیلتر، برچسب وضعیت، تاریخ شمسی/مدت انتظار، فرم سفارش، افزودن از نیازهای پروژه، پیش‌نمایش مازاد، فرم دریافت تکی/گروهی، ارسال batch، idempotency key و کنترل مجوز UI.
- `js/modules/material-planning.js`: فرم مشخصات مصرف پروژه، ویرایش نسخه جدید، تاریخچه محاسبات و refresh داده‌های پروژه.
- `js/modules/event-types.js`: تعریف نوع رویداد و فیلدهای پویا؛ modal نگاشت تنظیمات تأمین و invalidation cache مرتبط.
- `js/modules/events.js`: ثبت/نمایش/ابطال رویداد و اجرای مجدد اتصال تأمین پس از خطا.
- `js/modules/reports.js` و `pages/reports.html`: گزارش پروژه؛ فیلتر رویداد/تاریخ و نمایش داده‌های تجمیعی.
- `js/core/api.js`: wrapper درخواست‌های شبکه، خطا/نشست، sync status و diagnostics زمان درخواست؛ نقطه مرکزی برای اندازه‌گیری و کنترل رفت‌وبرگشت‌ها.
- `js/core/cache.js`: کش سمت فرانت‌اند؛ هر تغییر API باید سیاست cache invalidation آن را بررسی کند.
- `js/core/router.js`, `js/core/permissions.js`, `js/core/sidebar-access.js`: مسیریابی صفحه و نمایش دسترسی؛ امنیت واقعی همچنان سمت بک‌اند است.
- `js/components/form.js`, `js/components/modal.js`, `js/components/table.js`, `js/components/loading.js`, `js/components/alert.js`, `js/components/jalali-calendar.js`, `js/components/layout.js`: اجزای عمومی که برای سازگاری UX، اعتبارسنجی، پیام‌ها و تاریخ شمسی باید بازاستفاده شوند.
- فایل‌های استایل مشترک در ریشه/دایرکتوری CSS و کلاس‌های موجود `procurement-*` باید پیش از افزودن استایل موازی بررسی شوند؛ CSS تکراری یا override سراسری نامرتبط ایجاد نشود.

## 6. آزمون‌ها و ابزارهای موجود

### بک‌اند
- `tests/procurement-service.test.js`: کلید تخصیص نیاز، سقف تخصیص/مازاد، تجمیع workspace، تعداد lookup و context مشترک.
- `tests/material-planning.test.js`: مشخصات نسخه‌دار، اعتبارسنجی مصرف، تاریخچه محاسبات، idempotency، تغییر مقدار، ابطال رویداد، قفل، tenant و نسخه جدید مشخصات.
- `tests/procurement-event-integration.test.js`: اعتبارسنجی field mapping و اتصال مقدار قطعی رویداد به محاسبه نیاز.
- استاندارد اجرای تست‌های بک‌اند طبق `AGENTS.md`: `node --test tests/*.test.js`، بررسی syntax و schema و قراردادهای deployment در صورت ارتباط.

### فرانت‌اند
- `tests/procurement-form-loading.test.js`: تست بارگذاری فرم سفارش.
- `tests/procurement-receipt-form-loading.test.js`: تست بارگذاری فرم دریافت.
- `scripts/pms-staging-production-procurement-e2e.cjs`: ابزار سناریوی سرتاسری staging؛ پیش از اجرا محیط، حساب‌ها و اثر احتمالی آن بررسی شود.
- `scripts/pms-ui-performance-audit.cjs`, `test-results/latest-performance-report.md`, `test-results/latest-performance-report.json`: ابزار/نمونه گزارش عملکرد UI؛ تاریخ و محیط گزارش قبل از استفاده به‌عنوان baseline بررسی شود.
- `.github/workflows/pms-agent-suite.yml`, `.github/workflows/backend-check.yml` و QA مشترک فرانت‌اند: برای CI و کنترل قراردادها استفاده شوند.
- تست‌های موجود قبلاً فقط از روی سورس خوانده شده‌اند؛ در این مرحله اجرای مجدد تست‌ها ادعا نمی‌شود.
## 7. ریسک‌ها و قواعد اجرا

- Google Sheets تراکنش چندشیتی واقعی ندارد؛ عملیات سفارش و دریافت باید یا با نوشتن دسته‌ای/قفل/کلید تکرار ایمن شود یا وضعیت نیمه‌کاره و مسیر reconciliation داشته باشد.
- `getAll` کل ردیف‌های یک شیت را می‌خواند؛ هر بهینه‌سازی باید tenant isolation، cache invalidation و صحت خروجی را حفظ کند.
- محاسبه نیاز باید بین نیاز تخمینی/قطعی، نسخه مشخصات، رویداد منبع و مقدار واقعی پروژه تمایز بگذارد؛ سوابق قبلی پاک نشوند.
- مازاد سفارش نباید به‌طور خام به معنی نیاز پروژه دیگر تلقی شود؛ تخصیص به نیازها باید صریح و قابل حسابرسی باشد.
- ثبت دریافت واقعی باید به ردیف سفارش و در صورت لزوم پروژه/رویداد مرتبط شود؛ مقدار سفارش‌شده، دریافت‌شده و مانده جداگانه محاسبه شوند.
- اعلان‌ها نباید باعث ارسال تکراری یا نشت داده بین tenantها شوند؛ ابتدا تعیین شود آیا زیرساخت اعلان فعلی مناسب است یا باید از الگوی موجود استفاده شود.
- هدف کمتر از ۳ ثانیه یک هدف آزمون است، نه تضمین فعلی؛ باید حجم داده، تعداد ردیف‌ها، محیط، cold/warm request و صدک زمان تعریف شود.
- هر تغییری در بک‌اند که به `main` برسد ممکن است طبق `.github/workflows/sync-apps-script.yml` باعث sync/deploy به Apps Script شود. قبل از merge به main ریسک انتشار بررسی شود.
- طبق `AGENTS.md` تغییرات روی شاخه کاری و از طریق PR انجام شود؛ هرگز ادعای deploy/live test بدون مدرک نشود.

---

# Task Queue

## تسک 1 — بررسی و ساخت نقشه فنی
- [x] 1. بررسی ایستای هر دو ریپوزیتوری، فایل‌های سرویس/صفحه، قراردادهای API، headerهای شیت، مجوزها و آزمون‌های مرتبط؛ ثبت یافته‌ها در بخش Technical Spec & Architecture Map بالا.
- معیار تکمیل: نقشه فنی و دامنه انتخاب‌شده در این فایل ثبت شده باشد؛ هیچ کد برنامه‌ای تغییر نکند و نتیجه بررسی ایستا با آزمون زنده اشتباه گرفته نشود.
- وضعیت: تکمیل‌شده بر مبنای بررسی سورس؛ اجرای تست یا بررسی داده زنده بخشی از این تسک نبوده است.

## تسک 2 — تثبیت قراردادها و خط مبنای آزمون بک‌اند
- [x] 2.1 اجرای تست‌های فعلی مرتبط و ثبت نتیجه واقعی هر تست، بدون دست‌کاری داده زنده.
- [x] 2.2 افزودن/تکمیل آزمون‌های رگرسیون برای قرارداد API، tenant isolation، permission، idempotency، دریافت جزئی و حالت نوشتن نیمه‌کاره.
- [x] 2.3 استخراج و مستندسازی دقیق محاسبات فعلی نیاز، تخصیص، سفارش، دریافت، کسری و مازاد از توابع موجود؛ اختلاف‌ها را با آزمون بازتولیدپذیر ثبت کن.
- [x] 2.4 تعیین قراردادهای پایدار payload و پاسخ برای workspace، سفارش از نیاز و دریافت گروهی؛ تغییر API فقط با تست و هماهنگی فرانت‌اند.
- معیار پذیرش: baseline قابل تکرار، تست‌های سبز یا ایرادهای مشخص ثبت‌شده، و قراردادهای موجود مستند؛ هنوز بهینه‌سازی عملکرد یا تغییر UX وارد این تسک نشود.
- *Log:* در `tests/procurement-api-contract.test.js` آزمون‌های قراردادی ایستا برای نگاشت endpointهای تأمین/برنامه‌ریزی مواد به سرویس‌ها، مجوز مسیرهای نوشتنی، وجود سرویس‌ها/شیت‌های لازم و نشانه‌های محافظتی idempotency، دریافت جزئی و مازاد اضافه شد. در `docs/procurement-standardization-baseline.md` قرارداد endpointها و payloadهای فعلی، فرمول `CalculatedQuantity` با سقف‌گردکردن تا ۴ رقم اعشار، قواعد `CalculationKey` و `IdempotentReplay`، محاسبه مانده سفارش/تحویل، رفتار ابطال رویداد و محدودیت تراکنش چندشیتی Google Sheets مستند شد. CI در commit `d09dd26f19416b0792a7885c029c6b6204b55f4e` موفق شد: `node --test tests/*.test.js` با ۶۵ تست موفق، صفر شکست؛ بررسی syntax/manifest نیز سبز بود. این‌ها تست‌های CI و بررسی سورس‌اند؛ اتصال زنده به Google Sheets، آزمون مرورگر و deploy انجام نشد. فایل‌ها در PR #59 شاخه `test/procurement-standardization-task-2-main` ثبت شده‌اند: https://github.com/Saeidesl/PRSPRO2BACKEND/pull/59

## تسک 3 — تکمیل‌شده: زیرساخت داده و اعتبارسنجی سمت سرور
- [x] 3.1 تطبیق headerهای تعریف‌شده با خروجی پایگاه داده آزمایشی و بررسی ستون‌های قدیمی/اضافی بدون مهاجرت مخرب.
- *Log:* فایل خروجی `3 PRSPRO2-TEST-DB.xlsx` بررسی شد. در `20_PurchaseOrderItems` ستون `Status` در انتهای header وجود داشت (۱۵ ستون در برابر تعریف قدیمی ۱۴) و در `21_PurchaseAllocations` نیز `Status` وجود داشت (۸ ستون در برابر تعریف قدیمی ۷). هر دو ستون داده‌های `DELETED` واقعی/تاریخی داشتند؛ حذف یا پاک‌سازی رکوردها انجام نشد. `DatabaseSetup.js` در شاخه `feature/procurement-standardization-task-3-validation` با افزودن `Status` به انتهای دو تعریف header اصلاح شد؛ رفتار `ensureHeaders_` افزایشی است و ستون‌های اضافی را حذف یا جابه‌جا نمی‌کند. این بررسی بر مبنای snapshot خروجی پایگاه داده تست است؛ اتصال مستقیم به Google Sheets زنده و اجرای migration در این مرحله انجام نشده است.
- [x] 3.2 تعریف قراردادهای شناسه، کد قلم، واحد، وضعیت، تاریخ و مقادیر عددی؛ مستندسازی قواعد سازگاری legacy.
- *Log:* قراردادهای مشاهده‌شده در `docs/procurement-data-contracts.md` ثبت شد: ساختار شناسه‌ها و مرز tenant/project، کد MAT تولیدشده، واحدهای متنی بدون enum اجباری، وضعیت‌های مشاهده‌شده با تفکیک نوع رکورد، تاریخ ISO/تبدیل شمسی در UI، قواعد مقدار مثبت/قیمت و پذیرش ورودی عددی رشته‌ای. قواعد سازگاری legacy و ممنوعیت مهاجرت مخرب نیز مستند شد. این سند بر پایه سورس است؛ فهرست وضعیت‌ها جامع فرض نشده و شیت واقعی هنوز بررسی نشده است.
- [x] 3.3 تکمیل validatorهای API برای فیلدهای سفارش، ردیف سفارش، تخصیص و دریافت.
- [x] 3.4 تضمین مرزبندی tenant/project و مجوز در تمام مسیرهای خواندن و نوشتن.
- *Log:* در `ProcurementService.js` مسیرهای replay دریافت تکی و گروهی در `createReceipt` و `createReceiptsBatch` اصلاح شدند: پیش از بازگرداندن رسید موجود بر اساس `IdempotencyKey`، پروژه رسید با `_validateProject_` بررسی می‌شود تا idempotency کنترل دسترسی پروژه را دور نزند. در `tests/procurement-service.test.js` آزمون رگرسیون برای پروژه غیرقابل‌دسترسی در هر دو مسیر اضافه شد و بررسی tenant/project قبلی نیز حفظ شد. CI برای commit `6d6c2e9164bf6e4feb861cf5477fc2c5e6188edc` موفق بود: `Backend source checks` و `PMS agent suite` هر دو سبز شدند؛ کاربر نیز اصلاح را تأیید کرد. این تکمیل بر اساس بررسی سورس، آزمون‌های CI و تأیید کاربر است و ادعای ممیزی جامع همه مسیرها یا آزمون زنده Google Sheets نیست.
- [x] 3.5 طراحی migration افزایشی و امن برای هر تغییر لازم؛ حفظ داده و مسیر بازگشت.
- *Log:* فایل `docs/procurement-data-contracts.md` در شاخه `feature/procurement-standardization-task-3-validation` تکمیل شد. رفتار `DatabaseSetup.js` در `setupDatabase()`، `ensureHeaders_()` و `backfillPurchaseOrderSurplus_()` مستند شد؛ runbook شامل preflight فقط‌خواندنی، backup کامل، افزودن append-only ستون‌ها، backfill جداگانه با ثبت ردیف‌های تغییرکرده، postflight، توقف در header تکراری، و راهبرد rollback بدون حذف خودکار ستون‌هاست. تصریح شد که `resetDatabaseSheets()` برای migration ممنوع است و Google Sheets تراکنش اتمیک چندشیتی تضمین نمی‌کند. طرح فقط مستند شده؛ migration واقعی یا تغییر Google Sheets زنده اجرا نشده است. برای commit `98dbb983b368f3b90f1cd2b3339a693bd6e4c0a8`، هر دو workflow یعنی `Backend source checks` و `PMS agent suite` با نتیجه `success` ثبت شده‌اند.

## تسک 4 — تعلیق‌شده با بدهی عملکردی: بهینه‌سازی دسترسی به Google Sheets

### یافته‌های بررسی اولیه تسک 4.1 — هنوز تکمیل نشده
- در `GoogleSheetsRepository.js` تابع `_logTiming(operation, sheetName, startTime, extra)` زمان عملیات repository را محاسبه می‌کند؛ متدهای `getAll`, `findById`, `findOne`, `findRowByValue`, `insert`, `insertMany` و `updateById` از آن استفاده می‌کنند.
- `_logTiming` در صورت فعال بودن تنظیم `AppConfig.PERFORMANCE_LOG_TO_CONSOLE` یا `AppConfig.PERFORMANCE.LOG_TO_CONSOLE` لاگ کنسول تولید می‌کند و در صورت تعریف بودن `PerformanceDiagnostics.record` آن را فراخوانی می‌کند. برای شاخه کاری فعلی، فایل `PerformanceDiagnostics.js` افزوده شده تا مدت endpoint، تعداد عملیات repository، شمارش و زمان تجمیعی به تفکیک عملیات/شیت و cache hit/missهای ثبت‌شده را جمع کند.
- endpointهای خواندنی اصلی در `Router.js`: `/procurement/workspace`, `/procurement/dashboard`, `/procurement/needs`, `/procurement/orders`, `/procurement/reports`.
- `ProcurementRepository.getTenantRows` داده هر شیت را از طریق `GoogleSheetsRepository.getAll` می‌خواند و سپس بر اساس `TenantID` فیلتر می‌کند. `ProcurementService.workspace` از context مشترک برای سفارش‌ها/نیازها/dashboard استفاده می‌کند؛ `reports` نیز داده‌های پروژه، مشخصات مواد و محاسبات را می‌خواند.
- پیاده‌سازی اولیه در شاخه کاری انجام شد: `Router._runProcurementRead_` پنج endpoint بالا را اندازه‌گیری می‌کند؛ `PerformanceDiagnostics.js` مدت سرویس endpoint، تعداد و زمان تجمیعی عملیات repository به تفکیک نوع/شیت و خطای endpoint را جمع می‌کند؛ `GoogleSheetsRepository.getAll` و `findById` وضعیت cache hit را به `_logTiming` می‌دهند. این cache hit/miss فقط کش فهرست و رکورد را پوشش می‌دهد و به‌معنی شمارش همه cacheهای داخلی جست‌وجو یا تعداد دقیق RPCهای Google Sheets نیست.
- آزمون `tests/performance-diagnostics.test.js` اضافه شد تا تجمیع عملیات، زمان، شیت، cache و خطا را بررسی کند. بررسی syntax چهار فایل تغییرکرده و شبیه‌سازی دستی تابع diagnostics موفق بود؛ CI/`node --test` روی محیط repo و مشاهده لاگ واقعی Apps Script هنوز اجرا نشده است. بنابراین 4.1 عمداً تیک نخورده است.
- گام بعدی تکمیل 4.1: اجرای آزمون‌های CI و فعال‌سازی کنترل‌شده log در محیط تست Apps Script؛ بررسی خروجی واقعی و محدودیت‌های شمارش، سپس ثبت baseline. تا آن زمان هیچ عدد عملکرد زنده ادعا نمی‌شود.

- [ ] 4.1 اندازه‌گیری تعداد/زمان خواندن‌ها و جست‌وجوها در هر endpoint تأمین.
- [ ] 4.2 کاهش فراخوانی‌های تکراری `getAll/findById` و استفاده از context مشترک درخواست.
- [ ] 4.3 بهینه‌سازی خواندن/نوشتن دسته‌ای در repository در صورت اثبات سود با اندازه‌گیری.
- [ ] 4.4 آزمون invalidation کش بعد از insert/update/delete و جلوگیری از داده کهنه.
- [ ] 4.5 سنجش endpointهای workspace/dashboard/needs/orders/reports با داده تست واقع‌بینانه.

> **تصمیم ادامه مسیر (2026-10-28):** بنا به درخواست کاربر، تمرکز اجرایی از تسک 4 به تسک 5 منتقل می‌شود؛ این انتقال به معنی موفقیت یا تکمیل تسک 4 نیست. در آخرین گزارش پس از ادغام PR #68، هر پنج endpoint هنوز بیش از هدف ۳ ثانیه زمان داشتند (زمان مرورگر: workspace حدود 7.41s، dashboard 5.56s، needs 6.36s، orders 4.94s، reports 6.08s). بنابراین 4.1 تا 4.5 عمداً تیک‌نخورده باقی می‌مانند و بدهی عملکردی باید در تسک 15.5 و هنگام تحویل نهایی دوباره بررسی و گزارش شود. کش‌ها و آزمون‌های CI قبلی حفظ می‌شوند؛ هیچ ادعایی درباره رسیدن به هدف ۳ ثانیه وجود ندارد.

## تسک 5 — (IN PROGRESS) اتمیک‌سازی نسبی، idempotency و بازیابی
- [ ] 5.1 تعریف مراحل و نقاط شکست سفارش چندشیتی؛ پیاده‌سازی وضعیت قابل بازیابی و reconciliation.
- [ ] 5.2 بررسی قفل و idempotency سفارش و دریافت تکی/گروهی در درخواست هم‌زمان و retry.
- [ ] 5.3 جلوگیری از دریافت بیش از مانده سفارش، مگر با قاعده استثنا و ثبت audit صریح.
- [ ] 5.4 تعیین رفتار امن لغو/اصلاح سفارش، دریافت و تخصیص بدون حذف سابقه.
- [ ] 5.5 ثبت خطاهای قابل پیگیری و آزمون بازیابی پس از شکست بین نوشتن سرآیند، اقلام، تخصیص‌ها و دریافت‌ها.

## تسک 6 — استانداردسازی مدل و محاسبات نیاز
- [ ] 6.1 تثبیت قرارداد مشخصات مصرف نسخه‌دار و واحدهای معتبر.
- [ ] 6.2 تثبیت فرمول نیاز قطعی با مصرف هر واحد و درصد پرت، با گرد کردن/دقت عددی مستند.
- [ ] 6.3 تعریف قطعی مقدار نیاز، سفارش تخصیص‌یافته، دریافت واقعی، مانده سفارش، کسری سفارش و مازاد خرید.
- [ ] 6.4 تعیین رفتار نیاز تخمینی در برابر نیاز قطعی و جلوگیری از تخصیص مضاعف.
- [ ] 6.5 تعریف اثر تغییر تعداد تولید یا مشخصات مصرف بر نیازهای قبلی، سفارش‌های ثبت‌شده و سوابق محاسبه.
- [ ] 6.6 افزودن آزمون‌های مرزی: صفر/منفی/خالی، اعشار، مقدار بزرگ، واحد ناسازگار، مازاد، لغو و دریافت جزئی.

## تسک 7 — اتصال ایمن رویدادهای تولید
- [ ] 7.1 مستندسازی انواع رویداد و کد فیلدهای پویایی که بر تأمین اثر دارند.
- [ ] 7.2 تأیید رفتار رویداد «پایان کامل برش» و سایر رویدادهای مقدار قطعی از روی تنظیمات واقعی تست؛ فرض نام فیلد بدون بررسی ممنوع.
- [ ] 7.3 تثبیت ترتیب validate → ذخیره رویداد/داده → محاسبه/ثبت اثر تأمین و مدیریت خطای هر مرحله.
- [ ] 7.4 آزمون replay/retry، اصلاح مقدار، ابطال رویداد و تغییر نسخه نوع رویداد.
- [ ] 7.5 اطمینان از اینکه اجرای مجدد یک رویداد نیاز/دریافت تکراری تولید نمی‌کند و خطا قابل بازبینی است.

## تسک 8 — API و قابلیت سفارش از نیاز
- [ ] 8.1 تعریف انتخاب یک یا چند نیاز و ساخت سفارش با مقدار سفارش برای هر قلم.
- [ ] 8.2 اعتبارسنجی سمت سرور برای جلوگیری از تخصیص تکراری/بیش از نیاز بدون نمایش شفاف مازاد.
- [ ] 8.3 پشتیبانی سازگار از سفارش پروژه‌ای و سفارش عمومی مستقل از ProjectID.
- [ ] 8.4 تعریف قرارداد دریافت گروهی با خطاهای ردیفی قابل فهم و رفتار تکرار امن.
- [ ] 8.5 آزمون API و سازگاری عقب‌رو با payloadهای فعلی.

## تسک 9 — میزکار یکپارچه و صف اقدام فوری
- [ ] 9.1 تعیین DTO/قرارداد میزکار واحد با KPI، نیازها، سفارش‌ها، دریافت‌ها و پیوندهای پروژه.
- [ ] 9.2 تعریف صف اقدام فوری: نیاز بدون سفارش، کسری باز، سفارش معوق، دریافت ناقص، رکورد نیازمند بازبینی.
- [ ] 9.3 محاسبه مدت انتظار و تاریخ‌های موعد با مبنای زمانی ثابت و بدون تغییر داده اصلی.
- [ ] 9.4 جلوگیری از دریافت هم‌زمان داده تکراری از چند endpoint در بارگذاری صفحه.
- [ ] 9.5 آزمون کارایی و دسترسی tenant برای workspace و صف اقدام.

## تسک 10 — بهبود فرانت‌اند و فرم‌ها
- [ ] 10.1 بازطراحی تدریجی `pages/procurement.html` و `js/modules/procurement.js` حول میزکار، بدون شکستن قرارداد فعلی.
- [ ] 10.2 افزودن سفارش مستقیم از نیازهای انتخاب‌شده (A9/B1).
- [ ] 10.3 تکمیل ورود چندقلمی و دریافت گروهی با جمع‌بندی مقدار و خطای هر ردیف (B3).
- [ ] 10.4 ساده‌سازی فرم سفارش عمومی/پروژه‌ای و فرم دریافت، با پیش‌نمایش نیاز/سفارش/تحویل/مانده.
- [ ] 10.5 تکمیل جست‌وجو و فیلتر پروژه، قلم، وضعیت، تاریخ و نوع سفارش.
- [ ] 10.6 حفظ تب، جست‌وجو، فیلتر و بازشدگی کارت در حد سازگار با الگوی cache/state موجود.
- [ ] 10.7 بهبود موبایل، دسترس‌پذیری، loading/empty/error/success state و پیام‌های فارسی.
- [ ] 10.8 آزمون بارگذاری فرم، ارسال دوباره، قطع شبکه و پاسخ خطای API.

## تسک 11 — کش و بهینه‌سازی بارگذاری فرانت‌اند
- [ ] 11.1 تعیین منابعی که می‌توانند cache شوند و TTL/شرط invalidation هرکدام.
- [ ] 11.2 جلوگیری از درخواست‌های تکراری هنگام ورود صفحه و تغییر تب/فیلتر.
- [ ] 11.3 تفکیک بارگذاری اولیه از داده‌های جزئی در صورت پشتیبانی قرارداد API.
- [ ] 11.4 ثبت زمان API، زمان رندر و خطاها بدون افشای اطلاعات حساس.
- [ ] 11.5 آزمون سرد/گرم و مقایسه با baseline تسک 2 و 4.

## تسک 12 — اعلان‌های هوشمند
- [ ] 12.1 تعیین محرک‌های محدود و مفید: کسری باز، سفارش معوق، دریافت ناقص و شکست اتصال رویداد.
- [ ] 12.2 بررسی زیرساخت اعلان فعلی و انتخاب کانال سازگار (از جمله زیرساخت موجود در صورت مناسب بودن).
- [ ] 12.3 تعریف deduplication، rate limit، tenant scope، ترجیحات گیرنده و عدم ارسال اطلاعات حساس.
- [ ] 12.4 ثبت نتیجه ارسال و امکان تشخیص/تکرار امن خطا.
- [ ] 12.5 آزمون اعلان با داده تست و تأیید اینکه retry پیام تکراری نمی‌سازد.

## تسک 13 — گزارش‌های مدیریتی تأمین
- [ ] 13.1 گزارش نیازها و کسری باز به تفکیک پروژه و قلم.
- [ ] 13.2 گزارش سفارش‌های سفارش‌نشده/معوق و مدت انتظار.
- [ ] 13.3 گزارش دریافت جزئی/کامل، مانده و مازاد خرید.
- [ ] 13.4 فیلتر پروژه، قلم، وضعیت، نوع سفارش و بازه تاریخ.
- [ ] 13.5 اتصال به `ReportService` و UI موجود، امکان چاپ و تطبیق اعداد با داده مرجع.

## تسک 14 — مجوزها، audit و امنیت
- [ ] 14.1 بازبینی مجوزهای مشاهده/ثبت سفارش/دریافت/گزارش/تنظیم اتصال رویداد.
- [ ] 14.2 آزمون نقش‌های مختلف و دسترسی بین tenantها و پروژه‌های غیرمجاز.
- [ ] 14.3 ثبت audit برای اصلاح، لغو، retry، تغییر تخصیص و خطای بازیابی.
- [ ] 14.4 اطمینان از اینکه UI هیچ مسیر نوشتنی را صرفاً با کنترل سمت کاربر محافظت نمی‌کند.

## تسک 15 — آزمون سرتاسری، کارایی و تحویل
- [ ] 15.1 سناریوی پروژه جدید → مشخصات مصرف → رویداد مقدار قطعی → نیاز → سفارش → دریافت جزئی → دریافت کامل.
- [ ] 15.2 سناریوی سفارش عمومی بدون پروژه.
- [ ] 15.3 سناریوی retry، رویداد تکراری/ابطال‌شده، تغییر تعداد تولید، خطای میانه عملیات و بازیابی.
- [ ] 15.4 آزمون گزارش، اعلان، مجوزها، موبایل و رگرسیون صفحات دیگر.
- [ ] 15.5 مقایسه با baseline و هدف اولیه کمتر از ۳ ثانیه؛ ثبت محیط/حجم داده و نتیجه واقعی.
- [ ] 15.6 مرور CI، تغییرات هر دو ریپو، خطر انتشار Apps Script و روش بازگشت.
- [ ] 15.7 ارائه گزارش نهایی با شواهد تست، موارد باقی‌مانده و درخواست تأیید تست نهایی.

---

## Context Notes و سابقه

- سامانه از Google Apps Script و Google Sheets در بک‌اند و HTML/CSS/JavaScript در فرانت‌اند استفاده می‌کند.
- تسک‌های قبلی بررسی ایستای فایل‌ها را پوشش داده‌اند؛ هیچ ادعایی درباره موفقیت تست زنده از آن بررسی‌ها وجود ندارد.
- فایل قبلی TODO شامل تسک‌های 1.1 و 1.2 بود؛ این نسخه آن را برای دامنه جدید بازساخت و نقشه فنی را در ابتدای فایل ثبت کرد.
- انتخاب کاربر: همه A1 تا A16 و B1، B2، B3، B4، B7، B8؛ انبارداری کامل خارج از محدوده.
- تسک 1 بررسی ایستای سورس و ثبت نقشه بود. تسک 2 با CI سبز و مستندسازی قراردادها تکمیل شد؛ تست زنده Google Sheets انجام نشده است. تسک 3.1 تا 3.5 تکمیل و log شده‌اند؛ تسک 3.5 فقط طرح مهاجرت را مستند کرده و migration زنده اجرا نشده است.
- هیچ فایل برنامه‌ای در این مرحله تغییر نکرده است؛ فقط TODO در شاخه مستنداتی بازنویسی می‌شود.
- روند repository طبق `AGENTS.md`: شاخه کاری و Pull Request؛ ادغام به main ممکن است workflow انتشار Apps Script را فعال کند، پس ادغام/انتشار مرحله‌ای جداگانه و با بررسی اثر انجام شود.
- *Log تصمیم 2026-10-28:* با درخواست کاربر، تسک 4 از وضعیت فعال خارج و تسک 5 فعال می‌شود؛ تسک 4 تکمیل‌شده اعلام نشده است. فایل `TODO.md` تغییر می‌کند تا بدهی عملکردی و نتایج سنجش واقعی صریح بمانند و در تسک 15.5 پیگیری شوند.