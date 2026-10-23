/**
 * ============================================================
 * USER REPOSITORY
 * ============================================================
 */

const UserRepository = {

  SHEET_NAME: '02_Users',


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


  findByUsername: function(username) {
    const normalized = String(username || '').trim().toLowerCase();
    const matches = this.getAll().filter(function(item) {
      return String(item.Username || '').trim().toLowerCase() === normalized;
    });
    return matches.length === 1 ? matches[0] : null;
  },

  findAllByUsername: function(username) {
    const normalized = String(username || '').trim().toLowerCase();
    return this.getAll().filter(function(item) {
      return String(item.Username || '').trim().toLowerCase() === normalized;
    });
  },


  existsByUsername: function(username) {

    return GoogleSheetsRepository.exists(
      this.SHEET_NAME,
      'Username',
      username
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


  insert: function(user) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      user
    );

  },


  update: function(id, data) {

    return GoogleSheetsRepository.updateById(
      this.SHEET_NAME,
      id,
      data
    );

  },


  delete: function(id) {

    return GoogleSheetsRepository.deleteById(
      this.SHEET_NAME,
      id
    );

  }

};