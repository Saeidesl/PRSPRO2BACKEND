/**
 * ============================================================
 * PERMISSION REPOSITORY
 * ============================================================
 */

const PermissionRepository = {

  SHEET_NAME: '05_Permissions',


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


  findByModule: function(module) {

    const items =
      this.getAll();

    return items.filter(function(item) {

      return String(item.Module) ===
        String(module);

    });

  },


  insert: function(permission) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      permission
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