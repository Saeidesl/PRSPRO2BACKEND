/**
 * ============================================================
 * ROLE REPOSITORY
 * ============================================================
 */

const RoleRepository = {

  SHEET_NAME: '04_Roles',


  getAll: function() {

    return GoogleSheetsRepository.getAll(
      this.SHEET_NAME
    );

  },


  findById: function(id) {

    return GoogleSheetsRepository.findById(
      this.SHEET_NAME,
      id
    );

  },


  findByCode: function(code) {

    return GoogleSheetsRepository.findOne(
      this.SHEET_NAME,
      'Code',
      code
    );

  },


  findByTenantId: function(tenantId) {

    const items =
      this.getAll();

    return items.filter(function(item) {

      return String(item.TenantID) ===
        String(tenantId);

    });

  },


  existsByCode: function(code) {

    return GoogleSheetsRepository.exists(
      this.SHEET_NAME,
      'Code',
      code
    );

  },


  insert: function(role) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      role
    );

  },


  update: function(id, data) {

    return GoogleSheetsRepository.updateById(
      this.SHEET_NAME,
      id,
      data
    );

  }

};