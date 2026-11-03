## 🎯 Current Objective

طراحی و پیاده‌سازی موتور گردش کار قابل تنظیم برای PMS، با پشتیبانی از رویدادهای اجباری/اختیاری، ترتیب اجباری/آزاد/ترکیبی، مسیر تولید اولیه و تکراری، و همگام‌سازی خودکار اطلاعات مرجع پروژه اصلی در پروژه‌های تکراری؛ بدون ساخت مسیر موازی برای پروژه یا ثبت رویداد و با حفظ سوابق اجرایی مستقل هر پروژه.

## 🗺️ Technical Spec & Architecture Map (DO NOT DELETE)

### مخازن، شاخه و اسناد مرجع
- Backend: `Saeidesl/PRSPRO2BACKEND`، شاخه کاری این فاز `feat/workflow-event-rules-engine` (مبنای ایجاد: `main`).
- Frontend: `Saeidesl/PRSPRO2`، شاخه کاری این فاز `feat/workflow-event-rules-engine` (مبنای ایجاد: `main`).
- این فایل در ریشه هر دو مخزن نگهداری می‌شود تا نقشه و وضعیت تسک‌ها بین Frontend و Backend یکسان بماند.
- اسناد مرجع: بک‌اند `ARCHITECTURE.md`, `ARCHITECTURE2.md`, `TODO.md`, `TODO2.md`, `AGENTS.md`؛ فرانت‌اند `ARCHITECTURE.md`, `ARCHITECTURE2.md`, `TODO2.md`, `TODO3.md`, `AGENTS.md`.
- طبق `TODO2.md` شاخه قدیمی `feature/design-case-preproduction` ادغام شده است. برای این فاز شاخه جداگانه `feat/workflow-event-rules-engine` در هر دو مخزن از `main` ساخته شد. تغییرات از مسیر PR ارائه می‌شوند؛ ادغام/انتشار بک‌اند روی `main` می‌تواند Apps Script تولید را فعال کند و فقط با تأیید جداگانه مجاز است.

### معماری Backend — Google Apps Script V8 / Google Sheets
- `Router.js`: dispatch مسیرها و اعمال مجوز سمت سرور. مسیرهای فعلی گردش کار:
  - `GET /workflow-management/bootstrap` → نیازمند `WORKFLOW_MANAGE`؛ `WorkflowService.managementBootstrap(params)` و خروجی شامل `workflows`، `departments` و EventTypeهای فعال و پروژه‌محور (`eventTypes`) برای تنظیم قواعد مرحله.
  - `GET /workflows` → `WorkflowService.list(params)`؛ دسترسی خواندنی برای `WORKFLOW_MANAGE`, `PROJECT_CREATE` یا `SYSTEM_SETTINGS`.
  - `GET /workflows/:workflowId/management-data` → `WorkflowService.managementData(workflowId, params)`؛ خروجی `steps` و `assignments`.
  - `GET /workflows/:workflowId/steps` → `WorkflowService.getSteps(workflowId, params)`.
  - `GET /workflows/:workflowId/department-steps` → `WorkflowStepDepartmentService.listByWorkflow(workflowId, params)`.
  - `POST /workflows` → `WorkflowService.create(body, params)`؛ payload فعلی `{Name, Code}`.
  - `POST /workflows/:workflowId/steps` → `WorkflowService.createStep(workflowId, body, params)`؛ payload فعلی شامل `{Name, Code, StepOrder}`.
  - `POST /workflows/:workflowId/department-steps` و `POST /workflows/:workflowId/department-steps/bulk` → اتصال مرحله به دپارتمان؛ bulk payload شامل `{assignments: [...]}`.
  - `PUT /workflows/:workflowId` → `WorkflowService.update(id, body, params)`.
  - حذف اتصال دپارتمان از مسیر `DELETE /workflows/:workflowId/department-steps/:assignmentId`.
