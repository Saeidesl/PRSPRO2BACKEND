const WorkflowValidator = {

  validateCreate: function(data) {

    if (!data) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعات گردش‌کار ارسال نشده است.'
      );
    }

    Validator.required(data.Name, 'Name');
    Validator.string(data.Name, 'Name');

    Validator.required(data.Code, 'Code');
    Validator.string(data.Code, 'Code');

    if (data.Version !== undefined && data.Version !== '') {
      Validator.number(data.Version, 'Version');
    }

    if (data.Status !== undefined && data.Status !== '') {
      Validator.enum(
        data.Status,
        [
          Constants.STATUS.ACTIVE,
          Constants.STATUS.INACTIVE
        ],
        'Status'
      );
    }

    return true;
  },


  validateUpdate: function(data) {

    if (!data) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعاتی برای ویرایش گردش‌کار ارسال نشده است.'
      );
    }

    if (data.Name !== undefined) {
      Validator.required(data.Name, 'Name');
      Validator.string(data.Name, 'Name');
    }

    if (data.Code !== undefined) {
      Validator.required(data.Code, 'Code');
      Validator.string(data.Code, 'Code');
    }

    if (data.Version !== undefined && data.Version !== '') {
      Validator.number(data.Version, 'Version');
    }

    if (data.Status !== undefined) {
      Validator.enum(
        data.Status,
        [
          Constants.STATUS.ACTIVE,
          Constants.STATUS.INACTIVE
        ],
        'Status'
      );
    }

    return true;
  }

};