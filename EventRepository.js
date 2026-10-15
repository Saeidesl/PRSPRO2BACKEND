const EventRepository = {

  SHEET_NAME: '13_Events',

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


  findByProjectId: function(projectId) {

    const items =
      this.getAll();

    return items.filter(function(item) {

      return String(item.ProjectID) ===
        String(projectId);

    }).sort(function(a, b) {

      return new Date(
        a.OccurredAt || a.CreatedAt
      ).getTime() -
      new Date(
        b.OccurredAt || b.CreatedAt
      ).getTime();

    });

  },


  findByEventTypeId: function(eventTypeId) {

    const items =
      this.getAll();

    return items.filter(function(item) {

      return String(item.EventTypeID) ===
        String(eventTypeId);

    });

  },


  findByPerformedBy: function(userId) {

    const items =
      this.getAll();

    return items.filter(function(item) {

      return String(item.PerformedBy) ===
        String(userId);

    });

  },


  findByDepartmentId: function(departmentId) {

    const items =
      this.getAll();

    return items.filter(function(item) {

      return String(item.DepartmentID) ===
        String(departmentId);

    });

  },


  insert: function(event) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      event
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