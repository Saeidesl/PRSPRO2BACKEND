const EventFieldValidator = {

  validateCreate: function(field) {

    Validator.object(
      field,
      'field'
    );

    Validator.required(
      field.EventTypeID,
      'EventTypeID'
    );

    Validator.string(
      field.EventTypeID,
      'EventTypeID'
    );

    Validator.required(
      field.Name,
      'نام فیلد'
    );

    Validator.string(
      field.Name,
      'نام فیلد'
    );

    Validator.required(
      field.Code,
      'کد فیلد'
    );

    Validator.string(
      field.Code,
      'کد فیلد'
    );

    Validator.required(
      field.FieldType,
      'نوع فیلد'
    );

    Validator.enum(
      field.FieldType,
      [
        'text',
        'number',
        'date',
        'datetime',
        'select',
        'textarea',
        'boolean'
      ],
      'FieldType'
    );

    if (
      field.IsRequired !== undefined &&
      field.IsRequired !== null
    ) {

      Validator.boolean(
        field.IsRequired,
        'IsRequired'
      );

    }

    if (
      field.DefaultValue !== undefined &&
      field.DefaultValue !== null
    ) {

      Validator.string(
        String(field.DefaultValue),
        'DefaultValue'
      );

    }

    if (
      field.Options !== undefined &&
      field.Options !== null
    ) {

      Validator.string(
        String(field.Options),
        'Options'
      );

    }

    if (
      field.ValidationRule !== undefined &&
      field.ValidationRule !== null
    ) {

      Validator.string(
        String(field.ValidationRule),
        'ValidationRule'
      );

    }

    if (
      field.FieldOrder !== undefined &&
      field.FieldOrder !== null
    ) {

      Validator.number(
        Number(field.FieldOrder),
        'FieldOrder'
      );

    }

    if (
      field.Status !== undefined &&
      field.Status !== null &&
      String(field.Status).trim() !== ''
    ) {

      Validator.enum(
        field.Status,
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
        'نام فیلد'
      );

      Validator.string(
        data.Name,
        'نام فیلد'
      );

    }

    if (
      data.Code !== undefined
    ) {

      Validator.required(
        data.Code,
        'کد فیلد'
      );

      Validator.string(
        data.Code,
        'کد فیلد'
      );

    }

    if (
      data.FieldType !== undefined
    ) {

      Validator.enum(
        data.FieldType,
        [
          'text',
          'number',
          'date',
          'datetime',
          'select',
          'textarea',
          'boolean'
        ],
        'FieldType'
      );

    }

    if (
      data.IsRequired !== undefined &&
      data.IsRequired !== null
    ) {

      Validator.boolean(
        data.IsRequired,
        'IsRequired'
      );

    }

    if (
      data.DefaultValue !== undefined &&
      data.DefaultValue !== null
    ) {

      Validator.string(
        String(data.DefaultValue),
        'DefaultValue'
      );

    }

    if (
      data.Options !== undefined &&
      data.Options !== null
    ) {

      Validator.string(
        String(data.Options),
        'Options'
      );

    }

    if (
      data.ValidationRule !== undefined &&
      data.ValidationRule !== null
    ) {

      Validator.string(
        String(data.ValidationRule),
        'ValidationRule'
      );

    }

    if (
      data.FieldOrder !== undefined &&
      data.FieldOrder !== null
    ) {

      Validator.number(
        Number(data.FieldOrder),
        'FieldOrder'
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