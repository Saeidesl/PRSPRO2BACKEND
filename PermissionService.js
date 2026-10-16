/**
 * ============================================================
 * PERMISSION SERVICE
 * Optimized version
 * ============================================================
 */

const PermissionService = {

  list: function(params) {
    AccessControlService.getCurrentUser(params || {});
    return Response.success(PermissionRepository.getAll());
  },

  get: function(id, params) {
    Validator.required(id, 'شناسه دسترسی');
    AccessControlService.getCurrentUser(params || {});

    const permission = PermissionRepository.findById(id);

    if (!permission) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'دسترسی مورد نظر پیدا نشد.'
      );
    }

    return Response.success(permission);
  },

  getByCode: function(code, params) {
    Validator.required(code, 'کد دسترسی');
    AccessControlService.getCurrentUser(params || {});

    const permission = PermissionRepository.findByCode(code);

    if (!permission) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'دسترسی مورد نظر پیدا نشد.'
      );
    }

    return permission;
  },

  /**
   * دریافت تمام مجوزهای کاربر با خواندن گروهی اطلاعات
   */
  getUserPermissions: function(userId) {
    Validator.required(userId, 'UserID');

    const user = UserRepository.findById(userId);

    if (!user) {
      throw ErrorHandler.create(
        Constants.ERROR.USER_NOT_FOUND,
        'کاربر پیدا نشد.'
      );
    }

    const tenantId = String(user.TenantID);

    const permissions = PermissionRepository.getAll();
    const userRoles = UserRoleRepository.getAll().filter(function(item) {
      return String(item.UserID) === String(userId) &&
        String(item.TenantID) === tenantId;
    });

    if (userRoles.length === 0) {
      return [];
    }

    const roles = RoleRepository.getAll().filter(function(role) {
      return String(role.TenantID) === tenantId;
    });

    const validRoleIds = {};

    roles.forEach(function(role) {
      validRoleIds[String(role.ID)] = true;
    });

    const roleIds = {};

    userRoles.forEach(function(userRole) {
      const roleId = String(userRole.RoleID);

      if (validRoleIds[roleId]) {
        roleIds[roleId] = true;
      }
    });

    const rolePermissions = GoogleSheetsRepository
      .getAll('07_RolePermissions')
      .filter(function(item) {
        return String(item.TenantID) === tenantId &&
          !!roleIds[String(item.RoleID)];
      });

    const permissionIds = {};

    rolePermissions.forEach(function(item) {
      permissionIds[String(item.PermissionID)] = true;
    });

    const result = [];
    const addedCodes = {};

    permissions.forEach(function(permission) {
      const permissionId = String(permission.ID);
      const code = String(permission.Code || '');

      if (permissionIds[permissionId] && code && !addedCodes[code]) {
        addedCodes[code] = true;
        result.push(code);
      }
    });

    return result;
  },

  /**
   * بررسی یک مجوز مشخص
   */
  hasPermission: function(userId, permissionCode) {
    Validator.required(userId, 'UserID');
    Validator.required(permissionCode, 'کد دسترسی');

    const grantedCodes = this.getUserPermissions(userId);
    return grantedCodes.indexOf(String(permissionCode)) !== -1;
  },

  requirePermission: function(userId, permissionCode) {
    const allowed = this.hasPermission(userId, permissionCode);

    if (!allowed) {
      throw ErrorHandler.create(
        Constants.ERROR.PERMISSION_DENIED,
        'شما دسترسی لازم برای انجام این عملیات را ندارید.'
      );
    }

    return true;
  }

};