/**
 * ============================================================
 * USER SERVICE
 * ============================================================
 */

const UserService = {


  list: function(params) {

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const users =
      UserRepository.getAll();

    const tenantUsers =
      users.filter(function(item) {

        return String(item.TenantID) ===
          String(user.TenantID);

      });

    return Response.success(
      this.sanitizeList_(tenantUsers)
    );

  },


  get: function(id, params) {

    Validator.required(
      id,
      'شناسه کاربر'
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const user =
      UserRepository.findById(
        id
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

    return Response.success(
      this.sanitizeUser_(user)
    );

  },


  create: function(
    user,
    params
  ) {

    UserValidator.validateCreate(
      user
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    if (!currentUser.TenantID) {

      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'Tenant کاربر مشخص نیست.'
      );

    }

    const username =
      String(user.Username).trim();

    const users =
      UserRepository.getAll();

    const duplicate =
      users.some(function(item) {

        return String(item.TenantID) ===
          String(currentUser.TenantID) &&

          String(item.Username).toLowerCase() ===
          username.toLowerCase();

      });

    if (duplicate) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'این نام کاربری قبلاً در این Tenant ثبت شده است.'
      );

    }


    /*
     * بررسی Department
     */

    const departmentId =
      user.DepartmentID || '';

    if (departmentId !== '') {

      const department =
        DepartmentRepository.findById(
          departmentId
        );

      if (!department) {

        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'واحد مورد نظر پیدا نشد.'
        );

      }

      if (
        String(department.TenantID) !==
        String(currentUser.TenantID)
      ) {

        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'واحد مورد نظر پیدا نشد.'
        );

      }

    }


    const now =
      new Date().toISOString();

    const password =
      user.Password !== undefined &&
      user.Password !== null
        ? String(user.Password)
        : '';


    const newUser = {

      ID:
        'USR_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        currentUser.TenantID,

      Name:
        user.Name,

      Username:
        username,

      PasswordHash:
        password !== ''
          ? AuthService.hashPassword_(
              password
            )
          : '',

      DepartmentID:
        departmentId,

      Status:
        user.Status ||
        Constants.STATUS.ACTIVE,

      CreatedAt:
        now,

      UpdatedAt:
        now

    };


    const created =
      UserRepository.insert(
        newUser
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
        created.ID,

      OldData:
        null,

      NewData:
        this.sanitizeUser_(created),

      Reason:
        'ایجاد کاربر'

    });


    return Response.success(

      this.sanitizeUser_(
        created
      ),

      {
        message:
          'کاربر با موفقیت ایجاد شد.'
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
      'شناسه کاربر'
    );

    UserValidator.validateUpdate(
      data
    );

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const existing =
      UserRepository.findById(
        id
      );

    if (!existing) {

      throw ErrorHandler.create(
        Constants.ERROR.USER_NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }

    if (
      String(existing.TenantID) !==
      String(currentUser.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'کاربر مورد نظر پیدا نشد.'
      );

    }


    /*
     * بررسی Username فقط در Tenant جاری
     */

    if (
      data.Username !== undefined &&
      String(data.Username).trim() !==
        String(existing.Username)
    ) {

      const username =
        String(data.Username).trim();

      const users =
        UserRepository.getAll();

      const duplicate =
        users.some(function(item) {

          return String(item.ID) !==
            String(id) &&

            String(item.TenantID) ===
            String(currentUser.TenantID) &&

            String(item.Username).toLowerCase() ===
            username.toLowerCase();

        });

      if (duplicate) {

        throw ErrorHandler.create(
          Constants.ERROR.DUPLICATE,
          'این نام کاربری قبلاً در این Tenant ثبت شده است.'
        );

      }

    }


    /*
     * بررسی Department
     */

    if (
      data.DepartmentID !== undefined &&
      data.DepartmentID !== null &&
      String(data.DepartmentID).trim() !== ''
    ) {

      const department =
        DepartmentRepository.findById(
          data.DepartmentID
        );

      if (!department) {

        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'واحد مورد نظر پیدا نشد.'
        );

      }

      if (
        String(department.TenantID) !==
        String(currentUser.TenantID)
      ) {

        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'واحد مورد نظر پیدا نشد.'
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
      data.Username !== undefined
    ) {

      updateData.Username =
        String(data.Username).trim();

    }


    if (
      data.Password !== undefined &&
      data.Password !== null
    ) {

      updateData.PasswordHash =
        AuthService.hashPassword_(
          String(data.Password)
        );

    }


    if (
      data.DepartmentID !== undefined
    ) {

      updateData.DepartmentID =
        data.DepartmentID;

    }


    if (
      data.Status !== undefined
    ) {

      updateData.Status =
        data.Status;

    }


    /*
     * جلوگیری از تغییر Tenant
     */

    delete updateData.TenantID;


    updateData.UpdatedAt =
      new Date().toISOString();


    const updated =
      UserRepository.update(
        id,
        updateData
      );


    AuditService.log({

      TenantID:
        currentUser.TenantID,

      UserID:
        currentUser.ID,

      Action:
        Constants.ACTION.UPDATE,

      EntityType:
        Constants.ENTITY.USER,

      EntityID:
        id,

      OldData:
        this.sanitizeUser_(
          existing
        ),

      NewData:
        this.sanitizeUser_(
          updated
        ),

      Reason:
        data.Reason ||
        'ویرایش کاربر'

    });


    return Response.success(

      this.sanitizeUser_(
        updated
      ),

      {
        message:
          'اطلاعات کاربر با موفقیت ویرایش شد.'
      }

    );

  },


  sanitizeUser_: function(user) {

    if (!user) {
      return null;
    }

    return {

      ID:
        user.ID,

      TenantID:
        user.TenantID,

      Name:
        user.Name,

      Username:
        user.Username,

      DepartmentID:
        user.DepartmentID,

      Status:
        user.Status,

      CreatedAt:
        user.CreatedAt,

      UpdatedAt:
        user.UpdatedAt

    };

  },


  sanitizeList_: function(users) {

    return (users || []).map(
      function(user) {

        return UserService.sanitizeUser_(
          user
        );

      }
    );

  }

};