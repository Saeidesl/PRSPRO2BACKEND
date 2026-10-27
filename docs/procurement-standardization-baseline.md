# خط مبنای قراردادهای تأمین ملزومات

تاریخ: 2026-10-27  
ریپوزیتوری بک‌اند: `Saeidesl/PRSPRO2BACKEND`  
ریپوزیتوری فرانت‌اند: `Saeidesl/PRSPRO2`

این مستند نتیجه بررسی سورس و اجرای CI در تسک ۲ است. این قراردادها از کد فعلی استخراج شده‌اند؛ اجرای CI به معنی آزمون اتصال زنده به Google Sheets یا انتشار Apps Script نیست.

## 1. APIهای فعلی تأمین

پاسخ سرویس‌ها عموماً در wrapper شامل `success` و `data` قرار می‌گیرد؛ بعضی ماژول‌های فرانت‌اند `data` را unwrap می‌کنند.

| متد | مسیر | سرویس | مجوز Router |
|---|---|---|---|
| GET | `/procurement/workspace` | `ProcurementService.workspace(params)` | `PROCUREMENT_VIEW` یا `PROCUREMENT_MANAGE` |
| GET | `/procurement/dashboard` | `ProcurementService.dashboard(params)` | `PROCUREMENT_VIEW` یا `PROCUREMENT_MANAGE` |
| GET | `/procurement/needs` | `ProcurementService.listNeeds(params)` | `PROCUREMENT_VIEW` یا `PROCUREMENT_MANAGE` |
| GET | `/procurement/orders` | `ProcurementService.listOrders(params)` | `PROCUREMENT_VIEW` یا `PROCUREMENT_MANAGE` |
| GET | `/procurement/reports` | `ProcurementService.reports(params)` | `REPORT_VIEW` یا مجوز مشاهده/مدیریت تأمین |
| POST | `/procurement/orders` | `ProcurementService.createOrder(body, params)` | `PROCUREMENT_MANAGE` |
| POST | `/procurement/receipts` | `ProcurementService.createReceipt(body, params)` | `PROCUREMENT_MANAGE` |
| POST | `/procurement/receipts/batch` | `ProcurementService.createReceiptsBatch(body, params)` | `PROCUREMENT_MANAGE` |
| POST | `/events/:eventId/procurement-retry` | `EventService.retryProcurementIntegration(eventId, params)` | `EVENT_EDIT` در Router و کنترل تکمیلی در سرویس |

### شکل داده اصلی

- `workspace`: `{ summary, needs, orders }` در `data`؛ مسیر تجمیعی برای یک round-trip فرانت‌اند.
- `needs`: لیست نیازها به‌همراه مقادیر محاسبه‌شده `OrderedQuantity`, `ReceivedQuantity`, `RemainingToOrderQuantity`, `RemainingDeliveryQuantity`, `OverOrderedQuantity`, `ProcurementStatus`.
- `orders`: سفارش‌ها با `Items`؛ هر قلم شامل تخصیص‌ها، دریافت‌ها، `ReceivedQuantity` و `RemainingQuantity` است.
- سفارش تکی: `POST /procurement/orders` با `{ SupplierName, OrderDate, ExpectedDeliveryDate, Notes, IdempotencyKey, ProjectID?, Items: [{ MaterialNeedID?, ItemName, Unit, OrderedQuantity, UnitPrice?, Notes?, ProjectID?, Allocations? }] }`.
- دریافت تکی: `POST /procurement/receipts` با `{ PurchaseOrderItemID, ProjectID?, QuantityReceived, ReceivedAt?, WarehouseDepartmentID?, SourceEventID?, Notes?, IdempotencyKey }`.
- دریافت گروهی: `POST /procurement/receipts/batch` با `{ Receipts: [{ PurchaseOrderItemID, ProjectID?, QuantityReceived, ReceivedAt?, WarehouseDepartmentID?, SourceEventID?, Notes?, IdempotencyKey }] }`. فرانت‌اند کلید تکرار مستقل برای هر قلم می‌سازد.
- سفارش عمومی می‌تواند بدون `ProjectID` باشد. سفارش پروژه‌ای/قلم تخصیص‌یافته باید با پروژه و نیاز مرتبط تطابق داشته باشد.

