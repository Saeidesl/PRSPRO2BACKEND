/**
 * ============================================================
 * SESSION MANAGER
 * ============================================================
 */

const SessionManager = {
  PROPERTY_PREFIX: 'PMS_SESSION_',
  ONLINE_WINDOW_MS: 3 * 60 * 1000,
  LAST_SEEN_WRITE_INTERVAL_MS: 60 * 1000,

  create: function(user) {
    Validator.required(user, 'کاربر');
    Validator.required(user.ID, 'UserID');

    const token = Utilities.getUuid().replace(/-/g, '');
    const now = new Date();
    const durationHours = Number(AppConfig.AUTH.SESSION_DURATION_HOURS);
    const expiresAt = durationHours > 0
      ? new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString()
      : null;

    const session = {
      token: token,
      userId: user.ID,
      tenantId: user.TenantID,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: expiresAt,
      status: Constants.STATUS.ACTIVE
    };

    PropertiesService.getScriptProperties().setProperty(
      this.PROPERTY_PREFIX + token,
      JSON.stringify(session)
    );
    return session;
  },

  get: function(token) {
    if (token === undefined || token === null || String(token).trim() === '') return null;

    const properties = PropertiesService.getScriptProperties();
    const propertyKey = this.PROPERTY_PREFIX + token;
    const raw = properties.getProperty(propertyKey);
    if (!raw) return null;

    let session;
    try {
      session = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    if (session.status !== Constants.STATUS.ACTIVE) return null;

    const durationHours = Number(AppConfig.AUTH.SESSION_DURATION_HOURS);
    if (durationHours > 0 && session.expiresAt) {
      const expiresAt = new Date(session.expiresAt);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
        this.destroy(token);
        return null;
      }
    }

    // Track presence without writing Script Properties on every API request.
    const now = Date.now();
    const lastSeen = new Date(session.lastSeenAt || session.createdAt || 0).getTime();
    if (!lastSeen || now - lastSeen >= this.LAST_SEEN_WRITE_INTERVAL_MS) {
      session.lastSeenAt = new Date(now).toISOString();
      properties.setProperty(propertyKey, JSON.stringify(session));
    }

    return session;
  },

  listForAdmin: function(adminUser, currentToken) {
    if (!adminUser || !adminUser.ID || !adminUser.TenantID ||
        !AccessControlService.isAdmin(adminUser)) {
      throw ErrorHandler.create(Constants.ERROR.PERMISSION_DENIED, 'فقط مدیر سامانه می‌تواند نشست‌ها را مشاهده کند.');
    }

    const allProperties = PropertiesService.getScriptProperties().getProperties();
    const now = Date.now();
    const tenantId = String(adminUser.TenantID);
    const currentSessionId = this.hashSessionId_(currentToken);
    const usersById = {};
    const sessions = [];

    Object.keys(allProperties).forEach(function(key) {
      if (key.indexOf(SessionManager.PROPERTY_PREFIX) !== 0) return;

      const token = key.substring(SessionManager.PROPERTY_PREFIX.length);
      let session;
      try {
        session = JSON.parse(allProperties[key]);
      } catch (error) {
        return;
      }

      if (!session || session.status !== Constants.STATUS.ACTIVE ||
          String(session.tenantId) !== tenantId) return;

      const durationHours = Number(AppConfig.AUTH.SESSION_DURATION_HOURS);
      if (durationHours > 0 && session.expiresAt &&
          new Date(session.expiresAt).getTime() <= now) {
        PropertiesService.getScriptProperties().deleteProperty(key);
        return;
      }

      const userId = String(session.userId || '');
      if (!userId) return;

      if (!Object.prototype.hasOwnProperty.call(usersById, userId)) {
        usersById[userId] = UserRepository.findById(userId);
      }
      const user = usersById[userId];
      if (!user || String(user.TenantID) !== tenantId ||
          String(user.Status) !== String(Constants.STATUS.ACTIVE)) return;

      const lastSeenAt = session.lastSeenAt || session.createdAt || null;
      const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
      sessions.push({
        sessionId: SessionManager.hashSessionId_(token),
        userId: userId,
        userName: String(user.Name || user.FullName || user.Username || 'کاربر'),
        username: String(user.Username || ''),
        createdAt: session.createdAt || null,
        lastSeenAt: lastSeenAt,
        online: !!lastSeenMs && now - lastSeenMs <= SessionManager.ONLINE_WINDOW_MS,
        isCurrent: SessionManager.hashSessionId_(token) === currentSessionId
      });
    });

    sessions.sort(function(a, b) {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime();
    });

    return Response.success({
      sessions: sessions,
      onlineCount: sessions.filter(function(item) { return item.online; }).length,
      totalSessions: sessions.length,
      onlineWindowMinutes: Math.round(this.ONLINE_WINDOW_MS / 60000)
    });
  },

  revokeForAdmin: function(sessionId, adminUser, currentToken) {
    if (!adminUser || !adminUser.ID || !adminUser.TenantID ||
        !AccessControlService.isAdmin(adminUser)) {
      throw ErrorHandler.create(Constants.ERROR.PERMISSION_DENIED, 'فقط مدیر سامانه می‌تواند نشست‌ها را خاتمه دهد.');
    }

    const requestedId = String(sessionId || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(requestedId)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نشست موردنظر پیدا نشد.');
    }
    if (requestedId === this.hashSessionId_(currentToken)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای خروج از نشست فعلی از دکمه خروج استفاده کنید.');
    }

    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    const tenantId = String(adminUser.TenantID);

    for (const key in allProperties) {
      if (key.indexOf(this.PROPERTY_PREFIX) !== 0) continue;
      const token = key.substring(this.PROPERTY_PREFIX.length);
      if (this.hashSessionId_(token) !== requestedId) continue;

      let session;
      try {
        session = JSON.parse(allProperties[key]);
      } catch (error) {
        break;
      }

      if (!session || String(session.tenantId) !== tenantId) break;
      properties.deleteProperty(key);
      return Response.success({ revoked: true }, { message: 'نشست کاربر با موفقیت خاتمه یافت.' });
    }

    throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نشست موردنظر پیدا نشد یا قبلاً خاتمه یافته است.');
  },

  hashSessionId_: function(token) {
    if (token === undefined || token === null || String(token).trim() === '') return '';
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(token),
      Utilities.Charset.UTF_8
    );
    return bytes.map(function(byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return (value < 16 ? '0' : '') + value.toString(16);
    }).join('');
  },

  require: function(token) {
    const session = this.get(token);
    if (!session) {
      throw ErrorHandler.create(Constants.ERROR.UNAUTHORIZED, 'نشست کاربر معتبر نیست یا منقضی شده است.');
    }
    return session;
  },

  destroy: function(token) {
    if (token === undefined || token === null || String(token).trim() === '') return true;
    PropertiesService.getScriptProperties().deleteProperty(this.PROPERTY_PREFIX + token);
    return true;
  }
};
