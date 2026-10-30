const FormValidator = {
  validateForm: function(data, partial) {
    Validator.object(data, 'form');
    if (!partial || data.Name !== undefined) {
      Validator.required(data.Name, 'نام فرم');
      Validator.string(data.Name, 'نام فرم');
      if (String(data.Name).trim().length > 150) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام فرم نباید بیش از ۱۵۰ نویسه باشد.');
    }
    if (!partial || data.Code !== undefined) {
      Validator.required(data.Code, 'کد فرم');
      if (!/^[A-Za-z][A-Za-z0-9_]{1,59}$/.test(String(data.Code).trim())) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'کد فرم معتبر نیست.');
    }
    if (data.Description !== undefined && String(data.Description).length > 2000) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'توضیحات فرم بیش از حد مجاز است.');
    if (data.Status !== undefined) Validator.enum(data.Status, ['ACTIVE','INACTIVE'], 'Status');
    return true;
  },
  validateField: function(data, partial) {
    Validator.object(data, 'formField');
    if (!partial || data.InformationTypeID !== undefined) Validator.required(data.InformationTypeID, 'نوع اطلاعات');
    if (data.FieldOrder !== undefined && (!isFinite(Number(data.FieldOrder)) || Number(data.FieldOrder) < 0)) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ترتیب فیلد معتبر نیست.');
    if (data.IsRequired !== undefined) Validator.boolean(data.IsRequired, 'IsRequired');
    ['GroupName','LabelOverride','HelpText'].forEach(function(key) {
      if (data[key] !== undefined && String(data[key]).length > 500) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, key + ' بیش از حد مجاز است.');
    });
    if (data.Status !== undefined) Validator.enum(data.Status, ['ACTIVE','INACTIVE'], 'Status');
    return true;
  }
};