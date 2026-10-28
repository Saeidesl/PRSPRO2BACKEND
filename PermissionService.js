/**
 * ============================================================
 * PERMISSION SERVICE
 * Optimized version
 * ============================================================
 */

const PermissionService = {

  // Authorization results are cached only for the current web-app request.
  _requestUserPermissionCache: {},

  resetRequestCache: function() {
    this._requestUserPermissionCache = {};
  },

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
   * دریافت مجوزهای کاربر با خواندن گروهی اطلاعات
   */
  getUserPermissions: function(userId, userRecord) {
    Validator.required(userId, 'UserID');

    const suppliedUser = userRecord && String(userRecord.ID) === String(userId)
      ? userRecord
      : null;
    const user = suppliedUser || UserRepository.findById(userId);

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
      return String(role.TenantID) === tenantId &&
        String(role.Status || Constants.STATUS.ACTIVE) === Constants.STATUS.ACTIVE;
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
  hasPermission: function(userId, permissionCode, userRecord) {
    Validator.required(userId, 'UserID');
    Validator.required(permissionCode, 'کد دسترسی');

    const suppliedUser = userRecord && String(userRecord.ID) === String(userId)
      ? userRecord
      : null;
    const user = suppliedUser || UserRepository.findById(userId);

    if (!user) return false;

    const cacheKey = String(user.TenantID) + ':' + String(userId);
    if (!Object.prototype.hasOwnProperty.call(this._requestUserPermissionCache, cacheKey)) {
      // Resolve all permission codes in one bulk pass instead of repeating
      // findByCode/role filtering for every permission checked by Router.
      this._requestUserPermissionCache[cacheKey] = this.getUserPermissions(userId, user);
    }

    return this._requestUserPermissionCache[cacheKey].indexOf(String(permissionCode)) !== -1;

  },

  requirePermission: function(userId, permissionCode, userRecord) {
    // Reuse the already-authenticated user supplied by AccessControlService.
    // hasPermission still verifies that the supplied record belongs to userId.
    const allowed = this.hasPermission(userId, permissionCode, userRecord);

    if (!allowed) {
      throw ErrorHandler.create(
        Constants.ERROR.PERMISSION_DENIED,
        'شما دسترسی لازم برای انجام این عملیات را ندارید.'
      );
    }

    return true;
  }

};