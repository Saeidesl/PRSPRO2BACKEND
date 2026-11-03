/**
 * Read-only repository for legacy event-field definitions.
 * Used only to label historical DynamicData values in event history.
 */
const EventFieldRepository = {
  SHEET_NAME: '12_EventFields',
  _requestCache: null,
  resetRequestCache: function() {
    this._requestCache = null;
  },
  getAll: function() {
    if (this._requestCache) return this._requestCache;
    this._requestCache = GoogleSheetsRepository.getAll(this.SHEET_NAME) || [];
    return this._requestCache;
  }
};
