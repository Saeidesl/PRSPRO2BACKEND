'use strict';

function resetRequestCaches_() {
  if (
    typeof PermissionService !== 'undefined' &&
    PermissionService &&
    typeof PermissionService.resetRequestCache === 'function'
  ) {
    PermissionService.resetRequestCache();
  }

  if (
    typeof AccessControlService !== 'undefined' &&
    AccessControlService &&
    typeof AccessControlService.resetRequestCache === 'function'
  ) {
    AccessControlService.resetRequestCache();
  }

  if (
    typeof DepartmentRepository !== 'undefined' &&
    DepartmentRepository &&
    typeof DepartmentRepository.resetRequestCache === 'function'
  ) {
    DepartmentRepository.resetRequestCache();
  }

  if (
    typeof GoogleSheetsRepository !== 'undefined' &&
    GoogleSheetsRepository &&
    typeof GoogleSheetsRepository.resetRequestCache === 'function'
  ) {
    GoogleSheetsRepository.resetRequestCache();
  }
}

function webAppDoGet(e) {
  var startedAt = Date.now();
  var timing = {};
  var includeDiagnostics = false;

  PerformanceDiagnostics.reset();
  resetRequestCaches_();

  try {
    var t = Date.now();
    var request = RequestParser.parseGet(e);
    timing.parseMs = Date.now() - t;

    t = Date.now();
    AccessControlService.enforceRouteAccess(
      'GET',
      request.path,
      request.params
    );
    timing.accessMs = Date.now() - t;

    t = Date.now();
    var result = Router.get(request.path, request.params);
    timing.routerMs = Date.now() - t;

    // Detailed GET diagnostics are opt-in and admin-only. Normal responses
    // remain unchanged and do not expose sheet names or internal timings.
    includeDiagnostics = shouldIncludeGetDiagnostics_(request.params);
    timing.totalMs = Date.now() - startedAt;
    return buildHttpResponse_(result, timing, includeDiagnostics);

  } catch (error) {
    timing.totalMs = Date.now() - startedAt;
    return buildErrorResponse_(error, timing, false);
  }
}

function shouldIncludeGetDiagnostics_(params) {
  params = params || {};
  var requested = String(params._diagnostics || params.diagnostics || '') === '1';
  if (!requested) return false;

  var user = AccessControlService.getCurrentUser(params);
  return AccessControlService.isAdmin(user) === true;
}

function webAppDoPost(e) {
  var startedAt = Date.now();
  var timing = {};
  var isEventCreation = false;

  PerformanceDiagnostics.reset();
  resetRequestCaches_();

  try {
    var t = Date.now();
    var request = RequestParser.parsePost(e);
    timing.parseMs = Date.now() - t;

    isEventCreation =
      request.method === 'POST' &&
      String(request.path || '').trim() === '/events';

    t = Date.now();
    AccessControlService.enforceRouteAccess(
      request.method,
      request.path,
      request.params
    );
    timing.accessMs = Date.now() - t;

    t = Date.now();
    var result;

    if (request.method === 'POST') {
      result = Router.post(
        request.path,
        request.body,
        request.params
      );
    } else if (request.method === 'PUT') {
      result = Router.put(
        request.path,
        request.body,
        request.params
      );
    } else if (request.method === 'DELETE') {
      var deleteParams = Object.assign({}, request.params);

      if (request.body && request.body.reason !== undefined) {
        deleteParams.reason = request.body.reason;
      }
      if (request.body && request.body.confirmationCode !== undefined) {
        deleteParams.confirmationCode = request.body.confirmationCode;
      }
      if (request.body && request.body.ProjectCode !== undefined) {
        deleteParams.ProjectCode = request.body.ProjectCode;
      }

      result = Router.delete(request.path, deleteParams);
    } else {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_OPERATION,
        'متد درخواست پشتیبانی نمی‌شود.'
      );
    }

    timing.routerMs = Date.now() - t;
    timing.totalMs = Date.now() - startedAt;

    return buildHttpResponse_(result, timing, isEventCreation);

  } catch (error) {
    timing.totalMs = Date.now() - startedAt;
    return buildErrorResponse_(error, timing, isEventCreation);
  }
}

function buildHttpResponse_(result, timing, includeTiming) {
  var response = result || {
    success: true,
    data: null
  };

  if (includeTiming && response && typeof response === 'object') {
    response._diagnostics = Object.assign({}, timing, {
      sheetOperations: PerformanceDiagnostics.getSummary()
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildErrorResponse_(error, timing, includeTiming) {
  var response;

  if (error && error.code) {
    response = {
      success: false,
      error: {
        code: error.code,
        message: error.message || 'خطای نامشخص.'
      }
    };
  } else {
    response = {
      success: false,
      error: {
        code: Constants.ERROR.INTERNAL_ERROR,
        message: error && error.message
          ? error.message
          : 'خطای داخلی سیستم.'
      }
    };
  }

  if (includeTiming) {
    response._diagnostics = Object.assign({}, timing, {
      sheetOperations: PerformanceDiagnostics.getSummary()
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}