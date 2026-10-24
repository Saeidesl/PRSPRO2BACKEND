'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const accessSource = fs.readFileSync(path.join(__dirname, '..', 'AccessControlService.js'), 'utf8');
const webSource = fs.readFileSync(path.join(__dirname, '..', 'WebApp.js'), 'utf8');

test('authenticated user and admin status use request-scoped caches', () => {
  assert.match(accessSource, /_requestUserCache: \{\}/);
  assert.match(accessSource, /_requestAdminCache: \{\}/);
  assert.match(accessSource, /resetRequestCache: function\(\) \{\s*this\._requestUserCache = \{\};\s*this\._requestAdminCache = \{\};/);
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
