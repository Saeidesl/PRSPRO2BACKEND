/**
 * ============================================================
 * REQUEST PARSER
 * ============================================================
 *
 * مسئول:
 * - دریافت Path
 * - تشخیص Method
 * - خواندن Query Parameters
 * - خواندن JSON Body
 * - انتقال Token از Body به Params
 * - نرمال‌سازی Path
 *
 * Frontend مستقل
 *      ↓
 * HTTP Request
 *      ↓
 * RequestParser
 *      ↓
 * Router
 * ============================================================
 */

const RequestParser = {

  /**
   * ==========================================================
   * GET
   * ==========================================================
   */

  parseGet: function(e) {

    const params =
      e && e.parameter
        ? Object.assign({}, e.parameter)
        : {};


    /*
     * Token از Query Parameter
     *
     * مثال:
     * ?path=/projects&token=SESSION_TOKEN
     */

    if (
      params.token !== undefined &&
      params.token !== null
    ) {

      params.token =
        String(
          params.token
        ).trim();

    }


    return {

      path:
        this.normalizePath(
          params.path || '/'
        ),

      method:
        'GET',

      params:
        params,

      body:
        {}

    };

  },


  /**
   * ==========================================================
   * POST / PUT / DELETE
   * ==========================================================
   */

  parsePost: function(e) {

    const params =
      e && e.parameter
        ? Object.assign({}, e.parameter)
        : {};


    let body = {};


    /*
     * Read JSON Body
     */

    if (
      e &&
      e.postData &&
      e.postData.contents
    ) {

      const content =
        String(
          e.postData.contents
        ).trim();


      if (
        content !== ''
      ) {

        try {

          body =
            JSON.parse(
              content
            );

        } catch (error) {

          throw ErrorHandler.create(
            Constants.ERROR.VALIDATION_ERROR,
            'اطلاعات ارسال‌شده معتبر نیست.'
          );

        }

      }

    }


    /*
     * Body باید Object باشد.
     */

    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'بدنه درخواست معتبر نیست.'
      );

    }


    /*
     * Method
     *
     * اولویت:
     *
     * method
     * _method
     * POST
     */

    const method = (

      params.method ||

      params._method ||

      body._method ||

      body.method ||

      'POST'

    )
      .toString()
      .trim()
      .toUpperCase();


    const allowedMethods = [
      'POST',
      'PUT',
      'DELETE'
    ];


    if (
      allowedMethods.indexOf(
        method
      ) === -1
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_OPERATION,
        'متد درخواست معتبر نیست.'
      );

    }


    /*
     * Token
     *
     * برای Frontend مستقل می‌توان Token را
     * داخل JSON Body ارسال کرد.
     *
     * مثال:
     *
     * {
     *   "token": "...",
     *   "username": "...",
     *   "password": "..."
     * }
     *
     * Token به params منتقل می‌شود تا
     * Router و AccessControlService همان
     * ساختار فعلی را دریافت کنند.
     */

    if (
      (
        params.token === undefined ||
        params.token === null ||
        String(params.token).trim() === ''
      ) &&
      body.token !== undefined &&
      body.token !== null
    ) {

      params.token =
        String(
          body.token
        ).trim();

    }


    /*
     * Token را از Body حذف نمی‌کنیم.
     *
     * چون بعضی Endpointها ممکن است در آینده
     * به Body اصلی نیاز داشته باشند.
     */


    return {

      path:
        this.normalizePath(
          params.path ||
          body.path ||
          '/'
        ),

      method:
        method,

      body:
        body,

      params:
        params

    };

  },


  /**
   * ==========================================================
   * PATH NORMALIZER
   * ==========================================================
   */

  normalizePath: function(path) {

    path =
      String(
        path || '/'
      ).trim();


    if (
      path === ''
    ) {

      return '/';

    }


    /*
     * اطمینان از شروع Path با /
     */

    if (
      path.charAt(0) !== '/'
    ) {

      path =
        '/' + path;

    }


    /*
     * حذف / انتهایی
     *
     * به جز Root
     */

    if (
      path.length > 1 &&
      path.charAt(
        path.length - 1
      ) === '/'
    ) {

      path =
        path.substring(
          0,
          path.length - 1
        );

    }


    return path;

  }

};