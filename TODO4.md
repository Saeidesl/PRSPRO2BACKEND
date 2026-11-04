## 🎯 Current Objective

افزودن بخش مستقل «اطلاعات مرکزی پروژه» به صفحه جزئیات پروژه تا مقادیر جاری کپی‌شده از پروژه مرجع و سایر اطلاعات مرکزی در UI نمایش داده شوند؛ پاسخ فرم‌های رویدادمحور همچنان در بخش جداگانه خود باقی بماند.

## 🗺️ Technical Spec & Architecture Map (DO NOT DELETE)

### مخازن و شاخه فعال
- Frontend: `Saeidesl/PRSPRO2`، شاخه `main`.
- Backend: `Saeidesl/PRSPRO2BACKEND`، شاخه `main`.

### مدل داده و APIهای موجود
- انواع اطلاعات: `28_InformationTypes` و `29_InformationTypeColumns`.
- مقادیر جاری: `30_ProjectInformation.ValueJSON`.
- تاریخچه: `31_ProjectInformationHistory`.
- `ProjectInformationService.js:list(projectId, params)` انواع اطلاعات فعال Tenant را با مقدار جاری، تعریف و ستون‌ها برمی‌گرداند.
- `Router.js`: مسیر موجود `GET /projects/:projectId/information` با مجوز `PROJECT_VIEW` به سرویس فوق متصل است.
- مسیرهای موجود جزئیات، ذخیره، تاریخچه و حذف منطقی اطلاعات حفظ شوند؛ API موازی ایجاد نشود.

### Frontend و علت کشف‌شده
- `pages/project-detail.html`: کارت `project-forms-list` فقط پاسخ فرم‌های رویدادمحور را نمایش می‌دهد؛ container اطلاعات مرکزی وجود ندارد.
- `js/modules/project-detail.js`: توابع `loadProjectInformation`, `renderProjectInformation`, `openProjectInformationForm`, `openProjectInformationHistory` موجودند؛ اما container حذف شده و `loadProjectInformation` در چرخه بارگذاری صفحه فراخوانی نمی‌شود.
- `tests/project-information-dossier.test.js`: تست قدیمی نبود `project-information-list` را الزام می‌کند و باید اصلاح شود.
- بخش اطلاعات مرکزی باید جدا از فرم‌های ثبت‌شده نمایش داده شود و scalar، جدول‌های چندردیفی، پیوست، ویرایش و تاریخچه را حفظ کند.
- `index.html`: cache-busting ماژول جزئیات پروژه پس از تغییر به‌روز شود.

## 📋 Macro-Task Queue & Implementation Log

- [x] **تسک ۱ — کشف علت و معماری اتصال**
  - *Log:* بررسی `TODO4.md`، `ARCHITECTURE.md`، `ProjectInformationService.js`، `Router.js`، `pages/project-detail.html` و `js/modules/project-detail.js` نشان داد API سمت سرور آماده است؛ پنل اطلاعات مرکزی از HTML حذف شده و بارگذاری آن نیز از چرخه صفحه قطع شده است. تست فعلی حذف پنل را تثبیت کرده و باید به قرارداد جدید تغییر کند.
- [ ] **تسک ۲ — ساخت و اتصال پنل مستقل اطلاعات مرکزی (IN PROGRESS)**
  - افزودن کارت مستقل، اتصال بارگذاری/تازه‌سازی/خطا/حالت خالی و حفظ نمایش داده‌های جاری، چندردیفی، پیوست، ویرایش و تاریخچه.
- [ ] **تسک ۳ — آزمون و تثبیت رابط**
  - اصلاح تست‌های قدیمی و افزودن پوشش تفکیک اطلاعات مرکزی از فرم‌های رویدادی، داده کپی‌شده، ریسپانسیو و cache-busting.
- [ ] **تسک ۴ — اعتبارسنجی و انتشار**
  - اجرای تست‌های Frontend و QA بین‌مخزنی، بررسی CI و انتشار روی main؛ تحویل برای تست کاربر.
