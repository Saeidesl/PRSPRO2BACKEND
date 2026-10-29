## 🎯 Current Objective

طراحی و پیاده‌سازی چرخه یکپارچه «طرح → پیش‌تولید و نمونه‌گیری → تأیید/عدم تأیید → تولید» در PMS. پرونده از ابتدا شناسه داخلی ثابت دارد؛ کد پروژه تولیدی فقط پس از تأیید صادر می‌شود. داده‌های رنگ/سایز، ملزومات، رویدادها، گزارش‌ها و سفارش‌های تکراری باید ساختاریافته و بدون شکستن داده‌های فعلی پشتیبانی شوند.

## 🗺️ Technical Spec & Architecture Map (DO NOT DELETE)

### مخازن و اسناد مرجع
- Backend: `Saeidesl/PRSPRO2BACKEND`, شاخه `main`.
- Frontend: `Saeidesl/PRSPRO2`, شاخه `main`.
- نقشه تفصیلی بک‌اند: `ARCHITECTURE2.md` در ریشه مخزن بک‌اند.
- نقشه تفصیلی فرانت‌اند: `ARCHITECTURE2.md` در ریشه مخزن فرانت‌اند.
- اسناد موجود که باید حفظ شوند: بک‌اند `TODO.md` و فرانت‌اند `ARCHITECTURE.md` و `TODO1.md`. این فاز آن‌ها را بازنویسی نمی‌کند.

### نقشه فنی تأییدشده از سورس فعلی
- Backend GAS V8 / Google Sheets: `Router.js`, `ProjectService.js`, `ProjectRepository.js`, `ProjectValidator.js`, `EventService.js`, `EventTypeService.js`, `EventFieldService.js`, `EventDataService.js`, `GoogleSheetsRepository.js`, `DatabaseSetup.js`, `MaterialPlanningService.js`, `ProcurementService.js`, `ProcurementRepository.js`, `ProcurementEventIntegrationService.js`, `ReportService.js`, `AccessControlService.js`, `AuditService.js`.
- Frontend: `pages/projects.html`, `pages/project-detail.html`, `pages/dashboard.html`, `js/modules/projects.js`, `js/modules/project-detail.js`, `js/modules/events.js`, `js/modules/event-types.js`, `js/modules/material-planning.js`, `js/modules/project-images.js`, `js/core/api.js`, `js/core/router.js`, `js/components/layout.js`, `css/project-form.css`, `css/unified-theme.css`.
- Project sheet `08_Projects` فعلاً شامل `ID, TenantID, ProjectCode, Title, Description, WorkflowID, WorkflowVersion, CurrentStepID, Status, CreatedBy, CreatedAt, UpdatedAt, Quantity, ColorSizeJSON, AvailableDepartmentIDs, AllowedUserIDs, NotifyEnabled, CurrentStepStatus` است. Repository توابع `findById`, `findByProjectCode`, `existsByProjectCode`, `insert`, `update`, `delete` دارد.
- رویدادها در `13_Events` به `ProjectID` و `EventTypeID` متصل‌اند؛ داده پویا در `14_EventData.DataJSON` ذخیره می‌شود. فیلدهای پویا از شیت `12_EventFields` تعریف می‌شوند. پیوست‌ها در `15_Attachments` با `EntityType/EntityID/AttachmentType` متصل‌اند.
- رنگ/سایز فعلی در ستون `ColorSizeJSON` پروژه ذخیره می‌شود؛ شکل دقیق JSON و تمام مصرف‌کنندگان باید پیش از تغییر بررسی شود.
- ملزومات فعلی: `18_MaterialNeeds`, `24_ProjectMaterialSpecs`, `25_MaterialNeedCalculations`; سفارش/دریافت: شیت‌های 19 تا 22؛ تنظیم رویداد-تأمین: `23_EventTypeProcurementSettings`.
- `ProjectService.projectFormLookups(params)` داده‌های lookup فرم فعلی را آماده می‌کند. `EventService` می‌تواند طبق تنظیمات نوع رویداد وضعیت یا مرحله پروژه را تغییر دهد.
- Frontend `Projects.openCreateForm(project, options)` و `Projects.openProjectEditForm(projectId, options)` را در `js/modules/projects.js` دارد؛ فرم‌های پروژه در زمان اجرا ساخته می‌شوند. درخواست‌ها باید از `PMS.Api` در `js/core/api.js` عبور کنند.
- محدودیت‌های حیاتی: داده واقعی حذف/بازنویسی نشود؛ تغییر schema افزایشی و idempotent باشد؛ مجوز tenant/project سمت سرور اعمال شود؛ کد پروژه فقط یک بار و پس از تأیید صادر شود؛ مقدار برنامه‌ریزی‌شده از مقادیر واقعی عملیات جدا باشد؛ اجرای تکراری، تاریخچه اجرای قبلی را تغییر ندهد.
- این بررسی ایستا بوده است؛ endpointها و payloadهای دقیق، قواعد اعتبارسنجی و رفتارهای اجرایی در تسک‌های پیاده‌سازی از سورس کامل دوباره بررسی و تست می‌شوند.

