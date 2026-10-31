# معماری بک‌اند PMS

> مرجع پایدار معماری مخزن `Saeidesl/PRSPRO2BACKEND` در شاخه `main`. جزئیات تاریخی و تصمیم‌های قبلی در `ARCHITECTURE2.md` نگهداری شده‌اند؛ این سند مسیرهای عملیاتی جاری و قابلیت‌های جدید را خلاصه می‌کند.

## پشته و اصول

- Google Apps Script با Runtime V8 و Google Sheets به‌عنوان پایگاه داده عملیاتی.
- مسیریابی همه درخواست‌ها از `Router.js`؛ اعتبارسنجی و مجوزها در سمت سرور مرجع نهایی‌اند.
- دسترسی داده‌ها tenant-scoped است و شناسه‌های داخلی پایدار مبنای ارتباط رکوردها هستند.
- فایل‌های حجیم در Google Drive ذخیره می‌شوند؛ Google Sheets فقط metadata و شناسه ذخیره‌سازی را نگه می‌دارد.

## اطلاعات پویا و فرم‌ها

- `InformationTypeValidator.js`: allow-list نوع داده مرکزی شامل `text`, `textarea`, `number`, `date`, `datetime`, `boolean`, `select`, `image`, `file`؛ تعدادپذیری `SINGLE` یا `MULTIPLE` مستقل از نوع داده و ستون‌هاست.
- `InformationTypeService.js` و `InformationTypeRepository.js`: مدیریت تعریف مرکزی اطلاعات و ستون‌ها.
- `ProjectInformationService.js`: اعتبارسنجی و ذخیره مقادیر پروژه در `30_ProjectInformation.ValueJSON` و تاریخچه در `31_ProjectInformationHistory`.
- `FormService.js`: فرم‌های قابل استفاده مجدد، snapshot نسخه فرم و اعتبارسنجی پاسخ رویداد؛ `prepareEventResponses(eventTypeId, responses, tenantId, projectId)` زمینه پروژه را برای اعتبارسنجی پیوست‌های فرم دریافت می‌کند.
- `EventService.js`: ثبت رویداد در مسیر اصلی `POST /events`؛ پاسخ فرم قبل از ذخیره رویداد اعتبارسنجی می‌شود.

## پیوست‌ها و فایل‌های اطلاعاتی

- `AttachmentValidator.js`: allow-list MIME/پسوند برای JPEG/PNG/WebP/GIF، PDF، Word و Excel و بررسی حجم واقعی پس از decode؛ سقف سرور از `AppConfig.gs.js → FILES.MAX_SIZE_MB` (۱۰ مگابایت) خوانده می‌شود.
- `AttachmentService.js`: مجوز و مالکیت tenant/entity را بررسی می‌کند، فایل را از طریق `StorageRepository.js` به `GoogleDriveStorage.js` می‌فرستد و metadata را در شیت `15_Attachments` ثبت می‌کند.
- برای مقادیر اطلاعات پویا، `AttachmentType=INFORMATION` استفاده می‌شود. مقدار ذخیره‌شده فقط reference امن شامل `AttachmentID`, `FileName`, `MimeType`, `FileSize` است؛ backend metadata را از رکورد پیوست بازیابی می‌کند و ورودی کلاینت را مرجع نمی‌داند.
- `_scalar` و `_validate` در `ProjectInformationService.js` پیوست را با `TenantID`, `EntityType=PROJECT`, `EntityID`, `AttachmentType=INFORMATION`, وضعیت فعال و MIME مجاز تطبیق می‌دهند. برای نوع `image` فقط MIME تصویری پذیرفته می‌شود.
- APIهای موجود: `POST /projects/:projectId/attachments`, `GET /projects/:projectId/attachments`, `GET /attachments/:attachmentId/download`, `DELETE /attachments/:attachmentId`. مجوزهای `ATTACHMENT_UPLOAD` و `ATTACHMENT_VIEW` و دسترسی پروژه اعمال می‌شوند.
- فرم رویداد پروژه فایل را پیش از ایجاد رویداد به همان پروژه پیوست می‌کند؛ پاسخ فرم reference پیوست را ذخیره می‌کند. رویداد مستقل نمی‌تواند مقدار فایل/تصویر پروژه را ثبت کند.

