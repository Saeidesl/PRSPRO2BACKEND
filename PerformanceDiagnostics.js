/**
 * Request-scoped diagnostics for procurement read endpoints.
 * Emits one compact summary per endpoint call when performance logging is enabled.
 * Metrics are observational only and do not alter API responses or business data.
 */
var PerformanceDiagnostics = {
  _active: null,

  _loggingEnabled_: function() {
    try {
      return !!(AppConfig && (
        AppConfig.PERFORMANCE_LOG_TO_CONSOLE === true ||
        (AppConfig.PERFORMANCE && AppConfig.PERFORMANCE.LOG_TO_CONSOLE === true)
      ));
    } catch (error) {
      return false;
    }
  },

  beginRequest: function(endpoint) {
    this._active = {
      endpoint: String(endpoint || ''),
      startedAt: Date.now(),
      elapsedMs: 0,
      repositoryOperationCount: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
      operationsByType: Object.create(null),
      operationsBySheet: Object.create(null),
      errors: 0
    };
  },

  record: function(operation, sheetName, elapsedMs, extra) {
    var current = this._active;
    if (!current) return;

    var operationName = String(operation || 'unknown');
    var sheet = String(sheetName || '');
    current.repositoryOperationCount++;
    current.operationsByType[operationName] = (current.operationsByType[operationName] || 0) + 1;
    if (sheet) current.operationsBySheet[sheet] = (current.operationsBySheet[sheet] || 0) + 1;

    if (extra && extra.cacheHit === true) current.cacheHitCount++;
    else if (extra && extra.cacheHit === false) current.cacheMissCount++;
  },

  recordEndpointError: function() {
    if (this._active) this._active.errors++;
  },

  finishRequest: function(elapsedMs) {
    var current = this._active;
    if (!current) return null;

    current.elapsedMs = Number(elapsedMs) || (Date.now() - current.startedAt);
    current.type = 'PROCUREMENT_ENDPOINT_TIMING';
    this._active = null;

    if (this._loggingEnabled_() && typeof console !== 'undefined' && console.log) {
      console.log(JSON.stringify(current));
    }
    return current;
  }
};
