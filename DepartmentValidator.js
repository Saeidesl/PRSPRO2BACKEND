const DepartmentValidator = {

  validateCreate: function(department) {

    Validator.object(
      department,
      'department'
    );

    Validator.required(
      department.Name,
      'نام واحد'
    );

    Validator.string(
      department.Name,
      'نام واحد'
    );

    Validator.required(
      department.Code,
      'کد واحد'
    );

    Validator.string(
      department.Code,
      'کد واحد'
    );

    if (
      department.TenantID !== undefined &&
      department.TenantID !== null &&
      String(department.TenantID).trim() !== ''
    ) {

      Validator.id(
        department.TenantID,
        'TenantID'
      );

    }

    if (
      department.Status !== undefined &&
      department.Status !== null &&
      String(department.Status).trim() !== ''
    ) {

      Validator.enum(
        department.Status,
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

    Validator.object(
      data,
      'data'
    );

    if (
      data.Name !== undefined
    ) {

      Validator.required(
        data.Name,
        'نام واحد'
      );

      Validator.string(
        data.Name,
        'نام واحد'
      );

    }

    if (
      data.Code !== undefined
    ) {

      Validator.required(
        data.Code,
        'کد واحد'
      );

      Validator.string(
        data.Code,
        'کد واحد'
      );

    }

    if (
      data.Status !== undefined &&
      data.Status !== null &&
      String(data.Status).trim() !== ''
    ) {

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