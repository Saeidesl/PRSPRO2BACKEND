const EventValidator = {

  validateCreate: function(event) {

    Validator.object(
      event,
      'event'
    );

    Validator.required(
      event.ProjectID,
      'ProjectID'
    );

    Validator.string(
      event.ProjectID,
      'ProjectID'
    );

    Validator.required(
      event.EventTypeID,
      'EventTypeID'
    );

    Validator.string(
      event.EventTypeID,
      'EventTypeID'
    );

    Validator.required(
      event.PerformedBy,
      'PerformedBy'
    );

    Validator.string(
      event.PerformedBy,
      'PerformedBy'
    );

    if (
      event.CreatedBy !== undefined &&
      event.CreatedBy !== null &&
      String(event.CreatedBy).trim() !== ''
    ) {

      Validator.string(
        event.CreatedBy,
        'CreatedBy'
      );

    }

    if (
      event.DepartmentID !== undefined &&
      event.DepartmentID !== null &&
      String(event.DepartmentID).trim() !== ''
    ) {

      Validator.string(
        event.DepartmentID,
        'DepartmentID'
      );

    }

    if (
      event.OccurredAt !== undefined &&
      event.OccurredAt !== null &&
      String(event.OccurredAt).trim() !== ''
    ) {

      if (
        isNaN(
          new Date(
            event.OccurredAt
          ).getTime()
        )
      ) {

        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'تاریخ OccurredAt معتبر نیست.'
        );

      }

    }

    if (
      event.Description !== undefined &&
      event.Description !== null
    ) {

      Validator.string(
        event.Description,
        'Description'
      );

    }

    if (
      event.DynamicData !== undefined &&
      event.DynamicData !== null
    ) {

      Validator.object(
        event.DynamicData,
        'DynamicData'
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
      data.Description !== undefined &&
      data.Description !== null
    ) {

      Validator.string(
        data.Description,
        'Description'
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
          Constants.STATUS.VOID
        ],
        'Status'
      );

    }

    return true;

  }

};