const ProjectValidator = {

  validateCreate: function(data) {

    if (!data) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعات پروژه ارسال نشده است.'
      );
    }

    Validator.required(
      data.ProjectCode,
      'ProjectCode'
    );

    Validator.string(
      data.ProjectCode,
      'ProjectCode'
    );

    Validator.required(
      data.Title,
      'Title'
    );

    Validator.string(
      data.Title,
      'Title'
    );

    // تعداد اولیه اختیاری است؛ در صورت ثبت باید عدد صحیح مثبت باشد.
    if (data.Quantity !== undefined && data.Quantity !== null && String(data.Quantity).trim() !== '') {
      var quantity = Number(data.Quantity);
      if (!isFinite(quantity) || quantity < 1 || Math.floor(quantity) !== quantity) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'تعداد پروژه باید عدد صحیح بزرگ‌تر از صفر باشد.'
        );
      }
    }

    if (data.ColorSizeJSON !== undefined && data.ColorSizeJSON !== null &&
        String(data.ColorSizeJSON).length > 20000) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعات رنگ‌بندی و سایزبندی بیش از حد مجاز است.'
      );
    }

    if (data.Description !== undefined && data.Description !== null) {
      Validator.string(
        data.Description,
        'Description'
      );
    }

    Validator.required(data.WorkflowID, 'گردش کار');
    Validator.id(data.WorkflowID, 'WorkflowID');

    if (!Array.isArray(data.AvailableDepartmentIDs) || data.AvailableDepartmentIDs.length < 1) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حداقل یک واحد مجاز برای پروژه انتخاب کنید.');
    }
    if (data.AvailableDepartmentIDs.length > 100) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تعداد واحدهای مجاز بیش از حد مجاز است.');
    }
    if (data.AllowedUserIDs !== undefined && data.AllowedUserIDs !== null &&
        (!Array.isArray(data.AllowedUserIDs) || data.AllowedUserIDs.length > 500)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست کاربران مجاز معتبر نیست.');
    }
    if (data.NotifyEnabled !== undefined && typeof data.NotifyEnabled !== 'boolean' &&
        !['true', 'false'].includes(String(data.NotifyEnabled).toLowerCase())) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تنظیم اطلاع‌رسانی معتبر نیست.');
    }

    return true;
  },


  validateUpdate: function(data) {

    if (!data) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعاتی برای ویرایش پروژه ارسال نشده است.'
      );
    }

    if (data.ProjectCode !== undefined) {

      Validator.required(
        data.ProjectCode,
        'ProjectCode'
      );

      Validator.string(
        data.ProjectCode,
        'ProjectCode'
      );

    }

    if (data.Title !== undefined) {

      Validator.required(
        data.Title,
        'Title'
      );

      Validator.string(
        data.Title,
        'Title'
      );

    }

    if (data.Quantity !== undefined && data.Quantity !== null && String(data.Quantity).trim() !== '') {
      var quantity = Number(data.Quantity);
      if (!isFinite(quantity) || quantity < 1 || Math.floor(quantity) !== quantity) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'تعداد پروژه باید عدد صحیح بزرگ‌تر از صفر باشد.'
        );
      }
    }

    if (data.Description !== undefined && data.Description !== null) {

      Validator.string(
        data.Description,
        'Description'
      );

    }

    if (data.WorkflowID !== undefined) {
      Validator.required(
        data.WorkflowID,
        'WorkflowID'
      );

      Validator.id(
        data.WorkflowID,
        'WorkflowID'
      );
    }

    if (data.Status !== undefined) {

      Validator.enum(
        data.Status,
        [
          Constants.STATUS.ACTIVE,
          Constants.STATUS.ON_HOLD,
          Constants.STATUS.COMPLETED,
          Constants.STATUS.CANCELLED
        ],
        'Status'
      );

    }

    return true;
  }

};