- `WorkflowService.js`: توابع تأییدشده `managementBootstrap`, `managementData`, `list`, `get`, `create`, `update`, `getSteps`, `createStep`. گردش کار فعلی دارای `Version` است؛ مراحل با `WorkflowID`, `StepOrder`, `Status` تعریف می‌شوند. در نسخه‌های جدید، `managementData`, `get`, `getSteps` مراحل و اتصال واحدها را با `WorkflowVersion <=` نسخه پیش‌نویس/منتشرشده فعال فیلتر می‌کنند؛ افزودن مرحله به Workflow منتشرشده ابتدا DraftVersion جدید ایجاد می‌کند.
- APIهای افزوده‌شده در تسک ۲: `GET /workflows/:workflowId/steps/:stepId/event-rules`، `PUT /workflows/:workflowId/steps/:stepId/event-rules` و `POST /workflows/:workflowId/publish`؛ توابع `getStepEventRules`, `saveStepEventRules`, `publish` در `WorkflowService.js` پیاده‌سازی شده‌اند.
- `WorkflowRepository.js`: شیت `09_Workflows`؛ توابع `getAll`, `findById`, `findByCode`, `existsByCode`, `insert`, `update`.
- `WorkflowStepRepository.gs.js`: شیت `10_WorkflowSteps`؛ `getAll`, `findById`, `findByWorkflowId`, `findFirstByWorkflowId`, `findByCode`, `insert`, `update`؛ مراحل جدید `WorkflowVersion` دریافت می‌کنند.
- `WorkflowStepDepartmentRepository.js`: شیت `17_WorkflowStepDepartments`؛ توابع `getAll`, `findById`, `findByWorkflowId`, `findByDepartmentAndWorkflow`, `findByStepId`, `insert`, `insertMany`, `update`.
- `WorkflowStepDepartmentService.js`: اعتبارسنجی tenant، Workflow، Step و Department و ثبت اتصال‌های تکی/گروهی.
- `WorkflowValidator.js`: اعتبارسنجی ایجاد Workflow.
- `WorkflowStepEventRuleRepository.js`: شیت `37_WorkflowStepEventRules`، خواندن قواعد نسخه‌ای، کپی قواعد نسخه منتشرشده به پیش‌نویس و جایگزینی اتمیک قواعد یک مرحله/نسخه.
- `WorkflowStepEventRuleValidator.js`: اعتبارسنجی Required/Optional/Reference/Not-required، منبع داده NEW_EVENT/SOURCE_PROJECT/NONE و ترتیب STRICT/FREE/GROUPED؛ هر مرحله یک مدل ترتیب دارد.
- `EventService.js`: مسیر اصلی ثبت رویداد؛ قواعد موجود شامل کنترل پروژه/دپارتمان، تعیین مرحله مقصد و تغییر وضعیت طبق تنظیمات نوع رویداد است. منطق دقیق `create` و قرارداد payload در تسک اجرایی از سورس کامل استخراج و ثبت شود.
- `EventRepository.js`: شیت `13_Events`؛ توابع `getAll`, `findById`, `findByProjectId`, `findByEventTypeId`, `findByPerformedBy`, `findByDepartmentId`, `insert`, `update`.
- `EventTypeService.js` و `EventTypeRepository.js`: مدیریت EventTypes. EventType فعلی شامل `WorkflowStepID`, `MovesProjectToStep`, `TargetDepartmentID`, `TargetProjectStatus`, `TargetStepStatus`, `IsWorkCompletion`, `AllowOnDraft` و تنظیمات دسترسی است. این تنظیمات حفظ می‌شوند؛ الزامات ترتیب/اجبار مرحله نباید به‌صورت سراسری داخل EventType ذخیره شوند.
- `ProjectService.js`: `projectFormLookups(params)`، `dashboardLookups(params)`؛ lookup گردش‌کار و مراحل را برای فرم/داشبورد tenant-scoped برمی‌گرداند. فرم ایجاد/ویرایش پروژه فقط نسخه منتشرشده را نمایش می‌دهد؛ هنگام وجود Draft جدید، نسخه منتشرشده قبلی همچنان قابل انتخاب است و `PublishedVersion` همراه `CurrentStepID` تثبیت می‌شود.
- `ProjectRepository.js`: شیت `08_Projects`؛ توابع `getAll`, `findById`, `findByProjectCode`, `existsByProjectCode`, `insert`, `update`, `delete`. ستون‌های موجود شامل `WorkflowID`, `WorkflowVersion`, `CurrentStepID`, `RunNumber`, `SourceProjectID`, `RecordState` هستند.
- `DatabaseSetup.js`: تعریف شیت‌ها و ستون‌ها؛ شیت‌های تأییدشده `09_Workflows`, `10_WorkflowSteps`, `11_EventTypes`, `13_Events`, `17_WorkflowStepDepartments`. تغییرات schema باید افزایشی، idempotent و بدون حذف/جابجایی ستون‌های موجود باشند. ستون‌های افزایشی گردش‌کار شامل `WorkflowType`, `LifecycleState`, `PublishedVersion`, `DraftVersion` و `WorkflowVersion` هستند؛ شیت جدید `37_WorkflowStepEventRules` با ایجاد/تکمیل امن سرستون‌ها اضافه شده است.
- `GoogleSheetsRepository.js`: لایه مشترک خواندن/نوشتن و cache؛ تمام Repositoryهای جدید باید از همین لایه و سیاست invalidation پیروی کنند.
- `AccessControlService.js`, `PermissionService.js`, `AuditService.js`: مرجع مجوز، tenant isolation و audit.
- `FormService.js` و `34_EventTypeForms` / `34_EventFormData`: اتصال فرم به رویداد، snapshot نسخه فرم و ذخیره پاسخ؛ این مسیر باید حفظ شود.
- قرارداد API موجود برای پروژه و رویداد حفظ شود: `POST /projects`, `PUT /projects/:id`, `GET /projects/:id`, `POST /events`, `GET /events`, `GET /events/:id/forms/:formId`. هیچ endpoint یا جریان موازی برای ایجاد پروژه/ثبت رویداد ساخته نشود.