### قرارداد تثبیت‌شده تسک ۲
- مدل دامنه: پرونده پیش‌تولید `DesignCase` شناسه داخلی مستقل دارد؛ پروژه فعلی `08_Projects` فقط اجرای تولید است و `ProjectCode` اجباری فعلی‌اش حفظ می‌شود. یک پرونده می‌تواند چند اجرای مستقل تولید داشته باشد.
- مهاجرت افزایشی پیشنهادی: شیت `26_DesignCases` با ستون‌های `ID, TenantID, DesignCode, Title, Description, Status, Priority, RequestedBy, OwnerUserID, OwnerDepartmentID, ProposedQuantity, ColorSizeJSON, ReferenceAttachmentID, RejectionReason, ApprovedAt, ApprovedBy, CreatedBy, CreatedAt, UpdatedAt, Revision`; افزودن `DesignCaseID, RunNumber, SourceProjectID` به انتهای `08_Projects`؛ افزودن `DesignCaseID` به انتهای `13_Events`؛ و شیت append-only `27_DesignCaseHistory` با `ID, TenantID, DesignCaseID, Revision, Action, FromStatus, ToStatus, Reason, SnapshotJSON, ActorUserID, CreatedAt, IdempotencyKey`.
- وضعیت‌های پرونده: `DRAFT, IN_DESIGN, PATTERN_MAKING, MATERIALS_PENDING, SAMPLE_SEWING, REVISION_REQUIRED, READY_FOR_APPROVAL, REJECTED, APPROVED, ARCHIVED`. وضعیت پیش‌تولید از وضعیت پروژه تولید جدا است.
- رنگ/سایز با قالب سازگار فعلی `{colors:[], sizes:[]}` ذخیره و در لحظه تأیید به‌عنوان snapshot به اجرای تولید کپی می‌شود. داده‌های پروژه قدیمی بدون DesignCaseID دست‌نخورده می‌مانند.
- endpointهای موجود و بدون تغییر: `GET /projects`, `GET /projects/:id`, `POST /projects`, `PUT /projects/:id`, `GET /project-form/lookups`. ایجاد پروژه فعلی همچنان `ProjectCode`, `Title`, `WorkflowID`, `AvailableDepartmentIDs` می‌خواهد.
- endpointهای هدف برای تسک‌های بعدی: `GET/POST /design-cases`, `GET/PUT /design-cases/:id`, `GET/POST /design-cases/:id/events`, `POST /design-cases/:id/reject`, `POST /design-cases/:id/approve`, `GET /design-cases/:id/production-runs`, `POST /design-cases/:id/production-runs`. payloadها و قواعد دقیق در بخش ۷ فایل بک‌اند `ARCHITECTURE2.md` ثبت شده‌اند. این endpointها هنوز ساخته نشده‌اند.
- تضمین‌ها: tenant/permission در سرور؛ کد تولید فقط در تأیید؛ بررسی یکتایی کد زیر قفل؛ `IdempotencyKey` برای تأیید/ایجاد؛ retry قابل بازیابی برای شکست نیمه‌کاره؛ هیچ حذف/rename یا backfill اجباری برای داده‌های موجود.
- وضعیت اجرا: این تسک فقط تثبیت مدل، قرارداد API و طرح مهاجرت است؛ هنوز تغییر کد اصلی یا اجرای مهاجرت دیتابیس انجام نشده. تست runtime نیز هنوز انجام نشده است.



