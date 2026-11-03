const FormRepository = {
  FORMS: '32_Forms',
  FIELDS: '33_FormFields',
  EVENT_TYPES: '34_EventTypeForms',
  EVENT_DATA: '35_EventFormData',
  getForms: function() { return GoogleSheetsRepository.getAll(this.FORMS); },
  findForm: function(id) { return GoogleSheetsRepository.findById(this.FORMS, id); },
  insertForm: function(row) { return GoogleSheetsRepository.insert(this.FORMS, row); },
  updateForm: function(id, patch) { return GoogleSheetsRepository.updateById(this.FORMS, id, patch); },
  getFields: function() { return GoogleSheetsRepository.getAll(this.FIELDS); },
  findField: function(id) { return GoogleSheetsRepository.findById(this.FIELDS, id); },
  findFieldsByForm: function(formId) {
    return this.getFields().filter(function(row) { return String(row.FormID) === String(formId); })
      .sort(function(a,b) { return Number(a.FieldOrder || 0) - Number(b.FieldOrder || 0); });
  },
  insertField: function(row) { return GoogleSheetsRepository.insert(this.FIELDS, row); },
  updateField: function(id, patch) { return GoogleSheetsRepository.updateById(this.FIELDS, id, patch); },
  getEventTypeMappings: function() { return GoogleSheetsRepository.getAll(this.EVENT_TYPES); },
  findMapping: function(id) { return GoogleSheetsRepository.findById(this.EVENT_TYPES, id); },
  findMappingsByEventType: function(eventTypeId) {
    return this.getEventTypeMappings().filter(function(row) { return String(row.EventTypeID) === String(eventTypeId); });
  },
  findMappingByEventTypeAndForm: function(eventTypeId, formId) {
    return this.findMappingsByEventType(eventTypeId).find(function(row) { return String(row.FormID) === String(formId); }) || null;
  },
  insertMapping: function(row) { return GoogleSheetsRepository.insert(this.EVENT_TYPES, row); },
  updateMapping: function(id, patch) { return GoogleSheetsRepository.updateById(this.EVENT_TYPES, id, patch); },
  getEventResponses: function() { return GoogleSheetsRepository.getAll(this.EVENT_DATA); },
  findResponse: function(eventId, formId) {
    return this.getEventResponses().find(function(row) {
      return String(row.EventID) === String(eventId) && String(row.FormID) === String(formId);
    }) || null;
  },
  findResponsesByEvent: function(eventId) {
    return this.getEventResponses().filter(function(row) { return String(row.EventID) === String(eventId); });
  },
  insertResponse: function(row) { return GoogleSheetsRepository.insert(this.EVENT_DATA, row); },
  updateResponse: function(id, patch) { return GoogleSheetsRepository.updateById(this.EVENT_DATA, id, patch); }
};