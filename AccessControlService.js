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
    if (!user) return false;

    // Keep the legacy department-based identity during migration. New system
    // administrators use SYSTEM_MANAGE, expanded by PermissionService without
    // making every authorization check perform an extra admin lookup.
    return user.IsAdmin === true ||
      String(user.IsAdmin).toLowerCase() === 'true' ||
      this.getDepartmentCode(user) === 'ADMIN';
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