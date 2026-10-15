function diagnoseUserPermissions() {
  const users = UserRepository.getAll();
  const userRoles = UserRoleRepository.getAll();
  const roles = RoleRepository.getAll();

  const report = users.map(function (user) {
    const userId = String(user.ID || '');
    const tenantId = String(user.TenantID || '');

    const assignedRoles = userRoles.filter(function (link) {
      return String(link.UserID) === userId &&
        String(link.TenantID) === tenantId;
    });

    const roleDetails = assignedRoles.map(function (link) {
      const role = roles.find(function (item) {
        return String(item.ID) === String(link.RoleID) &&
          String(item.TenantID) === tenantId;
      });

      return {
        roleId: String(link.RoleID || ''),
        roleName: role ? String(role.Name || role.Code || '') : 'نقش نامعتبر',
        roleTenantId: role ? String(role.TenantID || '') : '',
        valid: !!role
      };
    });

    let permissions = [];
    let error = '';

    try {
      permissions = PermissionService.getUserPermissions(userId) || [];
    } catch (e) {
      error = String(e && e.message ? e.message : e);
    }

    return {
      userId: userId,
      username: String(user.Username || ''),
      name: String(user.Name || ''),
      tenantId: tenantId,
      status: String(user.Status || ''),
      assignedRoleCount: assignedRoles.length,
      roles: roleDetails,
      permissionCount: permissions.length,
      permissionCodes: permissions,
      error: error
    };
  });

  console.log('=== USER PERMISSION DETAILS ===');
  console.log(JSON.stringify(report, null, 2));

  return report;
}