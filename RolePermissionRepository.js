
/**
 * ============================================================
 * ROLE PERMISSION SERVICE
 * ============================================================
 */

const RolePermissionService = {

  listByRole: function(roleId, params) {
    Validator.required(roleId, 'شناسه نقش');

    const user = AccessControlService.getCurrentUser(params || {});
    const role = RoleRepository.findById(roleId);

    if (
      !role ||
      String(role.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );
    }

    const items = RolePermissionRepository.findByRoleId(roleId);

    return Response.success(
      items.filter(function(item) {
        return String(item.TenantID) === String(user.TenantID);
      })
    );
  },

  _validateRole: function(roleId, params) {
    Validator.required(roleId, 'شناسه نقش');

    const user = AccessControlService.getCurrentUser(params || {});
    const role = RoleRepository.findById(roleId);

    if (
      !role ||
      String(role.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'نقش مورد نظر پیدا نشد.'
      );
    }

    return {
      user: user,
      role: role
    };
  },

  assign: function(roleId, permissionId, params) {
    const context = this._validateRole(roleId, params);

    Validator.required(permissionId, 'شناسه دسترسی');

    const user = context.user;
    const permission = PermissionRepository.findById(permissionId);

    if (!permission) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'دسترسی مورد نظر پیدا نشد.'
      );
    }

    const existing = RolePermissionRepository.find(
      roleId,
      permissionId
    );

    if (
      existing &&
      String(existing.TenantID) === String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'این دسترسی قبلاً به نقش اختصاص داده شده است.'
      );
    }

    if (existing) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'ارتباط موجود با شرکت فعلی مطابقت ندارد.'
      );
    }

    const newItem = this._createItem(
      roleId,
      permissionId,
      user.TenantID
    );

    const created = RolePermissionRepository.insert(newItem);

    AuditService.log({
      TenantID: user.TenantID,
      UserID: user.ID,
      Action: Constants.ACTION.CREATE,
      EntityType: Constants.ENTITY.ROLE,
      EntityID: roleId,
      OldData: null,
      NewData: created,
      Reason: 'اختصاص دسترسی به نقش'
    });

    return Response.success(created, {
      message: 'دسترسی با موفقیت به نقش اختصاص داده شد.'
    });
  },

  assignMany: function(roleId, permissionIds, params) {
    const context = this._validateRole(roleId, params);
    const user = context.user;

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'حداقل یک دسترسی را انتخاب کنید.'
      );
    }

    const ids = [];
    const seen = {};

    permissionIds.forEach(function(value) {
      const id = String(value === undefined || value === null ? '' : value).trim();

      if (id && !seen[id]) {
        seen[id] = true;
        ids.push(id);
      }
    });

    if (ids.length === 0) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'شناسه دسترسی معتبری ارسال نشده است.'
      );
    }

    const existingItems = RolePermissionRepository.findByRoleId(roleId);
    const existingByPermission = {};

    existingItems.forEach(function(item) {
      if (String(item.TenantID) === String(user.TenantID)) {
        existingByPermission[String(item.PermissionID)] = item;
      }
    });

    const newItems = [];
    const skipped = [];
    const invalid = [];

    ids.forEach(function(id) {
      const permission = PermissionRepository.findById(id);

      if (!permission) {
        invalid.push({
          permissionId: id,
          reason: 'دسترسی پیدا نشد.'
        });
        return;
      }

      if (existingByPermission[id]) {
        skipped.push({
          permissionId: id,
          reason: 'این دسترسی قبلاً ثبت شده است.'
        });
        return;
      }

      newItems.push(
        RolePermissionService._createItem(
          roleId,
          id,
          user.TenantID
        )
      );
    });

    let created = [];

    if (newItems.length > 0) {
      created = RolePermissionRepository.insertMany(newItems);
    }

    created.forEach(function(item) {
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: Constants.ACTION.CREATE,
        EntityType: Constants.ENTITY.ROLE,
        EntityID: roleId,
        OldData: null,
        NewData: item,
        Reason: 'اختصاص گروهی دسترسی به نقش'
      });
    });

    return Response.success({
      roleId: roleId,
      requestedCount: ids.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      invalidCount: invalid.length,
      created: created,
      skipped: skipped,
      invalid: invalid
    }, {
      message: 'عملیات افزودن گروهی دسترسی‌ها انجام شد.'
    });
  },

  remove: function(roleId, permissionId, params) {
    const context = this._validateRole(roleId, params);
    const user = context.user;

    Validator.required(permissionId, 'شناسه دسترسی');

    const item = RolePermissionRepository.find(
      roleId,
      permissionId
    );

    if (
      !item ||
      String(item.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'این دسترسی برای نقش ثبت نشده است.'
      );
    }

    RolePermissionRepository.delete(item.ID);

    AuditService.log({
      TenantID: user.TenantID,
      UserID: user.ID,
      Action: Constants.ACTION.DELETE,
      EntityType: Constants.ENTITY.ROLE,
      EntityID: roleId,
      OldData: item,
      NewData: null,
      Reason: 'حذف دسترسی از نقش'
    });

    return Response.success(null, {
      message: 'دسترسی با موفقیت از نقش حذف شد.'
    });
  },

  removeMany: function(roleId, permissionIds, params) {
    const context = this._validateRole(roleId, params);
    const user = context.user;

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'حداقل یک دسترسی را برای حذف انتخاب کنید.'
      );
    }

    const ids = [];
    const seen = {};

    permissionIds.forEach(function(value) {
      const id = String(value === undefined || value === null ? '' : value).trim();

      if (id && !seen[id]) {
        seen[id] = true;
        ids.push(id);
      }
    });

    const allItems = RolePermissionRepository.findByRoleId(roleId);
    const itemByPermission = {};

    allItems.forEach(function(item) {
      if (String(item.TenantID) === String(user.TenantID)) {
        itemByPermission[String(item.PermissionID)] = item;
      }
    });

    const toDelete = [];
    const missing = [];

    ids.forEach(function(id) {
      if (itemByPermission[id]) {
        toDelete.push(itemByPermission[id]);
      } else {
        missing.push({
          permissionId: id,
          reason: 'این دسترسی برای نقش ثبت نشده است.'
        });
      }
    });

    const result = RolePermissionRepository.deleteMany(
      toDelete.map(function(item) {
        return item.ID;
      })
    );

    toDelete.forEach(function(item) {
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: Constants.ACTION.DELETE,
        EntityType: Constants.ENTITY.ROLE,
        EntityID: roleId,
        OldData: item,
        NewData: null,
        Reason: 'حذف گروهی دسترسی از نقش'
      });
    });

    return Response.success({
      roleId: roleId,
      requestedCount: ids.length,
      deletedCount: result.deletedCount,
      missingCount: missing.length,
      deletedPermissionIds: toDelete.map(function(item) {
        return String(item.PermissionID);
      }),
      missing: missing
    }, {
      message: 'عملیات حذف گروهی دسترسی‌ها انجام شد.'
    });
  },

  _createItem: function(roleId, permissionId, tenantId) {
    return {
      ID: 'RP_' + Utilities.getUuid().replace(/-/g, ''),
      TenantID: tenantId,
      RoleID: roleId,
      PermissionID: permissionId,
      CreatedAt: new Date().toISOString()
    };
  }

};
