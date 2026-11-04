## 🎯 Current Objective

انتقال مستقل و امن تصاویر ثبت‌شده در اطلاعات مرکزی از پروژه مرجع به پروژه تکراری؛ با ایجاد فایل Drive و AttachmentID مستقل برای پروژه مقصد و حفظ مالکیت، ساختار داده و قابلیت retry.

## 🗺️ Technical Spec & Architecture Map (DO NOT DELETE)

### مخازن و شاخه فعال
- Frontend: `Saeidesl/PRSPRO2`، شاخه `main`.
- Backend: `Saeidesl/PRSPRO2BACKEND`، شاخه `main`.
- تغییرات این فاز فقط روی `main` انجام می‌شود.

### مسیر کپی پروژه و API موجود
- `ProjectService.js:create`: ایجاد پروژه تکراری، ساخت `ReferenceCopyStatusJSON` و `ReferenceCopyPlan` بر اساس سیاست Workflow.
- `ProjectService.js:create`: هر نوع دارای ستون تصویر را حتی در صورت وجود ستون فایل غیرتصویری در همان فرم با وضعیت `PENDING` قرار می‌دهد؛ فقط نوع‌های بدون تصویر و فایل‌محور `SKIPPED_FILE` می‌مانند. تصویر نمایه نیز با آیتم داخلی `__PROJECT_PROFILE_IMAGE__` وارد برنامه می‌شود.
- `ProjectService.js:copyReferenceInformationType`: آیتم ویژه `__PROJECT_PROFILE_IMAGE__` را نیز از همان endpoint پردازش می‌کند؛ آخرین تصویر نمایه فعال پروژه مرجع به‌صورت مستقل کپی می‌شود.
- `ProjectService.js:_copyReferenceImageValue_` و `_copyReferenceInformationImages_`: کپی تصویرهای تکی و چندردیفی و جایگزینی AttachmentID با شناسه جدید مقصد؛ ستون‌های فایل غیرتصویری در فرم‌های ترکیبی بدون تغییر باقی می‌مانند.
- `ProjectService.js:copyReferenceInformationType`: وضعیت قدیمی `SKIPPED_FILE` را برای نوع‌های دارای ستون تصویر قابل پردازش مجدد می‌کند؛ نوع‌های صرفاً فایل همچنان رد می‌شوند.
- `ProjectService.js:copyReferenceInformationType(projectId, typeId, params)`: کپی مقدار مرکزی، تاریخچه و SyncLog؛ کپی تصویر در همان جریان و با حفظ سیاست Workflow.
- `Router.js`: مسیر موجود `POST /projects/:projectId/reference-copy/:typeId` به متد بالا متصل است و کنترل دسترسی `PROJECT_EDIT` یا fallback مجاز `PROJECT_CREATE` را اعمال می‌کند.
- `js/modules/projects.js` در Frontend، برنامه کپی را اجرا و وضعیت را نمایش می‌دهد؛ API جدید یا مسیر موازی لازم نیست.

