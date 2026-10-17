const EventService = {
  _parseArray_: function(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },

  _toBoolean_: function(value) {
    return value === true ||
      String(value).toLowerCase() === 'true';
  },

  _isAdmin_: function(user) {
    return AccessControlService.isAdmin(user);
  },

  _isDepartmentAllowed_: function(eventType, user) {
    const departments = this._parseArray_(
      eventType.AllowedDepartmentIDs
    );
    const users = this._parseArray_(
      eventType.AllowedUserIDs
    );

    if (departments.length || users.length) {
      return departments.some(function(id) {
        return String(id) === String(user.DepartmentID || '');
      }) || users.some(function(id) {
        return String(id) === String(user.ID);
      });
    }

    return !eventType.DepartmentID ||
      String(eventType.DepartmentID) ===
        String(user.DepartmentID || '');
  },

  _checkProjectAvailability_: function(project, user) {
    const available = this._parseArray_(
      project.AvailableDepartmentIDs
    );

    if (
      !this._isAdmin_(user) &&
      available.length > 0 &&
      !available.some(function(id) {
        return String(id) === String(user.DepartmentID || '');
      })
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.PERMISSION_DENIED,
        'این پروژه در حال حاضر برای واحد شما در دسترس نیست.'
      );
    }
  },

  _findTargetStep_: function(project, departmentId, tenantId, strict) {
    if (!departmentId || !project.WorkflowID) {
      if (strict) {
        throw ErrorHandler.create(
          Constants.ERROR.INVALID_WORKFLOW,
          'برای انتقال پروژه، گردش کار معتبر لازم است.'
        );
      }
      return null;
    }

    const workflow = WorkflowRepository.findById(
      project.WorkflowID
    );

    if (
      !workflow ||
      String(workflow.TenantID) !== String(tenantId)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'گردش کار پروژه پیدا نشد یا متعلق به این مجموعه نیست.'
      );
    }

    const assignments =
      WorkflowStepDepartmentRepository.findByWorkflowId(
        project.WorkflowID
      ) || [];

    const assignment = assignments.find(function(item) {
      return (
        String(item.TenantID) === String(tenantId) &&
        String(item.WorkflowID) === String(project.WorkflowID) &&
        String(item.DepartmentID) === String(departmentId) &&
        String(item.Status).toUpperCase() === 'ACTIVE'
      );
    });

    if (!assignment) {
      if (strict) {
        throw ErrorHandler.create(
          Constants.ERROR.INVALID_WORKFLOW,
          'واحد مقصد به مرحله‌ای از گردش کار پروژه متصل نشده است.'
        );
      }
      return null;
    }

    const step = WorkflowStepRepository.findById(
      assignment.WorkflowStepID
    );

    if (
      !step ||
      String(step.TenantID) !== String(tenantId) ||
      String(step.WorkflowID) !== String(project.WorkflowID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_WORKFLOW,
        'مرحله مقصد معتبر نیست.'
      );
    }

    return step;
  },

  _getEventTime_: function(event) {
    const occurred = new Date(
      event.OccurredAt || event.CreatedAt || 0
    ).getTime();

    return isNaN(occurred) ? 0 : occurred;
  },

  _hasLaterEventInAnotherDepartment_: function(event, tenantId) {
    const projectEvents = EventRepository.findByProjectId(
      event.ProjectID
    ) || [];

    const eventTime = this._getEventTime_(event);

    return projectEvents.some(function(other) {
      if (String(other.ID) === String(event.ID)) return false;

      if (String(other.TenantID) !== String(tenantId)) {
        return false;
      }

      if (
        String(other.Status).toUpperCase() ===
        String(Constants.STATUS.VOID).toUpperCase()
      ) {
        return false;
      }

      if (
        String(other.DepartmentID || '') ===
        String(event.DepartmentID || '')
      ) {
        return false;
      }

      return EventService._getEventTime_(other) > eventTime;
    });
  },

  _getConfiguredChanges_: function(project, event, eventType, tenantId) {
    const changes = {};

    const targetDepartmentId =
      eventType.TargetDepartmentID || '';

    const shouldMove =
      !!targetDepartmentId ||
      this._toBoolean_(eventType.MovesProjectToStep);

    if (shouldMove) {
      const destinationDepartmentId =
        targetDepartmentId || event.DepartmentID || '';

      const targetStep = this._findTargetStep_(
        project,
        destinationDepartmentId,
        tenantId,
        !!targetDepartmentId
      );

      if (targetStep) {
        changes.CurrentStepID = targetStep.ID;
      }
    }

    if (
      eventType.TargetProjectStatus !== undefined &&
      eventType.TargetProjectStatus !== null &&
      String(eventType.TargetProjectStatus).trim() !== ''
    ) {
      changes.Status = eventType.TargetProjectStatus;
    }

    const availableDepartments = this._parseArray_(
      eventType.AvailableDepartmentIDs
    );

    if (availableDepartments.length > 0) {
      changes.AvailableDepartmentIDs =
        JSON.stringify(availableDepartments);
    }

    return changes;
  },

  _isSameValue_: function(a, b) {
    if (a === undefined || a === null) {
      a = '';
    }

    if (b === undefined || b === null) {
      b = '';
    }

    return String(a) === String(b);
  },

  // فهرست رویدادها با بارگذاری گروهی اطلاعات مرتبط
  list: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID);
    const events = EventRepository.getAll() || [];

    const filtered = events.filter(function(event) {
      return String(event.TenantID) === tenantId;
    });

    return Response.success(
      this._enrichEventsBatch_(filtered, tenantId)
    );
  },

  // تکمیل اطلاعات تعداد زیادی رویداد بدون مراجعه جداگانه
  // به شیت برای هر رویداد
  _enrichEventsBatch_: function(events, tenantId) {
    const projects = Object.create(null);
    const eventTypes = Object.create(null);
    const users = Object.create(null);
    const departments = Object.create(null);

    function addToMap(map, items) {
      (items || []).forEach(function(item) {
        if (
          item &&
          item.ID !== undefined &&
          item.ID !== null &&
          String(item.TenantID) === String(tenantId)
        ) {
          map[String(item.ID)] = item;
        }
      });
    }

    addToMap(projects, ProjectRepository.getAll());
    addToMap(eventTypes, EventTypeRepository.getAll());
    addToMap(users, UserRepository.getAll());
    addToMap(departments, DepartmentRepository.getAll());

    return (events || []).map(function(event) {
      const result = Object.assign({}, event);

      const project = projects[String(event.ProjectID || '')];
      const eventType = eventTypes[String(event.EventTypeID || '')];
      const creator = users[String(event.CreatedBy || '')];
      const performer = users[String(event.PerformedBy || '')];
      const department = departments[String(event.DepartmentID || '')];

      if (project) {
        result.ProjectCode = project.ProjectCode || '';
        result.ProjectTitle = project.Title || project.Name || '';
      }

      if (eventType) {
        result.EventTypeName = eventType.Name || eventType.Code || '';
      }

      result.CreatorName = creator
        ? EventService.getUserDisplayName(creator)
        : (event.CreatedBy || '');

      result.PerformedByName = performer
        ? EventService.getUserDisplayName(performer)
        : (event.PerformedBy || '');

      result.DepartmentName = department
        ? (
            department.Name ||
            department.Title ||
            department.Code ||
            ''
          )
        : '';

      return result;
    });
  },

  // تکمیل اطلاعات یک رویداد
  enrichEvent: function(event, tenantId) {
    const result = Object.assign({}, event);

    const project = ProjectRepository.findById(event.ProjectID);

    if (
      project &&
      String(project.TenantID) === String(tenantId)
    ) {
      result.ProjectCode = project.ProjectCode || '';
      result.ProjectTitle = project.Title || project.Name || '';
    }

    const eventType = EventTypeRepository.findById(
      event.EventTypeID
    );

    if (
      eventType &&
      String(eventType.TenantID) === String(tenantId)
    ) {
      result.EventTypeName = eventType.Name || eventType.Code || '';
    }

    const creator = event.CreatedBy
      ? UserRepository.findById(event.CreatedBy)
      : null;

    result.CreatorName =
      creator && String(creator.TenantID) === String(tenantId)
        ? this.getUserDisplayName(creator)
        : (event.CreatedBy || '');

    const performer = event.PerformedBy
      ? UserRepository.findById(event.PerformedBy)
      : null;

    result.PerformedByName =
      performer && String(performer.TenantID) === String(tenantId)
        ? this.getUserDisplayName(performer)
        : (event.PerformedBy || '');

    const department = event.DepartmentID
      ? DepartmentRepository.findById(event.DepartmentID)
      : null;

    result.DepartmentName =
      department && String(department.TenantID) === String(tenantId)
        ? (
            department.Name ||
            department.Title ||
            department.Code ||
            ''
          )
        : '';

    return result;
  },

  // نام نمایشی کاربر
  getUserDisplayName: function(user) {
    if (!user) return '';

    const fullName = [
      user.FirstName || user.Firstname || '',
      user.LastName || user.Lastname || ''
    ].filter(Boolean).join(' ').trim();

    return user.FullName ||
      user.DisplayName ||
      fullName ||
      user.Name ||
      user.Username ||
      user.ID ||
      '';
  },

  // دریافت یک رویداد
  get: function(id, params) {
    Validator.required(id, 'شناسه رویداد');

    const user = AccessControlService.getCurrentUser(params || {});
    const event = EventRepository.findById(id);

    if (!event) {
      throw ErrorHandler.create(
        Constants.ERROR.EVENT_NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }

    if (String(event.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }

    return Response.success(
      this.enrichEvent(event, user.TenantID)
    );
  },

  // فهرست رویدادهای یک پروژه
  listByProject: function(projectId, params) {
    Validator.required(projectId, 'ProjectID');

    const user = AccessControlService.getCurrentUser(params || {});
    const project = ProjectRepository.findById(projectId);

    if (!project) {
      throw ErrorHandler.create(
        Constants.ERROR.PROJECT_NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );
    }

    if (String(project.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );
    }

    const tenantId = String(user.TenantID);
    const events = EventRepository.findByProjectId(projectId) || [];

    const filtered = events.filter(function(event) {
      return String(event.TenantID) === tenantId;
    });

    return Response.success(
      this._enrichEventsBatch_(filtered, tenantId)
    );
  },

  // دریافت رویدادهای پروژه و اطلاعات تکمیلی آن‌ها در یک پاسخ
  getProjectDetails: function(projectId, params) {
    Validator.required(projectId, 'ProjectID');

    const user = AccessControlService.getCurrentUser(params || {});
    const project = ProjectRepository.findById(projectId);

    if (!project) {
      throw ErrorHandler.create(
        Constants.ERROR.PROJECT_NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );
    }

    if (String(project.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'پروژه مورد نظر پیدا نشد.'
      );
    }

    const tenantId = String(user.TenantID);
    const events = (EventRepository.findByProjectId(projectId) || []).filter(function(event) {
      return String(event.TenantID) === tenantId;
    });
    const enrichedEvents = this._enrichEventsBatch_(events, tenantId);
    const eventIds = Object.create(null);
    const eventTypeIds = Object.create(null);

    events.forEach(function(event) {
      eventIds[String(event.ID)] = true;
      eventTypeIds[String(event.EventTypeID)] = true;
    });

    const eventData = Object.create(null);
    (EventDataRepository.getAll() || []).forEach(function(record) {
      const eventId = String(record.EventID || '');
      // Tenant isolation is inherited from the tenant-validated event ID.
      if (!eventIds[eventId] || Object.prototype.hasOwnProperty.call(eventData, eventId)) return;

      let parsed = {};
      if (record.DataJSON !== undefined && record.DataJSON !== null &&
          String(record.DataJSON).trim() !== '') {
        try {
          parsed = JSON.parse(record.DataJSON);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
        } catch (error) {
          parsed = {};
        }
      }
      eventData[eventId] = parsed;
    });

    const eventFields = Object.create(null);
    (EventFieldRepository.getAll() || []).forEach(function(field) {
      const typeId = String(field.EventTypeID || '');
      if (!eventTypeIds[typeId] || String(field.TenantID) !== tenantId) return;
      if (!eventFields[typeId]) eventFields[typeId] = [];
      eventFields[typeId].push(field);
    });

    Object.keys(eventFields).forEach(function(typeId) {
      eventFields[typeId].sort(function(a, b) {
        return Number(a.FieldOrder || 0) - Number(b.FieldOrder || 0);
      });
    });

    return Response.success({
      events: enrichedEvents,
      eventData: eventData,
      eventFields: eventFields
    });
  },

  // ثبت رویداد
  create: function(event, params) {
    Validator.object(event, 'event');

    const requestParams = params || {};
    const user = AccessControlService.getCurrentUser(requestParams);

    if (!user.TenantID) {
      throw ErrorHandler.create(
        Constants.ERROR.UNAUTHORIZED,
        'Tenant کاربر مشخص نیست.'
      );
    }

    const isAdmin = this._isAdmin_(user);

    const performedBy = isAdmin
      ? (event.PerformedBy || user.ID)
      : user.ID;

    const validationEvent = Object.assign({}, event);
    validationEvent.PerformedBy = performedBy;

    EventValidator.validateCreate(validationEvent);

    const eventType = EventTypeRepository.findById(
      event.EventTypeID
    );

    if (
      !eventType ||
      String(eventType.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_EVENT_TYPE,
        'نوع رویداد مورد نظر پیدا نشد.'
      );
    }

    if (
      String(eventType.Status).toUpperCase() !==
      String(Constants.STATUS.ACTIVE).toUpperCase()
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_EVENT_TYPE,
        'نوع رویداد فعال نیست.'
      );
    }

    const connectionType = String(eventType.ConnectionType || 'PROJECT').toUpperCase();
    const isProjectEvent = connectionType !== 'INDEPENDENT';
    let project = null;

    if (isProjectEvent) {
      if (!event.ProjectID) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'برای این نوع رویداد انتخاب پروژه الزامی است.'
        );
      }

      project = ProjectRepository.findById(event.ProjectID);
      if (!project || String(project.TenantID) !== String(user.TenantID)) {
        throw ErrorHandler.create(
          Constants.ERROR.PROJECT_NOT_FOUND,
          'پروژه مورد نظر پیدا نشد.'
        );
      }
      this._checkProjectAvailability_(project, user);
    }

    if (!isAdmin) {
      if (!user.DepartmentID) {
        throw ErrorHandler.create(
          Constants.ERROR.PERMISSION_DENIED,
          'واحد کاربر مشخص نیست؛ امکان ثبت رویداد وجود ندارد.'
        );
      }

      if (!this._isDepartmentAllowed_(eventType, user)) {
        throw ErrorHandler.create(
          Constants.ERROR.PERMISSION_DENIED,
          'شما اجازه ثبت این نوع رویداد را ندارید.'
        );
      }
    }

    const performedUser = UserRepository.findById(performedBy);

    if (
      !performedUser ||
      String(performedUser.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.USER_NOT_FOUND,
        'کاربر انجام‌دهنده معتبر نیست.'
      );
    }

    let departmentId;

    if (isAdmin) {
      departmentId =
        event.DepartmentID ||
        eventType.DepartmentID ||
        performedUser.DepartmentID ||
        '';
    } else {
      departmentId = user.DepartmentID;
    }

    let department = null;

    if (String(departmentId || '').trim() !== '') {
      department = DepartmentRepository.findById(departmentId);

      if (
        !department ||
        String(department.TenantID) !== String(user.TenantID)
      ) {
        throw ErrorHandler.create(
          Constants.ERROR.NOT_FOUND,
          'واحد مربوط به رویداد معتبر نیست.'
        );
      }

      if (
        !isAdmin &&
        String(department.ID) !== String(user.DepartmentID)
      ) {
        throw ErrorHandler.create(
          Constants.ERROR.PERMISSION_DENIED,
          'شما اجازه ثبت رویداد برای این واحد را ندارید.'
        );
      }
    }

    const hasDynamicData =
      Object.prototype.hasOwnProperty.call(event, 'DynamicData');

    let validatedDynamicData = null;

    if (hasDynamicData) {
      validatedDynamicData = EventDataService.validateDynamicData(
        eventType.ID,
        event.DynamicData,
        user.TenantID
      );
    }

    const projectChanges = project
      ? this._getConfiguredChanges_(
          project,
          { DepartmentID: department ? department.ID : '' },
          eventType,
          user.TenantID
        )
      : {};

    const now = new Date().toISOString();

    let occurredAt = now;

    if (event.OccurredAt && String(event.OccurredAt).trim() !== '') {
      const parsedDate = new Date(event.OccurredAt);

      if (isNaN(parsedDate.getTime())) {
        throw ErrorHandler.create(
          Constants.ERROR.VALIDATION_ERROR,
          'تاریخ وقوع رویداد معتبر نیست.'
        );
      }

      occurredAt = parsedDate.toISOString();
    }

    const newEvent = {
      ID: 'EVT_' + Utilities.getUuid().replace(/-/g, ''),
      TenantID: user.TenantID,
      ProjectID: project ? project.ID : '',
      EventTypeID: eventType.ID,
      EventTypeVersion: eventType.Version || 1,
      PerformedBy: performedBy,
      CreatedBy: user.ID,
      DepartmentID: department ? department.ID : '',
      OccurredAt: occurredAt,
      CreatedAt: now,
      Description: event.Description || '',
      Status: Constants.STATUS.ACTIVE,

      // سابقه وضعیت پروژه پیش از اعمال رویداد
      PreviousStepID: project ? (project.CurrentStepID || '') : '',
      PreviousProjectStatus: project ? (project.Status || '') : '',
      PreviousAvailableDepartmentIDs: project ? (project.AvailableDepartmentIDs || '') : ''
    };

    const created = EventRepository.insert(newEvent);

    if (hasDynamicData) {
      const createdData = EventDataRepository.insert({
        ID: 'ED_' + Utilities.getUuid().replace(/-/g, ''),
        EventID: created.ID,
        DataJSON: JSON.stringify(validatedDynamicData),
        CreatedAt: now
      });

      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: Constants.ACTION.CREATE,
        EntityType: Constants.ENTITY.EVENT,
        EntityID: created.ID,
        OldData: null,
        NewData: createdData,
        Reason: 'ثبت اطلاعات پویای رویداد'
      });
    }

    const projectUpdate = {
      UpdatedAt: now
    };

    Object.keys(projectChanges).forEach(function(key) {
      projectUpdate[key] = projectChanges[key];
    });

    const hasProjectChanges = Object.keys(projectChanges).length > 0;

    const workflowMoved =
      projectChanges.CurrentStepID !== undefined &&
      String(projectChanges.CurrentStepID) !==
        String(project.CurrentStepID || '');

    const updatedProject = hasProjectChanges
      ? ProjectRepository.update(project.ID, projectUpdate)
      : project;

    AuditService.log({
      TenantID: user.TenantID,
      UserID: user.ID,
      Action: Constants.ACTION.CREATE,
      EntityType: Constants.ENTITY.EVENT,
      EntityID: created.ID,
      OldData: null,
      NewData: created,
      Reason: 'ثبت رویداد'
    });

    if (hasProjectChanges) {
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: Constants.ACTION.UPDATE,
        EntityType: Constants.ENTITY.PROJECT,
        EntityID: project.ID,
        OldData: project,
        NewData: updatedProject,
        Reason: 'به‌روزرسانی پروژه بر اساس تنظیمات نوع رویداد'
      });
    }

    return Response.success(
      {
        event: created,
        project: updatedProject,
        workflowMoved: workflowMoved,
        currentStepID: updatedProject.CurrentStepID,
        projectStatus: updatedProject.Status,
        availableDepartmentIDs: this._parseArray_(
          updatedProject.AvailableDepartmentIDs
        )
      },
      {
        message: workflowMoved
          ? 'رویداد ثبت شد و مرحله پروژه به‌روزرسانی شد.'
          : (isProjectEvent ? 'رویداد با موفقیت ثبت شد.' : 'رویداد مستقل با موفقیت ثبت شد.')
      }
    );
  },

  // ابطال رویداد
  void: function(id, reason, params) {
    Validator.required(id, 'شناسه رویداد');
    Validator.required(reason, 'دلیل ابطال');

    const user = AccessControlService.getCurrentUser(params || {});
    const event = EventRepository.findById(id);

    if (!event) {
      throw ErrorHandler.create(
        Constants.ERROR.EVENT_NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }

    if (String(event.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }

    if (
      String(event.Status).toUpperCase() ===
      String(Constants.STATUS.VOID).toUpperCase()
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_STATUS,
        'این رویداد قبلاً باطل شده است.'
      );
    }

    const eventType = EventTypeRepository.findById(event.EventTypeID);

    if (
      !eventType ||
      String(eventType.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_EVENT_TYPE,
        'نوع رویداد مربوط به این ثبت پیدا نشد.'
      );
    }

    if (
      eventType.AllowVoid !== undefined &&
      eventType.AllowVoid !== null &&
      String(eventType.AllowVoid).trim() !== '' &&
      !this._toBoolean_(eventType.AllowVoid)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.PERMISSION_DENIED,
        'ابطال این نوع رویداد در تنظیمات غیرفعال شده است.'
      );
    }

    const isAdmin = this._isAdmin_(user);

    if (
      !isAdmin &&
      String(event.DepartmentID || '') !==
        String(user.DepartmentID || '')
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.PERMISSION_DENIED,
        'ابطال این رویداد باید توسط واحد ثبت‌کننده انجام شود.'
      );
    }

    if (
      this._hasLaterEventInAnotherDepartment_(
        event,
        user.TenantID
      )
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_STATUS,
        'این رویداد قابل ابطال نیست؛ پس از آن در واحد دیگری رویداد ثبت شده است.'
      );
    }

    const project = ProjectRepository.findById(event.ProjectID);

    if (
      !project ||
      String(project.TenantID) !== String(user.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.PROJECT_NOT_FOUND,
        'پروژه مربوط به این رویداد پیدا نشد.'
      );
    }

    const now = new Date().toISOString();

    const expectedChanges = this._getConfiguredChanges_(
      project,
      event,
      eventType,
      user.TenantID
    );

    let hasExpectedChanges = false;
    let currentStateMatches = true;

    Object.keys(expectedChanges).forEach(function(key) {
      hasExpectedChanges = true;

      if (
        !EventService._isSameValue_(
          project[key],
          expectedChanges[key]
        )
      ) {
        currentStateMatches = false;
      }
    });

    const hasPreviousSnapshot =
      event.PreviousStepID !== undefined &&
      event.PreviousProjectStatus !== undefined &&
      event.PreviousAvailableDepartmentIDs !== undefined;

    if (
      hasExpectedChanges &&
      (!hasPreviousSnapshot || !currentStateMatches)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_STATUS,
        'وضعیت پروژه پس از این رویداد تغییر کرده است؛ برای جلوگیری از بازگردانی اشتباه، ابتدا وضعیت پروژه بررسی شود.'
      );
    }

    const projectBeforeVoid = Object.assign({}, project);
    let restoredProject = project;

    if (hasExpectedChanges && hasPreviousSnapshot) {
      const restoreData = {
        CurrentStepID: event.PreviousStepID,
        Status: event.PreviousProjectStatus,
        AvailableDepartmentIDs:
          event.PreviousAvailableDepartmentIDs,
        UpdatedAt: now
      };

      restoredProject = ProjectRepository.update(
        project.ID,
        restoreData
      );
    }

    const updated = EventRepository.update(
      id,
      {
        Status: Constants.STATUS.VOID,
        UpdatedAt: now
      }
    );

    if (hasExpectedChanges && hasPreviousSnapshot) {
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: Constants.ACTION.UPDATE,
        EntityType: Constants.ENTITY.PROJECT,
        EntityID: project.ID,
        OldData: projectBeforeVoid,
        NewData: restoredProject,
        Reason: 'بازگردانی وضعیت پروژه پس از ابطال رویداد: ' + reason
      });
    }

    AuditService.log({
      TenantID: user.TenantID,
      UserID: user.ID,
      Action: Constants.ACTION.VOID,
      EntityType: Constants.ENTITY.EVENT,
      EntityID: id,
      OldData: event,
      NewData: updated,
      Reason: reason
    });

    return Response.success(
      {
        event: updated,
        project: restoredProject,
        projectRestored: hasExpectedChanges && hasPreviousSnapshot
      },
      {
        message: hasExpectedChanges && hasPreviousSnapshot
          ? 'رویداد باطل شد و وضعیت قبلی پروژه بازگردانده شد.'
          : 'رویداد با موفقیت باطل شد.'
      }
    );
  }
};