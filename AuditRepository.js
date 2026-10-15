/**
 * ============================================================
 * AUDIT REPOSITORY
 * ============================================================
 */

const AuditRepository = {

  SHEET_NAME:
    '16_AuditLogs',


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


  findByEntity: function(
    entityType,
    entityId
  ) {

    const items =
      this.getAll();


    return items.filter(function(item) {

      return (
        String(item.EntityType) ===
        String(entityType)
      ) &&
      (
        String(item.EntityID) ===
        String(entityId)
      );

    });

  },


  findByUser: function(userId) {

    const items =
      this.getAll();


    return items.filter(function(item) {

      return String(item.UserID) ===
        String(userId);

    });

  },


  insert: function(audit) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      audit
    );

  }

};