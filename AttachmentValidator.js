const AttachmentValidator = {

  validateCreate: function(data) {

    Validator.object(
      data,
      'attachment'
    );

    Validator.required(
      data.EntityType,
      'EntityType'
    );

    Validator.required(
      data.EntityID,
      'EntityID'
    );

    Validator.required(
      data.FileName,
      'FileName'
    );

    Validator.required(
      data.MimeType,
      'MimeType'
    );

    Validator.required(
      data.Base64,
      'Base64'
    );

    Validator.string(
      data.EntityType,
      'EntityType'
    );

    Validator.string(
      data.EntityID,
      'EntityID'
    );

    Validator.string(
      data.FileName,
      'FileName'
    );

    Validator.string(
      data.MimeType,
      'MimeType'
    );

    Validator.string(
      data.Base64,
      'Base64'
    );

    Validator.enum(
      data.EntityType,
      [
        'PROJECT',
        'EVENT'
      ],
      'EntityType'
    );

    if (data.AttachmentType !== undefined && data.AttachmentType !== null && String(data.AttachmentType).trim() !== '') {
      Validator.enum(data.AttachmentType, ['PROFILE', 'SEWING_PASSPORT', 'CUTTING_PASSPORT'], 'AttachmentType');
      if (String(data.EntityType).toUpperCase() !== 'PROJECT' ||
          String(data.MimeType).toLowerCase().indexOf('image/') !== 0) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نوع تصویر فقط برای پیوست تصویری پروژه مجاز است.');
      }
    }

    return true;

  }

};