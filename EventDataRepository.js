const EventDataRepository = {

  SHEET_NAME: '14_EventData',

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


  findByEventId: function(eventId) {

    return GoogleSheetsRepository.findOne(
      this.SHEET_NAME,
      'EventID',
      eventId
    );

  },


  insert: function(data) {

    return GoogleSheetsRepository.insert(
      this.SHEET_NAME,
      data
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