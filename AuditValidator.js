const AuditValidator = {

  validateCreate: function(data) {

    Validator.object(
      data,
      'audit'
    );

    Validator.required(
      data.Action,
      'Action'
    );

    Validator.required(
      data.EntityType,
      'EntityType'
    );

    Validator.required(
      data.EntityID,
      'EntityID'
    );

    Validator.string(
      data.Action,
      'Action'
    );

    Validator.string(
      data.EntityType,
      'EntityType'
    );

    Validator.string(
      data.EntityID,
      'EntityID'
    );

    if (
      data.UserID !== undefined &&
      data.UserID !== null
    ) {

      Validator.string(
        data.UserID,
        'UserID'
      );

    }

    if (
      data.TenantID !== undefined &&
      data.TenantID !== null
    ) {

      Validator.string(
        data.TenantID,
        'TenantID'
      );

    }

    if (
      data.Reason !== undefined &&
      data.Reason !== null
    ) {

      Validator.string(
        data.Reason,
        'Reason'
      );

    }

    return true;

  }

};