/**
 * ============================================================
 * VALIDATOR
 * ============================================================
 */

const Validator = {

  required: function(
    value,
    fieldName
  ) {

    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ''
    ) {

      throw ErrorHandler.create(

        Constants.ERROR.VALIDATION_ERROR,

        'فیلد "' +
        fieldName +
        '" الزامی است.'
      );
    }

    return true;
  },


  string: function(
    value,
    fieldName
  ) {

    if (
      value !== undefined &&
      value !== null &&
      typeof value !== 'string'
    ) {

      throw ErrorHandler.create(

        Constants.ERROR.VALIDATION_ERROR,

        'فیلد "' +
        fieldName +
        '" باید از نوع متن باشد.'
      );
    }

    return true;
  },


  number: function(
    value,
    fieldName
  ) {

    if (
      value !== undefined &&
      value !== null &&
      (
        typeof value !== 'number' ||
        isNaN(value)
      )
    ) {

      throw ErrorHandler.create(

        Constants.ERROR.VALIDATION_ERROR,

        'فیلد "' +
        fieldName +
        '" باید عددی باشد.'
      );
    }

    return true;
  },


  boolean: function(
    value,
    fieldName
  ) {

    if (
      value !== undefined &&
      value !== null &&
      typeof value !== 'boolean'
    ) {

      throw ErrorHandler.create(

        Constants.ERROR.VALIDATION_ERROR,

        'فیلد "' +
        fieldName +
        '" باید Boolean باشد.'
      );
    }

    return true;
  },


  enum: function(
    value,
    allowedValues,
    fieldName
  ) {

    if (
      value === undefined ||
      value === null
    ) {

      return true;
    }

    if (
      allowedValues.indexOf(value) === -1
    ) {

      throw ErrorHandler.create(

        Constants.ERROR.VALIDATION_ERROR,

        'مقدار "' +
        value +
        '" برای فیلد "' +
        fieldName +
        '" معتبر نیست.',

        {
          allowedValues: allowedValues
        }
      );
    }

    return true;
  },


  id: function(
    value,
    fieldName
  ) {

    Validator.required(
      value,
      fieldName
    );

    if (
      typeof value !== 'string' ||
      !/^[A-Z]+_[a-z0-9]+$/i.test(value)
    ) {

      throw ErrorHandler.create(

        Constants.ERROR.VALIDATION_ERROR,

        'شناسه "' +
        fieldName +
        '" معتبر نیست.'
      );
    }

    return true;
  },


  object: function(
    value,
    fieldName
  ) {

    if (
      value === undefined ||
      value === null
    ) {

      return true;
    }

    if (
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {

      throw ErrorHandler.create(

        Constants.ERROR.VALIDATION_ERROR,

        'فیلد "' +
        fieldName +
        '" باید Object باشد.'
      );
    }

    return true;
  }
};