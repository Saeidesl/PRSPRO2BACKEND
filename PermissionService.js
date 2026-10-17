/**
 * ============================================================
 * PERMISSION SERVICE
 * Optimized version
 * ============================================================
 */

const PermissionService = {

  // Effective permissions and the lookup rights required by supported workflows
  // are defined centrally. Independent actions such as event voiding and project
  // status changes remain separate from ordinary edit permission.
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

    const activeStatus = String(Constants.STATUS.ACTIVE || 'ACTIVE').toUpperCase();
    const permissions = (PermissionRepository.getAll() || []).filter(function(permission) {
      return String(permission.Status || '').trim().toUpperCase() === activeStatus;
    });
    const userRoles = UserRoleRepository.getAll().filter(function(item) {
      return String(item.UserID) === String(userId) &&
        String(item.TenantID) === tenantId;
    });

    if (userRoles.length === 0) {
      return [];
    }

    const roles = (RoleRepository.getAll() || []).filter(function(role) {
      return String(role.TenantID) === tenantId &&
        String(role.Status || '').trim().toUpperCase() === activeStatus;
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

    // SYSTEM_MANAGE is the explicit super-administrator grant. Expand it
    // dynamically to all registered permissions so adding a new permission does
    // not require maintaining a second hardcoded list.
    if (result.indexOf('SYSTEM_MANAGE') !== -1) {
      return permissions.map(function(permission) {
        return String(permission.Code || '');
      }).filter(Boolean);
    }

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
   * Prevent an administrator from removing their own final SYSTEM_MANAGE grant.
   * exclusions may omit one role, one user-role link, or selected permissions
   * from a role while simulating the proposed change.
   */
  assertRetainsSystemManage: function(userId, userRecord, exclusions) {
    Validator.required(userId, 'UserID');
    exclusions = exclusions || {};

    const user = userRecord && String(userRecord.ID) === String(userId)
      ? userRecord
      : UserRepository.findById(userId);

    if (!user || AccessControlService.isAdmin(user)) return true;

    const currentPermissions = this.getUserPermissions(userId, user);
    if (currentPermissions.indexOf('SYSTEM_MANAGE') === -1) return true;

    const tenantId = String(user.TenantID);
    const activeStatus = String(Constants.STATUS.ACTIVE || 'ACTIVE').toUpperCase();
    const excludedRoleId = exclusions.excludeRoleId == null
      ? ''
      : String(exclusions.excludeRoleId);
    const excludedUserRoleId = exclusions.excludeUserRoleId == null
      ? ''
      : String(exclusions.excludeUserRoleId);
    const excludedPermissionIds = {};
    (exclusions.excludePermissionIds || []).forEach(function(id) {
      excludedPermissionIds[String(id)] = true;
    });

    const assignedRoles = (UserRoleRepository.getAll() || []).filter(function(link) {
      return String(link.UserID) === String(userId) &&
        String(link.TenantID) === tenantId &&
        String(link.ID) !== excludedUserRoleId &&
        String(link.RoleID) !== excludedRoleId;
    });
    const assignedRoleIds = {};
    assignedRoles.forEach(function(link) {
      assignedRoleIds[String(link.RoleID)] = true;
    });

    const activeRoles = (RoleRepository.getAll() || []).filter(function(role) {
      return String(role.TenantID) === tenantId &&
        String(role.Status || '').trim().toUpperCase() === activeStatus &&
        !!assignedRoleIds[String(role.ID)];
    });
    const activeRoleIds = {};
    activeRoles.forEach(function(role) {
      activeRoleIds[String(role.ID)] = true;
    });

    const activePermissions = (PermissionRepository.getAll() || []).filter(function(permission) {
      return String(permission.Status || '').trim().toUpperCase() === activeStatus &&
        String(permission.Code || '') === 'SYSTEM_MANAGE';
    });
    const systemManagePermissionIds = {};
    activePermissions.forEach(function(permission) {
      systemManagePermissionIds[String(permission.ID)] = true;
    });

    const remainingGrant = (GoogleSheetsRepository.getAll('07_RolePermissions') || []).some(function(link) {
      if (
        String(link.TenantID) !== tenantId ||
        !activeRoleIds[String(link.RoleID)] ||
        !systemManagePermissionIds[String(link.PermissionID)]
      ) return false;

      if (
        String(link.RoleID) === excludedRoleId &&
        excludedPermissionIds[String(link.PermissionID)]
      ) return false;

      return true;
    });

    if (!remainingGrant) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'برای جلوگیری از قفل شدن دسترسی مدیر سامانه، ابتدا دسترسی مدیریتی دیگری به خود اختصاص دهید.'
      );
    }

    return true;
  },

  /**
   * Check the effective permission set, including explicitly defined inheritance.
   */
  hasPermission: function(userId, permissionCode, userRecord) {
    Validator.required(userId, 'UserID');
    Validator.required(permissionCode, 'کد دسترسی');
    return this.getUserPermissions(userId, userRecord).indexOf(String(permissionCode)) !== -1;
  },

  requirePermission: function(userId, permissionCode, userRecord) {
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