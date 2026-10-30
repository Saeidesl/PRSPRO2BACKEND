const ProjectInformationService = {
  _id: function(prefix) { return prefix + '_' + Utilities.getUuid().replace(/-/g, ''); },
  _parse: function(value,fallback) {
    if(value===undefined||value===null||value==='')return fallback;
    if(typeof value==='object')return value;
    try{return JSON.parse(String(value));}catch(error){return fallback;}
  },
  _user: function(params){return AccessControlService.getCurrentUser(params || {});},
  _project: function(id,tenantId,user){
    var project=ProjectRepository.findById(id);
    if(!project||String(project.TenantID)!==String(tenantId)||!ProjectService._isProjectAvailableToUser_(project,user))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'پرونده پروژه پیدا نشد.');
    return project;
  },
  _type: function(id,tenantId){
    var type=InformationTypeRepository.findById(id);
    if(!type||String(type.TenantID)!==String(tenantId))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'نوع اطلاعات پیدا نشد.');
    return type;
  },
  _scalar: function(value,dataType,rules,options,label){
    if(value===undefined||value===null||value==='')return '';
    var type=String(dataType || 'text').toLowerCase(), text=String(value);
    if(type==='text'||type==='textarea'||type==='select'){
      if(rules.minLength!==undefined&&text.length<Number(rules.minLength))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' کوتاه‌تر از حد مجاز است.');
      if(rules.maxLength!==undefined&&text.length>Number(rules.maxLength))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' طولانی‌تر از حد مجاز است.');
      if(rules.pattern){
        var regex; try{regex=new RegExp(String(rules.pattern));}catch(error){throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'قانون اعتبارسنجی '+label+' معتبر نیست.');}
        if(!regex.test(text))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' با الگوی مجاز مطابقت ندارد.');
      }
      if(type==='select'&&Array.isArray(options)&&options.length){
        var allowed=options.map(function(item){return typeof item==='object'?String(item.value!==undefined?item.value:item.Value):String(item);});
        if(allowed.indexOf(text)===-1)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'گزینه انتخاب‌شده برای '+label+' معتبر نیست.');
      }
      return text;
    }
    if(type==='number'){
      var number=Number(value);
      if(!isFinite(number))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' باید عدد معتبر باشد.');
      if(rules.min!==undefined&&number<Number(rules.min))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' کمتر از حد مجاز است.');
      if(rules.max!==undefined&&number>Number(rules.max))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' بیشتر از حد مجاز است.');
      return number;
    }
    if(type==='boolean'){
      if(value===true||value===false)return value;
      if(['true','1','yes'].indexOf(text.toLowerCase())!==-1)return true;
      if(['false','0','no'].indexOf(text.toLowerCase())!==-1)return false;
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' باید بله/خیر باشد.');
    }
    if(type==='date'||type==='datetime'){
      var date=new Date(text);
      if(isNaN(date.getTime()))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' باید تاریخ معتبر باشد.');
      return type==='date'?text.slice(0,10):date.toISOString();
    }
    throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'نوع داده پشتیبانی نمی‌شود: '+type);
  },
  _validate: function(type,columns,value){
    if(String(type.Cardinality || 'SINGLE').toUpperCase()==='SINGLE'){
      return this._scalar(value,type.DataType,this._parse(type.ValidationRuleJSON,{}),this._parse(type.OptionsJSON,[]),type.Name || 'مقدار');
    }
    if(!Array.isArray(value))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'اطلاعات چندمقداری باید به‌صورت فهرست ردیف‌ها ارسال شود.');
    if(value.length>500)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'حداکثر ۵۰۰ ردیف در هر ثبت مجاز است.');
    var active=columns.filter(function(col){return String(col.Status || 'ACTIVE')==='ACTIVE';});
    if(!active.length)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'برای این نوع اطلاعات هنوز ستونی تعریف نشده است.');
    return value.map(function(row,index){
      if(!row||typeof row!=='object'||Array.isArray(row))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'ردیف '+(index+1)+' معتبر نیست.');
      var clean={};
      active.forEach(function(col){
        var key=String(col.Code), item=row[key];
        if((col.IsRequired===true||String(col.IsRequired).toLowerCase()==='true')&&(item===undefined||item===null||item===''))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'مقدار «'+col.Name+'» در ردیف '+(index+1)+' الزامی است.');
        clean[key]=ProjectInformationService._scalar(item,col.DataType,ProjectInformationService._parse(col.ValidationRuleJSON,{}),ProjectInformationService._parse(col.OptionsJSON,[]),col.Name);
      });
      Object.keys(row).forEach(function(key){if(!active.some(function(col){return String(col.Code)===key;}))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'ستون ناشناخته در ردیف '+(index+1)+': '+key);});
      return clean;
    });
  },
  list: function(projectId,params){
    var user=this._user(params);this._project(projectId,user.TenantID,user);
    var types=Object.create(null);
    InformationTypeRepository.findByTenant(user.TenantID).forEach(function(type){types[String(type.ID)]=type;});
    var rows=ProjectInformationRepository.findByProject(projectId).filter(function(row){return String(row.TenantID)===String(user.TenantID)&&String(row.Status || 'ACTIVE')==='ACTIVE'&&types[String(row.InformationTypeID)];});
    rows.forEach(function(row){row.Value=this._parse(row.ValueJSON,null);row.InformationType=types[String(row.InformationTypeID)];},this);
    return Response.success(rows);
  },
  get: function(projectId,typeId,params){
    var user=this._user(params);this._project(projectId,user.TenantID,user);this._type(typeId,user.TenantID);
    var row=ProjectInformationRepository.findByProjectAndType(projectId,typeId);
    if(!row)return Response.success(null);
    row.Value=this._parse(row.ValueJSON,null);
    row.History=ProjectInformationRepository.findHistory(row.ID).filter(function(item){return String(item.TenantID)===String(user.TenantID);});
    return Response.success(row);
  },
  save: function(projectId,typeId,body,params){
    var user=this._user(params),project=this._project(projectId,user.TenantID),type=this._type(typeId,user.TenantID);
    if(String(type.Status || 'ACTIVE')!=='ACTIVE')throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'نوع اطلاعات غیرفعال است.');
    Validator.object(body,'information');
    var eventId=String(body.SourceEventID || body.EventID || '');
    if(eventId){
      var event=EventRepository.findById(eventId);
      if(!event||String(event.TenantID)!==String(user.TenantID)||String(event.ProjectID || '')!==String(projectId))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'رویداد مرتبط با این پرونده پیدا نشد.');
    }
    var value=this._validate(type,InformationTypeRepository.findColumns(typeId),body.Value);
    var existing=ProjectInformationRepository.findAnyByProjectAndType(projectId,typeId);
    var wasActive=existing&&String(existing.Status || 'ACTIVE')==='ACTIVE';
    var now=new Date().toISOString(),oldValue=wasActive?this._parse(existing.ValueJSON,null):null;
    var revision=existing?Number(existing.Revision || 1)+1:1,current;
    if(existing)current=ProjectInformationRepository.update(existing.ID,{ValueJSON:JSON.stringify(value),Revision:revision,SourceEventID:eventId||existing.SourceEventID||'',UpdatedBy:user.ID,UpdatedAt:now,Status:'ACTIVE'});
    else current=ProjectInformationRepository.insert({ID:this._id('PINF'),TenantID:user.TenantID,ProjectID:project.ID,InformationTypeID:type.ID,ValueJSON:JSON.stringify(value),Revision:revision,Status:'ACTIVE',SourceEventID:eventId,CreatedBy:user.ID,UpdatedBy:user.ID,CreatedAt:now,UpdatedAt:now});
    var history=ProjectInformationRepository.insertHistory({ID:this._id('PINH'),TenantID:user.TenantID,ProjectInformationID:current.ID,ProjectID:project.ID,InformationTypeID:type.ID,Revision:revision,Action:wasActive?'UPDATED':(existing?'RESTORED':'CREATED'),OldValueJSON:wasActive?JSON.stringify(oldValue):'',NewValueJSON:JSON.stringify(value),SourceEventID:eventId,Reason:String(body.Reason || ''),ActorUserID:user.ID,CreatedAt:now});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:wasActive?Constants.ACTION.UPDATE:Constants.ACTION.CREATE,EntityType:'PROJECT_INFORMATION',EntityID:current.ID,OldData:wasActive?{Value:oldValue,Revision:existing.Revision}:null,NewData:{Value:value,Revision:revision,HistoryID:history.ID,SourceEventID:eventId},Reason:String(body.Reason || 'ثبت اطلاعات پرونده پروژه')});
    current.Value=value;current.HistoryID=history.ID;
    return Response.success(current,{message:'اطلاعات پرونده ذخیره شد.'});
  },
  deactivate: function(projectId,typeId,params){
    var user=this._user(params);this._project(projectId,user.TenantID,user);this._type(typeId,user.TenantID);
    var existing=ProjectInformationRepository.findByProjectAndType(projectId,typeId);
    if(!existing)throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'اطلاعات ثبت‌شده پیدا نشد.');
    var now=new Date().toISOString(),oldValue=this._parse(existing.ValueJSON,null),revision=Number(existing.Revision || 1)+1;
    var updated=ProjectInformationRepository.update(existing.ID,{Status:'DELETED',Revision:revision,UpdatedBy:user.ID,UpdatedAt:now});
    var history=ProjectInformationRepository.insertHistory({ID:this._id('PINH'),TenantID:user.TenantID,ProjectInformationID:existing.ID,ProjectID:projectId,InformationTypeID:typeId,Revision:revision,Action:'DELETED',OldValueJSON:JSON.stringify(oldValue),NewValueJSON:'',SourceEventID:'',Reason:'حذف منطقی اطلاعات پرونده',ActorUserID:user.ID,CreatedAt:now});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.DELETE,EntityType:'PROJECT_INFORMATION',EntityID:existing.ID,OldData:existing,NewData:updated,Reason:'حذف منطقی اطلاعات پرونده'});
    updated.HistoryID=history.ID;
    return Response.success(updated,{message:'اطلاعات پرونده حذف منطقی شد.'});
  },
  history: function(projectId,typeId,params){
    var user=this._user(params);this._project(projectId,user.TenantID,user);this._type(typeId,user.TenantID);
    var current=ProjectInformationRepository.findAnyByProjectAndType(projectId,typeId);
    if(!current)return Response.success([]);
    var rows=ProjectInformationRepository.findHistory(current.ID).filter(function(row){return String(row.TenantID)===String(user.TenantID);});
    rows.forEach(function(row){row.OldValue=this._parse(row.OldValueJSON,null);row.NewValue=this._parse(row.NewValueJSON,null);},this);
    return Response.success(rows);
  }
};
