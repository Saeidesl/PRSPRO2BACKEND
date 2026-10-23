/**
 * ============================================================
 * ACCESS CONTROL SERVICE
 * ============================================================
 */

const AccessControlService = {

  getCurrentUser: function(params) {
    const result = AuthService.me(params || {});

    if (
      !result ||
      result.success !== true ||
      !result.data ||
      !result.data.ID
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'احراز هویت الزامی است.'
      );
    }

    return result.data;
  },

  getDepartmentCode: function(user) {
    if (!user || !user.DepartmentID) {
      return '';
    }

    const department = DepartmentRepository.findById(
      user.DepartmentID
    );

    if (
      !department ||
      String(department.TenantID) !== String(user.TenantID) ||
      String(department.Status) !== String(Constants.STATUS.ACTIVE)
    ) {
      return '';
    }

    return String(department.Code || '').trim().toUpperCase();
  },

  isAdmin: function(user) {
    if (!user || !user.ID || !user.TenantID) return false;
    const userRoles = UserRoleRepository.getAll().filter(function(item) {
      return String(item.UserID) === String(user.ID) &&
        String(item.TenantID) === String(user.TenantID);
    });
    if (!userRoles.length) return false;
    const assignedRoleIds = {};
    userRoles.forEach(function(item) { assignedRoleIds[String(item.RoleID)] = true; });
    return RoleRepository.getAll().some(function(role) {
      return String(role.TenantID) === String(user.TenantID) &&
        assignedRoleIds[String(role.ID)] === true &&
        String(role.Status || Constants.STATUS.ACTIVE) === Constants.STATUS.ACTIVE &&
        ['SYS_ADMIN', 'ADMIN'].indexOf(String(role.Code || '').trim().toUpperCase()) !== -1;
    });
  },

  enforceRouteAccess: function(method, path, params) {
    method = String(method || '').toUpperCase();
    path = String(path || '').trim();

    if (
      path === '/auth/login' ||
      path === '/auth/logout' ||
      path === '/auth/me'
    ) {
      return true;
    }

    const user = this.getCurrentUser(params || {});

    if (this.isAdmin(user)) {
      return true;
    }

    // بررسی مجوزهای عملیاتی در Router و سرویس‌های مربوطه انجام می‌شود.
    return true;
  },

  getUserPermissions: function(userId, userRecord) {
    Validator.required(userId, 'UserID');

    return PermissionService.getUserPermissions(userId, userRecord);
  },

  require: function(params, permissionCode) {
    const user = this.getCurrentUser(params || {});

    if (this.isAdmin(user)) {
      return user;
    }

    PermissionService.requirePermission(
      user.ID,
      permissionCode,
      user
    );

    return user;
  }

};