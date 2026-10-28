/**
 * ============================================================
 * ACCESS CONTROL SERVICE
 * ============================================================
 */

const AccessControlService = {

  _requestUserCache: {},
  _requestAdminCache: {},
  _requestUserRolesCache: {},
  _requestActiveRolesCache: {},

  resetRequestCache: function() {
    this._requestUserCache = {};
    this._requestAdminCache = {};
    this._requestUserRolesCache = {};
    this._requestActiveRolesCache = {};
  },

  getCurrentUser: function(params) {
    params = params || {};
    const token = AuthService.getToken_(params);
    const cacheKey = token ? 'token:' + token : '';
    if (cacheKey && Object.prototype.hasOwnProperty.call(this._requestUserCache, cacheKey)) {
      return this._requestUserCache[cacheKey];
    }

    const result = AuthService.me(params);

    if (!result || result.success !== true || !result.data || !result.data.ID) {
      throw ErrorHandler.create(Constants.ERROR.UNAUTHORIZED, 'احراز هویت الزامی است.');
    }

    if (cacheKey) this._requestUserCache[cacheKey] = result.data;
    return result.data;
  },

  getDepartmentCode: function(user) {
    if (!user || !user.DepartmentID) return '';
    const department = DepartmentRepository.findById(user.DepartmentID);
    if (!department ||
        String(department.TenantID) !== String(user.TenantID) ||
        String(department.Status) !== String(Constants.STATUS.ACTIVE)) return '';
    return String(department.Code || '').trim().toUpperCase();
  },

  // Share filtered role snapshots between admin checks and permission resolution
  // during one request. Repository request caches are reset at request start.
  getUserRolesForRequest_: function(userId, tenantId) {
    const key = String(tenantId) + ':' + String(userId);
    if (!Object.prototype.hasOwnProperty.call(this._requestUserRolesCache, key)) {
      this._requestUserRolesCache[key] = UserRoleRepository.getAll().filter(function(item) {
        return String(item.UserID) === String(userId) &&
          String(item.TenantID) === String(tenantId);
      });
    }
    return this._requestUserRolesCache[key];
  },

  getActiveRolesForTenantRequest_: function(tenantId) {
    const key = String(tenantId);
    if (!Object.prototype.hasOwnProperty.call(this._requestActiveRolesCache, key)) {
      this._requestActiveRolesCache[key] = RoleRepository.getAll().filter(function(role) {
        return String(role.TenantID) === key &&
          String(role.Status || Constants.STATUS.ACTIVE) === Constants.STATUS.ACTIVE;
      });
    }
    return this._requestActiveRolesCache[key];
  },

  isAdmin: function(user) {
    if (!user || !user.ID || !user.TenantID) return false;
    const cacheKey = 'user:' + String(user.TenantID) + '|' + String(user.ID);
    if (Object.prototype.hasOwnProperty.call(this._requestAdminCache, cacheKey)) {
      return this._requestAdminCache[cacheKey];
    }
    const userRoles = this.getUserRolesForRequest_(user.ID, user.TenantID);
    if (!userRoles.length) {
      this._requestAdminCache[cacheKey] = false;
      return false;
    }
    const assignedRoleIds = {};
    userRoles.forEach(function(item) { assignedRoleIds[String(item.RoleID)] = true; });
    const isAdmin = this.getActiveRolesForTenantRequest_(user.TenantID).some(function(role) {
      return assignedRoleIds[String(role.ID)] === true &&
        ['SYS_ADMIN', 'ADMIN'].indexOf(String(role.Code || '').trim().toUpperCase()) !== -1;
    });
    this._requestAdminCache[cacheKey] = isAdmin;
    return isAdmin;
  },

  enforceRouteAccess: function(method, path, params) {
    method = String(method || '').toUpperCase();
    path = String(path || '').trim();
    if (path === '/auth/login' || path === '/auth/logout' || path === '/auth/me') return true;
    const user = this.getCurrentUser(params || {});
    if (this.isAdmin(user)) return true;
    // بررسی مجوزهای عملیاتی در Router و سرویس‌های مربوطه انجام می‌شود.
    return true;
  },

  getUserPermissions: function(userId, userRecord) {
    Validator.required(userId, 'UserID');
    return PermissionService.getUserPermissions(userId, userRecord);
  },

  require: function(params, permissionCode) {
    const user = this.getCurrentUser(params || {});
    if (this.isAdmin(user)) return user;
    PermissionService.requirePermission(user.ID, permissionCode, user);
    return user;
  }

};