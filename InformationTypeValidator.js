const InformationTypeValidator = {
  DATA_TYPES: ['text', 'number', 'date', 'datetime', 'boolean', 'select', 'textarea', 'image', 'file'],
  CARDINALITIES: ['SINGLE', 'MULTIPLE'],

  parseJson: function(value, label, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); }
    catch (error) { throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, label + ' باید JSON معتبر باشد.'); }
  },

  validateRules: function(rules, label) {
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, label + ' معتبر نیست.');
    ['min', 'max', 'minLength', 'maxLength'].forEach(function(key) {
      if (rules[key] === undefined || rules[key] === null || rules[key] === '') return;
      var n = Number(rules[key]);
      if (!isFinite(n) || n < 0) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, label + ' مقدار ' + key + ' معتبر نیست.');
    });
    if (rules.pattern !== undefined && String(rules.pattern).length > 200) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'الگوی اعتبارسنجی بیش از حد طولانی است.');
    if (rules.pattern) {
      try { new RegExp(String(rules.pattern)); }
      catch (error) { throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'الگوی اعتبارسنجی معتبر نیست.'); }
    }
    return true;
  },

  validateDefinition: function(data, isUpdate) {
    Validator.object(data, 'informationType');
    if (!isUpdate || data.Name !== undefined) {
      Validator.required(data.Name, 'نام اطلاعات');
      Validator.string(data.Name, 'نام اطلاعات');
      if (String(data.Name).trim().length > 150) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام اطلاعات نباید بیش از ۱۵۰ نویسه باشد.');
    }
    if (!isUpdate || data.Code !== undefined) {
      Validator.required(data.Code, 'کد اطلاعات');
      Validator.string(data.Code, 'کد اطلاعات');
      if (!/^[A-Za-z][A-Za-z0-9_]{1,59}$/.test(String(data.Code).trim())) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کد باید با حرف انگلیسی شروع شود و فقط شامل حروف، عدد و زیرخط باشد.');
    }
    if (!isUpdate || data.Cardinality !== undefined) Validator.enum(String(data.Cardinality || '').toUpperCase(), this.CARDINALITIES, 'Cardinality');
    if (!isUpdate || data.DataType !== undefined) Validator.enum(String(data.DataType || '').toLowerCase(), this.DATA_TYPES, 'DataType');
    if (data.OptionsJSON !== undefined) {
      var options = this.parseJson(data.OptionsJSON, 'گزینه‌ها', []);
      if (!Array.isArray(options) || options.length > 500) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست گزینه‌ها معتبر نیست.');
    }
    if (data.ValidationRuleJSON !== undefined) this.validateRules(this.parseJson(data.ValidationRuleJSON, 'قواعد اعتبارسنجی', {}), 'قواعد اعتبارسنجی');
    if (data.ShowOnCard !== undefined) Validator.boolean(data.ShowOnCard, 'ShowOnCard');
    if (String(data.Code || '').toUpperCase() === 'PROJECT_CODE') {
      if (String(data.DataType || 'text').toLowerCase() !== 'text' || String(data.Cardinality || 'SINGLE').toUpperCase() !== 'SINGLE') {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نوع اطلاعات PROJECT_CODE باید متن تک‌مقداری باشد.');
      }
    }
    if (data.Status !== undefined) Validator.enum(data.Status, [Constants.STATUS.ACTIVE, Constants.STATUS.INACTIVE], 'Status');
    return true;
  },

  validateColumn: function(data, isUpdate) {
    Validator.object(data, 'column');
    if (!isUpdate || data.Name !== undefined) {
      Validator.required(data.Name, 'نام ستون');
      Validator.string(data.Name, 'نام ستون');
      if (String(data.Name).trim().length > 150) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام ستون بیش از حد مجاز است.');
    }
    if (!isUpdate || data.Code !== undefined) {
      Validator.required(data.Code, 'کد ستون');
      if (!/^[A-Za-z][A-Za-z0-9_]{1,59}$/.test(String(data.Code).trim())) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کد ستون معتبر نیست.');
    }
    if (!isUpdate || data.DataType !== undefined) Validator.enum(String(data.DataType || '').toLowerCase(), this.DATA_TYPES, 'DataType');
    if (data.IsRequired !== undefined) Validator.boolean(data.IsRequired, 'IsRequired');
    if (data.OptionsJSON !== undefined) {
      var options = this.parseJson(data.OptionsJSON, 'گزینه‌های ستون', []);
      if (!Array.isArray(options) || options.length > 500) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'گزینه‌های ستون معتبر نیست.');
    }
    if (data.ValidationRuleJSON !== undefined) this.validateRules(this.parseJson(data.ValidationRuleJSON, 'قواعد ستون', {}), 'قواعد ستون');
    if (data.ColumnOrder !== undefined && (!isFinite(Number(data.ColumnOrder)) || Number(data.ColumnOrder) < 0)) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ترتیب ستون معتبر نیست.');
    if (data.Status !== undefined) Validator.enum(data.Status, [Constants.STATUS.ACTIVE, Constants.STATUS.INACTIVE], 'Status');
    return true;
  }
};