### مدل اطلاعات و پیوست
- اطلاعات مرکزی: `28_InformationTypes`, `29_InformationTypeColumns`, `30_ProjectInformation.ValueJSON`, `31_ProjectInformationHistory`.
- `ProjectInformationService.js:_isFileBased_(typeId, type)`: تشخیص نوع‌های دارای `image/file`.
- `ProjectInformationService.js:_scalar(value, dataType, ...)`: اعتبارسنجی reference شامل `AttachmentID`, `FileName`, `MimeType`, `FileSize`, `AttachmentType` و کنترل تعلق به همان پروژه و tenant.
- `AttachmentService.js:upload(data, params)`: الگوی فعلی ایجاد فایل در Drive و metadata در شیت پیوست‌ها.
- `AttachmentRepository.js`: شیت `15_Attachments` و متدهای `findById`, `insert`, `update`.
- `StorageRepository.js`: دسترسی به storage provider.
- `GoogleDriveStorage.js:copyFile(storageKey, fileName)`: کپی native فایل Drive با `File.makeCopy`؛ فایل جدید در پوشه اصلی ذخیره می‌شود.
- `StorageRepository.js:copyFile(storageKey, fileName)`: دسترسی یکپارچه به کپی فایل.
- `AttachmentService.js:copyProjectImage(sourceAttachmentId, targetProjectId, user)`: کنترل tenant و دسترسی به هر دو پروژه، بررسی نوع تصویر، جلوگیری از کپی تکراری با `SourceAttachmentID`، ایجاد metadata مستقل مقصد و ثبت Audit.
- `DatabaseSetup.js:APP_CONFIG.SHEETS.ATTACHMENTS`: ستون افزایشی `SourceAttachmentID` برای نگاشت امن و idempotent فایل مبدأ/مقصد؛ در اجرای عادی نیز `GoogleSheetsRepository.ensureColumn` پیش از ثبت کپی آن را اضافه می‌کند.

### قرارداد فنی و ایمنی
- فایل تصویر کپی‌شده باید فایل مستقل Drive باشد و AttachmentID جدید بگیرد؛ attachment منبع نباید در مقصد reuse شود.
- metadata پیوست مقصد: همان TenantID، `EntityType=PROJECT`، `EntityID=ProjectID مقصد`، AttachmentType مناسب، وضعیت ACTIVE، نام و MIME معتبر، UploadedBy کاربر جاری.
- فقط فیلدهای تصویری `image` در اطلاعات مرکزی و تصویر نمایه پروژه در محدوده‌اند؛ اسناد غیرتصویری خارج از تغییر باقی بمانند.
- بازنویسی reference باید ساختار SINGLE/MULTIPLE و ردیف‌های چندستونی را حفظ کند.
- کپی باید idempotent و retry-safe باشد؛ ستون `SourceAttachmentID` در شیت `15_Attachments` نگاشت فایل مبدأ به مقصد را نگه می‌دارد تا retry همان فایل مقصد را بازیابی کند. شکست میانی نباید reference خراب یا پیوست تکراری باقی بگذارد.
- tenant isolation، کنترل دسترسی پروژه، Audit، سیاست‌های Workflow و مسیر فعلی API حفظ شوند.

## 📋 Macro-Task Queue & Implementation Log

- [x] **تسک ۱ — کشف علت و معماری انتقال تصویر**
  - *Log:* فایل‌های `ProjectService.js`, `ProjectInformationService.js`, `AttachmentService.js`, `AttachmentRepository.js`, `StorageRepository.js`, `GoogleDriveStorage.js` و `Router.js` بررسی شدند. علت قطعی عدم انتقال، شرط `ProjectInformationService._isFileBased_` در `ProjectService.copyReferenceInformationType` است که نوع‌های دارای image/file را `SKIPPED_FILE` می‌کند. داده مرکزی AttachmentID را ذخیره می‌کند؛ metadata در `15_Attachments` و فایل در Google Drive است. تصمیم معماری: کپی server-side فایل تصویر و ایجاد metadata/شناسه مستقل برای پروژه مقصد در همان جریان کپی فعلی.
- [ ] **تسک ۲ — پیاده‌سازی کپی امن تصویر در Backend (IN PROGRESS)**
  - افزودن قابلیت کپی native فایل Drive، ساخت Attachment مقصد با کنترل مالکیت/tenant، بازنویسی AttachmentID در ValueJSON و ثبت وضعیت idempotent؛ پشتیبانی از تصویر نمایه و مقادیر چندردیفی.
- [ ] **تسک ۳ — آزمون و انتشار بین‌مخزنی**
  - تست تصویر تکی/چندردیفی، فایل مستقل، retry، عدم تغییر فایل‌های غیرتصویری، tenant isolation و کنترل مجوز؛ اجرای تست‌ها و CI و هماهنگی نمایش پیشرفت در Frontend.
