const AttachmentRepository = {

  SHEET_NAME: '15_Attachments',


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
      ) &&
      String(item.Status) !==
        Constants.STATUS.DELETED;

    });

  },


  insert: function(attachment) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      attachment
    );

  },


  update: function(id,data) {

    return GoogleSheetsRepository.updateById(
      this.SHEET_NAME,
      id,
      data
    );

  }

};