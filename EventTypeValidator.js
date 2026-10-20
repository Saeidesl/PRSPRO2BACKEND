const EventTypeValidator = {

  validateCreate: function(data) {
    if (!data) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعات نوع رویداد ارسال نشده است.'
      );
    }

    Validator.required(data.Name, 'Name');
    Validator.string(data.Name, 'Name');
    Validator.required(data.Code, 'Code');
    Validator.string(data.Code, 'Code');

    this.validateFields_(data);
    return true;
  },

  validateUpdate: function(data) {
    if (!data || typeof data !== 'object') {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعاتی برای ویرایش نوع رویداد ارسال نشده است.'
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

    this.validateFields_(data);
    return true;
  },

  validateFields_: function(data) {
    if (data.ConnectionType !== undefined && data.ConnectionType !== null && data.ConnectionType !== '') {
      Validator.enum(data.ConnectionType, ['PROJECT', 'INDEPENDENT'], 'ConnectionType');
    }

    if (String(data.ConnectionType || '').toUpperCase() === 'INDEPENDENT' &&
        [data.UseProjectColors, data.UseProjectSizes, data.TrackVariantQuantity].some(function(value) {
          return value === true || String(value).toLowerCase() === 'true';
        })) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'رویداد مستقل از پروژه نمی‌تواند رنگ، سایز یا مقدار ترکیب پروژه را ثبت کند.');
    }

    const flagEnabled = function(value) {
      return value === true || String(value).toLowerCase() === 'true';
    };
    if (flagEnabled(data.TrackVariantQuantity) &&
        !flagEnabled(data.UseProjectColors) &&
        !flagEnabled(data.UseProjectSizes)) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'برای ثبت مقدار ترکیب، دست‌کم رنگ یا سایز باید فعال باشد.'
      );
    }

    ['UseProjectColors', 'UseProjectSizes', 'TrackVariantQuantity'].forEach(function(fieldName) {
      if (data[fieldName] !== undefined && typeof data[fieldName] !== 'boolean' &&
          String(data[fieldName]).toLowerCase() !== 'true' && String(data[fieldName]).toLowerCase() !== 'false') {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'تنظیم ' + fieldName + ' معتبر نیست.');
      }
    });

    if (data.Version !== undefined &&
        data.Version !== null &&
        data.Version !== '') {
      Validator.number(data.Version, 'Version');
    }

    if (data.Description !== undefined &&
        data.Description !== null) {
      Validator.string(data.Description, 'Description');
    }

    if (data.DepartmentID) {
      Validator.id(data.DepartmentID, 'DepartmentID');
    }

    if (data.Category) {
      Validator.enum(
        data.Category,
        Constants.CATEGORIES,
        'Category'
      );
    }

    if (data.WorkflowStepID) {
      Validator.id(data.WorkflowStepID, 'WorkflowStepID');
    }

    if (data.TargetDepartmentID) {
      Validator.id(
        data.TargetDepartmentID,
        'TargetDepartmentID'
      );
    }

    if (data.TargetProjectStatus !== undefined &&
        data.TargetProjectStatus !== null &&
        data.TargetProjectStatus !== '') {
      Validator.string(
        data.TargetProjectStatus,
        'TargetProjectStatus'
      );
    }

    [
      'AllowedDepartmentIDs',
      'AllowedUserIDs',
      'AvailableDepartmentIDs'
    ].forEach(function(fieldName) {
      if (data[fieldName] === undefined ||
          data[fieldName] === null ||
          data[fieldName] === '') {
        return;
      }

      if (!Array.isArray(data[fieldName])) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'مقدار ' + fieldName + ' باید فهرستی از شناسه‌ها باشد.'
        );
      }

      data[fieldName].forEach(function(id) {
        Validator.id(id, fieldName);
      });
    });

    [
      'MovesProjectToStep',
      'AllowAttachments',
      'AllowVoid'
    ].forEach(function(fieldName) {
      if (data[fieldName] !== undefined &&
          data[fieldName] !== null &&
          data[fieldName] !== '') {
        Validator.boolean(data[fieldName], fieldName);
      }
    });

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
  }
};