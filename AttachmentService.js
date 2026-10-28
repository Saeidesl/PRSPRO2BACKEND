/**
 * ============================================================
 * ATTACHMENT SERVICE
 * ============================================================
 */

const AttachmentService = {

  // Server-side project filename convention:
  // PROJECTCODE_ATTACHMENTTYPE_ORIGINALNAME.extension
  _buildProjectFileName_: function(project, originalName, attachmentType) {
    function safePart(value, fallback) {
      var cleaned = String(value || '').trim()
        .replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, '_')
        .replace(/\s+/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .substring(0, 80);
      return cleaned || fallback;
    }

    var inputName = String(originalName || 'file').replace(/\\/g, '/').split('/').pop();
    var dot = inputName.lastIndexOf('.');
    var extension = dot > 0 ? inputName.substring(dot + 1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    var baseName = dot > 0 ? inputName.substring(0, dot) : inputName;
    baseName = safePart(baseName, 'file').substring(0, 100);
    var projectCode = safePart(project && project.ProjectCode, 'PROJECT');
    var type = safePart(String(attachmentType || 'DOCUMENT').toUpperCase(), 'DOCUMENT').toUpperCase();
    var prefix = projectCode + '_' + type + '_';
    var suffix = extension ? '.' + extension : '';
    var maxBaseLength = Math.max(1, 240 - prefix.length - suffix.length);
    return prefix + baseName.substring(0, maxBaseLength) + suffix;
  },

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


  // Lightweight metadata endpoint for project-card thumbnails. It avoids
  // returning every attachment and avoids repeated project-row lookups per file.
  listProjectImages: function(params) {
    const currentUser = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(currentUser.TenantID || '');
    const visibleProjectIds = Object.create(null);

    (ProjectRepository.getAll() || []).forEach(function(project) {
      if (String(project.TenantID) === tenantId &&
          ProjectService._isProjectAvailableToUser_(project, currentUser)) {
        visibleProjectIds[String(project.ID)] = true;
      }
    });

    const latestByProject = Object.create(null);
    const latestTimestampByProject = Object.create(null);
    (AttachmentRepository.getAll() || []).forEach(function(item) {
      const status = String(item.Status || 'ACTIVE').toUpperCase();
      const projectId = String(item.EntityID || '');
      if (String(item.TenantID) !== tenantId ||
          String(item.EntityType || '').toUpperCase() !== 'PROJECT' ||
          !visibleProjectIds[projectId] ||
          String(item.MimeType || '').toLowerCase().indexOf('image/') !== 0 ||
          (String(item.AttachmentType || '').trim() !== '' &&
            String(item.AttachmentType).toUpperCase() !== 'PROFILE') ||
          status === String(Constants.STATUS.DELETED).toUpperCase() ||
          status === 'VOID') return;

      const timestamp = new Date(item.UploadedAt || item.CreatedAt || 0).getTime() || 0;
      if (!latestByProject[projectId] || timestamp > latestTimestampByProject[projectId]) {
        latestByProject[projectId] = item;
        latestTimestampByProject[projectId] = timestamp;
      }
    });

    return Response.success(Object.keys(latestByProject).map(function(projectId) {
      return latestByProject[projectId];
    }));
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

    // Event access inherits project visibility; knowing an event ID must not bypass it.
    if (String(entityType) === 'EVENT' && entity.ProjectID) {
      const project = ProjectRepository.findById(entity.ProjectID);
      if (!project || String(project.TenantID) !== String(currentUser.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(project, currentUser)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رکورد مورد نظر پیدا نشد.');
      }
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
          String(attachment.Status) !== Constants.STATUS.DELETED &&
          AttachmentService._isAttachmentVisibleToUser_(attachment, currentUser);

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

    // Uploads to project-linked events require access to the parent project too.
    if (String(data.EntityType) === 'EVENT' && entity.ProjectID) {
      const project = ProjectRepository.findById(entity.ProjectID);
      if (!project || String(project.TenantID) !== String(currentUser.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(project, currentUser)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رکورد مورد نظر پیدا نشد.');
      }
    }

    /*
     * UploadedBy نباید از ورودی کاربر گرفته شود.
     * کاربر جاری از Session مشخص می‌شود.
     */

    // Project files receive a canonical, server-generated name. The project
    // code is taken from the authorized project record, never from client input.
    const isProjectAttachment = String(data.EntityType).toUpperCase() === 'PROJECT';
    const mimeType = String(data.MimeType || '').toLowerCase();
    const normalizedType = String(data.AttachmentType ||
      (mimeType.indexOf('image/') === 0 ? 'PROFILE' : 'DOCUMENT')).trim().toUpperCase();
    const storedFileName = isProjectAttachment
      ? this._buildProjectFileName_(entity, data.FileName, normalizedType)
      : String(data.FileName).replace(/[\\\\/\\\\:*?"<>|\\u0000-\\u001f\\u007f]/g, '_').substring(0, 240);

    const storageResult =
      StorageRepository.uploadBase64({

        fileName:
          storedFileName,

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

      AttachmentType:
        isProjectAttachment ? normalizedType : '',

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