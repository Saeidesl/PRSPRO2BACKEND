const ProjectService = {

  _normalizeColorSizeJSON_: function(value) {
    if (value === undefined || value === null || String(value).trim() === '') return JSON.stringify({ colors: [], sizes: [] });
    let parsed;
    try { parsed = typeof value === 'string' ? JSON.parse(value) : value; }
    catch (error) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ساختار رنگ‌بندی و سایزبندی معتبر نیست.');
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.colors) ||
        !Array.isArray(parsed.sizes) || parsed.colors.length > 100 || parsed.sizes.length > 100) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست رنگ‌ها و سایزها معتبر نیست.');
    }
    function clean(list, maxLength) {
      const seen = {};
      return list.map(function(item) {
        const value = String(item || '').trim();
        if (!value || value.length > maxLength) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'نام رنگ یا سایز خالی یا بیش از حد طولانی است.');
        }
        const key = value.toLocaleLowerCase();
        if (seen[key]) return '';
        seen[key] = true;
        return value;
      }).filter(Boolean);
    }
    return JSON.stringify({ colors: clean(parsed.colors, 80), sizes: clean(parsed.sizes, 40) });
  },

  projectFormLookups: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID || '');
    const departments = (DepartmentRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }).map(function(item) {
      return { ID: item.ID, Name: item.Name || item.Title || item.Code || String(item.ID), Code: item.Code || '' };
    });
    const users = (UserRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }).map(function(item) {
      const fullName = [item.FirstName || '', item.LastName || ''].join(' ').trim();
      return { ID: item.ID, Name: item.Name || item.FullName || item.DisplayName || fullName || item.Username || String(item.ID), DepartmentID: item.DepartmentID || '' };
    });
    return Response.success({ departments: departments, users: users });
  },

  dashboardLookups: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID || '');

    const users = (UserRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId &&
        String(item.Status || 'ACTIVE').toUpperCase() !== 'DELETED';
    }).map(function(item) {
      const fullName = [item.FirstName || '', item.LastName || ''].join(' ').trim();
      return {
        ID: item.ID,
        Name: item.Name || item.FullName || item.DisplayName || fullName ||
          item.Username || item.Email || String(item.ID)
      };
    });

    const departments = (DepartmentRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId &&
        String(item.Status || 'ACTIVE').toUpperCase() !== 'DELETED';
    }).map(function(item) {
      return { ID: item.ID, Name: item.Name || item.Title || item.Code || String(item.ID) };
    });

    const eventTypes = (EventTypeRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId &&
        String(item.Status || 'ACTIVE').toUpperCase() !== 'DELETED';
    }).map(function(item) {
      return { ID: item.ID, Name: item.Name || item.Title || item.Code || String(item.ID) };
    });

    const workflowSteps = (WorkflowStepRepository.getAll() || []).filter(function(item) {
      return String(item.TenantID) === tenantId &&
        String(item.Status || 'ACTIVE').toUpperCase() !== 'DELETED';
    }).map(function(item) {
      return {
        ID: item.ID,
        WorkflowID: item.WorkflowID || '',
        Name: item.Name || item.Title || item.Code || String(item.ID),
        Code: item.Code || '',
        StepOrder: item.StepOrder || item.Order || 0
      };
    });

    // Read-only status labels for dashboard/project viewers. Do not require
    // PROJECT_STATUS_MANAGE merely to translate a status ID into its name.
    const projectStatuses = ProjectStatusService._getRows_().filter(function(item) {
      return String(item.TenantID) === tenantId &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    }).map(function(item) {
      return {
        ID: item.ID,
        Code: item.Code || '',
        Name: item.Name || item.Code || String(item.ID)
      };
    });

    return Response.success({
      users: users,
      departments: departments,
      eventTypes: eventTypes,
      workflowSteps: workflowSteps,
      projectStatuses: projectStatuses
    });
  },


  _isProjectAvailableToUser_: function(project, user) {
    if (AccessControlService.isAdmin(user)) return true;
    function parse(value) {
      if (Array.isArray(value)) return value;
      try { const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; }
      catch (error) { return []; }
    }
    const departments = parse(project.AvailableDepartmentIDs);
    const users = parse(project.AllowedUserIDs);
    if (!departments.length && !users.length) return true;
    return departments.some(function(id) {
      return String(id) === String(user.DepartmentID || '');
    }) || users.some(function(id) {
      return String(id) === String(user.ID);
    });
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

        return String(project.TenantID) === String(user.TenantID) &&
          ProjectService._isProjectAvailableToUser_(project, user);

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
      String(project.TenantID) !== String(user.TenantID) ||
      !this._isProjectAvailableToUser_(project, user)
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

    const departmentIds = Array.isArray(project.AvailableDepartmentIDs)
      ? project.AvailableDepartmentIDs.map(function(id) { return String(id || '').trim(); }).filter(Boolean)
      : [];
    if (!departmentIds.length) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حداقل یک واحد مجاز برای پروژه انتخاب کنید.');
    }
    const tenantDepartments = DepartmentRepository.getAll().filter(function(item) {
      return String(item.TenantID) === String(tenantId) &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    });
    const invalidDepartment = departmentIds.some(function(id) {
      return !tenantDepartments.some(function(item) { return String(item.ID) === id; });
    });
    if (invalidDepartment) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'یکی از واحدهای انتخاب‌شده معتبر نیست.');
    }

    const allowedUserIds = Array.isArray(project.AllowedUserIDs)
      ? project.AllowedUserIDs.map(function(id) { return String(id || '').trim(); }).filter(Boolean)
      : [];
    const tenantUsers = UserRepository.getAll().filter(function(item) {
      return String(item.TenantID) === String(tenantId) &&
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    });
    if (allowedUserIds.some(function(id) {
      return !tenantUsers.some(function(item) { return String(item.ID) === id; });
    })) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'یکی از کاربران مجاز معتبر نیست.');
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

      Quantity:
        project.Quantity === undefined ||
        project.Quantity === null ||
        String(project.Quantity).trim() === ''
          ? ''
          : Number(project.Quantity),

      ColorSizeJSON: this._normalizeColorSizeJSON_(project.ColorSizeJSON),

      Description:
        project.Description ||
        '',

      AvailableDepartmentIDs: JSON.stringify(departmentIds),
      AllowedUserIDs: JSON.stringify(allowedUserIds),
      NotifyEnabled: project.NotifyEnabled === undefined ? true :
        (project.NotifyEnabled === true || String(project.NotifyEnabled).toLowerCase() === 'true'),

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
      String(existing.TenantID) !== String(user.TenantID) ||
      !this._isProjectAvailableToUser_(existing, user)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );
    }

    // کد پروژه و گردش‌کار پس از ایجاد هویت ثابت پروژه هستند.
    if (
      data.ProjectCode !== undefined &&
      String(data.ProjectCode).trim() !== String(existing.ProjectCode || '').trim()
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.VALIDATION_ERROR,
        'کد پروژه پس از ایجاد قابل تغییر نیست.'
      );
    }

    if (
      data.WorkflowID !== undefined &&
      String(data.WorkflowID || '').trim() !== String(existing.WorkflowID || '').trim()
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'گردش‌کار پروژه پس از ایجاد قابل تغییر نیست.'
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

    if (data.Quantity !== undefined) {
      updateData.Quantity =
        data.Quantity === null || String(data.Quantity).trim() === ''
          ? ''
          : Number(data.Quantity);
    }

    if (
      data.Description !== undefined
    ) {

      updateData.Description =
        data.Description;

    }

    if (data.AvailableDepartmentIDs !== undefined) {
      if (!Array.isArray(data.AvailableDepartmentIDs) || data.AvailableDepartmentIDs.length < 1) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'حداقل یک واحد مجاز برای پروژه انتخاب کنید.');
      }
      const ids = data.AvailableDepartmentIDs.map(function(value) { return String(value || '').trim(); }).filter(Boolean);
      const departments = DepartmentRepository.getAll().filter(function(item) {
        return String(item.TenantID) === String(user.TenantID) &&
          String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
      });
      if (ids.some(function(departmentId) {
        return !departments.some(function(item) { return String(item.ID) === departmentId; });
      })) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'یکی از واحدهای مجاز معتبر نیست.');
      }
      updateData.AvailableDepartmentIDs = JSON.stringify(ids);
    }

    if (data.AllowedUserIDs !== undefined) {
      if (!Array.isArray(data.AllowedUserIDs)) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'فهرست کاربران مجاز معتبر نیست.');
      }
      const ids = data.AllowedUserIDs.map(function(value) { return String(value || '').trim(); }).filter(Boolean);
      const users = UserRepository.getAll().filter(function(item) {
        return String(item.TenantID) === String(user.TenantID) &&
          String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
      });
      if (ids.some(function(userId) {
        return !users.some(function(item) { return String(item.ID) === userId; });
      })) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'یکی از کاربران مجاز معتبر نیست.');
      }
      updateData.AllowedUserIDs = JSON.stringify(ids);
    }

    if (data.NotifyEnabled !== undefined) {
      updateData.NotifyEnabled = data.NotifyEnabled === true ||
        String(data.NotifyEnabled).toLowerCase() === 'true';
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