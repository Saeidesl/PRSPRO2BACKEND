/**
 * ============================================================
 * USER ROLE REPOSITORY
 * ============================================================
 */

const UserRoleRepository = {

  SHEET_NAME: '06_UserRoles',


  getAll: function() {

    return GoogleSheetsRepository.getAll(
      this.SHEET_NAME
    );

  },


  findByUserId: function(userId) {

    return this.getAll().filter(function(item) {

      return String(item.UserID) ===
        String(userId);

    });

  },


  findByRoleId: function(roleId) {

    return this.getAll().filter(function(item) {

      return String(item.RoleID) ===
        String(roleId);

    });

  },


  find: function(userId, roleId) {

    const items =
      this.getAll();

    for (
      let i = 0;
      i < items.length;
      i++
    ) {

      if (

        String(items[i].UserID) ===
          String(userId)

        &&

        String(items[i].RoleID) ===
          String(roleId)

      ) {

        return items[i];

      }

    }

    return null;

  },


  exists: function(userId, roleId) {

    return !!this.find(
      userId,
      roleId
    );

  },


  insert: function(data) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
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