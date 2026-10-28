'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const accessSource = fs.readFileSync(path.join(__dirname, '..', 'AccessControlService.js'), 'utf8');
const webSource = fs.readFileSync(path.join(__dirname, '..', 'WebApp.js'), 'utf8');
const permissionSource = fs.readFileSync(path.join(__dirname, '..', 'PermissionService.js'), 'utf8');

test('authenticated user and admin status use request-scoped caches', () => {
  assert.match(accessSource, /_requestUserCache: \{\}/);
  assert.match(accessSource, /_requestAdminCache: \{\}/);
  assert.match(accessSource, /_requestUserRolesCache: \{\}/);
  assert.match(accessSource, /_requestActiveRolesCache: \{\}/);
  assert.match(accessSource, /resetRequestCache: function\(\) \{[\s\S]*?this\._requestUserRolesCache = \{\};[\s\S]*?this\._requestActiveRolesCache = \{\};/);
  assert.match(accessSource, /const token = AuthService\.getToken_\(params\);/);
  assert.match(accessSource, /Object\.prototype\.hasOwnProperty\.call\(this\._requestUserCache, cacheKey\)/);
  assert.match(accessSource, /Object\.prototype\.hasOwnProperty\.call\(this\._requestAdminCache, cacheKey\)/);
  assert.match(accessSource, /this\._requestAdminCache\[cacheKey\] = false/);
  assert.match(accessSource, /this\._requestAdminCache\[cacheKey\] = isAdmin/);
});

test('request-scoped authorization caches reset at the beginning of GET and POST executions', () => {
  assert.match(webSource, /function resetRequestCaches_\(\) \{[\s\S]*?AccessControlService\.resetRequestCache\(\);/);
  assert.equal((webSource.match(/resetRequestCaches_\(\);/g) || []).length, 2);
});

test('permission checks reuse one resolved permission list per user within a request', () => {
  assert.match(permissionSource, /_requestUserPermissionCache: \{\}/);
  assert.match(permissionSource, /resetRequestCache: function\(\) \{\s*this\._requestUserPermissionCache = \{\};/);
  assert.match(permissionSource, /this\.getUserPermissions\(userId, user\)/);
  assert.match(permissionSource, /this\._requestUserPermissionCache\[cacheKey\]\.indexOf\(String\(permissionCode\)\)/);
  assert.match(webSource, /function resetRequestCaches_\(\) \{[\s\S]*?PermissionService\.resetRequestCache\(\);/);
});

test('admin and permission checks share tenant-scoped role snapshots within a request', () => {
  assert.match(accessSource, /getUserRolesForRequest_: function\(userId, tenantId\)/);
  assert.match(accessSource, /getActiveRolesForTenantRequest_: function\(tenantId\)/);
  assert.match(accessSource, /this\.getUserRolesForRequest_\(user\.ID, user\.TenantID\)/);
  assert.match(accessSource, /this\.getActiveRolesForTenantRequest_\(user\.TenantID\)/);
  assert.match(permissionSource, /AccessControlService\.getUserRolesForRequest_\(userId, tenantId\)/);
  assert.match(permissionSource, /AccessControlService\.getActiveRolesForTenantRequest_\(tenantId\)/);
});
