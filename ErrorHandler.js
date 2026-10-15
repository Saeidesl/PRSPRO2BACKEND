/**
 * ============================================================
 * ERROR HANDLER
 * ============================================================
 */

const ErrorHandler = {

  handle: function(error) {

    console.error(
      error.stack || error
    );

    // خطاهای شناخته‌شده
    if (
      error &&
      error.code
    ) {

      return Response.error(
        error.code,
        error.message || 'خطایی رخ داده است.',
        error.details || null
      );
    }

    // خطای ناشناخته
    return Response.error(
      Constants.ERROR.INTERNAL_ERROR,
      'خطای داخلی سیستم رخ داده است.'
    );
  },


  create: function(
    code,
    message,
    details
  ) {

    const error = new Error(message);

    error.code = code;

    error.details =
      details || null;

    return error;
  }
};