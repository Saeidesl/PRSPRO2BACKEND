const WorkflowStepEventRuleValidator = {
  validate: function(rules) {
    if (!Array.isArray(rules)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست قواعد رویداد معتبر نیست.');
    }
    const seen = Object.create(null);
    const groups = Object.create(null);
    return rules.map(function(input, index) {
      const rule = input || {};
      Validator.required(rule.EventTypeID, 'EventTypeID');
      Validator.id(rule.EventTypeID, 'EventTypeID');
      const requirement = String(rule.RequirementMode || 'REQUIRED').toUpperCase();
      const source = String(rule.DataSource || 'NEW_EVENT').toUpperCase();
      const sequence = String(rule.SequenceMode || 'STRICT').toUpperCase();
      if (['REQUIRED','OPTIONAL','REFERENCE','NOT_REQUIRED'].indexOf(requirement) === -1) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نوع الزام رویداد معتبر نیست.');
      }
      if (['NEW_EVENT','SOURCE_PROJECT','NONE'].indexOf(source) === -1) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'منبع داده رویداد معتبر نیست.');
      }
      if (['STRICT','FREE','GROUPED'].indexOf(sequence) === -1) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حالت ترتیب رویداد معتبر نیست.');
      }
      if ((requirement === 'REFERENCE' && source !== 'SOURCE_PROJECT') ||
          (requirement === 'NOT_REQUIRED' && source !== 'NONE') ||
          ((requirement === 'REQUIRED' || requirement === 'OPTIONAL') && source === 'NONE')) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نوع الزام با منبع داده انتخاب‌شده سازگار نیست.');
      }
      const groupKey = String(rule.GroupKey || '').trim();
      const groupOrder = Number(rule.GroupOrder || 0);
      const eventOrder = Number(rule.EventOrder || 0);
      if (sequence === 'STRICT' && (!Number.isInteger(eventOrder) || eventOrder < 1 || groupKey || groupOrder)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'در ترتیب اجباری، ترتیب هر رویداد باید یکتا و بدون گروه باشد.');
      }
      if (sequence === 'FREE' && (groupKey || groupOrder || eventOrder)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'در ترتیب آزاد، شماره ترتیب و گروه نباید تعیین شود.');
      }
      if (sequence === 'GROUPED') {
        if (!groupKey || !Number.isInteger(groupOrder) || groupOrder < 1 || eventOrder !== 0) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'در ترتیب ترکیبی، گروه و شماره گروه الزامی است و ترتیب داخلی گروه آزاد می‌ماند.');
        }
        const existingGroup = groups[String(groupOrder)];
        if (existingGroup && existingGroup !== groupKey) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'هر شماره گروه فقط می‌تواند یک شناسه گروه داشته باشد.');
        }
        groups[String(groupOrder)] = groupKey;
      }
      const eventKey = String(rule.EventTypeID);
      if (seen[eventKey]) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'یک نوع رویداد در یک مرحله نمی‌تواند دوبار تعریف شود.');
      }
      seen[eventKey] = true;
      return {
        EventTypeID: eventKey,
        RequirementMode: requirement,
        DataSource: source,
        SequenceMode: sequence,
        GroupKey: groupKey,
        GroupOrder: groupOrder,
        EventOrder: eventOrder
      };
    });
  }
};
