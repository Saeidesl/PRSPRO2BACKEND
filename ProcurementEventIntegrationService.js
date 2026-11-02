/**
 * Event integration with procurement through central project information.
 * Purchase orders and receipts remain independent of event integration.
 */
const ProcurementEventIntegrationService = {
  SHEET: '23_EventTypeProcurementSettings',
  _find_: function(eventTypeId, tenantId) {
    return (GoogleSheetsRepository.getAll(this.SHEET) || []).find(function(row) {
      return String(row.EventTypeID) === String(eventTypeId) && String(row.TenantID) === String(tenantId) &&
        String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }) || null;
  },
  _informationType_: function(typeId, tenantId) {
    var type = InformationTypeRepository.findById(typeId);
    if (!type || String(type.TenantID) !== String(tenantId) || String(type.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'نوع اطلاعات مرکزی تعداد قطعی معتبر یا فعال نیست.');
    }
    if (String(type.DataType || '').toLowerCase() !== 'number' || String(type.Cardinality || 'SINGLE').toUpperCase() !== 'SINGLE') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'تعداد قطعی باید به نوع اطلاعات مرکزی عددی و تک‌مقداری متصل باشد.');
    }
    var columns = InformationTypeRepository.findColumns(type.ID) || [];
    if (columns.some(function(column) { return String(column.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'; })) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'نوع اطلاعات تعداد قطعی نباید ساختار جدولی یا ستون جداگانه داشته باشد.');
    }
    return type;
  },
  _quantity_: function(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'مقدار تعداد قطعی تأییدشده در فرم متصل ثبت نشده است.');
    }
    var quantity = Number(value);
    if (!isFinite(quantity) || quantity <= 0) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'تعداد قطعی تأییدشده باید عددی بزرگ‌تر از صفر باشد.');
    return quantity;
  },
  _quantityFromResponses_: function(typeId, responses) {
    var found = false, value = null;
    (responses || []).forEach(function(response) {
      var values = response && response.Values;
      if (!values || !Object.prototype.hasOwnProperty.call(values, String(typeId))) return;
      var candidate = values[String(typeId)];
      if (candidate === undefined || candidate === null || String(candidate).trim() === '') return;
      if (found) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'تعداد قطعی در بیش از یک فرم متصل ثبت شده است؛ فقط یک منبع اطلاعاتی مجاز است.');
      found = true; value = candidate;
    });
    if (!found) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'فرم متصل باید مقدار تعداد قطعی تأییدشده را ثبت کند.');
    return this._quantity_(value);
  },
  get: function(eventTypeId, params) {
    AccessControlService.require(params || {},'EVENT_TYPE_MANAGE');
    var user=AccessControlService.getCurrentUser(params || {}), type=EventTypeRepository.findById(eventTypeId);
    if(!type||String(type.TenantID)!==String(user.TenantID))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'نوع رویداد پیدا نشد.');
    var row=this._find_(eventTypeId,user.TenantID);
    if(!row)return Response.success({EventTypeID:eventTypeId,Action:'NONE',ConfirmedQuantityInformationTypeID:''});
    var result=Object.assign({},row), action=String(row.Action || 'NONE').toUpperCase();
    result.Action=action==='RECALCULATE_CONFIRMED_NEEDS'&&String(row.ConfirmedQuantityInformationTypeID || '').trim()?action:'NONE';
    result.ConfirmedQuantityInformationTypeID=String(row.ConfirmedQuantityInformationTypeID || '');
    delete result.FieldMap; delete result.FieldMapJSON;
    return Response.success(result);
  },
  save: function(eventTypeId,body,params) {
    AccessControlService.require(params || {},'EVENT_TYPE_MANAGE');
    var user=AccessControlService.getCurrentUser(params || {}), type=EventTypeRepository.findById(eventTypeId);
    if(!type||String(type.TenantID)!==String(user.TenantID))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'نوع رویداد پیدا نشد.');
    body=body||{};
    var action=String(body.Action || 'NONE').toUpperCase();
    if(['NONE','RECALCULATE_CONFIRMED_NEEDS'].indexOf(action)<0)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'عملیات تأمین معتبر نیست.');
    var informationTypeId='';
    if(action==='RECALCULATE_CONFIRMED_NEEDS'){
      informationTypeId=String(body.ConfirmedQuantityInformationTypeID || '').trim();
      if(!informationTypeId)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'نوع اطلاعات مرکزی تعداد قطعی را انتخاب کنید.');
      this._informationType_(informationTypeId,user.TenantID);
    }
    var now=new Date().toISOString(),existing=this._find_(eventTypeId,user.TenantID);
    var record={ID:existing?existing.ID:'PSET_'+Utilities.getUuid().replace(/-/g,''),TenantID:user.TenantID,EventTypeID:eventTypeId,Action:action,ConfirmedQuantityInformationTypeID:informationTypeId,Status:'ACTIVE',CreatedBy:existing?existing.CreatedBy:user.ID,CreatedAt:existing?existing.CreatedAt:now,UpdatedAt:now};
    var saved=existing?GoogleSheetsRepository.updateById(this.SHEET,existing.ID,record):GoogleSheetsRepository.insert(this.SHEET,record);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:existing?Constants.ACTION.UPDATE:Constants.ACTION.CREATE,EntityType:'EVENT_TYPE_PROCUREMENT_SETTINGS',EntityID:record.ID,OldData:existing,NewData:saved,Reason:'تنظیم اتصال تعداد قطعی مرکزی به محاسبه نیاز ملزومات'});
    var output=Object.assign({},saved);delete output.FieldMap;delete output.FieldMapJSON;
    return Response.success(output);
  },
  validate: function(eventType,formResponses,projectId,params) {
    var user=AccessControlService.getCurrentUser(params || {}),row=this._find_(eventType.ID,user.TenantID);
    // Legacy receipt mappings are deliberately inert. Receipt APIs remain independent.
    if(!row||String(row.Action || 'NONE').toUpperCase()!=='RECALCULATE_CONFIRMED_NEEDS')return true;
    if(!projectId)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'محاسبه نیاز قطعی فقط برای رویداد مرتبط با پروژه مجاز است.');
    var project=ProjectRepository.findById(projectId);
    if(!project||String(project.TenantID)!==String(user.TenantID)||!ProjectService._isProjectAvailableToUser_(project,user))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'پروژه برای محاسبه نیاز قطعی معتبر نیست.');
    var typeId=String(row.ConfirmedQuantityInformationTypeID || '').trim();
    if(!typeId)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'تنظیم اتصال تعداد قطعی به اطلاعات مرکزی کامل نشده است.');
    this._informationType_(typeId,user.TenantID);
    this._quantityFromResponses_(typeId,formResponses);
    return true;
  },
  apply: function(eventType,event,params) {
    var user=AccessControlService.getCurrentUser(params || {}),row=this._find_(eventType.ID,user.TenantID);
    if(!row||String(row.Action || 'NONE').toUpperCase()!=='RECALCULATE_CONFIRMED_NEEDS')return null;
    if(!event.ProjectID)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'رویداد مبنای تعداد قطعی باید به پروژه متصل باشد.');
    var typeId=String(row.ConfirmedQuantityInformationTypeID || '').trim();
    if(!typeId)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'نوع اطلاعات مرکزی تعداد قطعی در تنظیمات تأمین مشخص نشده است.');
    this._informationType_(typeId,user.TenantID);
    var saved=ProjectInformationRepository.findByProjectAndType(event.ProjectID,typeId);
    if(!saved||String(saved.TenantID)!==String(user.TenantID)||String(saved.SourceEventID || '')!==String(event.ID))throw ErrorHandler.create(Constants.ERROR.CONFLICT,'مقدار تعداد قطعی باید از فرم همین رویداد در اطلاعات مرکزی پروژه ذخیره شده باشد.');
    var value;
    try{value=JSON.parse(String(saved.ValueJSON || ''));}catch(error){throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'مقدار تعداد قطعی ذخیره‌شده در اطلاعات مرکزی معتبر نیست.');}
    var quantity=this._quantity_(value);
    return MaterialPlanningService.recalculateProjectNeeds(event.ProjectID,event.ID,quantity,event.EventTypeVersion || eventType.Version || '',params);
  }
};
