const ProjectService = {

  list: function(params) {

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const projects =
      ProjectRepository.getAll();

    const tenantProjects =
      projects.filter(function(project) {

        return String(project.TenantID) ===
          String(user.TenantID);

      });

    return Response.success(
      tenantProjects
    );

  },


  get: function(id, params) {

    Validator.required(
      id,
      'شناسه پروژه'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    const project =
      ProjectRepository.findById(id);

    if (!project) {

      throw ErrorHandler.create(
        Constants.ERROR.PROJECT_NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );

    }

    if (
      String(project.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );

    }

    return Response.success(
      project
    );

  },


  create: function(project, params) {

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    ProjectValidator.validateCreate(
      project
    );

    /*
     * TenantID هرگز از ورودی کاربر پذیرفته نمی‌شود.
     * Tenant پروژه از Tenant کاربر جاری تعیین می‌شود.
     */

    const tenantId =
      user.TenantID;

    if (!tenantId) {

      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'Tenant کاربر مشخص نیست.'
      );

    }

    /*
     * ProjectCode فقط داخل Tenant جاری باید یکتا باشد.
     */

    const existingProjects =
      ProjectRepository.getAll();

    const duplicate =
      existingProjects.some(function(item) {

        return String(item.TenantID) ===
          String(tenantId) &&
          String(item.ProjectCode) ===
          String(project.ProjectCode).trim();

      });

    if (duplicate) {

      throw ErrorHandler.create(
        Constants.ERROR.DUPLICATE,
        'کد پروژه قبلاً در این Tenant ثبت شده است.'
      );

    }

    const workflow =
      WorkflowRepository.findById(
        project.WorkflowID
      );

    if (!workflow) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'Workflow مورد نظر پیدا نشد.'
      );

    }

    if (
      String(workflow.TenantID) !==
      String(tenantId)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'Workflow مورد نظر پیدا نشد.'
      );

    }

    const firstStep =
      WorkflowStepRepository.findFirstByWorkflowId(
        workflow.ID
      );

    if (!firstStep) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'Workflow فاقد مرحله است.'
      );

    }

    if (
      String(firstStep.TenantID) !==
      String(tenantId)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'مرحله Workflow معتبر نیست.'
      );

    }

    const now =
      new Date().toISOString();

    const newProject = {

      ID:
        'PRJ_' +
        Utilities.getUuid()
          .replace(/-/g, ''),

      TenantID:
        tenantId,

      ProjectCode:
        String(project.ProjectCode).trim(),

      Title:
        project.Title,

      Description:
        project.Description ||
        '',

      WorkflowID:
        workflow.ID,

      WorkflowVersion:
        workflow.Version ||
        1,

      CurrentStepID:
        firstStep.ID,

      Status:
        project.Status ||
        Constants.STATUS.ACTIVE,

      CreatedBy:
        user.ID,

      CreatedAt:
        now,

      UpdatedAt:
        now

    };

    const created =
      ProjectRepository.insert(
        newProject
      );

    AuditService.log({

      TenantID:
        newProject.TenantID,

      UserID:
        user.ID,

      Action:
        Constants.ACTION.CREATE,

      EntityType:
        Constants.ENTITY.PROJECT,

      EntityID:
        newProject.ID,

      OldData:
        null,

      NewData:
        created,

      Reason:
        'ایجاد پروژه'

    });

    return Response.success(
      created,
      {
        message:
          'پروژه با موفقیت ایجاد شد.'
      }
    );

  },


  update: function(id, data, params) {

    Validator.required(
      id,
      'شناسه پروژه'
    );

    const user =
      AccessControlService.getCurrentUser(
        params || {}
      );

    ProjectValidator.validateUpdate(
      data
    );

    const existing =
      ProjectRepository.findById(id);

    if (!existing) {

      throw ErrorHandler.create(
        Constants.ERROR.PROJECT_NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );

    }

    if (
      String(existing.TenantID) !==
      String(user.TenantID)
    ) {

      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );

    }

    const updateData = {};

    if (data.WorkflowID !== undefined) {
      const requestedWorkflowId = String(data.WorkflowID || '').trim();
      const currentWorkflowId = String(existing.WorkflowID || '');

      if (!requestedWorkflowId) {
        throw ErrorHandler.create(
          Constants.ERROR.INVALID_WORKFLOW,
          'انتخاب گردش‌کار برای پروژه الزامی است.'
        );
      }

      if (requestedWorkflowId !== currentWorkflowId) {
        const projectEvents = EventRepository.getAll().filter(function(item) {
          return String(item.ProjectID) === String(existing.ID) &&
            String(item.TenantID) === String(user.TenantID);
        });

        // هر رویدادی، حتی رویداد باطل‌شده، بخشی از تاریخچه پروژه است.
        if (projectEvents.length > 0) {
          throw ErrorHandler.create(
            Constants.ERROR.INVALID_WORKFLOW,
            'پس از ثبت اولین رویداد، تغییر گردش‌کار پروژه مجاز نیست.'
          );
        }

        const workflow = WorkflowRepository.findById(requestedWorkflowId);

        if (
          !workflow ||
          String(workflow.TenantID) !== String(user.TenantID) ||
          String(workflow.Status || Constants.STATUS.ACTIVE).toUpperCase() !==
            String(Constants.STATUS.ACTIVE).toUpperCase()
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.INVALID_WORKFLOW,
            'گردش‌کار انتخاب‌شده معتبر یا فعال نیست.'
          );
        }

        const firstStep = WorkflowStepRepository.findFirstByWorkflowId(workflow.ID);

        if (
          !firstStep ||
          String(firstStep.TenantID) !== String(user.TenantID)
        ) {
          throw ErrorHandler.create(
            Constants.ERROR.INVALID_WORKFLOW,
            'گردش‌کار انتخاب‌شده مرحله اول معتبر ندارد.'
          );
        }

        updateData.WorkflowID = workflow.ID;
        updateData.WorkflowVersion = workflow.Version || 1;
        updateData.CurrentStepID = firstStep.ID;
      }
    }

    if (
      data.ProjectCode !== undefined
    ) {

      const newProjectCode =
        String(data.ProjectCode).trim();

      const projects =
        ProjectRepository.getAll();

      const duplicate =
        projects.some(function(item) {

          return String(item.ID) !==
            String(id) &&
            String(item.TenantID) ===
            String(user.TenantID) &&
            String(item.ProjectCode) ===
            newProjectCode;

        });

      if (duplicate) {

        throw ErrorHandler.create(
          Constants.ERROR.DUPLICATE,
          'کد پروژه قبلاً در این Tenant ثبت شده است.'
        );

      }

      updateData.ProjectCode =
        newProjectCode;
    }

    if (
      data.Title !== undefined
    ) {

      updateData.Title =
        data.Title;

    }

    if (
      data.Description !== undefined
    ) {

      updateData.Description =
        data.Description;

    }

    if (
      data.Status !== undefined
    ) {

      updateData.Status =
        data.Status;

    }

    updateData.UpdatedAt =
      new Date().toISOString();

    const updated =
      ProjectRepository.update(
        id,
        updateData
      );

    AuditService.log({

      TenantID:
        existing.TenantID,

      UserID:
        user.ID,

      Action:
        Constants.ACTION.UPDATE,

      EntityType:
        Constants.ENTITY.PROJECT,

      EntityID:
        id,

      OldData:
        existing,

      NewData:
        updated,

      Reason:
        data.Reason ||
        'ویرایش پروژه'

    });

    return Response.success(
      updated,
      {
        message:
          'پروژه با موفقیت ویرایش شد.'
      }
    );

  }

};