const AttachmentValidator = {

  // Supported project-file formats. Keep MIME and extension checks aligned so
  // clients cannot bypass the allow-list by supplying a misleading MIME type.
  FILE_TYPES: {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/gif': ['gif'],
    'application/pdf': ['pdf'],
    'application/msword': ['doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.ms-excel': ['xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx']
  },

  validateCreate: function(data) {
    Validator.object(data, 'attachment');
    Validator.required(data.EntityType, 'EntityType');
    Validator.required(data.EntityID, 'EntityID');
    Validator.required(data.FileName, 'FileName');
    Validator.required(data.MimeType, 'MimeType');
    Validator.required(data.Base64, 'Base64');

    Validator.string(data.EntityType, 'EntityType');
    Validator.string(data.EntityID, 'EntityID');
    Validator.string(data.FileName, 'FileName');
    Validator.string(data.MimeType, 'MimeType');
    Validator.string(data.Base64, 'Base64');

    Validator.enum(data.EntityType, ['PROJECT', 'EVENT'], 'EntityType');

    var entityType = String(data.EntityType).toUpperCase();
    var mimeType = String(data.MimeType || '').trim().toLowerCase();
    var fileName = String(data.FileName || '').trim();
    var base64 = String(data.Base64 || '').replace(/^data:[^,]*;base64,/i, '');
    var dot = fileName.lastIndexOf('.');
    var extension = dot >= 0 ? fileName.substring(dot + 1).toLowerCase() : '';
    var supportedExtensions = this.FILE_TYPES[mimeType];

    if (!supportedExtensions ||
        (AppConfig.FILES.ALLOWED_MIME_TYPES || []).indexOf(mimeType) === -1 ||
        supportedExtensions.indexOf(extension) === -1) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'فرمت فایل مجاز نیست یا پسوند با نوع فایل سازگار نیست. فقط تصاویر، PDF، Word و Excel مجاز هستند.'
      );
    }

    if (fileName.length > 240 || /[\/\\\u0000-\u001f\u007f]/.test(fileName) ||
        fileName === '.' || fileName === '..') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام فایل معتبر نیست.');
    }

    var maxBytes = Number(AppConfig.FILES.MAX_SIZE_MB || 10) * 1024 * 1024;
    // Base64 adds approximately 4/3 overhead. This early check avoids decoding
    // an obviously oversized payload; GoogleDriveStorage enforces actual bytes.
    if (!base64 || base64.length > Math.ceil(maxBytes * 4 / 3) + 8) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حجم فایل خالی یا بیشتر از حد مجاز است.');
    }

    if (data.AttachmentType !== undefined && data.AttachmentType !== null &&
        String(data.AttachmentType).trim() !== '') {
      var attachmentType = String(data.AttachmentType).trim().toUpperCase();
      if (entityType !== 'PROJECT' || !/^[A-Z0-9_-]{1,64}$/.test(attachmentType)) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'نوع فایل معتبر نیست؛ نوع باید شناسه‌ای کوتاه و قابل توسعه باشد.'
        );
      }
    } else if (entityType === 'PROJECT' && mimeType.indexOf('image/') === 0) {
      // Legacy clients may omit the type for profile images.
      data.AttachmentType = 'PROFILE';
    }

    return true;
  }
};