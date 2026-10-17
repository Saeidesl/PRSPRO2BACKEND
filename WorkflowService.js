const WorkflowService = {

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


  // Narrow lookup for project creation; does not grant workflow-management access.
  listAvailableForProject: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const workflows = WorkflowRepository.getAll() || [];
    const active = workflows.filter(function(workflow) {
      return String(workflow.TenantID) === String(user.TenantID) &&
        String(workflow.Status || Constants.STATUS.ACTIVE).toUpperCase() ===
          String(Constants.STATUS.ACTIVE).toUpperCase();
    });

    return Response.success({ items: active, total: active.length });
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

  }

};