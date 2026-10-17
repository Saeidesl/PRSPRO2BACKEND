
const EventFieldService = {

  listByEventType: function(
    eventTypeId,
    params
  ) {

    Validator.required(
      eventTypeId,
      'EventTypeID'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    // Reuse the canonical event-type visibility checks so a user with
    // EVENT_CREATE cannot enumerate fields for an event type they cannot use.
    EventTypeService.get(eventTypeId, params);


    const fields =
      EventFieldRepository.findByEventTypeId(
        eventTypeId
      );

    const tenantFields =
      fields.filter(function(field) {

        return String(field.TenantID) ===
          String(user.TenantID);

      });

    return Response.success(
      tenantFields
    );

  },


  get: function(id, params) {

    Validator.required(
      id,
      'شناسه فیلد'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const field =
      EventFieldRepository.findById(
        id
      );

    if (!field) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'فیلد رویداد مورد نظر پیدا نشد.'
      );

    }

    if (
      String(field.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'فیلد رویداد مورد نظر پیدا نشد.'
      );

    }

    return Response.success(
      field
    );

  },


  create: function(
    field,
    params
  ) {

    EventFieldValidator.validateCreate(
      field
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const eventType =
      EventTypeRepository.findById(
        field.EventTypeID
      );

    if (!eventType) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_EVENT_TYPE,
        'نوع رویداد مورد نظر پیدا نشد.'
      );

    }

    if (
      String(eventType.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نوع رویداد مورد نظر پیدا نشد.'
      );

    }

    const code =
      String(field.Code).trim();

    const existingFields =
      EventFieldRepository.findByEventTypeId(
        field.EventTypeID
      );

    const duplicate =
      existingFields.some(function(item) {

        return String(item.TenantID) ===
          String(user.TenantID) &&

          String(item.Code) ===
          code;

      });

    if (duplicate) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'این کد فیلد قبلاً برای این نوع رویداد ثبت شده است.'
      );

    }

    const now =
      new Date().toISOString();

    const newField = {

      ID:
        Constants.ID_PREFIX.EVENT_FIELD +
        '_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        user.TenantID,

      EventTypeID:
        eventType.ID,

      Name:
        field.Name,

      Code:
        code,

      FieldType:
        field.FieldType,

      IsRequired:
        field.IsRequired === true,

      DefaultValue:
        field.DefaultValue !== undefined &&
        field.DefaultValue !== null
          ? String(field.DefaultValue)
          : '',

      Options:
        field.Options !== undefined &&
        field.Options !== null
          ? String(field.Options)
          : '',

      ValidationRule:
        field.ValidationRule !== undefined &&
        field.ValidationRule !== null
          ? String(field.ValidationRule)
          : '',

      FieldOrder:
        field.FieldOrder !== undefined &&
        field.FieldOrder !== null
          ? Number(field.FieldOrder)
          : 0,

      Status:
        field.Status ||
        Constants.STATUS.ACTIVE,

      CreatedAt:
        now,

      UpdatedAt:
        now

    };

    const created =
      EventFieldRepository.insert(
        newField
      );

    AuditService.log({

      TenantID:
        user.TenantID,

      UserID:
        user.ID,

      Action:
        Constants.ACTION.CREATE,

      EntityType:
        Constants.ENTITY.EVENT_FIELD,

      EntityID:
        created.ID,

      OldData:
        null,

      NewData:
        created,

      Reason:
        'ایجاد فیلد رویداد'

    });

    return Response.success(
      created,
      {
        message:
          'فیلد رویداد با موفقیت ایجاد شد.'
      }
    );

  },


  update: function(
    id,
    data,
    params
  ) {

    Validator.required(
      id,
      'شناسه فیلد'
    );

    EventFieldValidator.validateUpdate(
      data
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const existing =
      EventFieldRepository.findById(
        id
      );

    if (!existing) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'فیلد رویداد مورد نظر پیدا نشد.'
      );

    }

    if (
      String(existing.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'فیلد رویداد مورد نظر پیدا نشد.'
      );

    }

    if (
      data.Code !== undefined &&
      String(data.Code).trim() !==
        String(existing.Code)
    ) {

      const fields =
        EventFieldRepository.findByEventTypeId(
          existing.EventTypeID
        );

      const duplicate =
        fields.some(function(field) {

          return String(field.ID) !==
            String(id) &&

            String(field.TenantID) ===
            String(user.TenantID) &&

            String(field.Code) ===
            String(data.Code).trim();

        });

      if (duplicate) {

        throw ErrorHandler.create(
          Constants.ERROR.DUPLICATE,
          'این کد فیلد قبلاً برای این نوع رویداد ثبت شده است.'
        );

      }

    }

    const updateData = {};

    if (
      data.Name !== undefined
    ) {

      updateData.Name =
        data.Name;

    }

    if (
      data.Code !== undefined
    ) {

      updateData.Code =
        String(data.Code).trim();

    }

    if (
      data.FieldType !== undefined
    ) {

      updateData.FieldType =
        data.FieldType;

    }

    if (
      data.IsRequired !== undefined
    ) {

      updateData.IsRequired =
        data.IsRequired;

    }

    if (
      data.DefaultValue !== undefined
    ) {

      updateData.DefaultValue =
        data.DefaultValue !== null
          ? String(data.DefaultValue)
          : '';

    }

    if (
      data.Options !== undefined
    ) {

      updateData.Options =
        data.Options !== null
          ? String(data.Options)
          : '';

    }

    if (
      data.ValidationRule !== undefined
    ) {

      updateData.ValidationRule =
        data.ValidationRule !== null
          ? String(data.ValidationRule)
          : '';

    }

    if (
      data.FieldOrder !== undefined
    ) {

      updateData.FieldOrder =
        Number(data.FieldOrder);

    }

    if (
      data.Status !== undefined
    ) {

      updateData.Status =
        data.Status;

    }

    updateData.UpdatedAt =
      new Date().toISOString();

    const updated =
      EventFieldRepository.update(
        id,
        updateData
      );

    AuditService.log({

      TenantID:
        user.TenantID,

      UserID:
        user.ID,

      Action:
        Constants.ACTION.UPDATE,

      EntityType:
        Constants.ENTITY.EVENT_FIELD,

      EntityID:
        id,

      OldData:
        existing,

      NewData:
        updated,

      Reason:
        data.Reason ||
        'ویرایش فیلد رویداد'

    });

    return Response.success(
      updated,
      {
        message:
          'فیلد رویداد با موفقیت ویرایش شد.'
      }
    );

  },


  delete: function(
    id,
    params
  ) {

    Validator.required(
      id,
      'شناسه فیلد'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const existing =
      EventFieldRepository.findById(
        id
      );

    if (!existing) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'فیلد رویداد مورد نظر پیدا نشد.'
      );

    }

    if (
      String(existing.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'فیلد رویداد مورد نظر پیدا نشد.'
      );

    }

    if (
      String(existing.Status).toUpperCase() ===
      'INACTIVE'
    ) {

      return Response.success(
        existing,
        {
          message:
            'این فیلد قبلاً غیرفعال شده است.'
        }
      );

    }

    const updated =
      EventFieldRepository.update(
        id,
        {
          Status: 'INACTIVE',
          UpdatedAt: new Date().toISOString()
        }
      );

    AuditService.log({

      TenantID:
        user.TenantID,

      UserID:
        user.ID,

      Action:
        Constants.ACTION.UPDATE,

      EntityType:
        Constants.ENTITY.EVENT_FIELD,

      EntityID:
        id,

      OldData:
        existing,

      NewData:
        updated,

      Reason:
        'غیرفعال‌سازی فیلد رویداد به‌جای حذف فیزیکی'

    });

    return Response.success(
      updated,
      {
        message:
          'فیلد غیرفعال شد و اطلاعات رویدادهای قبلی حفظ شدند.'
      }
    );

  }

};
