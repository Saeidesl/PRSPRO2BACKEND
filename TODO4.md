## 🎯 Current Objective

یکپارچه‌سازی کامل سیاست کپی اطلاعات پروژه تکراری در سطح Workflow؛ حذف هرگونه انتخاب/تغییر سیاست در فرم ایجاد پروژه؛ نمایش روند واقعی و مرحله‌به‌مرحله کپی اطلاعات هنگام ثبت پروژه تکراری؛ و افزودن امکان ویرایش سیاست کپی در Workflowهای موجود، بدون بازنویسی اطلاعات پروژه‌های قبلی.

## 🗺️ Technical Spec & Architecture Map (DO NOT DELETE)

### مخازن و شاخه مجاز
- Frontend: `Saeidesl/PRSPRO2`، فقط شاخه `feature/design-case-preproduction`.
- Backend: `Saeidesl/PRSPRO2BACKEND`، فقط شاخه `feature/design-case-preproduction`.
- تغییر مستقیم `main` ممنوع است.
- Workspace قبلی همین شاخه خوانده شد؛ Task 2 قبلی هنوز به تأیید کاربر نرسیده بود. کاربر در تست اعلام کرد کپی موفق نبوده و دامنه فعلی جایگزین برنامه قبلی شد.

### مدل داده و سیاست مرجع
- اطلاعات مرکزی در شیت‌های `28_InformationTypes`, `29_InformationTypeColumns`, `30_ProjectInformation`, `31_ProjectInformationHistory` نگهداری می‌شود.
- سیاست Workflow در فیلدهای `RepeatReferencePolicyJSON` و نسخه منتشرشده `PublishedRepeatReferencePolicyJSON` ذخیره می‌شود.
- مقادیر معتبر: `INITIAL_COPY`, `LIVE_SYNC`, `INDEPENDENT`.
- تصمیم محصول جدید: سیاست فقط در تنظیمات خود Workflow تعیین می‌شود. فرم ایجاد پروژه تکراری نباید کنترل override داشته باشد و payload آن نباید `ReferencePolicyJSON` قابل انتخاب از کاربر ارسال کند.
- Backend باید فقط سیاست معتبر نسخه Workflow را مبنای ایجاد و کپی قرار دهد؛ هر override ارسالی از کلاینت نباید سیاست Workflow را تغییر دهد.
- تغییر سیاست Workflow از زمان ثبت نسخه جدید/ذخیره‌شده برای پروژه‌های تکراری بعدی اعمال می‌شود؛ داده پروژه‌های قبلی و سیاست ثبت‌شده آن‌ها نباید خودکار بازنویسی شود.
- فایل/تصویر فقط در صورت انتقال امن خود فایل و اصلاح ارجاع‌ها کپی شود؛ در غیر این صورت در گزارش روند به‌عنوان مورد قابل‌انتقال‌نبودن نمایش داده شود.

### Frontend — فایل‌ها و نقاط اتصال
- `js/modules/workflows.js`
  - `loadWorkflows()`: بارگذاری `/workflow-management/bootstrap` شامل Workflowها، انواع رویداد و انواع اطلاعات.
  - `render()`: نمایش فهرست Workflowها.
  - `showCreateWorkflowModal()`: فرم ایجاد Workflow و تنظیمات سیاست.
  - باید مسیر ویرایش Workflow موجود به همان فرم/کامپوننت متصل شود و سیاست‌های هر نوع اطلاعات قابل تغییر و ذخیره باشند.
  - API ذخیره: `POST /workflows` برای ایجاد و `PUT /workflows/:id` برای ویرایش.
- `pages/workflows.html`: ساختار صفحه مدیریت Workflow و محل کنترل فهرست/فرم.
- `js/modules/projects.js`
  - `Projects.openCreateForm(project, options)`: فرم موجود ایجاد پروژه.
  - بخش فعلی `[data-reference-override]` و هر UI انتخاب سیاست از فرم ایجاد/ویرایش پروژه باید حذف شود.
  - `createProject(modal)`: مسیر موجود `POST /projects`؛ payload باید فقط شناسه Workflow و پروژه مرجع را بفرستد، نه سیاست انتخاب‌شده کاربر.
  - پس از submit باید وضعیت پیشرفت واقعی و مرحله‌ای را به کاربر نمایش دهد، شامل نام هر نوع اطلاعاتی که طبق سیاست Workflow در حال کپی/رد شدن است.