### قرارداد تسک ۳ — استفاده مجدد از تب پروژه‌ها و تنظیمات ایجاد
- مسیر UI: تب فعلی `projects` و فرم `Projects.openCreateForm` حفظ می‌شوند؛ عنوان تب به «طرح و نمونه‌گیری» و دکمه ایجاد به «ثبت طرح و نمونه‌گیری جدید» تغییر می‌کند. تب مستقل `design-cases` نباید به‌عنوان مسیر موازی در منو باقی بماند.
- فرم ایجاد اولیه فقط عنوان طرح، شناسه داخلی یکتا و تصویر طرح را می‌گیرد و از API ایجاد پروژه تولیدی `POST /projects` استفاده نمی‌کند؛ ثبت باید `DesignCase` بسازد.
- تنظیمات فعلی فرم ایجاد پروژه (گردش‌کار/تنظیمات مربوط به دسترسی واحدها و کاربران مجاز، وضعیت و اطلاع‌رسانی، با حفظ رفتارهای موجود) باید برای پرونده طرح نیز قابل تنظیم شوند. منطق و رابط تنظیمات فعلی تا حد امکان بازاستفاده شود؛ تنظیمات در ذخیره‌سازی مستقل و مختص پرونده طرح نگهداری شوند و نباید ناخواسته پروژه تولیدی ایجاد کنند یا تنظیمات پروژه‌های قبلی را تغییر دهند.
- Task 4 علاوه بر تأیید/تبدیل به تولید، باید فهرست پرونده‌ها را بر اساس مجوز و واحد کاربر نمایش دهد تا الگوساز هنگام ورود، پرونده‌های مجاز را ببیند و اقدامات/رویدادهای مربوط به مرحله خودش را روی همان پرونده ثبت کند.
- پیش از ادغام، قرارداد API و سمت سرور باید بررسی شود؛ تنظیمات نمایشی فرانت‌اند به‌تنهایی مرز امنیتی محسوب نمی‌شوند.

## 📋 Macro-Task Queue & Implementation Log

- [x] **تسک ۱ — بررسی معماری و برنامه‌ریزی فاز**
  - *Log:* فایل‌های پایه و اسناد موجود در دو مخزن بررسی شدند: بک‌اند `TODO.md`, `DatabaseSetup.js`, `ProjectRepository.js`, بخش‌های `ProjectService.js`, `EventService.js` و معماری تأمین؛ فرانت‌اند `ARCHITECTURE.md`, `TODO1.md` و نقشه ماژول‌های پروژه/رویداد/API. مدل فعلی پروژه، داده‌های رویداد پویا، رنگ/سایز، ملزومات و فایل‌های وابسته ثبت شد. `ARCHITECTURE2.md` در هر دو مخزن ایجاد شد. بررسی ایستا است و هنوز تست اجرایی انجام نشده.