### معماری Frontend — HTML/CSS/JavaScript
- `index.html`: بارگذاری صفحه‌ها و ماژول‌ها؛ هر فایل تغییرکرده باید cache-busting متناسب دریافت کند.
- `pages/workflows.html`: صفحه مدیریت گردش کار موجود.
- `js/modules/workflows.js`: ماژول مدیریت Workflow؛ `init`, `bindEvents`, `loadWorkflows`, `showWorkflowSteps`, `showStepEventRules`, `appendRuleRow`, `publishWorkflow`؛ انتخاب نوع مسیر INITIAL/REPEAT، ویرایش قواعد رویداد مرحله و انتشار نسخه. APIهای فعلی تأییدشده: `GET /workflow-management/bootstrap` (همراه EventTypes فعال)، `POST /workflows`, `POST /workflows/:id/steps`, `GET /workflows/:id/steps`, `GET/PUT /workflows/:id/steps/:stepId/event-rules`, `POST /workflows/:id/publish`.
- `js/modules/workflow-department-assignments.js` (نام فایل/ماژول در زمان اجرای تسک از index و صفحه workflow تأیید شود): اتصال دپارتمان‌ها به مراحل.
- `js/modules/events.js`: مسیر اصلی ثبت/نمایش رویدادها، انتخاب پروژه و EventType، فرم‌های پویا، اصلاح فرم و idempotency؛ باید همان مسیر توسعه یابد.
- `js/modules/event-types.js`: مدیریت EventType و فیلدهای پویا؛ تعریف نوع رویداد مستقل از الزام استفاده آن در Workflow باقی بماند.
- `js/modules/projects.js`: `Projects.init()`, `Projects.render()`, `Projects.openCreateForm(project, options)`, `Projects.openProjectEditForm(projectId, options)`; تخصیص Workflow از همین جریان فعلی پروژه حفظ شود.
- `js/modules/project-workflow-settings.js`: در حال حاضر انتخاب Workflow پیش‌فرض فرم ایجاد پروژه را از تنظیم محلی مرورگر اعمال/پنهان می‌کند؛ هنگام توسعه باید رفتار فعلی و تنظیمات پروژه حفظ و تصمیم سرورمحور/نسخه‌دار با آن هماهنگ شود.
- `js/core/api.js`: همه درخواست‌ها از `PMS.Api` عبور کنند؛ از fetch مستقیم استفاده نشود.
- `js/core/router.js`, `js/components/layout.js`: route، منو و مجوزهای UI؛ کنترل UI جایگزین مجوز Backend نیست.
- `css/unified-theme.css` و استایل‌های صفحه Workflow: RTL، تم روشن/تیره و واکنش‌گرایی موبایل باید حفظ شود.

