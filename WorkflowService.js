const WorkflowService = {

  // Bundled read endpoint for the workflow-management screen. Keeping these
  // lookups in one Apps Script execution avoids multiple cold-start round trips.
  managementBootstrap: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID);
    const workflows = WorkflowRepository.getAll().filter(function(item) {
      return String(item.TenantID) === tenantId;
    });
    const departments = DepartmentRepository.getAll().filter(function(item) {
      return String(item.TenantID) === tenantId;
    });
    return Response.success({ workflows: workflows, departments: departments });
  },

  managementData: function(workflowId, params) {
    Validator.id(workflowId, 'WorkflowID');
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID);
    const workflow = WorkflowRepository.findById(workflowId);
    if (!workflow || String(workflow.TenantID) !== tenantId) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'گردش‌کار مورد نظر پیدا نشد.');
    }
    const steps = WorkflowStepRepository.findByWorkflowId(workflowId).filter(function(item) {
      return String(item.TenantID) === tenantId;
    });
    const assignments = WorkflowStepDepartmentRepository.findByWorkflowId(workflowId).filter(function(item) {
      return String(item.TenantID) === tenantId && String(item.Status).toUpperCase() === 'ACTIVE';
    });
    return Response.success({ steps: steps, assignments: assignments });
  },

  list: function(params) {

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const workflows =
      WorkflowRepository.getAll();

    const tenantWorkflows =
      workflows.filter(function(workflow) {

        return String(workflow.TenantID) ===
          String(user.TenantID);

      });

    return Response.success({
      items: tenantWorkflows,
      total: tenantWorkflows.length
    });

  },


  get: function(id, params) {

    Validator.id(
      id,
      'WorkflowID'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const workflow =
      WorkflowRepository.findById(id);

    if (!workflow) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    if (
      String(workflow.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    const steps =
      WorkflowStepRepository.findByWorkflowId(id);

    const tenantSteps =
      steps.filter(function(step) {

        return String(step.TenantID) ===
          String(user.TenantID);

      });

    return Response.success({
      workflow: workflow,
      steps: tenantSteps
    });

  },


  create: function(data, params) {

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    WorkflowValidator.validateCreate(
      data
    );

    const tenantId =
      user.TenantID;

    if (!tenantId) {

      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'Tenant کاربر مشخص نیست.'
      );

    }

    const workflows =
      WorkflowRepository.getAll();

    const duplicate =
      workflows.some(function(workflow) {

        return String(workflow.TenantID) ===
          String(tenantId) &&
          String(workflow.Code) ===
          String(data.Code);

      });

    if (duplicate) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'کد گردش‌کار قبلاً در این Tenant ثبت شده است.'
      );

    }

    const now =
      new Date().toISOString();

    const workflow = {

      ID:
        'WF_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        tenantId,

      Name:
        data.Name,

      Code:
        data.Code,

      Version:
        data.Version ||
        1,

      WorkflowType: String(data.WorkflowType || 'INITIAL').toUpperCase(),
      LifecycleState: 'DRAFT',
      PublishedVersion: '',
      DraftVersion: Number(data.Version || 1),

      Status:
        data.Status ||
        Constants.STATUS.ACTIVE,

      CreatedAt:
        now,

      UpdatedAt:
        now

    };

    const created =
      WorkflowRepository.insert(
        workflow
      );

    return Response.success(
      created,
      {
        message:
          'گردش‌کار با موفقیت ایجاد شد.'
      }
    );

  },


  update: function(id, data, params) {

    Validator.id(
      id,
      'WorkflowID'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    WorkflowValidator.validateUpdate(
      data
    );

    const existing =
      WorkflowRepository.findById(id);

    if (!existing) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    if (
      String(existing.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    if (
      data.Code !== undefined &&
      String(data.Code) !==
      String(existing.Code)
    ) {

      const workflows =
        WorkflowRepository.getAll();

      const duplicate =
        workflows.some(function(workflow) {

          return String(workflow.ID) !==
            String(id) &&
            String(workflow.TenantID) ===
            String(user.TenantID) &&
            String(workflow.Code) ===
            String(data.Code);

        });

      if (duplicate) {

        throw ErrorHandler.create(
          Constants.ERROR.DUPLICATE,
          'کد گردش‌کار قبلاً در این Tenant ثبت شده است.'
        );

      }

    }

    const updateData = {};

    if (data.WorkflowType !== undefined) {
      const workflowType = String(data.WorkflowType || '').toUpperCase();
      if (['INITIAL', 'REPEAT'].indexOf(workflowType) === -1) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نوع گردش‌کار معتبر نیست.');
      }
      updateData.WorkflowType = workflowType;
    }

    Object.keys(data).forEach(function(key) {

      if (
        key !== 'ID' &&
        key !== 'TenantID' &&
        key !== 'CreatedAt'
      ) {

        updateData[key] =
          data[key];

      }

    });

    /*
     * TenantID هرگز از ورودی قابل تغییر نیست.
     */

    updateData.UpdatedAt =
      new Date().toISOString();

    const updated =
      WorkflowRepository.update(
        id,
        updateData
      );

    return Response.success(
      updated,
      {
        message:
          'گردش‌کار با موفقیت ویرایش شد.'
      }
    );

  },


  getSteps: function(workflowId, params) {

    Validator.id(
      workflowId,
      'WorkflowID'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const workflow =
      WorkflowRepository.findById(
        workflowId
      );

    if (!workflow) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    if (
      String(workflow.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    const steps =
      WorkflowStepRepository.findByWorkflowId(
        workflowId
      );

    const tenantSteps =
      steps.filter(function(step) {

        return String(step.TenantID) ===
          String(user.TenantID);

      });

    return Response.success({
      items: tenantSteps,
      total: tenantSteps.length
    });

  },


  createStep: function(
    workflowId,
    data,
    params
  ) {

    Validator.id(
      workflowId,
      'WorkflowID'
    );

    if (!data) {

      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'اطلاعات مرحله ارسال نشده است.'
      );

    }

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    Validator.required(
      data.Name,
      'Name'
    );

    Validator.required(
      data.Code,
      'Code'
    );

    Validator.string(
      data.Name,
      'Name'
    );

    Validator.string(
      data.Code,
      'Code'
    );

    const workflow =
      WorkflowRepository.findById(
        workflowId
      );

    if (!workflow) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    if (
      String(workflow.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'گردش‌کار مورد نظر پیدا نشد.'
      );

    }

    const existingSteps =
      WorkflowStepRepository.findByWorkflowId(
        workflowId
      );

    const duplicate =
      existingSteps.some(function(step) {

        return String(step.TenantID) ===
          String(user.TenantID) &&
          String(step.Code) ===
          String(data.Code);

      });

    if (duplicate) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'کد این مرحله قبلاً در این گردش‌کار استفاده شده است.'
      );

    }

    const stepOrder =
      data.StepOrder !== undefined
        ? Number(data.StepOrder)
        : existingSteps.length + 1;

    const now =
      new Date().toISOString();

    const step = {

      ID:
        'STEP_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        user.TenantID,

      WorkflowID:
        workflowId,

      Name:
        data.Name,

      Code:
        data.Code,

      StepOrder:
        stepOrder,

      WorkflowVersion: Number(workflow.DraftVersion || workflow.Version || 1),

      Status:
        data.Status ||
        Constants.STATUS.ACTIVE,

      CreatedAt:
        now,

      UpdatedAt:
        now

    };

    const created =
      WorkflowStepRepository.insert(
        step
      );

    return Response.success(
      created,
      {
        message:
          'مرحله گردش‌کار با موفقیت ایجاد شد.'
      }
    );

  },

  getStepEventRules: function(workflowId, stepId, params) {
    Validator.id(workflowId, 'WorkflowID');
    Validator.id(stepId, 'WorkflowStepID');
    const user = AccessControlService.getCurrentUser(params || {});
    const workflow = WorkflowRepository.findById(workflowId);
    const step = WorkflowStepRepository.findById(stepId);
    if (!workflow || !step ||
        String(workflow.TenantID) !== String(user.TenantID) ||
        String(step.TenantID) !== String(user.TenantID) ||
        String(step.WorkflowID) !== String(workflowId)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مرحله گردش‌کار پیدا نشد.');
    }
    const requestedVersion = Number((params || {}).WorkflowVersion || (params || {}).version ||
      workflow.DraftVersion || workflow.PublishedVersion || workflow.Version || 1);
    const rules = WorkflowStepEventRuleRepository.findByStepAndVersion(stepId, requestedVersion)
      .filter(function(rule) { return String(rule.TenantID) === String(user.TenantID) && String(rule.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'; });
    return Response.success({ workflowId: workflowId, workflowVersion: requestedVersion, stepId: stepId, items: rules, total: rules.length });
  },

  saveStepEventRules: function(workflowId, stepId, data, params) {
    Validator.id(workflowId, 'WorkflowID');
    Validator.id(stepId, 'WorkflowStepID');
    if (!data || !Array.isArray(data.rules)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست قواعد رویداد ارسال نشده است.');
    }
    const user = AccessControlService.getCurrentUser(params || {});
    const workflow = WorkflowRepository.findById(workflowId);
    const step = WorkflowStepRepository.findById(stepId);
    if (!workflow || !step ||
        String(workflow.TenantID) !== String(user.TenantID) ||
        String(step.TenantID) !== String(user.TenantID) ||
        String(step.WorkflowID) !== String(workflowId)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مرحله گردش‌کار پیدا نشد.');
    }
    if (data.rules.length > 100) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای هر مرحله حداکثر ۱۰۰ قاعده رویداد مجاز است.');
    }
    const isPublished = String(workflow.LifecycleState || '').toUpperCase() === 'PUBLISHED';
    const publishedVersion = Number(workflow.PublishedVersion || workflow.Version || 1);
    const version = Number(workflow.DraftVersion || (isPublished ? publishedVersion + 1 : workflow.Version || 1));
    if (data.WorkflowVersion !== undefined && Number(data.WorkflowVersion) !== version) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نسخه درخواستی با نسخه پیش‌نویس معتبر گردش‌کار مطابقت ندارد.');
    }
    const normalizedRules = WorkflowStepEventRuleValidator.validate(data.rules);
    normalizedRules.forEach(function(rule) {
      const eventType = EventTypeRepository.findById(rule.EventTypeID);
      if (!eventType || String(eventType.TenantID) !== String(user.TenantID) ||
          String(eventType.Status || '').toUpperCase() !== 'ACTIVE' ||
          String(eventType.ConnectionType || 'PROJECT').toUpperCase() === 'INDEPENDENT') {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'یکی از انواع رویداد انتخاب‌شده معتبر یا فعال نیست.');
      }
    });
    if (isPublished && !workflow.DraftVersion) {
      WorkflowStepEventRuleRepository.cloneWorkflowVersion(
        workflowId, publishedVersion, version, user.TenantID
      );
    }
    const now = new Date().toISOString();
    const stored = normalizedRules.map(function(rule) {
      return Object.assign({}, rule, {
        ID: 'WFER_' + Utilities.getUuid().replace(/-/g, ''),
        TenantID: user.TenantID,
        WorkflowID: workflowId,
        WorkflowVersion: version,
        WorkflowStepID: stepId,
        Status: 'ACTIVE',
        CreatedAt: now,
        UpdatedAt: now
      });
    });
    WorkflowStepEventRuleRepository.replaceForStepVersion(workflowId, stepId, version, user.TenantID, stored);
    const workflowPatch = {};
    if (String(workflow.LifecycleState || '').toUpperCase() === 'PUBLISHED') {
      workflowPatch.DraftVersion = version;
      workflowPatch.LifecycleState = 'DRAFT';
    } else if (!workflow.DraftVersion) {
      workflowPatch.DraftVersion = version;
      workflowPatch.LifecycleState = 'DRAFT';
    }
    if (Object.keys(workflowPatch).length) {
      workflowPatch.UpdatedAt = now;
      WorkflowRepository.update(workflowId, workflowPatch);
    }
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID,
      Action: 'WORKFLOW_STEP_EVENT_RULES_UPDATED',
      EntityType: 'WORKFLOW_STEP', EntityID: stepId,
      NewData: { WorkflowID: workflowId, WorkflowVersion: version, Rules: stored },
      Reason: 'به‌روزرسانی قواعد رویداد مرحله گردش‌کار'
    });
    return Response.success({ workflowId: workflowId, workflowVersion: version, stepId: stepId, items: stored, total: stored.length },
      { message: 'قواعد رویداد مرحله ذخیره شد.' });
  },

  publish: function(workflowId, params) {
    Validator.id(workflowId, 'WorkflowID');
    const user = AccessControlService.getCurrentUser(params || {});
    const workflow = WorkflowRepository.findById(workflowId);
    if (!workflow || String(workflow.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'گردش‌کار مورد نظر پیدا نشد.');
    }
    const steps = WorkflowStepRepository.findByWorkflowId(workflowId).filter(function(step) {
      return String(step.TenantID) === String(user.TenantID) &&
        String(step.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    });
    if (!steps.length) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'برای انتشار گردش‌کار حداقل یک مرحله فعال لازم است.');
    }
    const version = Number(workflow.DraftVersion || workflow.Version || 1);
    const eventTypes = EventTypeRepository.getAll().filter(function(item) {
      return String(item.TenantID) === String(user.TenantID) && String(item.Status).toUpperCase() === 'ACTIVE';
    });
    const validEventTypeIds = Object.create(null);
    eventTypes.forEach(function(item) { validEventTypeIds[String(item.ID)] = true; });
    const activeRules = WorkflowStepEventRuleRepository.findByWorkflowVersion(workflowId, version)
      .filter(function(rule) { return String(rule.TenantID) === String(user.TenantID) && String(rule.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'; });
    activeRules.forEach(function(rule) {
      if (!validEventTypeIds[String(rule.EventTypeID)] ||
          !steps.some(function(step) { return String(step.ID) === String(rule.WorkflowStepID); })) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'قواعد گردش‌کار شامل مرحله یا نوع رویداد نامعتبر است.');
      }
    });
    const now = new Date().toISOString();
    const updated = WorkflowRepository.update(workflowId, {
      Version: version,
      PublishedVersion: version,
      DraftVersion: '',
      LifecycleState: 'PUBLISHED',
      Status: Constants.STATUS.ACTIVE,
      UpdatedAt: now
    });
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID,
      Action: 'WORKFLOW_PUBLISHED', EntityType: 'WORKFLOW', EntityID: workflowId,
      OldData: workflow, NewData: updated,
      Reason: 'انتشار نسخه ' + version + ' گردش‌کار'
    });
    return Response.success({ workflow: updated, workflowVersion: version },
      { message: 'نسخه گردش‌کار با موفقیت منتشر شد.' });
  }


};