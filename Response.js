/**
 * ============================================================
 * RESPONSE
 * ============================================================
 */

const Response = {

  success: function(data, meta) {

    return {
      success: true,

      data: data !== undefined
        ? data
        : null,

      error: null,

      meta: meta || {}
    };
  },


  error: function(
    code,
    message,
    details
  ) {

    return {

      success: false,

      data: null,

      error: {

        code: code,

        message: message,

        details: details || null
      },

      meta: {}
    };
  },


  json: function(payload) {

    return ContentService

      .createTextOutput(
        JSON.stringify(payload)
      )

      .setMimeType(
        ContentService.MimeType.JSON
      );
  }
};