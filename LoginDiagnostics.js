/**
 * Read-only diagnostics for the authentication rollout.
 * Run diagnoseAuthenticationSetup() in Apps Script before publishing the
 * role-based administrator policy. This function never changes spreadsheet data.
 */
function diagnoseAuthenticationSetup() {
  const users = UserRepository.getAll();
  const departments = DepartmentRepository.getAll();
  const roles = RoleRepository.getAll();
  const userRoles = UserRoleRepository.getAll();

  const activeUsers = users.filter(function(user) {
    return String(user.Status || '').toUpperCase() === Constants.STATUS.ACTIVE;
  });

  const usernames = {};
  users.forEach(function(user) {
    const username = String(user.Username || '').trim().toLowerCase();
    if (!username) return;
    if (!usernames[username]) usernames[username] = [];
    usernames[username].push({
      ID: String(user.ID || ''),
      TenantID: String(user.TenantID || ''),
      Status: String(user.Status || '')
    });
  });

  const duplicateUsernames = Object.keys(usernames).filter(function(username) {
    return usernames[username].length > 1;
  }).map(function(username) {
    return { username: username, accounts: usernames[username] };
  });

  const activeAdminRoleIdsByTenant = {};
  roles.forEach(function(role) {
    const tenantId = String(role.TenantID || '');
    const code = String(role.Code || '').trim().toUpperCase();
    const active = String(role.Status || Constants.STATUS.ACTIVE) === Constants.STATUS.ACTIVE;
    if (!active || ['SYS_ADMIN', 'ADMIN'].indexOf(code) === -1) return;
    if (!activeAdminRoleIdsByTenant[tenantId]) activeAdminRoleIdsByTenant[tenantId] = {};
    activeAdminRoleIdsByTenant[tenantId][String(role.ID)] = true;
  });

  const usersWithAdminRole = {};
  userRoles.forEach(function(userRole) {
    const tenantId = String(userRole.TenantID || '');
    const userId = String(userRole.UserID || '');
    const roleId = String(userRole.RoleID || '');
    if (activeAdminRoleIdsByTenant[tenantId] &&
        activeAdminRoleIdsByTenant[tenantId][roleId]) {
      usersWithAdminRole[tenantId + '|' + userId] = true;
    }
  });

  const adminDepartmentIdsByTenant = {};
  departments.forEach(function(department) {
    if (String(department.Status || Constants.STATUS.ACTIVE) !== Constants.STATUS.ACTIVE) return;
    if (String(department.Code || '').trim().toUpperCase() !== 'ADMIN') return;
    const tenantId = String(department.TenantID || '');
    if (!adminDepartmentIdsByTenant[tenantId]) adminDepartmentIdsByTenant[tenantId] = {};
    adminDepartmentIdsByTenant[tenantId][String(department.ID)] = true;
  });

  const adminUsersMissingRole = activeUsers.filter(function(user) {
    const tenantId = String(user.TenantID || '');
    const userId = String(user.ID || '');
    const departmentId = String(user.DepartmentID || '');
    const belongsToLegacyAdminDepartment = adminDepartmentIdsByTenant[tenantId] &&
      adminDepartmentIdsByTenant[tenantId][departmentId];
    return !!belongsToLegacyAdminDepartment && !usersWithAdminRole[tenantId + '|' + userId];
  }).map(function(user) {
    return { ID: String(user.ID || ''), Username: String(user.Username || ''), TenantID: String(user.TenantID || '') };
  });

  const inactiveRoleAssignments = userRoles.filter(function(userRole) {
    const role = roles.find(function(item) {
      return String(item.ID) === String(userRole.RoleID) &&
        String(item.TenantID) === String(userRole.TenantID);
    });
    return !role || String(role.Status || Constants.STATUS.ACTIVE) !== Constants.STATUS.ACTIVE;
  }).map(function(userRole) {
    return { UserID: String(userRole.UserID || ''), RoleID: String(userRole.RoleID || ''), TenantID: String(userRole.TenantID || '') };
  });

  const report = {
    activeUserCount: activeUsers.length,
    duplicateUsernames: duplicateUsernames,
    activeUsersInAdminDepartmentMissingAdminRole: adminUsersMissingRole,
    userRoleAssignmentsToInactiveOrMissingRoles: inactiveRoleAssignments
  };

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