## 2. APIهای مشخصات مصرف و محاسبات

- `GET /projects/:projectId/material-specifications` → `MaterialPlanningService.listSpecifications`
- `POST /projects/:projectId/material-specifications` → `MaterialPlanningService.createSpecification`; دسترسی `PROJECT_EDIT` یا استثنای محدود سازگار با `PROJECT_CREATE` برای سازنده مجاز پروژه.
- `PUT /material-specifications/:specId` → `MaterialPlanningService.reviseSpecification`; تغییر مشخصات نسخه جدید ایجاد می‌کند و نسخه قبلی superseded می‌شود.
- `GET /projects/:projectId/material-calculations` → `MaterialPlanningService.listCalculationHistory`.
- محاسبه نیاز از مسیر اتصال رویداد در `ProcurementEventIntegrationService` به `MaterialPlanningService.recalculateProjectNeeds` می‌رسد.

## 3. قواعد محاسبات فعلی

### مقدار نیاز قطعی

فرمول در `MaterialPlanningService.recordCalculation`:

`CalculatedQuantity = ceil(BasisQuantity × ConsumptionPerUnit × (1 + WastagePercent / 100) × 10000) / 10000`

یعنی مقدار تا چهار رقم اعشار به سمت بالا گرد می‌شود. مقادیر پایه، مصرف هر واحد و درصد پرت اعتبارسنجی می‌شوند؛ درصد پرت در بازه صفر تا ۱۰۰ است. اگر `CalculatedQuantityOverride` معتبر ارسال شود، همان مقدار به‌جای فرمول ذخیره می‌شود.

### سابقه و تکرار امن محاسبه

- `CalculationKey` برای tenant جاری الزامی و حداکثر ۲۴۰ کاراکتر است.
- وجود کلید یکسان در همان tenant باعث بازگرداندن سابقه قبلی با `IdempotentReplay: true` می‌شود.
- کلید تولید خودکار در محاسبه پروژه ترکیبی از `TenantID | ProjectID | SourceEventID | SpecKey | Revision | Quantity` است.
- سابقه محاسبات در `25_MaterialNeedCalculations` نگهداری می‌شود؛ تغییر نیاز، رکورد محاسبه قبلی را حذف نمی‌کند.
- نیازهای تخمینی با ثبت نیاز قطعی مرتبط superseded می‌شوند. نسخه قبلی مشخصات و نیاز قطعی متناظر نیز برای حفظ تاریخچه نگهداری می‌شود.
- ابطال رویداد، محاسبات مرتبط را `SOURCE_EVENT_VOIDED` و نیاز قطعی فعال مرتبط را `NEEDS_REVIEW` می‌کند؛ سابقه حذف نمی‌شود.

### سفارش، تخصیص، مازاد و مانده

- مقدار سفارش باید مثبت باشد؛ نام قلم و واحد اجباری است. قیمت واحد، اگر ارسال شود، باید عددی معتبر و غیرمنفی باشد.
- سفارش از نیاز: مقدار قابل تخصیص برابر است با حداقلِ مقدار سفارش و نیاز باقیمانده پس از تخصیص‌های قبلی. اضافه بر آن در `SurplusQuantity` ثبت می‌شود.
- مجموع تخصیص‌های هر قلم سفارش نباید از مقدار همان قلم بیشتر شود.
- سفارش بدون نیاز در سفارش پروژه‌ای به‌عنوان خرید برنامه‌ریزی‌نشده/مازاد ثبت می‌شود؛ نیاز ذخیره‌شده را خودکار تغییر نمی‌دهد.
- `OrderedQuantity` روی نیاز، با سقف مقدار درخواستی نمایش داده می‌شود؛ `OverOrderedQuantity` مقدار خام سفارش/تخصیص مازاد را نشان می‌دهد.
- `RemainingToOrderQuantity = max(0, RequestedQuantity - max(OrderedQuantity, ReceivedQuantity))`.
- `RemainingDeliveryQuantity = max(0, OrderedQuantity - ReceivedQuantity)`.
- وضعیت نمایشی نیاز بر مبنای نیاز بازبینی، دریافت، سفارش کامل/جزئی و عدم سفارش تعیین می‌شود؛ status خام نیاز با `ProcurementStatus` یکی نیست.

