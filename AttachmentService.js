/**
 * ============================================================
 * ATTACHMENT SERVICE
 * ============================================================
 */

const AttachmentService = {

  _isAttachmentVisibleToUser_: function(attachment, user) {
    if (!attachment || String(attachment.TenantID) !== String(user.TenantID)) return false;
    var type = String(attachment.EntityType || '').toUpperCase();
    var entity = type === 'PROJECT' ? ProjectRepository.findById(attachment.EntityID)
      : (type === 'EVENT' ? EventRepository.findById(attachment.EntityID) : null);
    if (!entity || String(entity.TenantID) !== String(user.TenantID)) return false;
    if (type === 'PROJECT') return ProjectService._isProjectAvailableToUser_(entity, user);
    if (type === 'EVENT' && entity.ProjectID) {
      var project = ProjectRepository.findById(entity.ProjectID);
      return !!project && String(project.TenantID) === String(user.TenantID) &&
        ProjectService._isProjectAvailableToUser_(project, user);
    }
    return type === 'EVENT';
  },

  list: function(params) {

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const attachments =
      AttachmentRepository.getAll();

    const tenantAttachments =
      attachments.filter(function(attachment) {

        return String(attachment.TenantID) === String(currentUser.TenantID) &&
          String(attachment.Status) !== Constants.STATUS.DELETED &&
          AttachmentService._isAttachmentVisibleToUser_(attachment, currentUser);

      });

    return Response.success(
      tenantAttachments
    );

  },


  get: function(
    id,
    params
  ) {

    Validator.required(
      id,
      'شناسه فایل'
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const attachment =
      AttachmentRepository.findById(
        id
      );

    if (!attachment) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر پیدا نشد.'
      );

    }

    if (
      String(attachment.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر پیدا نشد.'
      );

    }

    if (!this._isAttachmentVisibleToUser_(attachment, currentUser)) {
      throw ErrorHandler.create(Constants.ERROR.FILE_NOT_FOUND, 'فایل مورد نظر پیدا نشد.');
    }

    if (
      String(attachment.Status) ===
      Constants.STATUS.DELETED
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر حذف شده است.'
      );

    }

    return Response.success(
      attachment
    );

  },


  listByEntity: function(
    entityType,
    entityId,
    params
  ) {

    Validator.required(
      entityType,
      'EntityType'
    );

    Validator.required(
      entityId,
      'EntityID'
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    let entity = null;

    if (
      String(entityType) === 'PROJECT'
    ) {

      entity =
        ProjectRepository.findById(
          entityId
        );

    } else if (
      String(entityType) === 'EVENT'
    ) {

      entity =
        EventRepository.findById(
          entityId
        );

    } else {

      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'EntityType معتبر نیست.'
      );

    }

    if (!entity) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رکورد مورد نظر پیدا نشد.'
      );

    }

    if (
      String(entity.TenantID) !== String(currentUser.TenantID) ||
      (String(entityType) === 'PROJECT' &&
        !ProjectService._isProjectAvailableToUser_(entity, currentUser))
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رکورد مورد نظر پیدا نشد.'
      );
    }

    const attachments =
      AttachmentRepository.findByEntity(
        entityType,
        entityId
      );

    const tenantAttachments =
      attachments.filter(function(attachment) {

        return String(attachment.TenantID) ===
          String(currentUser.TenantID) &&
          String(attachment.Status) !==
          Constants.STATUS.DELETED;

      });

    return Response.success(
      tenantAttachments
    );

  },


  upload: function(
    data,
    params
  ) {

    AttachmentValidator.validateCreate(
      data
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    let entity = null;

    if (
      String(data.EntityType) === 'PROJECT'
    ) {

      entity =
        ProjectRepository.findById(
          data.EntityID
        );

      if (!entity) {

        throw ErrorHandler.create(
          Constants.ERROR.PROJECT_NOT_FOUND,
          'پروژه مورد نظر پیدا نشد.'
        );

      }

    } else if (
      String(data.EntityType) === 'EVENT'
    ) {

      entity =
        EventRepository.findById(
          data.EntityID
        );

      if (!entity) {

        throw ErrorHandler.create(
          Constants.ERROR.EVENT_NOT_FOUND,
          'رویداد مورد نظر پیدا نشد.'
        );

      }

    } else {

      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'EntityType معتبر نیست.'
      );

    }

    if (
      String(entity.TenantID) !== String(currentUser.TenantID) ||
      (String(data.EntityType) === 'PROJECT' &&
        !ProjectService._isProjectAvailableToUser_(entity, currentUser))
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رکورد مورد نظر پیدا نشد.'
      );
    }

    /*
     * UploadedBy نباید از ورودی کاربر گرفته شود.
     * کاربر جاری از Session مشخص می‌شود.
     */

    const storageResult =
      StorageRepository.uploadBase64({

        fileName:
          data.FileName,

        mimeType:
          data.MimeType,

        base64:
          data.Base64

      });


    const now =
      new Date().toISOString();


    const attachment = {

      ID:
        'ATT_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        currentUser.TenantID,

      EntityType:
        data.EntityType,

      EntityID:
        data.EntityID,

      FileName:
        storageResult.fileName,

      MimeType:
        storageResult.mimeType,

      FileSize:
        storageResult.fileSize,

      StorageProvider:
        'GOOGLE_DRIVE',

      StorageKey:
        storageResult.storageKey,

      UploadedBy:
        currentUser.ID,

      UploadedAt:
        now,

      Status:
        Constants.STATUS.ACTIVE

    };


    const created =
      AttachmentRepository.insert(
        attachment
      );


    AuditService.log({

      TenantID:
        currentUser.TenantID,

      UserID:
        currentUser.ID,

      Action:
        Constants.ACTION.UPLOAD,

      EntityType:
        Constants.ENTITY.ATTACHMENT,

      EntityID:
        created.ID,

      OldData:
        null,

      NewData:
        created,

      Reason:
        'آپلود فایل'

    });


    return Response.success(
      {
        attachment:
          created,

        url:
          storageResult.url

      },
      {
        message:
          'فایل با موفقیت آپلود شد.'
      }
    );

  },


  download: function(
    id,
    params
  ) {

    Validator.required(
      id,
      'شناسه فایل'
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const attachment =
      AttachmentRepository.findById(
        id
      );

    if (!attachment) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر پیدا نشد.'
      );

    }

    if (
      String(attachment.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر پیدا نشد.'
      );

    }

    if (!this._isAttachmentVisibleToUser_(attachment, currentUser)) {
      throw ErrorHandler.create(Constants.ERROR.FILE_NOT_FOUND, 'فایل مورد نظر پیدا نشد.');
    }

    if (
      String(attachment.Status) ===
      Constants.STATUS.DELETED
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر حذف شده است.'
      );

    }

    const file =
      StorageRepository.getFile(
        attachment.StorageKey
      );

    return Response.success({

      ID:
        attachment.ID,

      FileName:
        file.getName(),

      MimeType:
        file.getMimeType(),

      FileSize:
        file.getSize(),

      Base64:
        Utilities.base64Encode(
          file.getBlob().getBytes()
        )

    });

  },


  delete: function(
    id,
    reason,
    params
  ) {

    Validator.required(
      id,
      'شناسه فایل'
    );

    Validator.required(
      reason,
      'دلیل حذف'
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const attachment =
      AttachmentRepository.findById(
        id
      );

    if (!attachment) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر پیدا نشد.'
      );

    }

    if (
      String(attachment.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.FILE_NOT_FOUND,
        'فایل مورد نظر پیدا نشد.'
      );

    }

    if (!this._isAttachmentVisibleToUser_(attachment, currentUser)) {
      throw ErrorHandler.create(Constants.ERROR.FILE_NOT_FOUND, 'فایل مورد نظر پیدا نشد.');
    }

    if (
      String(attachment.Status) ===
      Constants.STATUS.DELETED
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_STATUS,
        'این فایل قبلاً حذف شده است.'
      );

    }


    StorageRepository.delete(
      attachment.StorageKey
    );


    const updated =
      AttachmentRepository.update(
        id,
        {
          Status:
            Constants.STATUS.DELETED
        }
      );


    AuditService.log({

      TenantID:
        currentUser.TenantID,

      UserID:
        currentUser.ID,

      Action:
        Constants.ACTION.DELETE,

      EntityType:
        Constants.ENTITY.ATTACHMENT,

      EntityID:
        id,

      OldData:
        attachment,

      NewData:
        updated,

      Reason:
        reason

    });


    return Response.success(
      updated,
      {
        message:
          'فایل با موفقیت حذف شد.'
      }
    );

  }

};