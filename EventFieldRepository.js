const EventFieldRepository = {
  SHEET_NAME: '12_EventFields',

  _requestCache: {},

  resetRequestCache: function() {
    this._requestCache = {};
  },

  getAll: function() {
    if (Object.prototype.hasOwnProperty.call(this._requestCache, '__ALL__')) {
      return this._requestCache.__ALL__;
    }

    var items = GoogleSheetsRepository.getAll(this.SHEET_NAME);
    this._requestCache.__ALL__ = items;

    return items;
  },

  findById: function(id) {
    return GoogleSheetsRepository.findById(this.SHEET_NAME, id);
  },

  findByEventTypeId: function(eventTypeId) {
    if (eventTypeId === undefined || eventTypeId === null || eventTypeId === '') {
      return [];
    }

    var key = 'EVENT_TYPE:' + String(eventTypeId);

    if (Object.prototype.hasOwnProperty.call(this._requestCache, key)) {
      return this._requestCache[key];
    }

    var items = this.getAll();

    var result = items
      .filter(function(item) {
        return String(item.EventTypeID) === String(eventTypeId);
      })
      .sort(function(a, b) {
        return Number(a.FieldOrder || 0) - Number(b.FieldOrder || 0);
      });

    this._requestCache[key] = result;

    return result;
  },

  findByCode: function(eventTypeId, code) {
    var fields = this.findByEventTypeId(eventTypeId);

    for (var i = 0; i < fields.length; i++) {
      if (String(fields[i].Code) === String(code)) {
        return fields[i];
      }
    }

    return null;
  },

  existsByCode: function(eventTypeId, code) {
    return !!this.findByCode(eventTypeId, code);
  }
};