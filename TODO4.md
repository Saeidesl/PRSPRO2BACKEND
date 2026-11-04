## 🎯 Current Objective

انتقال مستقل و امن تصاویر ثبت‌شده در اطلاعات مرکزی از پروژه مرجع به پروژه تکراری؛ با ایجاد فایل Drive و AttachmentID مستقل برای پروژه مقصد و حفظ مالکیت، ساختار داده و قابلیت retry.

## 🗺️ Technical Spec & Architecture Map (DO NOT DELETE)

### مخازن و شاخه فعال
- Frontend: `Saeidesl/PRSPRO2`، شاخه `main`.
- Backend: `Saeidesl/PRSPRO2BACKEND`، شاخه `main`.
- تغییرات این فاز فقط روی `main` انجام می‌شود.

### مسیر کپی پروژه و API موجود
- `ProjectService.js:create`: ایجاد پروژه تکراری، ساخت `ReferenceCopyStatusJSON` و `ReferenceCopyPlan` بر اساس سیاست Workflow.
- `ProjectService.js:copyReferenceInformationType(projectId, typeId, params)`: کپی هر نوع اطلاعات مرکزی و ثبت تاریخچه/SyncLog؛ اکنون انواع فایل/تصویر را به `SKIPPED_FILE` می‌برد.
- `Router.js`: مسیر موجود `POST /projects/:projectId/reference-copy/:typeId` به متد بالا متصل است و کنترل دسترسی `PROJECT_EDIT` یا fallback مجاز `PROJECT_CREATE` را اعمال می‌کند.
- `js/modules/projects.js` در Frontend، برنامه کپی را اجرا و وضعیت را نمایش می‌دهد؛ API جدید یا مسیر موازی لازم نیست.

### مدل اطلاعات و پیوست
- اطلاعات مرکزی: `28_InformationTypes`, `29_InformationTypeColumns`, `30_ProjectInformation.ValueJSON`, `31_ProjectInformationHistory`.
- `ProjectInformationService.js:_isFileBased_(typeId, type)`: تشخیص نوع‌های دارای `image/file`.
- `ProjectInformationService.js:_scalar(value, dataType, ...)`: اعتبارسنجی reference شامل `AttachmentID`, `FileName`, `MimeType`, `FileSize`, `AttachmentType` و کنترل تعلق به همان پروژه و tenant.
- `AttachmentService.js:upload(data, params)`: الگوی فعلی ایجاد فایل در Drive و metadata در شیت پیوست‌ها.
- `AttachmentRepository.js`: شیت `15_Attachments` و متدهای `findById`, `insert`, `update`.
- `StorageRepository.js`: دسترسی به storage provider.
- `GoogleDriveStorage.js:getFile(storageKey)`: دریافت فایل Drive؛ `uploadBase64(data)`: ساخت فایل جدید. برای انتقال باید از کپی native سمت سرور استفاده شود تا فایل از مرورگر عبور نکند.

### قرارداد فنی و ایمنی
- فایل تصویر کپی‌شده باید فایل مستقل Drive باشد و AttachmentID جدید بگیرد؛ attachment منبع نباید در مقصد reuse شود.
- metadata پیوست مقصد: همان TenantID، `EntityType=PROJECT`، `EntityID=ProjectID مقصد`، AttachmentType مناسب، وضعیت ACTIVE، نام و MIME معتبر، UploadedBy کاربر جاری.
- فقط فیلدهای تصویری `image` در اطلاعات مرکزی و تصویر نمایه پروژه در محدوده‌اند؛ اسناد غیرتصویری خارج از تغییر باقی بمانند.
- بازنویسی reference باید ساختار SINGLE/MULTIPLE و ردیف‌های چندستونی را حفظ کند.
- کپی باید idempotent و retry-safe باشد؛ شکست میانی نباید reference خراب یا پیوست تکراری باقی بگذارد.
- tenant isolation، کنترل دسترسی پروژه، Audit، سیاست‌های Workflow و مسیر فعلی API حفظ شوند.

## 📋 Macro-Task Queue & Implementation Log

- [x] **تسک ۱ — کشف علت و معماری انتقال تصویر**
  - *Log:* فایل‌های `ProjectService.js`, `ProjectInformationService.js`, `AttachmentService.js`, `AttachmentRepository.js`, `StorageRepository.js`, `GoogleDriveStorage.js` و `Router.js` بررسی شدند. علت قطعی عدم انتقال، شرط `ProjectInformationService._isFileBased_` در `ProjectService.copyReferenceInformationType` است که نوع‌های دارای image/file را `SKIPPED_FILE` می‌کند. داده مرکزی AttachmentID را ذخیره می‌کند؛ metadata در `15_Attachments` و فایل در Google Drive است. تصمیم معماری: کپی server-side فایل تصویر و ایجاد metadata/شناسه مستقل برای پروژه مقصد در همان جریان کپی فعلی.
- [ ] **تسک ۲ — پیاده‌سازی کپی امن تصویر در Backend (IN PROGRESS)**
  - افزودن قابلیت کپی native فایل Drive، ساخت Attachment مقصد با کنترل مالکیت/tenant، بازنویسی AttachmentID در ValueJSON و ثبت وضعیت idempotent؛ پشتیبانی از تصویر نمایه و مقادیر چندردیفی.
- [ ] **تسک ۳ — آزمون و انتشار بین‌مخزنی**
  - تست تصویر تکی/چندردیفی، فایل مستقل، retry، عدم تغییر فایل‌های غیرتصویری، tenant isolation و کنترل مجوز؛ اجرای تست‌ها و CI و هماهنگی نمایش پیشرفت در Frontend.
