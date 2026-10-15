const DepartmentRepository = {

  SHEET_NAME: '03_Departments',

  _requestCache: {},

  resetRequestCache: function() {
    this._requestCache = {};
  },

  getAll: function() {
    return GoogleSheetsRepository.getAll(
      this.SHEET_NAME
    );
  },

  findById: function(id) {
    if (id === undefined || id === null || id === '') {
      return null;
    }

    var key = String(id);

    if (
      Object.prototype.hasOwnProperty.call(
        this._requestCache,
        key
      )
    ) {
      return this._requestCache[key];
    }

    var department = GoogleSheetsRepository.findById(
      this.SHEET_NAME,
      id
    );

    this._requestCache[key] = department || null;

    return this._requestCache[key];
  },

  findByCode: function(code) {
    return GoogleSheetsRepository.findOne(
      this.SHEET_NAME,
      'Code',
      code
    );
  },

  findByTenantId: function(tenantId) {
    return this.getAll().filter(function(item) {
      return String(item.TenantID) === String(tenantId);
    });
  },

  existsByCode: function(code) {
    return GoogleSheetsRepository.exists(
      this.SHEET_NAME,
      'Code',
      code
    );
  },

  insert: function(department) {
    var result = GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      department
    );

    this.resetRequestCache();

    return result;
  },

  update: function(id, data) {
    var result = GoogleSheetsRepository.updateById(
      this.SHEET_NAME,
      id,
      data
    );

    this.resetRequestCache();

    return result;
  }

};