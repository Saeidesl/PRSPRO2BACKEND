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
    if (!ProjectService._isProjectAvailableToUser_(project, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه مورد نظر پیدا نشد.');
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
        String(item.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'
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
    if (!event || !event.ProjectID) return false;

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

      // If the event type says it moves the project to the event's unit,
      // a missing unit-to-step mapping must fail visibly instead of silently
      // leaving the project at its previous stage.
      const targetStep = this._findTargetStep_(
        project,
        destinationDepartmentId,
        tenantId,
        !!targetDepartmentId || this._toBoolean_(eventType.MovesProjectToStep)
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

    if (eventType.TargetStepStatus !== undefined && eventType.TargetStepStatus !== null &&
        String(eventType.TargetStepStatus).trim() !== '') {
      changes.CurrentStepStatus = String(eventType.TargetStepStatus).trim();
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
      if (String(event.TenantID) !== tenantId) return false;
      if (!event.ProjectID) return true;
      const project = ProjectRepository.findById(event.ProjectID);
      return !!project && String(project.TenantID) === tenantId &&
        ProjectService._isProjectAvailableToUser_(project, user);
    });

    // فهرست عمومی رویدادها پروژهٔ مشخصی ندارد؛
    // رویدادهای تدارکات فقط در timeline یک پروژه اضافه می‌شوند.
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
        result.IsWorkCompletion = eventType.IsWorkCompletion === true ||
          String(eventType.IsWorkCompletion).toLowerCase() === 'true' ||
          String(eventType.IsWorkCompletion) === '1';
      } else {
        result.IsWorkCompletion = false;
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
      result.IsWorkCompletion = eventType.IsWorkCompletion === true ||
        String(eventType.IsWorkCompletion).toLowerCase() === 'true' ||
        String(eventType.IsWorkCompletion) === '1';
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
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
    }
    if (event.ProjectID) {
      const project = ProjectRepository.findById(event.ProjectID);
      if (!project || String(project.TenantID) !== String(user.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(project, user)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
      }
    }

    return Response.success(
      this.enrichEvent(event, user.TenantID)
    );
  },

  // فهرست رویدادهای یک پروژه

  // Build read-only timeline cards from procurement source records. These are projections,
  // not duplicated event-sheet rows, so retries and historical data cannot create duplicates.
  _procurementTimelineEvents_: function(projectId, tenantId) {
    if (typeof ProcurementRepository === 'undefined') return [];
    const orders = ProcurementRepository.getOrders(tenantId) || [];
    const items = ProcurementRepository.getItems(tenantId) || [];
    const allocations = ProcurementRepository.getAllocations(tenantId) || [];
    const needs = ProcurementRepository.getNeeds(tenantId) || [];
    const receipts = ProcurementRepository.getReceipts(tenantId) || [];
    const itemsByOrder = Object.create(null);
    const allocationsByItem = Object.create(null);
    const needsById = Object.create(null);
    const ordersById = Object.create(null);

    orders.forEach(function(order) { ordersById[String(order.ID)] = order; });
    needs.forEach(function(need) { needsById[String(need.ID)] = need; });
    items.forEach(function(item) {
      const key = String(item.PurchaseOrderID || '');
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push(item);
    });
    allocations.forEach(function(allocation) {
      const key = String(allocation.PurchaseOrderItemID || '');
      if (!allocationsByItem[key]) allocationsByItem[key] = [];
      allocationsByItem[key].push(allocation);
    });

    const timeline = [];
    orders.forEach(function(order) {
      const orderItems = itemsByOrder[String(order.ID)] || [];
      const projectLines = [];
      orderItems.forEach(function(item) {
        const itemAllocations = allocationsByItem[String(item.ID)] || [];
        const projectAllocations = itemAllocations.filter(function(allocation) {
          return String(allocation.ProjectID || '') === String(projectId);
        });
        if (projectAllocations.length) {
          const allocatedQuantity = projectAllocations.reduce(function(sum, allocation) {
            return sum + (Number(allocation.AllocatedQuantity) || 0);
          }, 0);
          projectLines.push(String(item.ItemName || 'قلم سفارش') + ': ' + allocatedQuantity + ' ' + String(item.Unit || ''));
          return;
        }
        if (itemAllocations.length) return;
        const need = needsById[String(item.MaterialNeedID || '')];
        const itemProjectId = item.ProjectID || (need && need.ProjectID) || order.ProjectID || '';
        if (String(itemProjectId) === String(projectId)) {
          projectLines.push(String(item.ItemName || 'قلم سفارش') + ': ' +
            (Number(item.OrderedQuantity) || 0) + ' ' + String(item.Unit || ''));
        }
      });
      if (!projectLines.length) return;
      const descriptionParts = [];
      descriptionParts.push('شماره سفارش: ' + String(order.OrderNumber || order.Code || order.ID || '-'));
      if (order.SupplierName) descriptionParts.push('تأمین‌کننده: ' + String(order.SupplierName));
      descriptionParts.push('اقلام مربوط به این پروژه: ' + projectLines.join('؛ '));
      if (order.Notes) descriptionParts.push('توضیحات: ' + String(order.Notes));
      timeline.push({
        ID: 'PROC-ORDER-' + String(order.ID) + '-' + String(projectId),
        IsProcurementTimeline: true,
        ProcurementRecordType: 'PURCHASE_ORDER',
        ProjectID: String(projectId),
        EventTypeName: 'ثبت سفارش خرید',
        EventTypeCode: 'PROCUREMENT_ORDER',
        Status: 'SUBMITTED',
        Description: descriptionParts.join(' | '),
        OccurredAt: order.CreatedAt || order.OrderDate || order.UpdatedAt || '',
        CreatedAt: order.CreatedAt || order.OrderDate || '',
        CreatedBy: order.CreatedBy || '',
        CreatedByName: '',
        PerformedBy: order.CreatedBy || '',
        PerformedByName: '',
        DepartmentName: 'تدارکات',
        ProcurementRecordID: String(order.ID)
      });
    });

    receipts.forEach(function(receipt) {
      if (String(receipt.ProjectID || '') !== String(projectId)) return;
      const item = items.find(function(candidate) {
        return String(candidate.ID) === String(receipt.PurchaseOrderItemID);
      });
      if (!item) return;
      const order = ordersById[String(item.PurchaseOrderID || '')] || {};
      const descriptionParts = [];
      descriptionParts.push('شماره سفارش: ' + String(order.OrderNumber || order.Code || order.ID || '-'));
      descriptionParts.push('قلم دریافت‌شده: ' + String(item.ItemName || 'قلم سفارش') + '، مقدار: ' +
        (Number(receipt.QuantityReceived) || 0) + ' ' + String(item.Unit || ''));
      if (receipt.Notes) descriptionParts.push('توضیحات دریافت: ' + String(receipt.Notes));
      timeline.push({
        ID: 'PROC-RECEIPT-' + String(receipt.ID),
        IsProcurementTimeline: true,
        ProcurementRecordType: 'MATERIAL_RECEIPT',
        ProjectID: String(projectId),
        EventTypeName: 'دریافت کالا در انبار',
        EventTypeCode: 'WAREHOUSE_RECEIPT',
        Status: 'SUBMITTED',
        Description: descriptionParts.join(' | '),
        OccurredAt: receipt.ReceivedAt || receipt.CreatedAt || '',
        CreatedAt: receipt.CreatedAt || receipt.ReceivedAt || '',
        CreatedBy: receipt.ReceivedBy || '',
        CreatedByName: '',
        PerformedBy: receipt.ReceivedBy || '',
        PerformedByName: '',
        DepartmentName: 'انبار',
        ProcurementRecordID: String(receipt.ID)
      });
    });

    return timeline;
  },

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

    if (String(project.TenantID) !== String(user.TenantID) ||
        !ProjectService._isProjectAvailableToUser_(project, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه مورد نظر پیدا نشد.');
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

  getProjectDetailsPage: function(projectId, order, page, params) {
    Validator.required(projectId, 'ProjectID');
    const user = AccessControlService.getCurrentUser(params || {});
    const project = ProjectRepository.findById(projectId);

    if (!project || String(project.TenantID) !== String(user.TenantID) ||
        !ProjectService._isProjectAvailableToUser_(project, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه مورد نظر پیدا نشد.');
    }

    const tenantId = String(user.TenantID);
    const direction = String(order || 'newest').toLowerCase() === 'oldest' ? 'oldest' : 'newest';
    const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
    const pageSize = 30;

    const events = (EventRepository.findByProjectId(projectId) || []).filter(function(event) {
      const status = String(event.Status || '').toUpperCase();
      return String(event.TenantID) === tenantId && status !== 'VOID' && status !== 'CANCELLED';
    });
    Array.prototype.push.apply(events, this._procurementTimelineEvents_(projectId, tenantId));

    function eventTime(event) {
      const value = event.OccurredAt || event.CreatedAt || '';
      const parsed = value ? new Date(value).getTime() : 0;
      return isFinite(parsed) ? parsed : 0;
    }

    events.sort(function(a, b) {
      return direction === 'oldest'
        ? eventTime(a) - eventTime(b)
        : eventTime(b) - eventTime(a);
    });

    const total = events.length;
    const start = (pageNumber - 1) * pageSize;
    const pageEvents = events.slice(start, start + pageSize);
    const actualPageEvents = pageEvents.filter(function(event) { return !event.IsProcurementTimeline; });
    const enrichedActualEvents = this._enrichEventsBatch_(actualPageEvents, tenantId);
    const enrichedById = Object.create(null);
    enrichedActualEvents.forEach(function(event) { enrichedById[String(event.ID)] = event; });
    const enrichedEvents = pageEvents.map(function(event) {
      return event.IsProcurementTimeline ? event : (enrichedById[String(event.ID)] || event);
    });
    const eventIds = Object.create(null);
    const eventTypeIds = Object.create(null);

    pageEvents.forEach(function(event) {
      if (event.IsProcurementTimeline) return;
      eventIds[String(event.ID)] = true;
      eventTypeIds[String(event.EventTypeID)] = true;
    });

    const eventData = Object.create(null);
    (EventDataRepository.getAll() || []).forEach(function(record) {
      const eventId = String(record.EventID || '');
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
      if (String(field.TenantID) !== tenantId || !eventTypeIds[typeId]) return;
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
      eventFields: eventFields,
      pagination: {
        page: pageNumber,
        pageSize: pageSize,
        total: total,
        hasMore: start + pageEvents.length < total,
        order: direction
      }
    });
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

    if (String(project.TenantID) !== String(user.TenantID) ||
        !ProjectService._isProjectAvailableToUser_(project, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه مورد نظر پیدا نشد.');
    }

    const tenantId = String(user.TenantID);
    const events = (EventRepository.findByProjectId(projectId) || []).filter(function(event) {
      return String(event.TenantID) === tenantId;
    });
    Array.prototype.push.apply(events, this._procurementTimelineEvents_(projectId, tenantId));
    const actualEvents = events.filter(function(event) { return !event.IsProcurementTimeline; });
    const enrichedActualEvents = this._enrichEventsBatch_(actualEvents, tenantId);
    const enrichedById = Object.create(null);
    enrichedActualEvents.forEach(function(event) { enrichedById[String(event.ID)] = event; });
    const enrichedEvents = events.map(function(event) {
      return event.IsProcurementTimeline ? event : (enrichedById[String(event.ID)] || event);
    });
    const eventIds = Object.create(null);
    const eventTypeIds = Object.create(null);

    events.forEach(function(event) {
      if (event.IsProcurementTimeline) return;
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

    const useProjectColors = EventTypeService._toBoolean_(eventType.UseProjectColors);
    const useProjectSizes = EventTypeService._toBoolean_(eventType.UseProjectSizes);
    const trackVariantQuantity = EventTypeService._toBoolean_(eventType.TrackVariantQuantity);
    let selectedColor = '';
    let selectedSize = '';
    let variantQuantity = '';
    let validatedVariants = [];

    if (useProjectColors || useProjectSizes || trackVariantQuantity) {
      if (!project) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ثبت رنگ، سایز یا مقدار ترکیب فقط برای رویداد مرتبط با پروژه امکان‌پذیر است.');
      let projectVariants = { colors: [], sizes: [] };
      try {
        const parsed = JSON.parse(String(project.ColorSizeJSON || '{"colors":[],"sizes":[]}'));
        if (parsed && typeof parsed === 'object') {
          projectVariants.colors = Array.isArray(parsed.colors) ? parsed.colors.map(String) : [];
          projectVariants.sizes = Array.isArray(parsed.sizes) ? parsed.sizes.map(String) : [];
        }
      } catch (error) {}

      const submittedVariants = Array.isArray(event.VariantDetails) && event.VariantDetails.length
        ? event.VariantDetails
        : [{ Color: event.Color, Size: event.Size, VariantQuantity: event.VariantQuantity }];
      if (submittedVariants.length > 500) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'در هر رویداد حداکثر ۵۰۰ ردیف رنگ و سایز قابل ثبت است.');
      }
      const seenVariants = Object.create(null);
      validatedVariants = submittedVariants.map(function(row) {
        row = row || {};
        const color = String(row.Color || '').trim();
        const size = String(row.Size || '').trim();
        let quantity = '';
        if (useProjectColors) {
          if (!color || projectVariants.colors.indexOf(color) === -1) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'رنگ انتخاب‌شده در مشخصات همین پروژه وجود ندارد.');
        } else if (color) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'این نوع رویداد اجازه ثبت رنگ پروژه را ندارد.');
        if (useProjectSizes) {
          if (!size || projectVariants.sizes.indexOf(size) === -1) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'سایز انتخاب‌شده در مشخصات همین پروژه وجود ندارد.');
        } else if (size) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'این نوع رویداد اجازه ثبت سایز پروژه را ندارد.');
        if (trackVariantQuantity) {
          const q = Number(row.VariantQuantity);
          if (row.VariantQuantity === undefined || row.VariantQuantity === null || String(row.VariantQuantity).trim() === '' || !isFinite(q) || q < 1 || Math.floor(q) !== q) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'مقدار تولید هر ترکیب باید عدد صحیح بزرگ‌تر از صفر باشد.');
          quantity = q;
        } else if (row.VariantQuantity !== undefined && String(row.VariantQuantity).trim() !== '') {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'این نوع رویداد اجازه ثبت مقدار ترکیب را ندارد.');
        }
        const key = JSON.stringify([color, size]);
        if (seenVariants[key]) throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'ترکیب رنگ و سایز تکراری است؛ هر ترکیب را فقط یک‌بار وارد کنید.');
        seenVariants[key] = true;
        return { Color: color, Size: size, VariantQuantity: quantity };
      });
      selectedColor = validatedVariants[0].Color || '';
      selectedSize = validatedVariants[0].Size || '';
      variantQuantity = validatedVariants[0].VariantQuantity;
    } else if (
      event.Color || event.Size ||
      (event.VariantQuantity !== undefined && String(event.VariantQuantity).trim() !== '') ||
      (Array.isArray(event.VariantDetails) && event.VariantDetails.length)
    ) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'این نوع رویداد برای ثبت رنگ، سایز یا مقدار ترکیب تنظیم نشده است.');
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
      Color: selectedColor,
      Size: selectedSize,
      VariantQuantity: variantQuantity,
      VariantDetailsJSON: validatedVariants.length ? JSON.stringify(validatedVariants) : '',

      // سابقه وضعیت پروژه پیش از اعمال رویداد
      PreviousStepID: project ? (project.CurrentStepID || '') : '',
      PreviousProjectStatus: project ? (project.Status || '') : '',
      PreviousCurrentStepStatus: project ? (project.CurrentStepStatus || '') : '',
      PreviousAvailableDepartmentIDs: project ? (project.AvailableDepartmentIDs || '') : '',
      PreviousSnapshotCaptured: project ? true : false
    };

    // Reject missing/invalid mapped procurement inputs before writing the event.
    if (typeof ProcurementEventIntegrationService !== 'undefined') {
      ProcurementEventIntegrationService.validate(
        eventType,
        validatedDynamicData || {},
        project ? project.ID : '',
        requestParams
      );
    }

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

    let procurementIntegration = { status: 'NOT_CONFIGURED' };
    try {
      procurementIntegration = ProcurementEventIntegrationService.apply(
        eventType,
        created,
        hasDynamicData ? validatedDynamicData : {},
        requestParams
      ) || { status: 'NOT_CONFIGURED' };
    } catch (integrationError) {
      // The production event is already persisted. Record the integration failure
      // explicitly so it is not mistaken for a successful procurement update.
      procurementIntegration = {
        status: 'FAILED',
        message: String(integrationError && integrationError.message || integrationError)
      };
      AuditService.log({
        TenantID: user.TenantID,
        UserID: user.ID,
        Action: 'PROCUREMENT_INTEGRATION_FAILED',
        EntityType: 'EVENT',
        EntityID: created.ID,
        NewData: procurementIntegration,
        Reason: 'رویداد ثبت شد اما اتصال تأمین نیازمند بررسی است.'
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
        currentStepID: updatedProject ? updatedProject.CurrentStepID : '',
        projectStatus: updatedProject ? updatedProject.Status : '',
        availableDepartmentIDs: updatedProject
          ? this._parseArray_(updatedProject.AvailableDepartmentIDs)
          : [],
        procurementIntegration: procurementIntegration
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
    if (event.ProjectID) {
      const linkedProject = ProjectRepository.findById(event.ProjectID);
      if (!linkedProject || String(linkedProject.TenantID) !== String(user.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(linkedProject, user)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
      }
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

    const project = event.ProjectID
      ? ProjectRepository.findById(event.ProjectID)
      : null;

    if (
      event.ProjectID &&
      (!project || String(project.TenantID) !== String(user.TenantID))
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.PROJECT_NOT_FOUND,
        'پروژه مربوط به این رویداد پیدا نشد.'
      );
    }

    const now = new Date().toISOString();

    const expectedChanges = project
      ? this._getConfiguredChanges_(project, event, eventType, user.TenantID)
      : {};

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
      this._toBoolean_(event.PreviousSnapshotCaptured) ||
      (
        event.PreviousSnapshotCaptured === undefined &&
        event.PreviousStepID !== undefined &&
        event.PreviousProjectStatus !== undefined &&
        event.PreviousCurrentStepStatus !== undefined &&
        event.PreviousAvailableDepartmentIDs !== undefined &&
        String(event.PreviousProjectStatus || '').trim() !== ''
      );

    if (
      hasExpectedChanges &&
      (!hasPreviousSnapshot || !currentStateMatches)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INVALID_STATUS,
        'وضعیت پروژه پس از این رویداد تغییر کرده است؛ برای جلوگیری از بازگردانی اشتباه، ابتدا وضعیت پروژه بررسی شود.'
      );
    }

    const projectBeforeVoid = project ? Object.assign({}, project) : null;
    let restoredProject = project;

    if (project && hasExpectedChanges && hasPreviousSnapshot) {
      const restoreData = {
        CurrentStepID: event.PreviousStepID,
        CurrentStepStatus: event.PreviousCurrentStepStatus || '',
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

    if (project && hasExpectedChanges && hasPreviousSnapshot) {
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

  retryProcurementIntegration: function(eventId, params) {
    var user = AccessControlService.getCurrentUser(params || {});
    var event = EventRepository.findById(eventId);
    if (!event || String(event.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
    }
    if (event.ProjectID) {
      var project = ProjectRepository.findById(event.ProjectID);
      if (!project || String(project.TenantID) !== String(user.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(project, user)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
      }
    }
    if (['VOID', 'CANCELLED', 'CANCELED', 'DELETED'].indexOf(String(event.Status || '').toUpperCase()) !== -1) {
      throw ErrorHandler.create(Constants.ERROR.INVALID_STATUS, 'برای رویداد لغوشده نمی‌توان اتصال تأمین را دوباره اجرا کرد.');
    }
    var eventType = EventTypeRepository.findById(event.EventTypeID);
    if (!eventType || String(eventType.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نوع رویداد پیدا نشد.');
    }
    var settings = ProcurementEventIntegrationService._find_(eventType.ID, user.TenantID);
    if (!settings || String(settings.Action || 'NONE').toUpperCase() !== 'RECALCULATE_CONFIRMED_NEEDS') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR,
        'اجرای مجدد خودکار فقط برای محاسبه نیاز قطعی پشتیبانی می‌شود؛ عملیات دیگر باید پس از بررسی دستی اصلاح شوند.');
    }
    var stored = EventDataRepository.findByEventId(eventId);
    var dynamicData = {};
    if (stored && stored.DataJSON) {
      try { dynamicData = JSON.parse(String(stored.DataJSON)); }
      catch (error) {
        throw ErrorHandler.create(Constants.ERROR.INTERNAL_ERROR, 'اطلاعات پویای رویداد قابل خواندن نیست.');
      }
    }
    if (!dynamicData || typeof dynamicData !== 'object' || Array.isArray(dynamicData)) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION_ERROR, 'داده‌های پویای رویداد معتبر نیستند.');
    }
    ProcurementEventIntegrationService.validate(eventType, dynamicData, event.ProjectID || '', params || {});
    var result = ProcurementEventIntegrationService.apply(eventType, event, dynamicData, params || {});
    AuditService.log({
      TenantID: user.TenantID, UserID: user.ID, Action: 'PROCUREMENT_INTEGRATION_RETRY',
      EntityType: 'EVENT', EntityID: event.ID, NewData: result,
      Reason: 'اجرای مجدد محاسبه نیاز ملزومات'
    });
    return Response.success({ EventID: event.ID, status: 'SUCCEEDED', result: result && result.data !== undefined ? result.data : result });
  },

};