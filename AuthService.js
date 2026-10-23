/**
 * ============================================================
 * AUTH SERVICE
 * ============================================================
 */

const AuthService = {

  login: function(body, params) {
    Validator.object(body, 'اطلاعات ورود');

    Validator.required(body.username, 'نام کاربری');
    Validator.required(body.password, 'رمز عبور');

    const username = String(body.username).trim();
    const password = String(body.password);

    const matchingUsers = typeof UserRepository.findAllByUsername === 'function'
      ? UserRepository.findAllByUsername(username)
      : [UserRepository.findByUsername(username)].filter(Boolean);

    // Usernames can repeat across tenants. Without a tenant selector, fail closed.
    if (matchingUsers.length !== 1) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'نام کاربری یا رمز عبور صحیح نیست.'
      );
    }

    const user = matchingUsers[0];

    if (String(user.Status) !== Constants.STATUS.ACTIVE) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'حساب کاربری فعال نیست.'
      );
    }

    const passwordHash = this.hashPassword_(password);

    if (String(user.PasswordHash) !== String(passwordHash)) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'نام کاربری یا رمز عبور صحیح نیست.'
      );
    }

    const session = SessionManager.create(user);

    const departmentCode =
      AccessControlService.getDepartmentCode(user);

    return Response.success(
      {
        token: session.token,
        expiresAt: session.expiresAt,

        user: {
          ID: user.ID,
          TenantID: user.TenantID,
          Name: user.Name,
          Username: user.Username,
          DepartmentID: user.DepartmentID,
          DepartmentCode: departmentCode,
          IsAdmin: AccessControlService.isAdmin(user),
          Status: user.Status
        }
      },
      {
        message: 'ورود با موفقیت انجام شد.'
      }
    );
  },

  logout: function(params) {
    const token = this.getToken_(params);

    if (token) {
      SessionManager.destroy(token);
    }

    return Response.success(
      null,
      {
        message: 'خروج با موفقیت انجام شد.'
      }
    );
  },

  me: function(params) {
    const token = this.getToken_(params);
    const session = SessionManager.require(token);

    const user = UserRepository.findById(session.userId);

    if (!user) {
      throw ErrorHandler.create(
        Constants.ERROR.USER_NOT_FOUND,
        'کاربر مربوط به نشست پیدا نشد.'
      );
    }

    if (String(user.Status) !== Constants.STATUS.ACTIVE) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'حساب کاربری فعال نیست.'
      );
    }

    if (
      String(user.TenantID) !==
      String(session.tenantId)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'نشست کاربر معتبر نیست.'
      );
    }

    const departmentCode =
      AccessControlService.getDepartmentCode(user);

    return Response.success(
      {
        ID: user.ID,
        TenantID: user.TenantID,
        Name: user.Name,
        Username: user.Username,
        DepartmentID: user.DepartmentID,
        DepartmentCode: departmentCode,
        IsAdmin: AccessControlService.isAdmin(user),
        Status: user.Status
      }
    );
  },

  getToken_: function(params) {
    params = params || {};

    let token =
      params.token ||
      params.sessionToken ||
      params.Authorization ||
      '';

    token = String(token).trim();

    if (token.indexOf('Bearer ') === 0) {
      token = token.substring(7).trim();
    }

    return token;
  },

  hashPassword_: function(password) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(password),
      Utilities.Charset.UTF_8
    );

    return bytes
      .map(function(byte) {
        const value = byte < 0 ? byte + 256 : byte;

        return (
          value < 16 ? '0' : ''
        ) + value.toString(16);
      })
      .join('');
  }

};