const DepartmentService = {

  list: function(params) {

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const departments =
      DepartmentRepository.getAll();

    const tenantDepartments =
      departments.filter(function(department) {

        return String(department.TenantID) ===
          String(user.TenantID);

      });

    return Response.success(
      tenantDepartments
    );

  },


  get: function(id, params) {

    Validator.required(
      id,
      'شناسه واحد'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const department =
      DepartmentRepository.findById(
        id
      );

    if (!department) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'واحد مورد نظر پیدا نشد.'
      );

    }

    if (
      String(department.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'واحد مورد نظر پیدا نشد.'
      );

    }

    return Response.success(
      department
    );

  },


  create: function(
    department,
    params
  ) {

    DepartmentValidator.validateCreate(
      department
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
      String(
        department.Code
      ).trim();


    const departments =
      DepartmentRepository.getAll();

    const duplicate =
      departments.some(function(item) {

        return String(item.TenantID) ===
          String(user.TenantID) &&

          String(item.Code).toLowerCase() ===
          code.toLowerCase();

      });


    if (duplicate) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'این کد واحد قبلاً در این Tenant ثبت شده است.'
      );

    }


    const now =
      new Date().toISOString();


    const newDepartment = {

      ID:
        'DEP_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        user.TenantID,

      Name:
        department.Name,

      Code:
        code,

      Status:
        department.Status ||
        Constants.STATUS.ACTIVE,

      CreatedAt:
        now,

      UpdatedAt:
        now

    };


    const created =
      DepartmentRepository.insert(
        newDepartment
      );


    AuditService.log({

      TenantID:
        user.TenantID,

      UserID:
        user.ID,

      Action:
        Constants.ACTION.CREATE,

      EntityType:
        Constants.ENTITY.DEPARTMENT,

      EntityID:
        created.ID,

      OldData:
        null,

      NewData:
        created,

      Reason:
        'ایجاد واحد'

    });


    return Response.success(
      created,
      {
        message:
          'واحد با موفقیت ایجاد شد.'
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
      'شناسه واحد'
    );


    DepartmentValidator.validateUpdate(
      data
    );


    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );


    const existing =
      DepartmentRepository.findById(
        id
      );


    if (!existing) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'واحد مورد نظر پیدا نشد.'
      );

    }


    if (
      String(existing.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'واحد مورد نظر پیدا نشد.'
      );

    }


    if (
      data.Code !== undefined &&
      String(data.Code).trim() !==
        String(existing.Code)
    ) {

      const newCode =
        String(data.Code).trim();


      const departments =
        DepartmentRepository.getAll();


      const duplicate =
        departments.some(function(item) {

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
          'این کد واحد قبلاً در این Tenant ثبت شده است.'
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
      DepartmentRepository.update(
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
        Constants.ENTITY.DEPARTMENT,

      EntityID:
        id,

      OldData:
        existing,

      NewData:
        updated,

      Reason:
        data.Reason ||
        'ویرایش واحد'

    });


    return Response.success(
      updated,
      {
        message:
          'واحد با موفقیت ویرایش شد.'
      }
    );

  }

};