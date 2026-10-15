const GoogleDriveStorage = {

  getRootFolder_: function() {

    const configuredFolderId =
      AppConfig.FILES.GOOGLE_DRIVE_FOLDER_ID;

    if (
      configuredFolderId &&
      String(configuredFolderId).trim() !== ''
    ) {

      return DriveApp.getFolderById(
        String(configuredFolderId).trim()
      );

    }

    const folders =
      DriveApp.getFoldersByName(
        AppConfig.APP_NAME
      );

    if (folders.hasNext()) {
      return folders.next();
    }

    return DriveApp.createFolder(
      AppConfig.APP_NAME
    );

  },


  uploadBase64: function(data) {

    if (!data) {

      throw ErrorHandler.create(
        Constants.ERROR.UPLOAD_FAILED,
        'اطلاعات فایل ارسال نشده است.'
      );

    }

    Validator.required(
      data.fileName,
      'نام فایل'
    );

    Validator.required(
      data.mimeType,
      'نوع فایل'
    );

    Validator.required(
      data.base64,
      'محتوای فایل'
    );

    const mimeType =
      String(data.mimeType).trim();

    if (
      AppConfig.FILES.ALLOWED_MIME_TYPES.indexOf(
        mimeType
      ) === -1
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.UPLOAD_FAILED,
        'نوع فایل مجاز نیست.'
      );

    }

    let base64 =
      String(data.base64);

    if (
      base64.indexOf('base64,') !== -1
    ) {

      base64 =
        base64.split('base64,')[1];

    }

    let bytes;

    try {

      bytes =
        Utilities.base64Decode(
          base64
        );

    } catch (error) {

      throw ErrorHandler.create(
        Constants.ERROR.UPLOAD_FAILED,
        'محتوای فایل معتبر نیست.'
      );

    }

    const maxBytes =
      Number(
        AppConfig.FILES.MAX_SIZE_MB
      ) *
      1024 *
      1024;

    if (
      bytes.length > maxBytes
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.UPLOAD_FAILED,
        'حجم فایل بیشتر از حد مجاز است.'
      );

    }

    const blob =
      Utilities.newBlob(
        bytes,
        mimeType,
        String(data.fileName)
      );

    const folder =
      this.getRootFolder_();

    const file =
      folder.createFile(blob);

    return {

      storageProvider:
        'GOOGLE_DRIVE',

      storageKey:
        file.getId(),

      fileId:
        file.getId(),

      fileName:
        file.getName(),

      mimeType:
        file.getMimeType(),

      fileSize:
        file.getSize(),

      url:
        file.getUrl()

    };

  },


  getFile: function(storageKey) {

    Validator.required(
      storageKey,
      'StorageKey'
    );

    try {

      return DriveApp.getFileById(
        String(storageKey)
      );

    } catch (error) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر پیدا نشد.'
      );

    }

  },


  getFileAsBase64: function(storageKey) {

    const file =
      this.getFile(storageKey);

    const blob =
      file.getBlob();

    return {

      fileName:
        file.getName(),

      mimeType:
        blob.getContentType(),

      fileSize:
        file.getSize(),

      base64:
        Utilities.base64Encode(
          blob.getBytes()
        )

    };

  },


  delete: function(storageKey) {

    const file =
      this.getFile(storageKey);

    file.setTrashed(true);

    return true;

  }

};