## آزمون و استقرار

- آزمون‌های Node در `tests/*.test.js` با `node --test tests/*.test.js` اجرا می‌شوند.
- `backend-check.yml` آزمون‌ها و syntax همه فایل‌های JS را بررسی می‌کند.
- `sync-apps-script.yml` تغییرات بک‌اند را به Apps Script همگام و Web App را منتشر می‌کند؛ وضعیت workflow باید قبل از اعلام آماده‌بودن بررسی شود.

## مسیرهای کلیدی

- `Router.js`: API و کنترل مجوز.
- `ProjectInformationService.js`, `InformationTypeValidator.js`: اطلاعات پویا و اعتبارسنجی.
- `FormService.js`, `EventService.js`: پاسخ فرم و ثبت رویداد.
- `AttachmentService.js`, `AttachmentValidator.js`, `StorageRepository.js`, `GoogleDriveStorage.js`: ذخیره امن فایل.
- `DatabaseSetup.js`: شیت‌ها و سرستون‌ها.

## 2026-10-31 — چرخه عمر پیش‌نویس پروژه و همگام‌سازی پاسخ فرم

- `08_Projects.RecordState`: وضعیت چرخه عمر را مستقل از `Status` تجاری/قابل تنظیم کارخانه نگه می‌دارد؛ `DRAFT` برای ایجاد اولیه و `ACTIVE` برای پروژه تکمیل‌شده است. رکوردهای قدیمی بدون مقدار این ستون فعال تلقی می‌شوند.
- `POST /projects` همان مسیر ایجاد است و با `RecordState=DRAFT` فقط عنوان را می‌پذیرد؛ کد، گردش‌کار، مرحله، واحدها و کاربران تا زمان تکمیل خالی می‌مانند. payload کامل قبلی بدون تغییر رفتار، پروژه فعال می‌سازد.
- `PUT /projects/:id` همان مسیر تکمیل است؛ فقط پیش‌نویس می‌تواند یک‌بار به فعال تبدیل شود. هنگام تکمیل، یکتایی کد، گردش‌کار فعال و مرحله اول، واحدهای مجاز و سایر قواعد فعلی اعتبارسنجی می‌شوند؛ کد و گردش‌کار بعد از فعال‌شدن ثابت‌اند.
- `Router.js` برای کاربر دارای `PROJECT_CREATE`، فهرست را فقط به پیش‌نویس‌های ساخته‌شده توسط خودش محدود می‌کند و دریافت/تکمیل همان پیش‌نویس را مجاز می‌سازد. ثبت رویداد برای پیش‌نویس در `EventService.js` رد می‌شود.
- `FormService.saveEventResponses(event, responses, user, params)` snapshot پاسخ را در `34_EventFormData` حفظ می‌کند و مقدارهای غیرخالی فرم را با `SourceEventID` به `ProjectInformationService.save` می‌فرستد؛ مقدارهای خالی ناخواسته مقدار قبلی را پاک نمی‌کنند.
- `ProjectInformationService.save` ثبت دوباره همان مقدار با همان `SourceEventID` را idempotent می‌کند تا در retry، revision تکراری ایجاد نشود. مقدار جاری در `30_ProjectInformation` و تاریخچه تغییر در `31_ProjectInformationHistory` باقی می‌ماند.
- تست‌های رگرسیون در `tests/project-draft-information-flow.test.js` و به‌روزرسانی قرارداد `tests/forms-api-contract.test.js` اضافه شده‌اند. تغییرات در PR #78 نگهداری می‌شوند؛ تا زمان تأیید و انتشار staging، روی Apps Script تولید deploy نمی‌شوند.

