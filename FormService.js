const FormService = {
  _user: function(params) { return AccessControlService.getCurrentUser(params || {}); },
  _id: function(prefix) { return prefix + '_' + Utilities.getUuid().replace(/-/g, ''); },
  _parse: function(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch (error) { return fallback; }
  },
  _form: function(id, tenantId) {
    var form = FormRepository.findForm(id);
    if (!form || String(form.TenantID) !== String(tenantId) || String(form.Status) === 'DELETED') {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'فرم موردنظر پیدا نشد.');
    }
    return form;
  },
  _eventType: function(id, tenantId) {
    var type = EventTypeRepository.findById(id);
    if (!type || String(type.TenantID) !== String(tenantId)) throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع رویداد پیدا نشد.');
    return type;
  },
  _definition: function(form, tenantId) {
    var fields = FormRepository.findFieldsByForm(form.ID).filter(function(row) {
      return String(row.TenantID) === String(tenantId) && String(row.Status || 'ACTIVE') === 'ACTIVE';
    });
    fields.forEach(function(field) {
      var type = InformationTypeRepository.findById(field.InformationTypeID);
      if (!type || String(type.TenantID) !== String(tenantId)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع اطلاعات متصل به فرم پیدا نشد.');
      }
      if (String(type.Status || 'ACTIVE') !== 'ACTIVE') {
        throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION, 'یکی از انواع اطلاعات فرم غیرفعال شده است؛ ابتدا فرم را اصلاح کنید.');
      }
      field.InformationType = Object.assign({}, type, {
        Columns: InformationTypeRepository.findColumns(type.ID).filter(function(column) {
          return String(column.TenantID) === String(tenantId) && String(column.Status || 'ACTIVE') === 'ACTIVE';
        })
      });
      delete field.InformationType.ValidationRuleJSON;
      field.VisibilityRule = FormService._parse(field.VisibilityRuleJSON, {});
    });
    return fields;
  },
  _isVisible_: function(rule, values) {
    rule = rule || {};
    if (!rule.fieldId) return true;
    var value = values[String(rule.fieldId)];
    var empty = FormService._isEmptyValue_(value);
    var operator = String(rule.operator || '').toUpperCase();
    if (operator === 'FILLED') return !empty;
    if (operator === 'EMPTY') return empty;
    if (operator === 'EQUALS') return !empty && String(value) === String(rule.value);
    if (operator === 'NOT_EQUALS') return empty || String(value) !== String(rule.value);
    return true;
  },
  _isEmptyValue_: function(value) {
    if(value===undefined||value===null||value==='')return true;
    if(Array.isArray(value))return value.length===0||!value.some(function(item){return !FormService._isEmptyValue_(item);});
    if(typeof value==='object')return Object.keys(value).length===0||Object.keys(value).every(function(key){return FormService._isEmptyValue_(value[key]);});
    return false;
  },
  _emptyValueForType_: function(type) {
    var cardinality=String(type.Cardinality || 'SINGLE').toUpperCase();
    var hasColumns=Array.isArray(type.Columns)&&type.Columns.some(function(column){return String(column.Status || 'ACTIVE')==='ACTIVE';});
    if(hasColumns)return cardinality==='MULTIPLE'?[]:{};
    return cardinality==='MULTIPLE'?[]:'';
  },
  _validateVisibilityReference_: function(formId, fieldId, rule, tenantId, fieldOrder) {
    if (!rule || !rule.fieldId) return;
    var fields = FormRepository.findFieldsByForm(formId);
    var valid = fields.some(function(field) {
      return String(field.TenantID) === String(tenantId) &&
        String(field.Status || 'ACTIVE') === 'ACTIVE' &&
        String(field.InformationTypeID) === String(rule.fieldId) &&
        String(field.ID) !== String(fieldId || '') &&
        Number(field.FieldOrder || 0) < Number(fieldOrder || 0);
    });
    if (!valid) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فیلد مرجع شرط نمایش باید یکی از فیلدهای فعال دیگر همین فرم باشد.');
  },
  _snapshot: function(form, fields) {
    return {
      ID: form.ID, Code: form.Code, Name: form.Name, Version: Number(form.Version || 1),
      Fields: fields.map(function(field) {
        return {
          ID: field.ID, InformationTypeID: field.InformationTypeID, FieldOrder: Number(field.FieldOrder || 0),
          GroupName: field.GroupName || '', LabelOverride: field.LabelOverride || '', HelpText: field.HelpText || '',
          IsRequired: field.IsRequired === true || String(field.IsRequired).toLowerCase() === 'true',
          VisibilityRule: FormService._parse(field.VisibilityRuleJSON, {}),
          InformationType: field.InformationType
        };
      })
    };
  },
  list: function(params) {
    var user = this._user(params);
    return Response.success(FormRepository.getForms().filter(function(row) {
      return String(row.TenantID) === String(user.TenantID) && String(row.Status || 'ACTIVE') !== 'DELETED';
    }).sort(function(a,b) { return String(a.Name).localeCompare(String(b.Name)); }));
  },
  get: function(id, params) {
    var user = this._user(params), form = this._form(id, user.TenantID);
    var result = Object.assign({}, form);
    result.Fields = this._definition(form, user.TenantID);
    return Response.success(result);
  },
  create: function(data, params) {
    var user = this._user(params);
    FormValidator.validateForm(data, false);
    var code = String(data.Code).trim();
    var duplicate = FormRepository.getForms().some(function(row) {
      return String(row.TenantID) === String(user.TenantID) && String(row.Code).toLowerCase() === code.toLowerCase() && String(row.Status) !== 'DELETED';
    });
    if (duplicate) throw ErrorHandler.create(Constants.ERROR.DUPLICATE, 'کد فرم قبلاً ثبت شده است.');
    var now = new Date().toISOString();
    var row = {ID:this._id('FRM'),TenantID:user.TenantID,Code:code,Name:String(data.Name).trim(),Description:String(data.Description || ''),Version:1,Status:data.Status || 'ACTIVE',CreatedBy:user.ID,CreatedAt:now,UpdatedAt:now};
    var created = FormRepository.insertForm(row);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,EntityType:'FORM',EntityID:created.ID,NewData:created,Reason:'ایجاد فرم قابل استفاده مجدد'});
    return Response.success(created,{message:'فرم ایجاد شد.'});
  },
  update: function(id, data, params) {
    var user=this._user(params), existing=this._form(id,user.TenantID);
    FormValidator.validateForm(data,true);
    var patch={UpdatedAt:new Date().toISOString(),Version:Number(existing.Version || 1)+1};
    ['Name','Description','Status'].forEach(function(key){if(data[key]!==undefined)patch[key]=data[key];});
    if(data.Code!==undefined && String(data.Code).trim()!==String(existing.Code)) {
      var code=String(data.Code).trim();
      var duplicate=FormRepository.getForms().some(function(row){return String(row.ID)!==String(id)&&String(row.TenantID)===String(user.TenantID)&&String(row.Code).toLowerCase()===code.toLowerCase()&&String(row.Status)!=='DELETED';});
      if(duplicate)throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'کد فرم تکراری است.');
      patch.Code=code;
    }
    var updated=FormRepository.updateForm(id,patch);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.UPDATE,EntityType:'FORM',EntityID:id,OldData:existing,NewData:updated,Reason:'ویرایش فرم'});
    return Response.success(updated,{message:'فرم به‌روزرسانی شد.'});
  },
  addField: function(formId, data, params) {
    var user=this._user(params), form=this._form(formId,user.TenantID);
    FormValidator.validateField(data,false);
    var type=InformationTypeRepository.findById(data.InformationTypeID);
    if(!type||String(type.TenantID)!==String(user.TenantID)||String(type.Status || 'ACTIVE')!=='ACTIVE')throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'نوع اطلاعات فعال پیدا نشد.');
    if(String(type.Cardinality).toUpperCase()==='MULTIPLE'&&!InformationTypeRepository.findColumns(type.ID).some(function(column){return String(column.TenantID)===String(user.TenantID)&&String(column.Status || 'ACTIVE')==='ACTIVE';}))throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'ابتدا ستون‌های نوع اطلاعات جدولی را تعریف کنید.');
    if(FormRepository.findFieldsByForm(formId).some(function(row){return String(row.InformationTypeID)===String(type.ID)&&String(row.Status || 'ACTIVE')==='ACTIVE';}))throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'این نوع اطلاعات قبلاً به فرم اضافه شده است.');
    var currentFields=FormRepository.findFieldsByForm(formId).filter(function(row){return String(row.Status || 'ACTIVE')==='ACTIVE';});
    var newFieldOrder=data.FieldOrder!==undefined?Number(data.FieldOrder):currentFields.reduce(function(max,row){return Math.max(max,Number(row.FieldOrder)||0);},0)+1;
    var visibilityRule=this._parse(data.VisibilityRuleJSON,{});
    this._validateVisibilityReference_(formId,'',visibilityRule,user.TenantID,newFieldOrder);
    var now=new Date().toISOString();
    var row={ID:this._id('FF'),TenantID:user.TenantID,FormID:form.ID,InformationTypeID:type.ID,FieldOrder:newFieldOrder,GroupName:String(data.GroupName || ''),LabelOverride:String(data.LabelOverride || ''),HelpText:String(data.HelpText || ''),IsRequired:data.IsRequired===true,VisibilityRuleJSON:JSON.stringify(data.VisibilityRuleJSON || {}),Status:data.Status || 'ACTIVE',CreatedAt:now,UpdatedAt:now};
    var created=FormRepository.insertField(row);
    FormRepository.updateForm(form.ID,{Version:Number(form.Version || 1)+1,UpdatedAt:now});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,EntityType:'FORM_FIELD',EntityID:created.ID,NewData:created,Reason:'افزودن فیلد متصل به اطلاعات مرکزی'});
    return Response.success(created,{message:'فیلد به فرم اضافه شد.'});
  },
  updateField: function(id, data, params) {
    var user=this._user(params), existing=FormRepository.findField(id);
    if(!existing||String(existing.TenantID)!==String(user.TenantID))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'فیلد فرم پیدا نشد.');
    var form=this._form(existing.FormID,user.TenantID);
    FormValidator.validateField(data,true);
    if(data.InformationTypeID!==undefined) {
      if(String(data.InformationTypeID)!==String(existing.InformationTypeID)) {
        var referenced=FormRepository.findFieldsByForm(form.ID).some(function(field){
          if(String(field.ID)===String(id)||String(field.Status || 'ACTIVE')!=='ACTIVE')return false;
          var rule=FormService._parse(field.VisibilityRuleJSON,{});
          return String(rule.fieldId || '')===String(existing.InformationTypeID);
        });
        if(referenced)throw ErrorHandler.create(Constants.ERROR.CONFLICT,'ابتدا شرط نمایش فیلدهای وابسته را اصلاح کنید؛ این فیلد مرجع شرط نمایش است.');
      }
      var type=InformationTypeRepository.findById(data.InformationTypeID);
      if(!type||String(type.TenantID)!==String(user.TenantID)||String(type.Status)!=='ACTIVE')throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'نوع اطلاعات فعال پیدا نشد.');
      if(String(type.Cardinality).toUpperCase()==='MULTIPLE'&&!InformationTypeRepository.findColumns(type.ID).some(function(column){return String(column.TenantID)===String(user.TenantID)&&String(column.Status || 'ACTIVE')==='ACTIVE';}))throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'ابتدا ستون‌های نوع اطلاعات جدولی را تعریف کنید.');
      var duplicate=FormRepository.findFieldsByForm(form.ID).some(function(row){return String(row.ID)!==String(id)&&String(row.InformationTypeID)===String(type.ID)&&String(row.Status || 'ACTIVE')==='ACTIVE';});
      if(duplicate)throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'این نوع اطلاعات قبلاً به فرم اضافه شده است.');
    }
    if(data.FieldOrder!==undefined&&Number(data.FieldOrder)!==Number(existing.FieldOrder || 0)) {
      var laterDependent=FormRepository.findFieldsByForm(form.ID).some(function(field){
        if(String(field.ID)===String(id)||String(field.Status || 'ACTIVE')!=='ACTIVE')return false;
        var rule=FormService._parse(field.VisibilityRuleJSON,{});
        return String(rule.fieldId || '')===String(existing.InformationTypeID)&&Number(field.FieldOrder || 0)<=Number(data.FieldOrder);
      });
      if(laterDependent)throw ErrorHandler.create(Constants.ERROR.CONFLICT,'ترتیب این فیلد نمی‌تواند بعد از فیلدهای وابسته به آن قرار بگیرد.');
    }
    if(data.Status!==undefined&&String(data.Status)!=='ACTIVE') {
      var dependentField=FormRepository.findFieldsByForm(form.ID).some(function(field){
        if(String(field.ID)===String(id)||String(field.Status || 'ACTIVE')!=='ACTIVE')return false;
        var rule=FormService._parse(field.VisibilityRuleJSON,{});
        return String(rule.fieldId || '')===String(existing.InformationTypeID);
      });
      if(dependentField)throw ErrorHandler.create(Constants.ERROR.CONFLICT,'ابتدا شرط نمایش فیلدهای وابسته را اصلاح کنید؛ این فیلد مرجع شرط نمایش است.');
    }
    var visibilityRule=data.VisibilityRuleJSON!==undefined?this._parse(data.VisibilityRuleJSON,{}):this._parse(existing.VisibilityRuleJSON,{});
    this._validateVisibilityReference_(form.ID,id,visibilityRule,user.TenantID,Number(data.FieldOrder !== undefined ? data.FieldOrder : existing.FieldOrder));
    var patch={UpdatedAt:new Date().toISOString()};
    ['InformationTypeID','FieldOrder','GroupName','LabelOverride','HelpText','IsRequired','Status'].forEach(function(key){if(data[key]!==undefined)patch[key]=data[key];});
    if(data.VisibilityRuleJSON!==undefined)patch.VisibilityRuleJSON=JSON.stringify(data.VisibilityRuleJSON);
    var updated=FormRepository.updateField(id,patch);
    FormRepository.updateForm(form.ID,{Version:Number(form.Version || 1)+1,UpdatedAt:patch.UpdatedAt});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.UPDATE,EntityType:'FORM_FIELD',EntityID:id,OldData:existing,NewData:updated,Reason:'ویرایش فیلد فرم'});
    return Response.success(updated,{message:'فیلد فرم به‌روزرسانی شد.'});
  },
  removeField: function(id, params) {
    var user=this._user(params), existing=FormRepository.findField(id);
    if(!existing||String(existing.TenantID)!==String(user.TenantID))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'فیلد فرم پیدا نشد.');
    var form=this._form(existing.FormID,user.TenantID);
    var dependent=FormRepository.findFieldsByForm(form.ID).some(function(field){
      if(String(field.ID)===String(id)||String(field.Status || 'ACTIVE')!=='ACTIVE')return false;
      var rule=FormService._parse(field.VisibilityRuleJSON,{});
      return String(rule.fieldId || '')===String(existing.InformationTypeID);
    });
    if(dependent)throw ErrorHandler.create(Constants.ERROR.CONFLICT,'ابتدا شرط نمایش فیلدهای وابسته را اصلاح کنید؛ این فیلد مرجع شرط نمایش است.');
    var now=new Date().toISOString();
    var updated=FormRepository.updateField(id,{Status:'DELETED',UpdatedAt:now});
    FormRepository.updateForm(form.ID,{Version:Number(form.Version || 1)+1,UpdatedAt:now});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.DELETE,EntityType:'FORM_FIELD',EntityID:id,OldData:existing,NewData:updated,Reason:'حذف منطقی فیلد فرم'});
    return Response.success(updated,{message:'فیلد فرم حذف منطقی شد.'});
  },
  listFormEventTypes: function(formId, params) {
    var user=this._user(params), form=this._form(formId,user.TenantID);
    var mappings=FormRepository.getEventTypeMappings().filter(function(row){
      return String(row.TenantID)===String(user.TenantID)&&String(row.FormID)===String(form.ID)&&String(row.Status || 'ACTIVE')==='ACTIVE';
    });
    var types=EventTypeRepository.getAll().filter(function(type){return String(type.TenantID)===String(user.TenantID);});
    return Response.success(mappings.map(function(mapping){
      var type=types.find(function(item){return String(item.ID)===String(mapping.EventTypeID);});
      if(!type)return null;
      return Object.assign({},mapping,{EventType:{ID:type.ID,Name:type.Name,Code:type.Code,ConnectionType:type.ConnectionType}});
    }).filter(Boolean));
  },
  listEventTypeForms: function(eventTypeId, params) {
    var user=this._user(params), eventType=this._eventType(eventTypeId,user.TenantID);
    var rows=FormRepository.findMappingsByEventType(eventTypeId).filter(function(row){
      if(String(row.TenantID)!==String(user.TenantID)||String(row.Status || 'ACTIVE')!=='ACTIVE')return false;
      var form=FormRepository.findForm(row.FormID);
      return !!form && String(form.Status || 'ACTIVE')==='ACTIVE';
    });
    rows.sort(function(a,b){return Number(a.FieldOrder || 0)-Number(b.FieldOrder || 0);});
    return Response.success(rows.map(function(row){
      var form=this._form(row.FormID,user.TenantID);
      var result=Object.assign({},row,{Form:Object.assign({},form,{Fields:this._definition(form,user.TenantID)})});
      return result;
    },this));
  },
  assignEventType: function(eventTypeId, data, params) {
    var user=this._user(params), type=this._eventType(eventTypeId,user.TenantID);
    if(String(type.ConnectionType || 'PROJECT').toUpperCase()==='INDEPENDENT')throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'فرم اطلاعات پروژه فقط به نوع رویداد متصل به پروژه قابل اتصال است.');
    Validator.required(data && data.FormID,'FormID');
    var form=this._form(data.FormID,user.TenantID);
    if(String(form.Status || 'ACTIVE')!=='ACTIVE')throw ErrorHandler.create(Constants.ERROR.INVALID_OPERATION,'فرم غیرفعال است و قابل اتصال نیست.');
    var existing=FormRepository.findMappingByEventTypeAndForm(eventTypeId,form.ID);
    if(existing && String(existing.Status || 'ACTIVE')==='ACTIVE')throw ErrorHandler.create(Constants.ERROR.DUPLICATE,'این فرم قبلاً به نوع رویداد متصل شده است.');
    var now=new Date().toISOString();
    var row={ID:existing?existing.ID:this._id('ETF'),TenantID:user.TenantID,EventTypeID:type.ID,FormID:form.ID,IsRequired:data.IsRequired!==false,FieldOrder:Number(data.FieldOrder || 0),Status:'ACTIVE',CreatedBy:existing?existing.CreatedBy:user.ID,CreatedAt:existing?existing.CreatedAt:now,UpdatedAt:now};
    var created=existing?FormRepository.updateMapping(existing.ID,row):FormRepository.insertMapping(row);
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,EntityType:'EVENT_TYPE_FORM',EntityID:created.ID,NewData:created,Reason:'اتصال فرم به نوع رویداد'});
    return Response.success(created,{message:'فرم به نوع رویداد متصل شد.'});
  },
  unassignEventType: function(id, params) {
    var user=this._user(params), row=FormRepository.findMapping(id);
    if(!row||String(row.TenantID)!==String(user.TenantID))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'اتصال فرم پیدا نشد.');
    var updated=FormRepository.updateMapping(id,{Status:'DELETED',UpdatedAt:new Date().toISOString()});
    AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.DELETE,EntityType:'EVENT_TYPE_FORM',EntityID:id,OldData:row,NewData:updated,Reason:'قطع اتصال فرم از نوع رویداد'});
    return Response.success(updated,{message:'اتصال فرم حذف شد.'});
  },
  prepareEventResponses: function(eventTypeId, responses, tenantId) {
    var mappings=FormRepository.findMappingsByEventType(eventTypeId).filter(function(row){
      if(String(row.TenantID)!==String(tenantId)||String(row.Status || 'ACTIVE')!=='ACTIVE')return false;
      var form=FormRepository.findForm(row.FormID);
      return !!form && String(form.Status || 'ACTIVE')==='ACTIVE';
    });
    if(responses!==undefined&&responses!==null&&!Array.isArray(responses))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'فهرست پاسخ فرم‌ها معتبر نیست.');
    var submitted=Array.isArray(responses)?responses:[];
    if(submitted.length>30)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'حداکثر ۳۰ فرم در هر رویداد قابل ثبت است.');
    if(!mappings.length&&submitted.length)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'برای این نوع رویداد فرمی تعریف نشده است.');
    var byId=Object.create(null);
    submitted.forEach(function(item){if(!item||!item.FormID||byId[String(item.FormID)])throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'اطلاعات فرم تکراری یا نامعتبر است.');byId[String(item.FormID)]=item;});
    var allowed=Object.create(null),validated=[];
    mappings.forEach(function(mapping){
      allowed[String(mapping.FormID)]=true;
      var raw=byId[String(mapping.FormID)];
      if(!raw){
        if(mapping.IsRequired===true||String(mapping.IsRequired).toLowerCase()==='true')throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'تکمیل فرم الزامی این رویداد انجام نشده است.');
        return;
      }
      var form=this._form(mapping.FormID,tenantId),version=Number(form.Version || 1);
      if(Number(raw.FormVersion || 0)!==version)throw ErrorHandler.create(Constants.ERROR.CONFLICT,'نسخه فرم تغییر کرده است؛ فرم را دوباره باز کنید و اطلاعات را مجدداً وارد کنید.');
      var fields=this._definition(form,tenantId),values=raw.Values;
      if(!values||typeof values!=='object'||Array.isArray(values))throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'مقادیر فرم معتبر نیستند.');
      var hasMeaningfulValue=fields.some(function(field){
        var type=field.InformationType,key=String(type.ID),value=values[key];
        var visible=FormService._isVisible_(field.VisibilityRule || FormService._parse(field.VisibilityRuleJSON,{}),values);
        var empty=FormService._isEmptyValue_(value);
        return visible&&!empty;
      });
      if((mapping.IsRequired===true||String(mapping.IsRequired).toLowerCase()==='true')&&!hasMeaningfulValue) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'فرم الزامی باید حداقل یک مقدار داشته باشد.');
      }
      var allowedTypes=Object.create(null),clean=Object.create(null);
      fields.forEach(function(field){
        var type=field.InformationType, key=String(type.ID), supplied=Object.prototype.hasOwnProperty.call(values,key), value=supplied?values[key]:undefined;
        allowedTypes[key]=true;
        var visible=FormService._isVisible_(field.VisibilityRule || FormService._parse(field.VisibilityRuleJSON,{}),values);
        var required=field.IsRequired===true||String(field.IsRequired).toLowerCase()==='true';
        var empty=FormService._isEmptyValue_(value);
        if(!visible) {
          if(!empty) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'فیلد پنهان نباید مقدار ارسال‌شده داشته باشد: '+(field.LabelOverride||type.Name));
          clean[key]=FormService._emptyValueForType_(type);
          return;
        }
        if(empty&&required)throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'تکمیل «'+(field.LabelOverride||type.Name)+'» الزامی است.');
        if(empty){
          var hasColumns=Array.isArray(type.Columns)&&type.Columns.some(function(column){return String(column.Status || 'ACTIVE')==='ACTIVE';});
          clean[key]=hasColumns&&supplied&&value!==null&&value!==undefined&&value!==''
            ? ProjectInformationService._validate(type,type.Columns,value)
            : FormService._emptyValueForType_(type);
          return;
        }
        clean[key]=ProjectInformationService._validate(type,type.Columns || [],value);
      });
      Object.keys(values).forEach(function(key){if(!allowedTypes[key])throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'نوع اطلاعات خارج از فرم ارسال شده است: '+key);});
      validated.push({FormID:form.ID,FormVersion:version,Values:clean,DefinitionSnapshot:this._snapshot(form,fields)});
    },this);
    Object.keys(byId).forEach(function(id){if(!allowed[id])throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,'فرم ارسالی به این نوع رویداد متصل نیست.');});
    return validated;
  },
  saveEventResponses: function(event, responses, user) {
    (responses || []).forEach(function(response){
      var existing=FormRepository.findResponse(event.ID,response.FormID);
      var now=new Date().toISOString();
      var row={ID:existing?existing.ID:this._id('EFR'),TenantID:user.TenantID,EventID:event.ID,FormID:response.FormID,FormVersion:response.FormVersion,ResponseJSON:JSON.stringify(response.Values),DefinitionSnapshotJSON:JSON.stringify(response.DefinitionSnapshot),CreatedBy:user.ID,CreatedAt:now};
      if(existing)FormRepository.updateResponse(existing.ID,row);else FormRepository.insertResponse(row);
      AuditService.log({TenantID:user.TenantID,UserID:user.ID,Action:Constants.ACTION.CREATE,EntityType:'EVENT_FORM_DATA',EntityID:event.ID,NewData:row,Reason:'ثبت پاسخ فرم متصل به رویداد'});
    },this);
  },
  getEventResponses: function(eventId, params) {
    var user=this._user(params),event=EventRepository.findById(eventId);
    if(!event||String(event.TenantID)!==String(user.TenantID))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'رویداد پیدا نشد.');
    if(event.ProjectID){
      var project=ProjectRepository.findById(event.ProjectID);
      if(!project||String(project.TenantID)!==String(user.TenantID)||!ProjectService._isProjectAvailableToUser_(project,user))throw ErrorHandler.create(Constants.ERROR.NOT_FOUND,'رویداد پیدا نشد.');
    }
    return Response.success(FormRepository.findResponsesByEvent(eventId).filter(function(row){return String(row.TenantID)===String(user.TenantID);}).map(function(row){
      return Object.assign({},row,{Values:this._parse(row.ResponseJSON,{}),Definition:this._parse(row.DefinitionSnapshotJSON,{})});
    },this));
  }
};