- `index.html`: cache-busting ماژول‌های تغییرکرده.

### Backend — فایل‌ها و APIها
- `WorkflowService.js`
  - `managementBootstrap(params)`: ارائه Workflowها و انواع اطلاعات برای صفحه مدیریت.
  - `create(data, params)`: اعتبارسنجی و ذخیره سیاست در `RepeatReferencePolicyJSON`.
  - `update(id, data, params)`: پشتیبانی از تغییر سیاست Workflow موجود؛ اعتبارسنجی باید علاوه بر enum، تعلق هر InformationType به Tenant و فعال‌بودن آن را کنترل کند.
  - `publish(workflowId, params)`: ثبت snapshot سیاست در `PublishedRepeatReferencePolicyJSON`.
- `ProjectService.js`
  - `projectFormLookups(params)`: ارائه Workflowها و انواع اطلاعات برای فرم پروژه.
  - `create(project, params)`: ایجاد پروژه از مسیر واحد `POST /projects`، ساخت `ReferenceCopyPlan` و ذخیره وضعیت عملیات در `08_Projects.ReferenceCopyStatusJSON`؛ کلید `ReferenceCopyOperationID` برای idempotency.
  - `copyReferenceInformationType(projectId, typeId, params)`: اجرای مستقل هر نوع اطلاعات با Lock، tenant/access checks، snapshot سیاست پروژه، ثبت History/SyncLog و وضعیت قابل retry.
  - پاسخ ایجاد شامل `ReferenceCopyPlan` و `ReferenceCopySummary` است؛ کپی هر نوع اطلاعات با درخواست جداگانه `POST /projects/:projectId/reference-copy/:typeId` انجام می‌شود.
- `ProjectInformationService.js`: `save`, `_syncLiveReference_` و منطق همگام‌سازی زنده و تعارض‌ها.
- `Router.js`
  - `GET /workflow-management/bootstrap`
  - `GET /workflows`
  - `POST /workflows`
  - `PUT /workflows/:id`
  - `POST /projects`
  - `POST /projects/:projectId/reference-copy/:typeId` → `ProjectService.copyReferenceInformationType`; فقط در `Router.post` قرار دارد و مجوز `PROJECT_EDIT` یا برای سازنده پروژه، `PROJECT_CREATE` را کنترل می‌کند.
  - `GET /project-form/lookups`
  - حفظ همین مسیر واحد ایجاد پروژه؛ endpoint موازی برای ایجاد پروژه ممنوع.
- `DatabaseSetup.js`: `setupDatabase()` پس از ایجاد شیت‌ها، `ensureProjectReferenceCopySchema_(ss)` را اجرا می‌کند و سه ستون `ReferenceCopyStatusJSON`, `ReferenceCopyCompletedAt`, `ReferenceCopyOperationID` را به‌صورت افزایشی به `08_Projects` اضافه می‌کند.
- `WorkflowRepository.js`, `ProjectRepository.js`, `ProjectInformationRepository.js`, `InformationTypeRepository.js`: مخازن موجود برای Workflow، پروژه و اطلاعات مرکزی.
- `tests/project-repeat-reference-copy.test.js`: آزمون برنامه کپی، کپی تک‌نوعی، idempotency، همگام‌سازی زنده، سیاست Workflow و قرارداد route کپی.
- انتشار آزمایشی: `.github/workflows/deploy-pages-staging.yml` برای فرانت‌اند و `.github/workflows/sync-apps-script-staging.yml` برای بک‌اند.

