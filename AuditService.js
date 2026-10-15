/**
 * ============================================================
 * AUDIT SERVICE
 * ============================================================
 */

const AuditService = {

  log: function(data) {

    Validator.object(
      data,
      'audit'
    );

    Validator.required(
      data.TenantID,
      'TenantID'
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


    const audit = {

      ID:
        'AUD_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        data.TenantID,

      UserID:
        data.UserID ||
        '',

      Action:
        data.Action,

      EntityType:
        data.EntityType,

      EntityID:
        data.EntityID,

      OldData:
        data.OldData !== undefined &&
        data.OldData !== null
          ? JSON.stringify(data.OldData)
          : '',

      NewData:
        data.NewData !== undefined &&
        data.NewData !== null
          ? JSON.stringify(data.NewData)
          : '',

      Reason:
        data.Reason ||
        '',

      CreatedAt:
        new Date().toISOString()

    };


    return AuditRepository.insert(
      audit
    );

  },


  list: function(params) {

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );


    const audits =
      AuditRepository.getAll();


    const tenantAudits =
      audits.filter(function(audit) {

        return String(audit.TenantID) ===
          String(currentUser.TenantID);

      });


    return Response.success(
      tenantAudits
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


    const audits =
      AuditRepository.findByEntity(
        entityType,
        entityId
      );


    const tenantAudits =
      audits.filter(function(audit) {

        return String(audit.TenantID) ===
          String(currentUser.TenantID);

      });


    return Response.success(
      tenantAudits
    );

  },


  listByUser: function(
    userId,
    params
  ) {

    Validator.required(
      userId,
      'UserID'
    );


    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );


    const targetUser =
      UserRepository.findById(
        userId
      );


    if (!targetUser) {

      throw ErrorHandler.create(
        Constants.ERROR.USER_NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }


    if (
      String(targetUser.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }


    const audits =
      AuditRepository.findByUser(
        userId
      );


    const tenantAudits =
      audits.filter(function(audit) {

        return String(audit.TenantID) ===
          String(currentUser.TenantID);

      });


    return Response.success(
      tenantAudits
    );

  }

};