### مدل دامنه هدف و قواعد قطعی محصول
- EventType تعریف می‌کند «چه عملیاتی قابل ثبت است»؛ WorkflowStep تعریف می‌کند «کدام مرحله»؛ WorkflowStepEventRequirement تعریف می‌کند «در این مرحله چه رویدادهایی با چه قواعدی لازم‌اند». الزام رویداد در EventType ذخیره نشود تا یک EventType بتواند در Workflowهای مختلف اجباری/اختیاری/غیرضروری باشد.
- برای هر Step، فهرست الزامات رویدادی مرتب‌شده نگهداری شود؛ هر الزام حداقل دارای EventTypeID، ترتیب، Required/Optional، نوع ترتیب/وابستگی و سیاست منبع داده باشد.
- ترتیب رویدادها در سطح مرحله سه حالت دارد: اجباری (ترتیب دقیق)، آزاد (بدون وابستگی ترتیبی) و ترکیبی (گروه‌ها/وابستگی‌های مرتب‌شده و رویدادهای موازی درون گروه).
- منبع داده هر الزام: ثبت جدید در پروژه جاری، دریافت از پروژه مرجع، اختیاری، یا غیرضروری/غیرفعال. داده مرجع رویداد جدید اجرایی محسوب نمی‌شود و Event تکراری در پروژه جدید ساخته نمی‌شود.
- Workflow دارای نسخه منتشرشده و پیش‌نویس تغییرات است. Project هنگام تخصیص به یک Workflow، نسخه مشخص را تثبیت می‌کند؛ تغییر Workflow منتشرشده نباید اجرای در حال انجام را بی‌خبر تغییر دهد. انتقال پروژه به نسخه جدید باید کنترل‌شده و صریح باشد.
- انواع مسیر حداقل شامل «تولید اولیه» و «تولید تکراری» هستند؛ این‌ها قالب Workflow هستند، نه مسیر موازی ثبت پروژه. ایجاد پروژه تکراری از مسیر موجود پروژه انجام می‌شود و Workflow مناسب به آن اختصاص می‌یابد.
- پروژه تکراری پروژه مستقل با رویدادها/تولید/تأمین/کیفیت/بسته‌بندی مستقل است و با `SourceProjectID` به پروژه مرجع متصل می‌شود. چندین پروژه تکراری می‌توانند به یک پروژه اصلی متصل باشند.
- اطلاعات مرجع (طراحی، تصویر، الگو، نمونه تأییدشده و مشخصات فنی انتخاب‌شده) از پروژه اصلی خوانده و با Live Reference Synchronization به پروژه‌های تکراری منعکس می‌شوند. تغییرات مرجع نباید Eventهای اجرایی، سفارش‌ها، مقادیر واقعی یا گزارش‌های گذشته را بازنویسی کنند.
- همگام‌سازی باید قابل ردیابی باشد: منبع/شناسه/نسخه اطلاعات مرجع، زمان آخرین sync، وضعیت sync و تاریخچه تغییرات. عملیات تکراری باید idempotent و tenant-scoped باشد. اگر داده‌ای در پروژه تکراری به‌عنوان مقدار اجرایی مستقل ثبت شده، همگام‌سازی مرجع نباید آن را بی‌صدا جایگزین کند؛ تعارض باید طبق سیاست مشخص و قابل مشاهده مدیریت شود.
- سوابق رویدادهای پروژه اصلی صرفاً مرجع خواندنی‌اند؛ رویدادهای تولید جدید فقط به ProjectID پروژه تکراری ثبت می‌شوند.
- ثبت/ابطال/اصلاح رویداد باید وضعیت الزامات مرحله را دوباره محاسبه کند. ابطال یک رویداد اجباری می‌تواند مرحله را از حالت تکمیل خارج کند، ولی نباید به‌طور ناامن پروژه را به مرحله قبلی برگرداند.
- قواعد امنیتی: tenant isolation، دسترسی پروژه، دپارتمان/کاربر مجاز، audit، idempotency و جلوگیری از race condition سمت Backend اعمال شوند.
- تست‌ها فقط با دیتابیس/محیط آزمایشی اجرا شوند. هیچ داده واقعی حذف یا بازنویسی نشود. merge به main بک‌اند می‌تواند deploy تولید را فعال کند؛ انتشار نیازمند تأیید جداگانه است.

## 📋 Macro-Task Queue & Implementation Log

- [x] **تسک ۱ — کشف معماری و برنامه‌ریزی فاز**
  - *Log:* اسناد `AGENTS.md`, `ARCHITECTURE.md`, `ARCHITECTURE2.md`, `TODO.md` و `TODO2.md` بک‌اند و اسناد `AGENTS.md`, `ARCHITECTURE.md`, `ARCHITECTURE2.md`, `TODO2.md`, `TODO3.md` فرانت‌اند در شاخه `main` بررسی شدند. ساختار فعلی Workflow در `09_Workflows` و `10_WorkflowSteps`، اتصال دپارتمان در `17_WorkflowStepDepartments`، EventTypes در `11_EventTypes` و رویدادها در `13_Events` تأیید شد. APIهای فعلی مدیریت Workflow و مسیر اصلی `POST /events` و پروژه `POST/PUT /projects` ثبت شدند. ماژول‌های Frontend موجود برای Workflow، رویداد، EventType و پروژه مشخص شدند. تصمیم‌های قطعی ترتیب اجباری/آزاد/ترکیبی، مسیر تولید اولیه/تکراری، ارجاع زنده اطلاعات مرجع، استقلال سوابق تولید و عدم ساخت مسیر موازی ثبت شد. بررسی ایستا است؛ قراردادهای جزئی و مسیر فایل WorkflowStepRepository باید پیش از تغییر کد در تسک اجرایی دوباره با سورس کامل تطبیق داده شوند. هیچ کد اجرایی یا داده‌ای تغییر نکرده است.
