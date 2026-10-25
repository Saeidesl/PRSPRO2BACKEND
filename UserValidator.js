/**
 * ============================================================
 * USER VALIDATOR
 * ============================================================
 */

const UserValidator = {

  validateCreate: function(user) {

    Validator.object(
      user,
      'user'
    );


    Validator.required(
      user.Name,
      'نام کاربر'
    );

    Validator.string(
      user.Name,
      'نام کاربر'
    );


    Validator.required(
      user.Username,
      'نام کاربری'
    );

    Validator.string(
      user.Username,
      'نام کاربری'
    );


    Validator.required(
      user.Password,
      'رمز عبور'
    );

    Validator.string(
      user.Password,
      'رمز عبور'
    );

    if (user.Password.length < 8) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'رمز عبور باید حداقل ۸ کاراکتر باشد.'
      );
    }


    if (
      user.DepartmentID !== undefined &&
      user.DepartmentID !== null &&
      String(user.DepartmentID).trim() !== ''
    ) {

      Validator.id(
        user.DepartmentID,
        'DepartmentID'
      );

    }


    if (
      user.Status !== undefined &&
      user.Status !== null &&
      String(user.Status).trim() !== ''
    ) {

      Validator.enum(
        user.Status,
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
        'نام کاربر'
      );

      Validator.string(
        data.Name,
        'نام کاربر'
      );

    }


    if (
      data.Username !== undefined
    ) {

      Validator.required(
        data.Username,
        'نام کاربری'
      );

      Validator.string(
        data.Username,
        'نام کاربری'
      );

    }


    if (
      data.Password !== undefined &&
      data.Password !== null
    ) {
      Validator.required(
        data.Password,
        'رمز عبور'
      );

      Validator.string(
        data.Password,
        'رمز عبور'
      );

      if (data.Password.length < 8) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'رمز عبور باید حداقل ۸ کاراکتر باشد.'
        );
      }
    }


    if (
      data.DepartmentID !== undefined &&
      data.DepartmentID !== null &&
      String(data.DepartmentID).trim() !== ''
    ) {

      Validator.id(
        data.DepartmentID,
        'DepartmentID'
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