### قرارداد نمایش پیشرفت
- نوار/پنجره پیشرفت باید پس از کلیک ثبت، مرحله جاری را با متن روشن نشان دهد: اعتبارسنجی اطلاعات پروژه، ایجاد پروژه، بررسی سیاست Workflow، کپی هر نوع اطلاعات منتخب، ثبت تاریخچه/همگام‌سازی، و تکمیل.
- برای هر نوع اطلاعات نام آن و وضعیت واقعی (در انتظار، در حال پردازش، کپی شد، مستقل/رد شد، فایل قابل انتقال نبود، خطا) نمایش داده شود.
- صرفاً تغییر متن یا درصد ساختگی مجاز نیست. قرارداد API باید طوری طراحی شود که وضعیت هر مرحله/نوع اطلاعات از عملیات واقعی Backend قابل دریافت باشد. با توجه به غیرقابل‌stream بودن پاسخ معمول Apps Script، راهکار باید مبتنی بر اجرای مرحله‌ای یا شناسه عملیات و polling وضعیت باشد و از ایجاد پروژه/کپی نیمه‌کاره و تکراری جلوگیری کند.
- وضعیت‌های هر نوع اطلاعات: `PENDING`, `FAILED`, `COPIED`, `INDEPENDENT`, `EMPTY`, `SKIPPED_FILE`, `PROCESSING`؛ retry فقط نوع‌های ناموفق/در انتظار را روی همان پروژه ادامه می‌دهد.
- Frontend در `js/modules/projects.js` با `renderReferenceCopyProgress(items)` وضعیت واقعی هر نوع را نمایش می‌دهد و درخواست‌ها را ترتیبی از مسیر `PMS.Api.post` می‌فرستد؛ `ReferenceCopyOperationID` در درخواست ایجاد پروژه از ثبت تکراری جلوگیری می‌کند.
- تمام endpointها tenant-scoped، permission-checked و idempotent باشند؛ خطا و امکان retry باید بدون ایجاد پروژه تکراری مدیریت شود.

## 📋 Macro-Task Queue & Implementation Log

- [x] **تسک ۱ — کشف وضعیت موجود و طراحی دامنه اصلاح**
  - *Log:* ابتدا `TODO4.md` قبلی خوانده شد؛ Task 2 قبلی هنوز منتظر تست کاربر بود. سپس `ARCHITECTURE.md`، `js/modules/workflows.js`، `js/modules/projects.js`، `pages/workflows.html` (ساختار در مرحله پیاده‌سازی تکمیل می‌شود)، `ProjectService.js`، `WorkflowService.js` و `Router.js` در شاخه مجاز بررسی شدند. مشخص شد فرم پروژه هنوز `ReferencePolicyJSON` را از کنترل‌های `[data-reference-override]` ارسال می‌کند و Backend آن را روی سیاست Workflow merge می‌کند؛ در نتیجه دو منبع تصمیم وجود دارد. Backend از قبل `WorkflowService.update` و `PUT /workflows/:id` را برای ذخیره سیاست پشتیبانی می‌کند، اما رابط ویرایش در صفحه Workflow باید به آن متصل شود. مسیر کپی در `ProjectService.create` یک درخواست هم‌زمان است و پاسخ معمول Apps Script امکان گزارش زنده میان مراحل را ندارد؛ بنابراین برای نمایش واقعی و جزءبه‌جزء باید قرارداد عملیات مرحله‌ای/وضعیت عملیات طراحی و با کنترل idempotency اجرا شود. هیچ کد اجرایی در این مرحله تغییر نکرده است.
- [ ] **تسک ۲ — تک‌منبعی‌کردن سیاست کپی و افزودن ویرایش Workflow (IN PROGRESS)**
  - حذف overrideهای سیاست از فرم پروژه و payload؛ enforce کردن سیاست Workflow در Backend؛ تکمیل ویرایش Workflowهای موجود با کنترل سیاست هر نوع اطلاعات؛ اعتبارسنجی Tenant/نوع اطلاعات و حفظ نسخه‌بندی/انتشار.
- [ ] **تسک ۳ — نمایش پیشرفت واقعی و جزئیات کپی پروژه تکراری**
  - طراحی و پیاده‌سازی عملیات قابل‌پیگیری و idempotent برای ایجاد/کپی؛ نمایش مرحله و نوع اطلاعات در حال پردازش و نتیجه هر مورد در فرم پروژه؛ مدیریت خطا و retry بدون رکورد تکراری.
- [ ] **تسک ۴ — آزمون یکپارچه، انتشار staging و تحویل**
  - تست Workflowهای موجود/جدید، تغییر سیاست، سیاست منتشرشده، INITIAL_COPY/LIVE_SYNC/INDEPENDENT، داده‌های چندردیفی، خطا/تلاش مجدد، عدم تغییر پروژه‌های قبلی؛ اجرای تست‌ها و انتشار هر دو مخزن فقط در staging.