- [x] **تسک ۲ — تثبیت مدل داده پرونده طرح و اجرای تولید**
  - *Log:* در بک‌اند `ARCHITECTURE2.md` بخش ۷ و در فرانت‌اند `ARCHITECTURE2.md` قراردادهای مدل و UI ثبت و با `TODO2.md` همگام شدند. مدل `DesignCase` از اجرای تولید در `08_Projects` جدا شد؛ شیت‌های افزایشی `26_DesignCases` و `27_DesignCaseHistory`، ستون‌های ارتباطی `DesignCaseID`, `RunNumber`, `SourceProjectID` و وضعیت‌های پرونده تعریف شدند. قرارداد endpointهای پرونده، تأیید/رد، رویدادها و اجرای مجدد، قواعد tenant/permission، یکتایی کد و idempotency مستند شد. فقط مستندسازی و تثبیت قرارداد انجام شد؛ هنوز کد اجرایی یا مهاجرت دیتابیس تغییر نکرده و تست runtime انجام نشده است.
- [ ] **تسک ۳ — پرونده پیش‌تولید و گردش نمونه‌گیری در فرانت‌اند و بک‌اند (IN PROGRESS)**
  - جایگزینی تب مستقل با تب فعلی پروژه‌ها؛ بازاستفاده از فرم ایجاد فعلی با سه فیلد عنوان، شناسه داخلی و تصویر؛ انتقال/بازاستفاده تنظیمات فعلی ایجاد پروژه برای پرونده طرح؛ ایجاد پرونده از API طرح و نه API پروژه تولید؛ فهرست/مشاهده/ویرایش و تاریخچه، با حفظ ظاهر و موبایل.
- [ ] **تسک ۴ — رویدادهای تأیید/عدم تأیید و تبدیل امن به تولید**
  - نمایش پرونده‌های مجاز به نقش/واحد (از جمله الگوساز) و ثبت اقدامات مرحله‌ای روی همان پرونده؛ رویداد تأیید، فرم اطلاعات تولید، صدور یکتای کد، ثبت تعداد و رنگ/سایز؛ رویداد عدم تأیید با دلیل؛ کنترل دوباره‌ثبت، دسترسی و خطاهای نیمه‌کاره؛ اتصال پرونده موجود به جریان تولید بدون ایجاد پرونده تکراری.
- [ ] **تسک ۵ — اتصال داده‌های ساختاریافته به برش، ملزومات، محاسبات و گزارش‌ها**
  - نمایش رنگ/سایز و تعداد به برش؛ ثبت مقادیر واقعی؛ محاسبه نیاز بر پایه مشخصات مصرف و ضایعات؛ جلوگیری از نیازهای تکراری؛ یکپارچگی گزارش پروژه و گزارش تأمین.
- [ ] **تسک ۶ — فرم‌ساز پویا و اتصال فرم به رویداد**
  - تعریف/ویرایش فرم و فیلدها، اعتبارسنجی، ذخیره داده ساختاریافته، اتصال نوع رویداد به فرم، نمایش در زمان ثبت رویداد و حفظ نسخه/تاریخچه؛ سازگاری با زیرساخت EventTypes/EventFields/EventData.
- [ ] **تسک ۷ — پشتیبانی از سفارش تکراری، آزمون رگرسیون و بهینه‌سازی**
  - شروع اجرای تولید جدید از طرح تأییدشده و مرحله مناسب؛ استفاده مجدد کنترل‌شده از الگو/استاندارد مصرف؛ حفظ تاریخچه اجرای قبلی؛ آزمون مسیر کامل، مجوزها، داده‌های قدیمی، کارایی و گزارش نهایی.

> قاعده اجرا: هر Macro-Task به‌صورت یک تحویل کامل فرانت‌اند+بک‌اند اجرا می‌شود. پس از هر تسک، نتیجه و فایل‌های تغییرکرده گزارش می‌شوند؛ تیک تسک و Log دقیق تکمیل فقط بعد از تأیید کاربر ثبت می‌شود. تسک‌های ۱ و ۲ تأیید و تکمیل شده‌اند؛ تسک ۳ فعال است.
