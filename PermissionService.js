/**
 * ============================================================
 * PERMISSION SERVICE
 * Optimized version
 * ============================================================
 */

const PermissionService = {

  // Permission inheritance is explicit and centralized. A manage/edit
  // permission includes the corresponding read permission, while independent
  // actions (such as voiding an event or changing project status) stay separate.
  IMPLIED_PERMISSIONS: {
    PROJECT_EDIT: ['PROJECT_VIEW'],
    EVENT_EDIT: ['EVENT_VIEW'],
    USER_EDIT: ['USER_VIEW'],
    ROLE_MANAGE: ['ROLE_VIEW'],
    PERMISSION_MANAGE: ['PERMISSION_VIEW'],
    DEPARTMENT_MANAGE: ['DEPARTMENT_VIEW'],
    EVENT_TYPE_MANAGE: ['EVENT_TYPE_VIEW'],
    WORKFLOW_MANAGE: ['WORKFLOW_VIEW'],
    PROJECT_STATUS_MANAGE: ['PROJECT_STATUS_VIEW'],
    ATTACHMENT_MANAGE: ['ATTACHMENT_VIEW', 'ATTACHMENT_UPLOAD', 'ATTACHMENT_DELETE']
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
   * دریافت تمام مجوزهای کاربر با خواندن گروهی اطلاعات
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

    // Expand inherited permissions once so frontend and backend use the same
    // effective permission set rather than each implementing its own rules.
    const effective = Object.create(null);
    const self = this;
    result.forEach(function(code) {
      effective[code] = true;
      (self.IMPLIED_PERMISSIONS[code] || []).forEach(function(impliedCode) {
        effective[impliedCode] = true;
      });
    });

    return Object.keys(effective);
  },

  /**
   * Check the effective permission set, including explicitly defined inheritance.
   */
  hasPermission: function(userId, permissionCode, userRecord) {
    Validator.required(userId, 'UserID');
    Validator.required(permissionCode, 'کد دسترسی');
    return this.getUserPermissions(userId, userRecord).indexOf(String(permissionCode)) !== -1;
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