/**
 * ============================================================
 * USER ROLE SERVICE
 * ============================================================
 */

const UserRoleService = {

  listByUser: function(
    userId,
    params
  ) {

    Validator.required(
      userId,
      'شناسه کاربر'
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

    const items =
      UserRoleRepository.findByUserId(
        userId
      );

    const tenantItems =
      items.filter(function(item) {

        return String(item.TenantID) ===
          String(currentUser.TenantID);

      });

    return Response.success(
      tenantItems
    );

  },


  assign: function(
    userId,
    roleId,
    params
  ) {

    Validator.required(
      userId,
      'شناسه کاربر'
    );

    Validator.required(
      roleId,
      'شناسه نقش'
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );


    const user =
      UserRepository.findById(
        userId
      );

    if (!user) {

      throw ErrorHandler.create(
        Constants.ERROR.USER_NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }


    if (
      String(user.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }


    const role =
      RoleRepository.findById(
        roleId
      );

    if (!role) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );

    }


    if (
      String(role.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );

    }


    if (
      String(user.TenantID) !==
      String(role.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.PERMISSION_DENIED,
        'کاربر و نقش متعلق به یک مجموعه نیستند.'
      );

    }


    if (
      UserRoleRepository.exists(
        userId,
        roleId
      )
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'این نقش قبلاً به کاربر اختصاص داده شده است.'
      );

    }


    const newItem = {

      ID:
        'UR_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        currentUser.TenantID,

      UserID:
        userId,

      RoleID:
        roleId,

      CreatedAt:
        new Date().toISOString()

    };


    const created =
      UserRoleRepository.insert(
        newItem
      );


    AuditService.log({

      TenantID:
        currentUser.TenantID,

      UserID:
        currentUser.ID,

      Action:
        Constants.ACTION.CREATE,

      EntityType:
        Constants.ENTITY.USER,

      EntityID:
        userId,

      OldData:
        null,

      NewData:
        created,

      Reason:
        'اختصاص نقش به کاربر'

    });


    return Response.success(
      created,
      {
        message:
          'نقش با موفقیت به کاربر اختصاص داده شد.'
      }
    );

  },


  remove: function(
    userId,
    roleId,
    params
  ) {

    Validator.required(
      userId,
      'شناسه کاربر'
    );

    Validator.required(
      roleId,
      'شناسه نقش'
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );


    const user =
      UserRepository.findById(
        userId
      );

    if (!user) {

      throw ErrorHandler.create(
        Constants.ERROR.USER_NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }


    if (
      String(user.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }


    const item =
      UserRoleRepository.find(
        userId,
        roleId
      );


    if (!item) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'این نقش برای کاربر ثبت نشده است.'
      );

    }


    if (
      String(item.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'این نقش برای کاربر ثبت نشده است.'
      );

    }


    UserRoleRepository.delete(
      item.ID
    );


    AuditService.log({

      TenantID:
        currentUser.TenantID,

      UserID:
        currentUser.ID,

      Action:
        Constants.ACTION.DELETE,

      EntityType:
        Constants.ENTITY.USER,

      EntityID:
        userId,

      OldData:
        item,

      NewData:
        null,

      Reason:
        'حذف نقش از کاربر'

    });


    return Response.success(
      null,
      {
        message:
          'نقش با موفقیت از کاربر حذف شد.'
      }
    );

  }

};