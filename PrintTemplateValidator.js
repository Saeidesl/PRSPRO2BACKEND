/**
 * Validation for reusable print-template definitions.
 * Definitions are JSON-only, bounded to a single Sheets cell, and use stable source IDs.
 */
const PrintTemplateValidator = {
  parseDefinition: function(value) {
    if (value === undefined || value === null || value === '') {
      return { schemaVersion: 1, page: { size: 'A4', orientation: 'portrait' }, elements: [], bindings: [] };
    }
    let definition = value;
    if (typeof value === 'string') {
      try { definition = JSON.parse(value); }
      catch (error) { throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار قالب معتبر نیست.'); }
    }
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار قالب باید یک شیء معتبر باشد.');
    }
    if (definition.schemaVersion !== undefined && Number(definition.schemaVersion) !== 1) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نسخه ساختار قالب پشتیبانی نمی‌شود.');
    }
    if (definition.elements !== undefined && !Array.isArray(definition.elements)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست المان‌های قالب معتبر نیست.');
    }
    if (definition.bindings !== undefined && !Array.isArray(definition.bindings)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست منابع داده قالب معتبر نیست.');
    }
    const normalized = Object.assign({
      schemaVersion: 1,
      page: { size: 'A4', orientation: 'portrait' },
      elements: [],
      bindings: []
    }, definition);
    normalized.page = Object.assign({ size: 'A4', orientation: 'portrait' }, normalized.page || {});
    if (!['A4','A5','LETTER','CUSTOM'].includes(String(normalized.page.size || 'A4').toUpperCase())) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'اندازه صفحه قالب معتبر نیست.');
    }
    if (!['portrait','landscape'].includes(String(normalized.page.orientation || 'portrait').toLowerCase())) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'جهت صفحه قالب معتبر نیست.');
    }
    const seen = Object.create(null);
    normalized.bindings.forEach(function(binding, index) {
      if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'منبع داده شماره ' + (index + 1) + ' معتبر نیست.');
      }
      const id = String(binding.id || '').trim();
      const sourceType = String(binding.sourceType || '').trim().toUpperCase();
      if (!id || id.length > 100 || seen[id]) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه منبع داده خالی یا تکراری است.');
      }
      if (['PROJECT_FIELD','PROJECT_INFORMATION','EVENT_FORM_FIELD','EVENT_FORM_RESPONSE'].indexOf(sourceType) === -1) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نوع منبع داده پشتیبانی نمی‌شود.');
      }
      if (sourceType === 'PROJECT_FIELD' && !String(binding.field || '').trim()) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فیلد پروژه برای منبع داده الزامی است.');
      }
      if (sourceType === 'PROJECT_INFORMATION' && !String(binding.informationTypeId || '').trim()) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه اطلاعات مرکزی الزامی است.');
      }
      if ((sourceType === 'EVENT_FORM_FIELD' || sourceType === 'EVENT_FORM_RESPONSE') &&
          !String(binding.formId || '').trim()) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه فرم برای منبع رویداد الزامی است.');
      }
      if (sourceType === 'EVENT_FORM_FIELD' &&
          !String(binding.fieldId || binding.informationTypeId || '').trim()) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه فیلد فرم برای منبع داده الزامی است.');
      }
      if (sourceType === 'EVENT_FORM_FIELD' || sourceType === 'EVENT_FORM_RESPONSE') {
        const selection = String(binding.selection || 'LATEST').toUpperCase();
        if (['LATEST','ALL','EVENT','RESPONSE'].indexOf(selection) === -1) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'روش انتخاب پاسخ فرم معتبر نیست.');
        }
        if (selection === 'EVENT' && !String(binding.eventId || '').trim()) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه رویداد برای انتخاب پاسخ الزامی است.');
        }
        if (selection === 'RESPONSE' && !String(binding.responseId || '').trim()) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'شناسه پاسخ فرم برای انتخاب پاسخ الزامی است.');
        }
        binding.selection = selection;
      }
      seen[id] = true;
      binding.id = id;
      binding.sourceType = sourceType;
    });
    let serialized;
    try { serialized = JSON.stringify(normalized); }
    catch (error) { throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار قالب قابل ذخیره نیست.'); }
    if (serialized.length > 45000) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حجم تعریف قالب بیش از ظرفیت مجاز است.');
    }
    return normalized;
  },

  validateMetadata: function(data, isUpdate) {
    data = data || {};
    if (!isUpdate || data.Code !== undefined) {
      Validator.required(data.Code, 'کد قالب');
      const code = String(data.Code).trim();
      if (!/^[A-Za-z0-9_-]{2,50}$/.test(code)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کد قالب باید ۲ تا ۵۰ نویسه انگلیسی، عدد، خط تیره یا زیرخط باشد.');
      }
    }
    if (!isUpdate || data.Name !== undefined) {
      Validator.required(data.Name, 'نام قالب');
      if (String(data.Name).trim().length > 150) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام قالب حداکثر ۱۵۰ نویسه است.');
      }
    }
    if (data.Description !== undefined && String(data.Description).length > 1000) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'توضیحات قالب حداکثر ۱۰۰۰ نویسه است.');
    }
    if (data.Status !== undefined && ['ACTIVE','INACTIVE'].indexOf(String(data.Status).toUpperCase()) === -1) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'وضعیت قالب معتبر نیست.');
    }
    if (data.Definition !== undefined || data.DefinitionJSON !== undefined) {
      this.parseDefinition(data.Definition !== undefined ? data.Definition : data.DefinitionJSON);
    }
  }
};