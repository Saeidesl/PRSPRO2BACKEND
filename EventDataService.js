
/**
 * ============================================================
 * EVENT DATA SERVICE
 * ============================================================
 */

const EventDataService = {

  getByEventId: function(eventId, params) {

    Validator.required(eventId, 'EventID');

    const currentUser =
      AccessControlService.getCurrentUser(params || {});

    const event =
      EventRepository.findById(eventId);

    if (!event) {
      throw ErrorHandler.create(
        Constants.ERROR.EVENT_NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }

    if (
      String(event.TenantID) !==
      String(currentUser.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }
    if (event.ProjectID) {
      const project = ProjectRepository.findById(event.ProjectID);
      if (!project || String(project.TenantID) !== String(currentUser.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(project, currentUser)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
      }
    }

    const stored =
      EventDataRepository.findByEventId(eventId);

    if (!stored) {
      return Response.success(null);
    }

    let parsedData = {};

    if (
      stored.DataJSON !== undefined &&
      stored.DataJSON !== null &&
      String(stored.DataJSON).trim() !== ''
    ) {
      try {
        parsedData = JSON.parse(stored.DataJSON);
      } catch (error) {
        throw ErrorHandler.create(
          Constants.ERROR.INTERNAL_ERROR,
          'اطلاعات پویای رویداد قابل خواندن نیست.'
        );
      }
    }

    if (
      !parsedData ||
      typeof parsedData !== 'object' ||
      Array.isArray(parsedData)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INTERNAL_ERROR,
        'ساختار اطلاعات پویای رویداد معتبر نیست.'
      );
    }

    return Response.success(parsedData);
  },


  /**
   * اعتبارسنجی داده‌ها براساس فیلدهای تعریف‌شده برای نوع رویداد.
   * خروجی، داده‌های معتبرشده است.
   */
  validateDynamicData: function(eventTypeId, data, tenantId) {

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعات پویا باید یک شیء معتبر باشد.'
      );
    }

    const eventType =
      EventTypeRepository.findById(eventTypeId);

    if (
      !eventType ||
      String(eventType.TenantID) !== String(tenantId)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نوع رویداد مورد نظر پیدا نشد.'
      );
    }

    const fields =
      EventFieldRepository.findByEventTypeId(eventTypeId) || [];

    const activeFields = fields.filter(function(field) {
      return (
        String(field.TenantID) === String(tenantId) &&
        String(field.Status).toUpperCase() === 'ACTIVE'
      );
    });

    const allowedCodes = {};

    activeFields.forEach(function(field) {
      allowedCodes[String(field.Code)] = true;
    });

    Object.keys(data).forEach(function(code) {
      if (!allowedCodes[code]) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'فیلد نامعتبر یا غیرفعال ارسال شده است: ' + code
        );
      }
    });

    const result = {};

    activeFields.forEach(function(field) {

      const code = String(field.Code);
      const supplied = Object.prototype.hasOwnProperty.call(data, code);
      let value = supplied ? data[code] : field.DefaultValue;

      const required =
        field.IsRequired === true ||
        String(field.IsRequired).toUpperCase() === 'TRUE';

      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '');

      if (empty) {
        if (required) {
          throw ErrorHandler.create(
            Constants.ERROR.VALIDATION_ERROR,
            'تکمیل این فیلد الزامی است: ' + field.Name
          );
        }

        if (supplied) {
          result[code] = '';
        }

        return;
      }

      const type = String(field.FieldType || '').toLowerCase();

      if (type === 'text' || type === 'textarea') {
        if (typeof value !== 'string') {
          value = String(value);
        }
      }

      else if (type === 'number') {
        if (
          typeof value === 'boolean' ||
          String(value).trim() === '' ||
          !isFinite(Number(value))
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.VALIDATION_ERROR,
            'مقدار این فیلد باید عدد باشد: ' + field.Name
          );
        }

        value = Number(value);
      }

      else if (type === 'boolean') {
        if (value === true || String(value).toUpperCase() === 'TRUE') {
          value = true;
        } else if (
          value === false ||
          String(value).toUpperCase() === 'FALSE'
        ) {
          value = false;
        } else {
          throw ErrorHandler.create(
            Constants.ERROR.VALIDATION_ERROR,
            'مقدار این فیلد باید درست یا نادرست باشد: ' + field.Name
          );
        }
      }

      else if (type === 'date') {
        if (
          typeof value !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          isNaN(Date.parse(value + 'T00:00:00Z'))
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.VALIDATION_ERROR,
            'تاریخ این فیلد باید با قالب YYYY-MM-DD ارسال شود: ' + field.Name
          );
        }
      }

      else if (type === 'datetime') {
        if (
          typeof value !== 'string' ||
          isNaN(Date.parse(value))
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.VALIDATION_ERROR,
            'تاریخ و ساعت این فیلد معتبر نیست: ' + field.Name
          );
        }
      }

      else if (type === 'select') {
        let options = [];

        try {
          const rawOptions = field.Options;

          if (Array.isArray(rawOptions)) {
            options = rawOptions;
          } else if (
            typeof rawOptions === 'string' &&
            rawOptions.trim() !== ''
          ) {
            const parsedOptions = JSON.parse(rawOptions);

            if (Array.isArray(parsedOptions)) {
              options = parsedOptions;
            } else {
              options = rawOptions.split(',').map(function(item) {
                return item.trim();
              });
            }
          }
        } catch (error) {
          options = String(field.Options || '').split(',').map(function(item) {
            return item.trim();
          });
        }

        options = options.map(function(option) {
          if (
            option &&
            typeof option === 'object' &&
            option.value !== undefined
          ) {
            return String(option.value);
          }

          return String(option);
        });

        if (options.indexOf(String(value)) === -1) {
          throw ErrorHandler.create(
            Constants.ERROR.VALIDATION_ERROR,
            'مقدار انتخاب‌شده برای این فیلد مجاز نیست: ' + field.Name
          );
        }

        value = String(value);
      }

      else {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'نوع فیلد پشتیبانی نمی‌شود: ' + field.Name
        );
      }

      result[code] = value;
    });

    return result;
  },


  save: function(eventId, data, params) {

    Validator.required(eventId, 'EventID');
    Validator.object(data, 'DynamicData');

    const currentUser =
      AccessControlService.getCurrentUser(params || {});

    const event =
      EventRepository.findById(eventId);

    if (!event) {
      throw ErrorHandler.create(
        Constants.ERROR.EVENT_NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }

    if (
      String(event.TenantID) !==
      String(currentUser.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }
    if (event.ProjectID) {
      const project = ProjectRepository.findById(event.ProjectID);
      if (!project || String(project.TenantID) !== String(currentUser.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(project, currentUser)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
      }
    }

    if (String(event.Status) === Constants.STATUS.VOID) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_STATUS,
        'اطلاعات رویداد باطل‌شده قابل ویرایش نیست.'
      );
    }

    const validatedData =
      this.validateDynamicData(
        event.EventTypeID,
        data || {},
        currentUser.TenantID
      );

    const dataJson =
      JSON.stringify(validatedData);

    const existing =
      EventDataRepository.findByEventId(eventId);

    if (existing) {

      const updated =
        EventDataRepository.update(
          existing.ID,
          {
            DataJSON: dataJson
          }
        );

      AuditService.log({
        TenantID: currentUser.TenantID,
        UserID: currentUser.ID,
        Action: Constants.ACTION.UPDATE,
        EntityType: Constants.ENTITY.EVENT,
        EntityID: eventId,
        OldData: existing,
        NewData: updated,
        Reason: 'ویرایش اطلاعات پویای رویداد'
      });

      return Response.success(
        updated,
        {
          message: 'اطلاعات پویای رویداد با موفقیت ویرایش شد.'
        }
      );
    }

    const created =
      EventDataRepository.insert({
        ID: 'ED_' + Utilities.getUuid().replace(/-/g, ''),
        EventID: eventId,
        DataJSON: dataJson,
        CreatedAt: new Date().toISOString()
      });

    AuditService.log({
      TenantID: currentUser.TenantID,
      UserID: currentUser.ID,
      Action: Constants.ACTION.CREATE,
      EntityType: Constants.ENTITY.EVENT,
      EntityID: eventId,
      OldData: null,
      NewData: created,
      Reason: 'ثبت اطلاعات پویای رویداد'
    });

    return Response.success(
      created,
      {
        message: 'اطلاعات پویای رویداد با موفقیت ثبت شد.'
      }
    );
  }

};
