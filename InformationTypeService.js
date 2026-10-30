const InformationTypeService = {
  _id: function() { return 'IT_' + Utilities.getUuid().replace(/-/g, ''); },
  _user: function(params) { return AccessControlService.getCurrentUser(params || {}); },
  _type: function(id, tenantId) {
    var row = InformationTypeRepository.findById(id);
    if (!row || String(row.TenantID) !== String(tenantId)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع اطلاعات پیدا نشد.');
    return row;
  },
  _json: function(value, label, fallback) { return InformationTypeValidator.parseJson(value, label, fallback); },
  list: function(params) {
    var user=this._user(params);
    return Response.success(InformationTypeRepository.findByTenant(user.TenantID).filter(function(row){return String(row.Status || 'ACTIVE')!=='DELETED';}));
  },
  get: function(id,params) {
    var user=this._user(params), row=this._type(id,user.TenantID);
    row.Columns=InformationTypeRepository.findColumns(id).filter(function(col){return String(col.Status || 'ACTIVE')!=='DELETED';});
    return Response.success(row);
  },
  create: function(data,params) {
    var user=this._user(params);
    InformationTypeValidator.validateDefinition(data,false);
    var code=String(data.Code).trim();
    if(InformationTypeRepository.findByCode(user.TenantID,code))throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'این کد اطلاعات قبلاً ثبت شده است.');
    var now=new Date().toISOString();
    var row={ID:this._id(),TenantID:user.TenantID,Code:code,Name:String(data.Name).trim(),Description:String(data.Description || ''),Cardinality:String(data.Cardinality).toUpperCase(),DataType:String(data.DataType).toLowerCase(),ValidationRuleJSON:JSON.stringify(this._json(data.ValidationRuleJSON,'قواعد اعتبارسنجی',{})),OptionsJSON:JSON.stringify(this._json(data.OptionsJSON,'گزینه‌ها',[])),Status:data.Status || Constants.STATUS.ACTIVE,Revision:1,CreatedBy:user.ID,CreatedAt:now,UpdatedAt:now};
    var created=InformationTypeRepository.insert(row);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,EntityType:'INFORMATION_TYPE',EntityID:created.ID,NewData:created,Reason:'تعریف نوع اطلاعات مرکزی'});
    return Response.success(created,{message:'نوع اطلاعات ایجاد شد.'});
  },
  update: function(id,data,params) {
    var user=this._user(params), existing=this._type(id,user.TenantID);
    InformationTypeValidator.validateDefinition(data,true);
    var cardinality=String(data.Cardinality || existing.Cardinality).toUpperCase();
    var dataType=String(data.DataType || existing.DataType).toLowerCase();
    if(cardinality==='MULTIPLE' && dataType!=='text')throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'برای اطلاعات چندمقداری، نوع داده اصلی باید text باشد.');
    if((cardinality!==String(existing.Cardinality).toUpperCase() || dataType!==String(existing.DataType).toLowerCase()) && ProjectInformationRepository.getAll().some(function(row){return String(row.InformationTypeID)===String(id);})) {
      throw ErrorHandler.create(Constants.ERROR.CONFLICT,'ساختار این نوع اطلاعات قبلاً استفاده شده است؛ تغییر تک‌/چندمقداری یا نوع داده مجاز نیست.');
    }
    var patch={UpdatedAt:new Date().toISOString(),Revision:Number(existing.Revision || 1)+1};
    ['Name','Description','Status'].forEach(function(key){if(data[key]!==undefined)patch[key]=data[key];});
    if(data.Cardinality!==undefined)patch.Cardinality=cardinality;
    if(data.DataType!==undefined)patch.DataType=dataType;
    if(data.ValidationRuleJSON!==undefined)patch.ValidationRuleJSON=JSON.stringify(this._json(data.ValidationRuleJSON,'قواعد اعتبارسنجی',{}));
    if(data.OptionsJSON!==undefined)patch.OptionsJSON=JSON.stringify(this._json(data.OptionsJSON,'گزینه‌ها',[]));
    if(data.Code!==undefined && String(data.Code).trim()!==String(existing.Code)) {
      var duplicate=InformationTypeRepository.findByCode(user.TenantID,data.Code);
      if(duplicate && String(duplicate.ID)!==String(id))throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'این کد اطلاعات قبلاً ثبت شده است.');
      patch.Code=String(data.Code).trim();
    }
    var updated=InformationTypeRepository.update(id,patch);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.UPDATE,EntityType:'INFORMATION_TYPE',EntityID:id,OldData:existing,NewData:updated,Reason:'ویرایش تعریف نوع اطلاعات'});
    return Response.success(updated,{message:'تعریف نوع اطلاعات به‌روزرسانی شد.'});
  },
  deactivate: function(id,params) {
    var user=this._user(params), existing=this._type(id,user.TenantID);
    var updated=InformationTypeRepository.update(id,{Status:'DELETED',UpdatedAt:new Date().toISOString(),Revision:Number(existing.Revision || 1)+1});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.DELETE,EntityType:'INFORMATION_TYPE',EntityID:id,OldData:existing,NewData:updated,Reason:'حذف منطقی نوع اطلاعات'});
    return Response.success(updated,{message:'نوع اطلاعات به‌صورت منطقی حذف شد.'});
  },
  listColumns: function(typeId,params) {
    var user=this._user(params); this._type(typeId,user.TenantID);
    return Response.success(InformationTypeRepository.findColumns(typeId).filter(function(row){return String(row.Status || 'ACTIVE')!=='DELETED';}));
  },
  createColumn: function(typeId,data,params) {
    var user=this._user(params), type=this._type(typeId,user.TenantID);
    if(String(type.Cardinality).toUpperCase()!=='MULTIPLE')throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'فقط اطلاعات چندمقداری دارای ستون‌های جدولی هستند.');
    InformationTypeValidator.validateColumn(data,false);
    var columns=InformationTypeRepository.findColumns(typeId);
    var normalizedCode=String(data.Code).trim().toLowerCase();
    if(columns.some(function(row){return String(row.TenantID)===String(user.TenantID)&&String(row.Code).trim().toLowerCase()===normalizedCode&&String(row.Status)!=='DELETED';}))throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'کد ستون تکراری است.');
    var now=new Date().toISOString();
    var row={ID:'ITC_'+Utilities.getUuid().replace(/-/g,''),TenantID:user.TenantID,InformationTypeID:typeId,Code:String(data.Code).trim(),Name:String(data.Name).trim(),DataType:String(data.DataType).toLowerCase(),IsRequired:data.IsRequired===true,OptionsJSON:JSON.stringify(this._json(data.OptionsJSON,'گزینه‌های ستون',[])),ValidationRuleJSON:JSON.stringify(this._json(data.ValidationRuleJSON,'قواعد ستون',{})),ColumnOrder:Number(data.ColumnOrder || columns.length+1),Status:data.Status || Constants.STATUS.ACTIVE,CreatedAt:now,UpdatedAt:now};
    var created=InformationTypeRepository.insertColumn(row);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,EntityType:'INFORMATION_TYPE_COLUMN',EntityID:created.ID,NewData:created,Reason:'افزودن ستون نوع اطلاعات'});
    return Response.success(created,{message:'ستون اطلاعات ایجاد شد.'});
  },
  updateColumn: function(typeId,columnId,data,params) {
    var user=this._user(params); this._type(typeId,user.TenantID); InformationTypeValidator.validateColumn(data,true);
    var existing=InformationTypeRepository.findColumnById(columnId);
    if(!existing||String(existing.TenantID)!==String(user.TenantID)||String(existing.InformationTypeID)!==String(typeId))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'ستون اطلاعات پیدا نشد.');
    var patch={UpdatedAt:new Date().toISOString()};
    if(data.Code!==undefined){
      var normalizedCode=String(data.Code).trim().toLowerCase();
      var duplicate=InformationTypeRepository.findColumns(typeId).some(function(row){return String(row.ID)!==String(columnId)&&String(row.Status)!=='DELETED'&&String(row.Code).trim().toLowerCase()===normalizedCode;});
      if(duplicate)throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'کد ستون تکراری است.');
      patch.Code=String(data.Code).trim();
    }
    ['Name','DataType','IsRequired','ColumnOrder','Status'].forEach(function(key){if(data[key]!==undefined)patch[key]=data[key];});
    if(data.OptionsJSON!==undefined)patch.OptionsJSON=JSON.stringify(this._json(data.OptionsJSON,'گزینه‌های ستون',[]));
    if(data.ValidationRuleJSON!==undefined)patch.ValidationRuleJSON=JSON.stringify(this._json(data.ValidationRuleJSON,'قواعد ستون',{}));
    var updated=InformationTypeRepository.updateColumn(columnId,patch);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.UPDATE,EntityType:'INFORMATION_TYPE_COLUMN',EntityID:columnId,OldData:existing,NewData:updated,Reason:'ویرایش ستون نوع اطلاعات'});
    return Response.success(updated,{message:'ستون اطلاعات به‌روزرسانی شد.'});
  },
  deactivateColumn: function(columnId,params) {
    var user=this._user(params), existing=InformationTypeRepository.findColumnById(columnId);
    if(!existing||String(existing.TenantID)!==String(user.TenantID))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'ستون اطلاعات پیدا نشد.');
    var updated=InformationTypeRepository.updateColumn(columnId,{Status:'DELETED',UpdatedAt:new Date().toISOString()});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.DELETE,EntityType:'INFORMATION_TYPE_COLUMN',EntityID:columnId,OldData:existing,NewData:updated,Reason:'حذف منطقی ستون اطلاعات'});
    return Response.success(updated,{message:'ستون اطلاعات حذف منطقی شد.'});
  }
};