### دریافت

- مقدار دریافت باید مثبت باشد و مجموع دریافت‌های قبلی + دریافت جدید از مقدار سفارش‌شده بیشتر نشود.
- برای قلم دارای تخصیص پروژه‌ای، دریافت باید به پروژه تخصیص‌یافته و سهم تخصیص آن محدود بماند.
- دریافت گروهی همه ردیف‌ها را پیش از نوشتن اعتبارسنجی می‌کند و سپس رکوردهای دریافت را با `insertMany` درج می‌کند.
- پس از دریافت، وضعیت سفارش به `ACTIVE`, `PARTIALLY_RECEIVED` یا `RECEIVED` به‌روزرسانی می‌شود؛ سفارش `NEEDS_REVIEW` در این مرحله خودکار بازنویسی نمی‌شود.
- Google Sheets تراکنش چندشیتی واقعی ندارد. سفارش ابتدا ایجاد می‌شود و اگر نوشتن اقلام/تخصیص‌ها شکست بخورد، سفارش `NEEDS_REVIEW` می‌شود تا سابقه نیمه‌کاره حفظ شود. بازیابی خودکار کامل هنوز باید در تسک‌های بعدی تعریف و آزموده شود.

## 4. امنیت و مرزهای داده

- سرویس‌ها رکوردها را با `TenantID` جاری فیلتر می‌کنند و برای داده پروژه‌ای، قابل‌مشاهده بودن پروژه را نیز بررسی می‌کنند.
- دریافت به قلم و سفارش متعلق به همان tenant وابسته است؛ نیاز و پروژه‌ای که به tenant دیگر تعلق دارند باید رد شوند.
- کنترل UI فقط برای تجربه کاربری است؛ مجوز نهایی در Router و سرویس بک‌اند اعمال می‌شود.
- هر تغییری در قرارداد باید آزمون‌های tenant isolation، permission، idempotency و دریافت جزئی را حفظ کند.

## 5. خط مبنای آزمون CI

- workflow: `Backend source checks`, اجرای `node --test tests/*.test.js`.
- نتیجه اجرا روی commit `5b70cddbc1e3e5d59fb35e03184149c81fe99ae9`: **۶۵ آزمون موفق، ۰ ناموفق**.
- بررسی manifest، syntax فایل‌های منبع و کنترل نام‌های تکراری Apps Script نیز موفق شد.
- workflow `PMS agent suite`: بررسی قرارداد دامنه، آزمون‌های backend، اعتبارسنجی manifest/syntax و کنترل حفاظ انتشار موفق شد.
- اجرای اولیه تست جدید یک شکست در assertion ایستای مسیر مشخصات مصرف داشت؛ assertion بیش از حد به فاصله خطوط حساس بود. پس از اصلاح تست، اجرای مجدد کامل سبز شد.
- این نتیجه CI است؛ تست زنده Google Sheets، مرورگر واقعی، داده production یا deploy اجرا نشده است.
- این baseline روی شاخه feature و با PR اجرا شده است. ادغام به `main` در بک‌اند می‌تواند workflow همگام‌سازی/انتشار Apps Script را فعال کند و بدون بررسی جداگانه نباید انجام شود.