- [x] **تسک ۲ — مدل اطلاعاتی و موتور قواعد رویدادی Workflow**
  - *Log:* در `DatabaseSetup.js` ستون‌های نسخه/وضعیت Workflow و شیت افزایشی `37_WorkflowStepEventRules` تعریف شد؛ `WorkflowStepEventRuleRepository.js` خواندن، کپی نسخه و جایگزینی قواعد را انجام می‌دهد؛ `WorkflowStepEventRuleValidator.js` حالت‌های Required/Optional/Reference/Not-required و ترتیب STRICT/FREE/GROUPED را اعتبارسنجی می‌کند؛ `WorkflowService.js` توابع `getStepEventRules`, `saveStepEventRules`, `publish` و `WorkflowValidator.js` اعتبارسنجی نوع INITIAL/REPEAT اضافه شدند؛ `Router.js` APIهای دریافت/ذخیره قواعد و انتشار نسخه را با مجوز مدیریت ارائه می‌کند. تغییرات بک‌اند در PR #86 و رابط اولیه در PR فرانت‌اند #149 ادغام شدند.
- [x] **تسک ۳ — پنل تنظیم و انتشار Workflow**
  - *Log:* `pages/workflows.html` و `js/modules/workflows.js` برای ساخت Workflowهای INITIAL/REPEAT، تعریف مراحل، انتخاب EventTypeها، تعیین RequirementMode و ترتیب STRICT/FREE/GROUPED، ذخیره قواعد و انتشار نسخه به APIهای موجود متصل شدند؛ `WorkflowService.js` و APIهای مدیریت نسخه/قواعد در بک‌اند استفاده شدند. `index.html` برای cache-busting ماژول به‌روزرسانی شد. پس از گزارش کاربر مبنی بر بی‌واکنش بودن دکمه تنظیم، `showStepEventRules` در `js/modules/workflows.js` اصلاح شد تا مودال فوراً باز شود، وضعیت بارگذاری و خطا را نشان دهد و پس از دریافت قواعد، ویرایش و ذخیره را فعال کند؛ پاسخ‌های `items` و `rules` پشتیبانی شدند. تست‌های رگرسیون `tests/workflow-management.test.js` با قرارداد جدید و کلید cache هماهنگ شدند. PRهای فرانت‌اند #149 و #150 در `main` ادغام شدند. کاربر ثبت موفق تنظیم سه رویداد اجباری با ترتیب ۱، ۲ و ۳ را در محیط برنامه تأیید کرد.
- [ ] **تسک ۴ — اجرای قواعد در ثبت رویداد و تکمیل مرحله (IN PROGRESS)**
  - اتصال موتور قواعد به مسیر اصلی `POST /events` و UI موجود ثبت رویداد؛ نمایش رویدادهای مجاز/باقی‌مانده، کنترل ترتیب و وابستگی، اعتبارسنجی سرور، محاسبه تکمیل مرحله و مدیریت void/amendment؛ جلوگیری از انتقال زودهنگام بدون تغییر مسیر اصلی ثبت رویداد.
- [ ] **تسک ۵ — پروژه تکراری و همگام‌سازی زنده مرجع**
  - ایجاد پروژه تکراری از مسیر موجود پروژه؛ اتصال به پروژه اصلی با `SourceProjectID`؛ تخصیص Workflow تکراری؛ ارجاع اطلاعات طراحی/الگو/نمونه/مشخصات مرجع و همگام‌سازی خودکار تغییرات؛ ثبت تاریخچه و تعارض‌ها؛ حفظ استقلال رویدادها و سوابق تولید؛ آزمون کامل چند تکرار و عدم تغییر گزارش‌های گذشته.

> قاعده اجرا: هر Macro-Task یک تحویل یکپارچه Backend + Frontend در محدوده خودش است. پس از هر تحویل، گزارش کوتاه و توقف برای تست کاربر؛ تیک و Log تکمیل فقط پس از تأیید کاربر ثبت می‌شود. کدنویسی روی شاخه feature و از مسیر PR انجام می‌شود؛ ادغام/انتشار تولید فقط با تأیید جداگانه کاربر.
