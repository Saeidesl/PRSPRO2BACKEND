/**
 * ============================================================
 * ROLE VALIDATOR
 * ============================================================
 */

const RoleValidator = {

  validateCreate: function(role) {

    Validator.object(
      role,
      'role'
    );

    Validator.required(
      role.Name,
      'نام نقش'
    );

    Validator.string(
      role.Name,
      'نام نقش'
    );

    Validator.required(
      role.Code,
      'کد نقش'
    );

    Validator.string(
      role.Code,
      'کد نقش'
    );

    if (
      role.TenantID !== undefined &&
      role.TenantID !== null &&
      String(role.TenantID).trim() !== ''
    ) {

      Validator.id(
        role.TenantID,
        'TenantID'
      );

    }

    if (
      role.Status !== undefined &&
      role.Status !== null &&
      String(role.Status).trim() !== ''
    ) {

      Validator.enum(
        role.Status,
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
        'نام نقش'
      );

      Validator.string(
        data.Name,
        'نام نقش'
      );

    }

    if (
      data.Code !== undefined
    ) {

      Validator.required(
        data.Code,
        'کد نقش'
      );

      Validator.string(
        data.Code,
        'کد نقش'
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