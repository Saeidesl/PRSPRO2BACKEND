/**
 * ============================================================
 * SESSION MANAGER
 * ============================================================
 */

const SessionManager = {

  PROPERTY_PREFIX: 'PMS_SESSION_',


  /**
   * ----------------------------------------------------------
   * CREATE SESSION
   * ----------------------------------------------------------
   */

  create: function(user) {

    Validator.required(
      user,
      'کاربر'
    );

    Validator.required(
      user.ID,
      'UserID'
    );

    const token =
      Utilities.getUuid().replace(/-/g, '');

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
        AppConfig.AUTH.SESSION_DURATION_HOURS *
        60 *
        60 *
        1000
      );

    const session = {

      token: token,

      userId: user.ID,

      tenantId: user.TenantID,

      createdAt:
        now.toISOString(),

      expiresAt:
        expiresAt.toISOString(),

      status:
        Constants.STATUS.ACTIVE

    };

    PropertiesService
      .getScriptProperties()
      .setProperty(
        this.PROPERTY_PREFIX + token,
        JSON.stringify(session)
      );

    return session;
  },


  /**
   * ----------------------------------------------------------
   * GET SESSION
   * ----------------------------------------------------------
   */

  get: function(token) {

    if (
      token === undefined ||
      token === null ||
      String(token).trim() === ''
    ) {

      return null;

    }

    const raw =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          this.PROPERTY_PREFIX + token
        );

    if (!raw) {

      return null;

    }

    let session;

    try {

      session =
        JSON.parse(raw);

    } catch (error) {

      return null;

    }

    if (
      session.status !==
      Constants.STATUS.ACTIVE
    ) {

      return null;

    }

    const expiresAt =
      new Date(
        session.expiresAt
      );

    if (
      expiresAt.getTime() <=
      new Date().getTime()
    ) {

      this.destroy(token);

      return null;

    }

    return session;

  },


  /**
   * ----------------------------------------------------------
   * REQUIRE SESSION
   * ----------------------------------------------------------
   */

  require: function(token) {

    const session =
      this.get(token);

    if (!session) {

      throw ErrorHandler.create(

        Constants.ERROR.UNAUTHORIZED,

        'نشست کاربر معتبر نیست یا منقضی شده است.'

      );

    }

    return session;

  },


  /**
   * ----------------------------------------------------------
   * DESTROY SESSION
   * ----------------------------------------------------------
   */

  destroy: function(token) {

    if (
      token === undefined ||
      token === null ||
      String(token).trim() === ''
    ) {

      return true;

    }

    PropertiesService
      .getScriptProperties()
      .deleteProperty(
        this.PROPERTY_PREFIX + token
      );

    return true;

  }

};