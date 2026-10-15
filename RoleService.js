const RoleService = {

  list: function(params) {

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const roles =
      RoleRepository.getAll();

    const tenantRoles =
      roles.filter(function(role) {

        return String(role.TenantID) ===
          String(user.TenantID);

      });

    return Response.success(
      tenantRoles
    );

  },


  get: function(id, params) {

    Validator.required(
      id,
      'شناسه نقش'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const role =
      RoleRepository.findById(
        id
      );

    if (!role) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );

    }

    if (
      String(role.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );

    }

    return Response.success(
      role
    );

  },


  create: function(
    role,
    params
  ) {

    RoleValidator.validateCreate(
      role
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    if (!user.TenantID) {

      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'Tenant کاربر مشخص نیست.'
      );

    }

    const code =
      String(role.Code).trim();

    const roles =
      RoleRepository.getAll();

    const duplicate =
      roles.some(function(item) {

        return String(item.TenantID) ===
          String(user.TenantID) &&

          String(item.Code).toLowerCase() ===
          code.toLowerCase();

      });

    if (duplicate) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'این کد نقش قبلاً در این Tenant ثبت شده است.'
      );

    }

    const now =
      new Date().toISOString();

    const newRole = {

      ID:
        'ROL_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        user.TenantID,

      Name:
        role.Name,

      Code:
        code,

      Status:
        role.Status ||
        Constants.STATUS.ACTIVE,

      CreatedAt:
        now,

      UpdatedAt:
        now

    };

    const created =
      RoleRepository.insert(
        newRole
      );

    AuditService.log({

      TenantID:
        user.TenantID,

      UserID:
        user.ID,

      Action:
        Constants.ACTION.CREATE,

      EntityType:
        Constants.ENTITY.ROLE,

      EntityID:
        created.ID,

      OldData:
        null,

      NewData:
        created,

      Reason:
        'ایجاد نقش'

    });

    return Response.success(
      created,
      {
        message:
          'نقش با موفقیت ایجاد شد.'
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
      'شناسه نقش'
    );

    RoleValidator.validateUpdate(
      data
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const existing =
      RoleRepository.findById(
        id
      );

    if (!existing) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );

    }

    if (
      String(existing.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );

    }


    if (
      data.Code !== undefined &&
      String(data.Code).trim() !==
        String(existing.Code)
    ) {

      const newCode =
        String(data.Code).trim();

      const roles =
        RoleRepository.getAll();

      const duplicate =
        roles.some(function(item) {

          return String(item.ID) !==
            String(id) &&

            String(item.TenantID) ===
            String(user.TenantID) &&

            String(item.Code).toLowerCase() ===
            newCode.toLowerCase();

        });

      if (duplicate) {

        throw ErrorHandler.create(
          Constants.ERROR.DUPLICATE,
          'این کد نقش قبلاً در این Tenant ثبت شده است.'
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
      data.Status !== undefined
    ) {

      updateData.Status =
        data.Status;

    }


    delete updateData.TenantID;


    updateData.UpdatedAt =
      new Date().toISOString();


    const updated =
      RoleRepository.update(
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
        Constants.ENTITY.ROLE,

      EntityID:
        id,

      OldData:
        existing,

      NewData:
        updated,

      Reason:
        data.Reason ||
        'ویرایش نقش'

    });


    return Response.success(
      updated,
      {
        message:
          'نقش با موفقیت ویرایش شد.'
      }
    );

  }

};