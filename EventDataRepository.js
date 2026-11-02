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


};