const ProjectService = {

  dashboard: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID || '');

    const projects = (ProjectRepository.getAll() || []).filter(function(project) {
      return String(project.TenantID) === tenantId;
    });
    const events = (EventRepository.getAll() || []).filter(function(event) {
      return String(event.TenantID) === tenantId && !!event.ProjectID;
    });
    const steps = (WorkflowStepRepository.getAll() || []).filter(function(step) {
      return String(step.TenantID) === tenantId;
    });
    const assignments = (WorkflowStepDepartmentRepository.getAll
      ? WorkflowStepDepartmentRepository.getAll()
      : []).filter(function(item) {
        return String(item.TenantID) === tenantId &&
          String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
      });
    const departments = (DepartmentRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId;
    });

    const stepById = Object.create(null);
    const departmentById = Object.create(null);
    const assignmentByStepId = Object.create(null);
    const latestByProjectId = Object.create(null);

    steps.forEach(function(step) {
      stepById[String(step.ID)] = step;
    });
    departments.forEach(function(item) {
      departmentById[String(item.ID)] = item;
    });
    assignments.forEach(function(item) {
      const key = String(item.WorkflowStepID || '');
      if (key && !assignmentByStepId[key]) assignmentByStepId[key] = item;
    });

    events.forEach(function(event) {
      const projectId = String(event.ProjectID || '');
      const rawTime = event.OccurredAt || event.CreatedAt || '';
      const time = rawTime ? new Date(rawTime).getTime() : 0;
      const current = latestByProjectId[projectId];
      if (!current || (isFinite(time) && time > current.time)) {
        latestByProjectId[projectId] = {
          time: isFinite(time) ? time : 0,
          date: rawTime || '',
          eventId: event.ID || ''
        };
      }
    });

    const items = projects.map(function(project) {
      const result = Object.assign({}, project);
      const step = stepById[String(project.CurrentStepID || '')];
      const assignment = assignmentByStepId[String(project.CurrentStepID || '')];
      const department = assignment
        ? departmentById[String(assignment.DepartmentID || '')]
        : null;
      const latest = latestByProjectId[String(project.ID || '')];

      result.CurrentStepName = step
        ? (step.Name || step.Title || step.Code || '')
        : '';
      result.CurrentDepartmentID = department ? department.ID : '';
      result.CurrentDepartmentName = department
        ? (department.Name || department.Title || department.Code || '')
        : '';
      result.LastActivityAt = latest && latest.date
        ? latest.date
        : (project.UpdatedAt || project.CreatedAt || '');
      result.LastActivityEventID = latest ? latest.eventId : '';
      return result;
    });

    const displayDepartments = departments.map(function(item) {
      return { ID: item.ID, Name: item.Name || item.Title || item.Code || String(item.ID) };
    });
    const displaySteps = steps.map(function(item) {
      return { ID: item.ID, Name: item.Name || item.Title || item.Code || String(item.ID) };
    });

    return Response.success({
      projects: items,
      totalProjects: items.length,
      filterOptions: {
        users: [],
        eventTypes: [],
        departments: displayDepartments,
        stages: displaySteps
      }
    });
  },


  managementHistory: function(projectId, params) {
    Validator.required(projectId, 'شناسه پروژه');
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID || '');
    const project = ProjectRepository.findById(projectId);

    if (!project || String(project.TenantID) !== tenantId) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );
    }

    const projectEvents = (EventRepository.getAll() || []).filter(function(event) {
      return String(event.TenantID) === tenantId &&
        String(event.ProjectID || '') === String(projectId);
    });
    const eventIds = Object.create(null);
    projectEvents.forEach(function(event) { eventIds[String(event.ID)] = true; });

    const users = (UserRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId;
    });
    const userById = Object.create(null);
    users.forEach(function(item) { userById[String(item.ID)] = item; });

    const eventTypes = (EventTypeRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId;
    });
    const eventTypeById = Object.create(null);
    eventTypes.forEach(function(item) { eventTypeById[String(item.ID)] = item; });
    const departments = (DepartmentRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId;
    });
    const departmentById = Object.create(null);
    departments.forEach(function(item) { departmentById[String(item.ID)] = item; });

    const eventById = Object.create(null);
    projectEvents.forEach(function(event) { eventById[String(event.ID)] = event; });

    const history = (AuditRepository.getAll() || []).filter(function(item) {
      if (String(item.TenantID) !== tenantId) return false;
      const entityType = String(item.EntityType || '').toUpperCase();
      const entityId = String(item.EntityID || '');
      if (entityType === 'PROJECT' && entityId === String(projectId)) return true;
      if (entityType === 'EVENT' && !!eventIds[entityId]) {
        // ثبت عادی رویداد در خط زمانی تولید می‌ماند؛ این بخش فقط تغییرات مدیریتی را نشان می‌دهد.
        return String(item.Action || '').toUpperCase() !== 'CREATE';
      }
      return false;
    }).map(function(item) {
      const result = Object.assign({}, item);
      const actor = userById[String(item.UserID || '')];
      result.UserName = actor
        ? (actor.FullName || actor.DisplayName ||
          [actor.FirstName || '', actor.LastName || ''].join(' ').trim() ||
          actor.Name || actor.Username || actor.ID)
        : (item.UserID || 'نامشخص');

      const relatedEvent = String(item.EntityType || '').toUpperCase() === 'EVENT'
        ? eventById[String(item.EntityID || '')]
        : null;
      if (relatedEvent) {
        const type = eventTypeById[String(relatedEvent.EventTypeID || '')];
        const department = departmentById[String(relatedEvent.DepartmentID || '')];
        const departmentName = department
          ? (department.Name || department.Title || department.Code || '')
          : '';
        result.RelatedEventTitle = (type
          ? (type.Name || type.Title || type.Code || 'رویداد')
          : 'رویداد') + (departmentName ? ' — ' + departmentName : '');
      } else {
        result.RelatedEventTitle = '';
      }
      return result;
    }).sort(function(a, b) {
      const first = new Date(a.CreatedAt || 0).getTime() || 0;
      const second = new Date(b.CreatedAt || 0).getTime() || 0;
      return second - first;
    });

    return Response.success(history);
  },

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