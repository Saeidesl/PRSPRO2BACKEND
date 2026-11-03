const ProjectInformationService = {
  _id: function(prefix) { return prefix + '_' + Utilities.getUuid().replace(/-/g, ''); },
  _parse: function(value,fallback) {
    if(value===undefined||value===null||value==='')return fallback;
    if(typeof value==='object')return value;
    try{return JSON.parse(String(value));}catch(error){return fallback;}
  },
  _latestApproval_: function(projectInformationId,tenantId){
    return ProjectInformationRepository.findHistory(projectInformationId).filter(function(row){
      return String(row.TenantID)===String(tenantId) && String(row.Action||'').toUpperCase()==='APPROVED';
    }).sort(function(a,b){return Number(b.Revision||0)-Number(a.Revision||0);})[0] || null;
  },
  _isFileBased_: function(typeId,type){
    if(['image','file'].indexOf(String(type.DataType||'').toLowerCase())!==-1)return true;
    return (InformationTypeRepository.findColumns(typeId)||[]).some(function(col){
      return ['image','file'].indexOf(String(col.DataType||'').toLowerCase())!==-1 && String(col.Status||'ACTIVE').toUpperCase()==='ACTIVE';
    });
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
  _scalar: function(value,dataType,rules,options,label,context){
    if(value===undefined||value===null||value==='')return '';
    var type=String(dataType || 'text').toLowerCase(), text=String(value);
    if(type==='image'||type==='file'){
      if(!value||typeof value!=='object'||Array.isArray(value))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,label+' باید از طریق انتخاب و بارگذاری فایل ثبت شود.');
      var id=String(value.AttachmentID || value.ID || ''), attachment=AttachmentRepository.findById(id);
      var projectId=context&&String(context.projectId || ''), tenantId=context&&String(context.tenantId || '');
      if(!attachment||String(attachment.TenantID)!==tenantId||String(attachment.EntityType).toUpperCase()!=='PROJECT'||String(attachment.EntityID)!==projectId||(String(attachment.AttachmentType || '').toUpperCase()!=='INFORMATION' && !(type==='image' && String(attachment.AttachmentType || '').toUpperCase()==='PROFILE'))||String(attachment.Status || 'ACTIVE').toUpperCase()!=='ACTIVE')throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'فایل انتخاب‌شده به این پروژه تعلق ندارد یا قابل استفاده نیست.');
      var mime=String(attachment.MimeType || '').toLowerCase();
      if(!AttachmentValidator.FILE_TYPES[mime]||(type==='image'&&mime.indexOf('image/')!==0))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,type==='image'?'برای این فیلد فقط تصویر مجاز است.':'نوع فایل انتخاب‌شده مجاز نیست.');
      return {AttachmentID:String(attachment.ID),FileName:String(attachment.FileName || ''),MimeType:mime,FileSize:Number(attachment.FileSize || 0),AttachmentType:String(attachment.AttachmentType || 'INFORMATION').toUpperCase()};
    }
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
  _validate: function(type,columns,value,context){
    var cardinality=String(type.Cardinality || 'SINGLE').toUpperCase();
    var active=(columns || []).filter(function(col){return String(col.Status || 'ACTIVE')==='ACTIVE';});
    var hasColumns=active.length>0;
    var isEmpty=function(item){
      if(item===undefined||item===null||item==='')return true;
      if(Array.isArray(item))return item.length===0||!item.some(function(entry){return !isEmpty(entry);});
      if(typeof item==='object')return Object.keys(item).length===0||Object.keys(item).every(function(key){return isEmpty(item[key]);});
      return false;
    };
    if(!hasColumns){
      if(cardinality==='MULTIPLE')throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'برای اطلاعات چندمقداری باید حداقل یک ستون تعریف شود.');
      return this._scalar(value,type.DataType,this._parse(type.ValidationRuleJSON,{}),this._parse(type.OptionsJSON,[]),type.Name || 'مقدار',context);
    }
    var validateRow=function(row,index){
      if(!row||typeof row!=='object'||Array.isArray(row))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'ردیف '+index+' معتبر نیست.');
      var clean={},hasAnyValue=active.some(function(col){return !isEmpty(row[String(col.Code)]);});
      active.forEach(function(col){
        var key=String(col.Code),item=row[key];
        if(hasAnyValue&&(col.IsRequired===true||String(col.IsRequired).toLowerCase()==='true')&&isEmpty(item)){
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'مقدار «'+col.Name+'» در ردیف '+index+' الزامی است.');
        }
        clean[key]=ProjectInformationService._scalar(item,col.DataType,ProjectInformationService._parse(col.ValidationRuleJSON,{}),ProjectInformationService._parse(col.OptionsJSON,[]),col.Name,context);
      });
      Object.keys(row).forEach(function(key){
        if(!active.some(function(col){return String(col.Code)===key;}))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'ستون ناشناخته در ردیف '+index+': '+key);
      });
      return clean;
    };
    if(cardinality==='SINGLE'){
      if(isEmpty(value)&&(!value||typeof value!=='object'||Array.isArray(value)))return {};
      if(!value||typeof value!=='object'||Array.isArray(value))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'اطلاعات تک‌مقداری جدولی باید به‌صورت یک ردیف ارسال شود.');
      return validateRow(value,1);
    }
    if(!Array.isArray(value))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'اطلاعات چندمقداری باید به‌صورت فهرست ردیف‌ها ارسال شود.');
    if(value.length>500)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'حداکثر ۵۰۰ ردیف در هر ثبت مجاز است.');
    return value.map(function(row,index){return validateRow(row,index+1);}).filter(function(row){return !isEmpty(row);});
  },
  list: function(projectId,params){
    var user=this._user(params),project=this._project(projectId,user.TenantID,user);
    var saved=ProjectInformationRepository.findByProject(projectId).filter(function(row){
      return String(row.TenantID)===String(user.TenantID);
    });
    var savedByType=Object.create(null);
    saved.forEach(function(row){savedByType[String(row.InformationTypeID)]=row;});
    var definitions=InformationTypeRepository.findByTenant(user.TenantID).filter(function(type){
      return String(type.Status || 'ACTIVE')==='ACTIVE';
    });
    var rows=definitions.map(function(type){
      var row=savedByType[String(type.ID)];
      if(!row||String(row.Status || 'ACTIVE')!=='ACTIVE'){
        row={ID:'',TenantID:user.TenantID,ProjectID:projectId,InformationTypeID:type.ID,ValueJSON:'',Revision:0,Status:'EMPTY',SourceEventID:''};
      }else{
        row=Object.assign({},row,{Value:this._parse(row.ValueJSON,null)});
      }
      var approved=row.ID?this._latestApproval_(row.ID,user.TenantID):null;
      row.ReferenceSyncLog=String(project.SourceProjectID||'').trim()?ProjectInformationRepository.findSyncLog(project.SourceProjectID,projectId,type.ID,user.TenantID):null;
      row.ApprovedRevision=approved?Number(approved.Revision||0):0;
      row.IsApproved=!!(approved && Number(approved.Revision||0)===Number(row.Revision||0) && String(row.Status||'ACTIVE')==='ACTIVE');
      row.InformationType=type;
      row.Columns=InformationTypeRepository.findColumns(type.ID).filter(function(col){
        return String(col.Status || 'ACTIVE')==='ACTIVE';
      });
      return row;
    },this);
    return Response.success(rows);
  },
  get: function(projectId,typeId,params){
    var user=this._user(params);this._project(projectId,user.TenantID,user);this._type(typeId,user.TenantID);
    var row=ProjectInformationRepository.findByProjectAndType(projectId,typeId);
    if(!row)return Response.success(null);
    row.Value=this._parse(row.ValueJSON,null);
    var latestApproval=this._latestApproval_(row.ID,user.TenantID);
    row.ApprovedRevision=latestApproval?Number(latestApproval.Revision||0):0;
    row.IsApproved=!!(latestApproval && Number(latestApproval.Revision||0)===Number(row.Revision||0));
    row.History=ProjectInformationRepository.findHistory(row.ID).filter(function(item){return String(item.TenantID)===String(user.TenantID);});
    return Response.success(row);
  },
  save: function(projectId,typeId,body,params){
    var user=this._user(params),project=this._project(projectId,user.TenantID,user),type=this._type(typeId,user.TenantID);
    if(String(type.Status || 'ACTIVE')!=='ACTIVE')throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'نوع اطلاعات غیرفعال است.');
    Validator.object(body,'information');
    var eventId=String(body.SourceEventID || body.EventID || '');
    if(eventId){
      var event=EventRepository.findById(eventId);
      if(!event||String(event.TenantID)!==String(user.TenantID)||String(event.ProjectID || '')!==String(projectId))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'رویداد مرتبط با این پرونده پیدا نشد.');
    }
    var value=this._validate(type,InformationTypeRepository.findColumns(typeId),body.Value,{projectId:project.ID,tenantId:user.TenantID});
    var valueJSON=JSON.stringify(value);
    if(valueJSON.length>45000)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'حجم اطلاعات بیش از ظرفیت مجاز یک سلول صفحه‌گسترده است. لطفاً اطلاعات را در چند بخش ثبت کنید.');
    var existing=ProjectInformationRepository.findAnyByProjectAndType(projectId,typeId);
    var wasActive=existing&&String(existing.Status || 'ACTIVE')==='ACTIVE';
    // Idempotent replay of the same event/value must not create duplicate revisions.
    if(wasActive && eventId && String(existing.SourceEventID || '')===eventId &&
       String(existing.ValueJSON || '')===valueJSON) {
      return Response.success(Object.assign({},existing,{Value:value}));
    }
    var now=new Date().toISOString(),oldValue=wasActive?this._parse(existing.ValueJSON,null):null;
    var revision=existing?Number(existing.Revision || 1)+1:1,current;
    if(existing)current=ProjectInformationRepository.update(existing.ID,{ValueJSON:valueJSON,Revision:revision,SourceEventID:eventId||existing.SourceEventID||'',UpdatedBy:user.ID,UpdatedAt:now,Status:'ACTIVE'});
    else current=ProjectInformationRepository.insert({ID:this._id('PINF'),TenantID:user.TenantID,ProjectID:project.ID,InformationTypeID:type.ID,ValueJSON:valueJSON,Revision:revision,Status:'ACTIVE',SourceEventID:eventId,CreatedBy:user.ID,UpdatedBy:user.ID,CreatedAt:now,UpdatedAt:now});
    var history=ProjectInformationRepository.insertHistory({ID:this._id('PINH'),TenantID:user.TenantID,ProjectInformationID:current.ID,ProjectID:project.ID,InformationTypeID:type.ID,Revision:revision,Action:wasActive?'UPDATED':(existing?'RESTORED':'CREATED'),OldValueJSON:wasActive?JSON.stringify(oldValue):'',NewValueJSON:JSON.stringify(value),SourceEventID:eventId,Reason:String(body.Reason || ''),ActorUserID:user.ID,CreatedAt:now});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:wasActive?Constants.ACTION.UPDATE:Constants.ACTION.CREATE,EntityType:'PROJECT_INFORMATION',EntityID:current.ID,OldData:wasActive?{Value:oldValue,Revision:existing.Revision}:null,NewData:{Value:value,Revision:revision,HistoryID:history.ID,SourceEventID:eventId},Reason:String(body.Reason || 'ثبت اطلاعات پرونده پروژه')});
    var referenceSync = this._syncLiveReference_(project,type,current,user);
    current.Value=value;current.HistoryID=history.ID;current.ReferenceSync=referenceSync;
    return Response.success(current,{message:'اطلاعات پرونده ذخیره شد و اطلاعات مرجع پروژه‌های تکراری به‌روزرسانی شد.',referenceSync:referenceSync});
  },
  approve: function(projectId,typeId,body,params){
    var user=this._user(params);
    try{
      var project=this._project(projectId,user.TenantID,user),type=this._type(typeId,user.TenantID);
      if(String(project.SourceProjectID||'').trim())throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'اطلاعات پروژه تکراری قابل تأیید به‌عنوان مرجع نیست.');
      var current=ProjectInformationRepository.findByProjectAndType(projectId,typeId);
      if(!current)throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'اطلاعاتی برای تأیید ثبت نشده است.');
      var latest=this._latestApproval_(current.ID,user.TenantID);
      if(latest && Number(latest.Revision)===Number(current.Revision))return Response.success({approved:true,revision:Number(current.Revision),sync:this._syncLiveReference_(project,type,current,user)}, {message:'این نسخه قبلاً تأیید شده است.'});
      var now=new Date().toISOString(),value=this._parse(current.ValueJSON,null);
      var history=ProjectInformationRepository.insertHistory({ID:this._id('PINH'),TenantID:user.TenantID,ProjectInformationID:current.ID,ProjectID:project.ID,InformationTypeID:type.ID,Revision:Number(current.Revision||1),Action:'APPROVED',OldValueJSON:'',NewValueJSON:String(current.ValueJSON||''),SourceEventID:String(current.SourceEventID||''),Reason:String((body||{}).Reason||'تأیید نسخه مرجع'),ActorUserID:user.ID,CreatedAt:now});
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'PROJECT_INFORMATION_APPROVED',EntityType:'PROJECT_INFORMATION',EntityID:current.ID,OldData:null,NewData:{Revision:Number(current.Revision||1),HistoryID:history.ID},Reason:String((body||{}).Reason||'تأیید نسخه مرجع')});
      var sync=this._syncLiveReference_(project,type,current,user);
      return Response.success({approved:true,revision:Number(current.Revision||1),approvedAt:now,approvedBy:user.ID,Value:value,sync:sync},{message:'نسخه اطلاعات تأیید شد و همگام‌سازی پروژه‌های تکراری انجام شد.'});
    } finally {}
  },
  resolveReferenceConflict: function(projectId,typeId,body,params){
    var user=this._user(params);
    try{
      body=body||{};
      var target=this._project(projectId,user.TenantID,user),type=this._type(typeId,user.TenantID);
      var sourceId=String(target.SourceProjectID||'').trim();
      if(!sourceId)throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'این پروژه به پروژه مرجع متصل نیست.');
      var source=this._project(sourceId,user.TenantID,user);
      var policyMap=this._parse(source.ReferencePolicyJSON,{});
      var childPolicy=this._parse(target.ReferencePolicyJSON,{});
      var policy=String(childPolicy[String(type.ID)]||policyMap[String(type.ID)]||childPolicy[String(type.Code||'')]||policyMap[String(type.Code||'')]||'INDEPENDENT').toUpperCase();
      if(policy!=='LIVE_SYNC')throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'سیاست همگام‌سازی زنده برای این اطلاعات فعال نیست.');
      var conflictLog=ProjectInformationRepository.findSyncLog(source.ID,target.ID,type.ID,user.TenantID);
      if(!conflictLog||String(conflictLog.Action)!=='CONFLICT')throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'تعارض بازی برای تعیین تکلیف وجود ندارد.');
      var targetInfo=ProjectInformationRepository.findAnyByProjectAndType(target.ID,type.ID);
      var currentTargetRevision=targetInfo?Number(targetInfo.Revision||0):0;
      if(Number(body.ExpectedTargetRevision)!==Number(conflictLog.TargetRevision||0)||currentTargetRevision!==Number(conflictLog.TargetRevision||0)){
        throw ErrorHandler.create(Constants.ERROR.CONFLICT||Constants.ERROR.VALIDATION_ERROR,'اطلاعات پروژه تکراری پس از ثبت تعارض تغییر کرده است؛ صفحه را تازه‌سازی و دوباره بررسی کنید.');
      }
      var decision=String(body.Decision||'').toUpperCase();
      if(['USE_SOURCE','KEEP_LOCAL'].indexOf(decision)===-1)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'تصمیم تعارض معتبر نیست.');
      var sourceInfo=ProjectInformationRepository.findByProjectAndType(source.ID,type.ID);
      if(!sourceInfo)throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'اطلاعات مرجع پیدا نشد.');
      if(Number(sourceInfo.Revision)!==Number(conflictLog.SourceRevision)){
        throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'اطلاعات پروژه مرجع پس از ثبت تعارض تغییر کرده است؛ صفحه را تازه‌سازی و دوباره بررسی کنید.');
      }
      var now=new Date().toISOString(),nextRevision=currentTargetRevision,oldValue=targetInfo?String(targetInfo.ValueJSON||''):'';
      if(decision==='USE_SOURCE'){
        if(this._isFileBased_(type.ID,type))throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'همگام‌سازی فایل‌ها هنوز به انتقال امن پیوست نیاز دارد.');
        nextRevision=currentTargetRevision+1;
        if(targetInfo)targetInfo=ProjectInformationRepository.update(targetInfo.ID,{ValueJSON:String(sourceInfo.ValueJSON||''),Revision:nextRevision,Status:'ACTIVE',SourceEventID:'',UpdatedBy:user.ID,UpdatedAt:now});
        else targetInfo=ProjectInformationRepository.insert({ID:this._id('PINF'),TenantID:user.TenantID,ProjectID:target.ID,InformationTypeID:type.ID,ValueJSON:String(approval.NewValueJSON||''),Revision:nextRevision,Status:'ACTIVE',SourceEventID:'',CreatedBy:user.ID,UpdatedBy:user.ID,CreatedAt:now,UpdatedAt:now});
        ProjectInformationRepository.insertHistory({ID:this._id('PINH'),TenantID:user.TenantID,ProjectInformationID:targetInfo.ID,ProjectID:target.ID,InformationTypeID:type.ID,Revision:nextRevision,Action:'REFERENCE_CONFLICT_RESOLVED',OldValueJSON:oldValue,NewValueJSON:String(approval.NewValueJSON||''),SourceEventID:'',Reason:'تعارض با انتخاب نسخه جاری پروژه مرجع حل شد.',ActorUserID:user.ID,CreatedAt:now});
      }
      var resolution={decision:decision,reason:String(body.Reason||''),resolvedAt:now,sourceRevision:Number(sourceInfo.Revision),targetRevision:nextRevision,previousConflict:this._parse(conflictLog.ConflictJSON,{})};
      ProjectInformationRepository.updateSyncLog(conflictLog.ID,{Action:decision==='USE_SOURCE'?'SYNCED':'CONFLICT_RESOLVED_LOCAL',TargetRevision:nextRevision,ConflictJSON:JSON.stringify(resolution),ActorUserID:user.ID,CreatedAt:now});
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:'PROJECT_REFERENCE_CONFLICT_RESOLVED',EntityType:'PROJECT_INFORMATION',EntityID:targetInfo?targetInfo.ID:target.ID,OldData:{ValueJSON:oldValue,Revision:currentTargetRevision},NewData:{Decision:decision,SourceProjectID:source.ID,InformationTypeID:type.ID,SourceRevision:Number(approval.Revision),TargetRevision:nextRevision},Reason:String(body.Reason||'تعیین تکلیف تعارض همگام‌سازی')});
      return Response.success({resolved:true,decision:decision,targetRevision:nextRevision},{message:decision==='USE_SOURCE'?'نسخه مرجع اعمال شد.':'اطلاعات محلی حفظ شد.'});
    } finally {}
  },
  _syncLiveReference_: function(sourceProject,type,sourceInfo,user){
    var policyMap=this._parse(sourceProject.ReferencePolicyJSON,{});
    var children=(ProjectRepository.getAll()||[]).filter(function(item){
      return String(item.TenantID)===String(user.TenantID) && String(item.SourceProjectID||'')===String(sourceProject.ID) && String(item.RecordState||'ACTIVE').toUpperCase()==='ACTIVE';
    });
    var outcomes=[];
    children.forEach(function(target){
      var childPolicy=this._parse(target.ReferencePolicyJSON,{});
      var policy=String(childPolicy[String(type.ID)] || policyMap[String(type.ID)] || childPolicy[String(type.Code||'')] || policyMap[String(type.Code||'')] || 'INDEPENDENT').toUpperCase();
      if(policy!=='LIVE_SYNC')return;
      var idempotencyKey=[sourceProject.ID,target.ID,type.ID,sourceInfo.Revision].join('|');
      var logs=ProjectInformationRepository.getAllSyncLogs().filter(function(row){
        return String(row.TenantID)===String(user.TenantID) && String(row.IdempotencyKey||'')===idempotencyKey;
      });
      if(logs.length){
        var priorAction=String(logs[logs.length-1].Action||'');
        outcomes.push({targetProjectId:target.ID,status:priorAction==='SYNCED'?'ALREADY_SYNCED':(priorAction==='CONFLICT_RESOLVED_LOCAL'?'LOCAL_KEPT':priorAction)});
        return;
      }
      var now=new Date().toISOString(),targetInfo=ProjectInformationRepository.findAnyByProjectAndType(target.ID,type.ID);
      if(this._isFileBased_(type.ID,type)){
        ProjectInformationRepository.insertSyncLog({ID:this._id('PRSL'),TenantID:user.TenantID,SourceProjectID:sourceProject.ID,TargetProjectID:target.ID,InformationTypeID:type.ID,Policy:policy,SourceRevision:sourceInfo.Revision,TargetRevision:targetInfo?targetInfo.Revision:'',Action:'SKIPPED_FILE',ConflictJSON:'',IdempotencyKey:idempotencyKey,ActorUserID:user.ID,CreatedAt:now});
        outcomes.push({targetProjectId:target.ID,status:'SKIPPED_FILE'});return;
      }
      var successfulLogs=ProjectInformationRepository.getAllSyncLogs().filter(function(row){
        return String(row.TenantID)===String(user.TenantID) && String(row.SourceProjectID)===String(sourceProject.ID) &&
          String(row.TargetProjectID)===String(target.ID) && String(row.InformationTypeID)===String(type.ID) && ['SYNCED','CONFLICT_RESOLVED_LOCAL'].indexOf(String(row.Action))!==-1;
      }).sort(function(a,b){return String(b.CreatedAt||'').localeCompare(String(a.CreatedAt||''));});
      var previous=successfulLogs[0] || null;
      var targetRevision=targetInfo?Number(targetInfo.Revision||0):0;
      var expectedRevision=previous ? Number(previous.TargetRevision||0) : 0;
      if((previous && String(previous.Action)==='SYNCED' && targetRevision!==expectedRevision) || (!previous && targetInfo && String(targetInfo.Status||'ACTIVE')==='ACTIVE')){
        var conflict={reason:'TARGET_CHANGED_LOCALLY',expectedRevision:expectedRevision,currentRevision:targetRevision,sourceRevision:Number(sourceInfo.Revision||0)};
        ProjectInformationRepository.insertSyncLog({ID:this._id('PRSL'),TenantID:user.TenantID,SourceProjectID:sourceProject.ID,TargetProjectID:target.ID,InformationTypeID:type.ID,Policy:policy,SourceRevision:sourceInfo.Revision,TargetRevision:targetRevision,Action:'CONFLICT',ConflictJSON:JSON.stringify(conflict),IdempotencyKey:idempotencyKey,ActorUserID:user.ID,CreatedAt:now});
        outcomes.push({targetProjectId:target.ID,status:'CONFLICT'});return;
      }
      var nextRevision=targetInfo?targetRevision+1:1,copy;
      if(targetInfo)copy=ProjectInformationRepository.update(targetInfo.ID,{ValueJSON:String(sourceInfo.ValueJSON||''),Revision:nextRevision,Status:'ACTIVE',SourceEventID:'',UpdatedBy:user.ID,UpdatedAt:now});
      else copy=ProjectInformationRepository.insert({ID:this._id('PINF'),TenantID:user.TenantID,ProjectID:target.ID,InformationTypeID:type.ID,ValueJSON:String(sourceInfo.ValueJSON||''),Revision:nextRevision,Status:'ACTIVE',SourceEventID:'',CreatedBy:user.ID,UpdatedBy:user.ID,CreatedAt:now,UpdatedAt:now});
      ProjectInformationRepository.insertHistory({ID:this._id('PINH'),TenantID:user.TenantID,ProjectInformationID:copy.ID,ProjectID:target.ID,InformationTypeID:type.ID,Revision:nextRevision,Action:'REFERENCE_SYNC',OldValueJSON:targetInfo?String(targetInfo.ValueJSON||''):'',NewValueJSON:String(sourceInfo.ValueJSON||''),SourceEventID:'',Reason:'همگام‌سازی نسخه تأییدشده پروژه مرجع '+sourceProject.ID,ActorUserID:user.ID,CreatedAt:now});
      ProjectInformationRepository.insertSyncLog({ID:this._id('PRSL'),TenantID:user.TenantID,SourceProjectID:sourceProject.ID,TargetProjectID:target.ID,InformationTypeID:type.ID,Policy:policy,SourceRevision:sourceInfo.Revision,TargetRevision:nextRevision,Action:'SYNCED',ConflictJSON:'',IdempotencyKey:idempotencyKey,ActorUserID:user.ID,CreatedAt:now});
      outcomes.push({targetProjectId:target.ID,status:'SYNCED',targetRevision:nextRevision});
    },this);
    return outcomes;
  },
  deactivate: function(projectId,typeId,params,options){
    var user=this._user(params);this._project(projectId,user.TenantID,user);this._type(typeId,user.TenantID);options=options||{};
    var existing=ProjectInformationRepository.findByProjectAndType(projectId,typeId);
    if(!existing)throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'اطلاعات ثبت‌شده پیدا نشد.');
    var now=new Date().toISOString(),oldValue=this._parse(existing.ValueJSON,null),revision=Number(existing.Revision || 1)+1,eventId=String(options.SourceEventID||'');
    if(eventId){var sourceEvent=EventRepository.findById(eventId);if(!sourceEvent||String(sourceEvent.TenantID)!==String(user.TenantID)||String(sourceEvent.ProjectID)!==String(projectId))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'رویداد اصلاح اطلاعات پیدا نشد.');}
    var updated=ProjectInformationRepository.update(existing.ID,{Status:'DELETED',Revision:revision,UpdatedBy:user.ID,UpdatedAt:now,SourceEventID:eventId||existing.SourceEventID||''});
    var reason=String(options.Reason||'حذف منطقی اطلاعات پرونده');
    var history=ProjectInformationRepository.insertHistory({ID:this._id('PINH'),TenantID:user.TenantID,ProjectInformationID:existing.ID,ProjectID:projectId,InformationTypeID:typeId,Revision:revision,Action:'DELETED',OldValueJSON:JSON.stringify(oldValue),NewValueJSON:'',SourceEventID:eventId,Reason:reason,ActorUserID:user.ID,CreatedAt:now});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.DELETE,EntityType:'PROJECT_INFORMATION',EntityID:existing.ID,OldData:existing,NewData:updated,Reason:reason});
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
