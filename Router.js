
/**
 * ROUTER
 * Version 1.2.2
 */

const Router = {

  _runProcurementRead_: function(endpoint, callback) {
    var startedAt = Date.now();
    var diagnosticsStarted = false;
    try {
      if (typeof PerformanceDiagnostics !== 'undefined' &&
          PerformanceDiagnostics &&
          typeof PerformanceDiagnostics.beginRequest === 'function') {
        PerformanceDiagnostics.beginRequest(endpoint);
        diagnosticsStarted = true;
      }
      return callback();
    } catch (error) {
      if (diagnosticsStarted && typeof PerformanceDiagnostics.recordEndpointError === 'function') {
        PerformanceDiagnostics.recordEndpointError(error);
      }
      throw error;
    } finally {
      if (diagnosticsStarted && typeof PerformanceDiagnostics.finishRequest === 'function') {
        PerformanceDiagnostics.finishRequest(Date.now() - startedAt);
      }
    }
  },

  requireAny: function(params, permissionCodes) {
    const user = AccessControlService.getCurrentUser(params || {});

    if (AccessControlService.isAdmin(user)) {
      return user;
    }

    const allowed = (permissionCodes || []).some(function(code) {
      return PermissionService.hasPermission(user.ID, code, user);
    });

    if (!allowed) {
      throw ErrorHandler.create(
        Constants.ERROR.PERMISSION_DENIED,
        'شما دسترسی لازم برای این عملیات را ندارید.'
      );
    }

    return user;
  },

  get: function(path, params) {
    path = String(path || '').trim();

    if (path === '/auth/me') {
      return AuthService.me(params);
    }

    if (path === '/auth/me/permissions') {
      const user = AccessControlService.getCurrentUser(params || {});
      let permissions;

      if (AccessControlService.isAdmin(user)) {
        permissions = PermissionRepository.getAll().map(function(item) {
          return item.Code;
        });
      } else {
        permissions = AccessControlService.getUserPermissions(user.ID, user);
      }

      return Response.success({
        permissions: permissions,
        isAdmin: AccessControlService.isAdmin(user)
      });
    }

    var projectDeletePreviewMatch = path.match(/^\/admin\/projects\/([^/]+)\/deletion-preview$/);
    if (projectDeletePreviewMatch) {
      var previewAdmin = AccessControlService.getCurrentUser(params || {});
      if (!AccessControlService.isAdmin(previewAdmin)) {
        throw ErrorHandler.create(Constants.ERROR.PERMISSION_DENIED, 'فقط مدیر سامانه می‌تواند حذف پروژه را بررسی کند.');
      }
      return ProjectDeletionService.preview(decodeURIComponent(projectDeletePreviewMatch[1]), params);
    }

    if (path === '/admin/sessions') {
      const adminUser = AccessControlService.getCurrentUser(params || {});
      if (!AccessControlService.isAdmin(adminUser)) {
        throw ErrorHandler.create(Constants.ERROR.PERMISSION_DENIED, 'فقط مدیر سامانه می‌تواند نشست‌ها را مشاهده کند.');
      }
      return SessionManager.listForAdmin(adminUser, AuthService.getToken_(params));
    }

    if (path === '/project-statuses') {
      AccessControlService.require(params, 'PROJECT_STATUS_MANAGE');
      return ProjectStatusService.list(params);
    }

    if (path === '/departments') {
      this.requireAny(params, [
        'DEPARTMENT_MANAGE',
        'USER_VIEW',
        'USER_CREATE',
        'USER_EDIT',
        'WORKFLOW_MANAGE',
        'EVENT_TYPE_MANAGE',
        'EVENT_CREATE'
      ]);
      return DepartmentService.list(params);
    }

    if (path.indexOf('/departments/') === 0) {
      this.requireAny(params, [
        'DEPARTMENT_MANAGE',
        'USER_VIEW',
        'USER_CREATE',
        'USER_EDIT',
        'WORKFLOW_MANAGE',
        'EVENT_TYPE_MANAGE',
        'EVENT_CREATE'
      ]);
      const departmentId = path.split('/')[2];

      if (!departmentId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مسیر مورد نظر پیدا نشد.');
      }

      return DepartmentService.get(departmentId, params);
    }

    if (path === '/project-card-images') {
      AccessControlService.require(params, 'PROJECT_VIEW');
      AccessControlService.require(params, 'ATTACHMENT_VIEW');
      return AttachmentService.listProjectImages(params);
    }

    if (path === '/project-form/lookups') {
      AccessControlService.require(params, 'PROJECT_CREATE');
      return ProjectService.projectFormLookups(params);
    }

    if (path === '/projects') {
      AccessControlService.require(params, 'PROJECT_VIEW');
      return ProjectService.list(params);
    }

    if (path.indexOf('/projects/') === 0) {
      const routeParts = path.split('/');
      if (routeParts[3] === 'material-specifications' || routeParts[3] === 'material-calculations') {
        this.requireAny(params, ['PROJECT_VIEW', 'PROJECT_EDIT']);
      } else {
        AccessControlService.require(params, 'PROJECT_VIEW');
      }
      const parts = path.split('/');
      const projectId = parts[2];

      if (!projectId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مسیر مورد نظر پیدا نشد.');
      }

      if (parts[3] === 'events') {
        AccessControlService.require(params, 'EVENT_VIEW');
        return EventService.listByProject(projectId, params);
      }

      if (parts[3] === 'material-specifications') {
        return MaterialPlanningService.listSpecifications(projectId, params);
      }

      if (parts[3] === 'material-calculations') {
        return MaterialPlanningService.listCalculationHistory(projectId, params);
      }

      if (parts[3] === 'details') {
        AccessControlService.require(params, 'EVENT_VIEW');
        if (parts[4] === 'page') {
          return EventService.getProjectDetailsPage(projectId, parts[5] || 'newest', parts[6] || '1', params);
        }
        return EventService.getProjectDetails(projectId, params);
      }

      if (parts[3] === 'attachments') {
        AccessControlService.require(params, 'ATTACHMENT_VIEW');
        return AttachmentService.listByEntity('PROJECT', projectId, params);
      }

      return ProjectService.get(projectId, params);
    }

    if (path === '/workflow-management/bootstrap') {
      AccessControlService.require(params, 'WORKFLOW_MANAGE');
      return WorkflowService.managementBootstrap(params);
    }

    if (path === '/workflows') {
      // Project creators need read-only workflow choices during project creation.
      this.requireAny(params, ['WORKFLOW_MANAGE', 'PROJECT_CREATE']);
      return WorkflowService.list(params);
    }

    if (path.indexOf('/workflows/') === 0) {
      const parts = path.split('/');
      const workflowId = parts[2];

      if (!workflowId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'گردش‌کار مورد نظر پیدا نشد.');
      }

      if (parts[3] === 'management-data') {
        AccessControlService.require(params, 'WORKFLOW_MANAGE');
        return WorkflowService.managementData(workflowId, params);
      }

      if (parts[3] === 'steps') {
        this.requireAny(params, ['WORKFLOW_MANAGE', 'PROJECT_VIEW']);
        return WorkflowService.getSteps(workflowId, params);
      }

      AccessControlService.require(params, 'WORKFLOW_MANAGE');

      if (parts[3] === 'department-steps') {
        return WorkflowStepDepartmentService.listByWorkflow(workflowId, params);
      }

      return WorkflowService.get(workflowId, params);
    }

    if (path === '/event-types') {
      this.requireAny(params, ['EVENT_TYPE_MANAGE', 'EVENT_CREATE']);
      return EventTypeService.list(params);
    }


    if (path.indexOf('/event-types/') === 0) {
      this.requireAny(params, ['EVENT_TYPE_MANAGE', 'EVENT_CREATE']);
      const parts = path.split('/');
      const eventTypeId = parts[2];

      if (!eventTypeId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مسیر مورد نظر پیدا نشد.');
      }

      if (parts[3] === 'fields') {
        return EventFieldService.listByEventType(eventTypeId, params);
      }

      if (parts[3] === 'procurement') {
        AccessControlService.require(params, 'EVENT_TYPE_MANAGE');
        return ProcurementEventIntegrationService.get(eventTypeId, params);
      }

      return EventTypeService.get(eventTypeId, params);
    }

    if (path === '/events') {
      AccessControlService.require(params, 'EVENT_VIEW');
      return EventService.list(params);
    }

    if (path.indexOf('/events/') === 0) {
      AccessControlService.require(params, 'EVENT_VIEW');
      const parts = path.split('/');
      const eventId = parts[2];

      if (!eventId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
      }

      if (parts[3] === 'data') {
        return EventDataService.getByEventId(eventId, params);
      }

      if (parts[3] === 'attachments') {
        AccessControlService.require(params, 'ATTACHMENT_VIEW');
        return AttachmentService.listByEntity('EVENT', eventId, params);
      }

      return EventService.get(eventId, params);
    }

    if (path === '/attachments') {
      AccessControlService.require(params, 'ATTACHMENT_VIEW');
      return AttachmentService.list(params);
    }

    if (path.indexOf('/attachments/') === 0) {
      AccessControlService.require(params, 'ATTACHMENT_VIEW');
      const parts = path.split('/');
      const attachmentId = parts[2];

      if (!attachmentId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پیوست مورد نظر پیدا نشد.');
      }

      if (parts[3] === 'download') {
        return AttachmentService.download(attachmentId, params);
      }

      return AttachmentService.get(attachmentId, params);
    }

    if (path === '/users') {
      AccessControlService.require(params, 'USER_VIEW');
      return UserService.list(params);
    }

    if (path.indexOf('/users/') === 0 && path.split('/')[3] === 'roles') {
      AccessControlService.require(params, 'USER_EDIT');
      const parts = path.split('/');
      return UserRoleService.listByUser(parts[2], params);
    }

    // ROLES
    if (path === '/roles/available-permissions') {
      AccessControlService.require(params, 'ROLE_MANAGE');
      return PermissionService.list(params);
    }

    if (path === '/roles') {
      this.requireAny(params, ['ROLE_MANAGE', 'USER_EDIT']);
      return RoleService.list(params);
    }

    if (path.indexOf('/roles/') === 0) {
      const parts = path.split('/');

      if (parts[3] === 'permissions' && parts.length === 4) {
        AccessControlService.require(params, 'ROLE_MANAGE');
        return RolePermissionService.listByRole(parts[2], params);
      }
    }

    if (path === '/permissions') {
      AccessControlService.require(params, 'PERMISSION_MANAGE');
      return PermissionService.list(params);
    }

    if (path === '/audit') {
      AccessControlService.require(params, 'REPORT_VIEW');
      return AuditService.list(params);
    }

    if (path.indexOf('/audit/entity/') === 0) {
      AccessControlService.require(params, 'REPORT_VIEW');
      const parts = path.split('/');
      return AuditService.listByEntity(parts[3], parts[4], params);
    }

    if (path.indexOf('/audit/user/') === 0) {
      AccessControlService.require(params, 'REPORT_VIEW');
      const parts = path.split('/');
      return AuditService.listByUser(parts[3], params);
    }

    if (path === '/project-dashboard/lookups') {
      AccessControlService.require(params, 'PROJECT_VIEW');
      return ProjectService.dashboardLookups(params);
    }

    // Include permission checks in endpoint timing. Authorization can perform
    // several Google Sheets reads and must be visible in the same measurement.
    if (path === '/procurement/workspace') {
      return this._runProcurementRead_('/procurement/workspace', function() {
        Router.requireAny(params, ['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE']);
        return ProcurementService.workspace(params);
      });
    }

    if (path === '/procurement/reports') {
      return this._runProcurementRead_('/procurement/reports', function() {
        Router.requireAny(params, ['REPORT_VIEW', 'PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE']);
        return ProcurementService.reports(params);
      });
    }

    if (path === '/procurement/dashboard') {
      return this._runProcurementRead_('/procurement/dashboard', function() {
        Router.requireAny(params, ['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE']);
        return ProcurementService.dashboard(params);
      });
    }

    if (path === '/procurement/needs') {
      return this._runProcurementRead_('/procurement/needs', function() {
        Router.requireAny(params, ['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE']);
        return ProcurementService.listNeeds(params);
      });
    }

    if (path === '/procurement/orders') {
      return this._runProcurementRead_('/procurement/orders', function() {
        Router.requireAny(params, ['PROCUREMENT_VIEW', 'PROCUREMENT_MANAGE']);
        return ProcurementService.listOrders(params);
      });
    }

    if (path === '/reports/projects') {
      AccessControlService.require(params, 'REPORT_VIEW');
      return ReportService.listReportProjects(params);
    }

    if (path.indexOf('/reports/project/') === 0) {
      AccessControlService.require(params, 'REPORT_VIEW');
      const reportProjectId = path.split('/')[3];
      if (!reportProjectId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'شناسه پروژه برای گزارش مشخص نیست.');
      }
      return ReportService.projectReport(reportProjectId, params);
    }

    if (path === '/dashboard') {
      AccessControlService.require(params, 'REPORT_VIEW');
      return ReportService.dashboard(params);
    }

    throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مسیر مورد نظر پیدا نشد.');
  },

  post: function(path, body, params) {
    path = String(path || '').trim();
    body = body || {};

    if (path === '/auth/login') {
      return AuthService.login(body, params);
    }

    if (path === '/auth/logout') {
      return AuthService.logout(params);
    }

    if (path === '/project-statuses') {
      AccessControlService.require(params, 'PROJECT_STATUS_MANAGE');
      return ProjectStatusService.create(body, params);
    }

    if (path === '/departments') {
      AccessControlService.require(params, 'DEPARTMENT_MANAGE');
      return DepartmentService.create(body, params);
    }

    if (path === '/roles') {
      AccessControlService.require(params, 'ROLE_MANAGE');
      return RoleService.create(body, params);
    }

    // ROLE PERMISSIONS - BULK
    const bulkPermissionMatch = path.match(
      /^\/roles\/([^/]+)\/permissions\/(bulk|bulk-remove)$/
    );

    if (bulkPermissionMatch) {
      AccessControlService.require(params, 'ROLE_MANAGE');

      const roleId = bulkPermissionMatch[1];
      const operation = bulkPermissionMatch[2];
      const permissionIds = body.permissionIds || body.PermissionIDs;

      if (operation === 'bulk') {
        return RolePermissionService.assignMany(
          roleId,
          permissionIds,
          params
        );
      }

      return RolePermissionService.removeMany(
        roleId,
        permissionIds,
        params
      );
    }

    const procurementRetryMatch = path.match(/^\/events\/([^/]+)\/procurement-retry$/);
    if (procurementRetryMatch) {
      AccessControlService.require(params, 'EVENT_EDIT');
      return EventService.retryProcurementIntegration(procurementRetryMatch[1], params);
    }

    if (path === '/procurement/orders') {
      AccessControlService.require(params, 'PROCUREMENT_MANAGE');
      return ProcurementService.createOrder(body, params);
    }

    if (path === '/procurement/receipts/batch') {
      AccessControlService.require(params, 'PROCUREMENT_MANAGE');
      return ProcurementService.createReceiptsBatch(body, params);
    }

    if (path === '/procurement/receipts') {
      AccessControlService.require(params, 'PROCUREMENT_MANAGE');
      return ProcurementService.createReceipt(body, params);
    }

    const materialSpecCreateMatch = path.match(/^\/projects\/([^/]+)\/material-specifications$/);
    if (materialSpecCreateMatch) {
      const projectId = materialSpecCreateMatch[1];
      try {
        AccessControlService.require(params, 'PROJECT_EDIT');
      } catch (permissionError) {
        const user = AccessControlService.getCurrentUser(params || {});
        const project = ProjectRepository.findById(projectId);
        if (!project || String(project.TenantID) !== String(user.TenantID) ||
            String(project.CreatedBy || '') !== String(user.ID || '')) {
          throw permissionError;
        }
        AccessControlService.require(params, 'PROJECT_CREATE');
      }
      return MaterialPlanningService.createSpecification(projectId, body, params);
    }

    if (path === '/projects') {
      AccessControlService.require(params, 'PROJECT_CREATE');
      return ProjectService.create(body, params);
    }

    if (path === '/workflows') {
      AccessControlService.require(params, 'WORKFLOW_MANAGE');
      return WorkflowService.create(body, params);
    }

    if (path.indexOf('/workflows/') === 0) {
      AccessControlService.require(params, 'WORKFLOW_MANAGE');
      const parts = path.split('/');
      const workflowId = parts[2];

      if (!workflowId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'گردش‌کار مورد نظر پیدا نشد.');
      }

      if (parts[3] === 'steps') {
        return WorkflowService.createStep(workflowId, body, params);
      }

      if (
        parts[3] === 'department-steps' &&
        (parts[4] === 'bulk' ||
          Array.isArray(body.assignments) ||
          Array.isArray(body.Assignments))
      ) {
        return WorkflowStepDepartmentService.assignMany(
          workflowId,
          body.assignments || body.Assignments,
          params
        );
      }

      if (parts[3] === 'department-steps') {
        body.WorkflowID = workflowId;
        return WorkflowStepDepartmentService.assign(body, params);
      }
    }

    if (path === '/event-types') {
      AccessControlService.require(params, 'EVENT_TYPE_MANAGE');
      return EventTypeService.create(body, params);
    }

    const eventTypeProcurementMatch = path.match(/^\/event-types\/([^/]+)\/procurement$/);
    if (eventTypeProcurementMatch) {
      AccessControlService.require(params, 'EVENT_TYPE_MANAGE');
      return ProcurementEventIntegrationService.save(eventTypeProcurementMatch[1], body, params);
    }

    if (path.indexOf('/event-types/') === 0) {
      AccessControlService.require(params, 'EVENT_TYPE_MANAGE');
      const parts = path.split('/');

      if (parts[3] === 'fields') {
        body.EventTypeID = parts[2];
        return EventFieldService.create(body, params);
      }
    }

    if (path === '/events') {
      AccessControlService.require(params, 'EVENT_CREATE');
      return EventService.create(body, params);
    }

    if (path.indexOf('/events/') === 0) {
      const parts = path.split('/');
      const eventId = parts[2];

      if (parts[3] === 'data') {
        AccessControlService.require(params, 'EVENT_EDIT');
        return EventDataService.save(eventId, body, params);
      }

      if (parts[3] === 'attachments') {
        AccessControlService.require(params, 'ATTACHMENT_UPLOAD');
        body.EntityType = 'EVENT';
        body.EntityID = eventId;
        return AttachmentService.upload(body, params);
      }
    }

    if (path.indexOf('/projects/') === 0) {
      const parts = path.split('/');

      if (parts[3] === 'attachments') {
        AccessControlService.require(params, 'ATTACHMENT_UPLOAD');
        body.EntityType = 'PROJECT';
        body.EntityID = parts[2];
        return AttachmentService.upload(body, params);
      }
    }

    if (path === '/attachments') {
      AccessControlService.require(params, 'ATTACHMENT_UPLOAD');
      return AttachmentService.upload(body, params);
    }

    if (path === '/users') {
      AccessControlService.require(params, 'USER_CREATE');
      return UserService.create(body, params);
    }

    if (path.indexOf('/users/') === 0 && path.split('/')[3] === 'roles') {
      AccessControlService.require(params, 'USER_EDIT');
      const parts = path.split('/');
      return UserRoleService.assign(
        parts[2],
        body.roleId || body.RoleID,
        params
      );
    }

    // ROLE PERMISSIONS - SINGLE
    if (
      path.indexOf('/roles/') === 0 &&
      path.split('/')[3] === 'permissions' &&
      path.split('/').length === 4
    ) {
      AccessControlService.require(params, 'ROLE_MANAGE');
      const parts = path.split('/');
      return RolePermissionService.assign(
        parts[2],
        body.permissionId || body.PermissionID,
        params
      );
    }

    throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مسیر مورد نظر پیدا نشد.');
  },

  put: function(path, body, params) {
    path = String(path || '').trim();
    body = body || {};

    if (path.indexOf('/project-statuses/') === 0 && path.split('/').length === 3) {
      AccessControlService.require(params, 'PROJECT_STATUS_MANAGE');
      return ProjectStatusService.update(path.split('/')[2], body, params);
    }

    if (path.indexOf('/roles/') === 0 && path.split('/').length === 3) {
      AccessControlService.require(params, 'ROLE_MANAGE');
      const roleId = path.split('/')[2];

      if (!roleId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'نقش مورد نظر پیدا نشد.');
      }

      return RoleService.update(roleId, body, params);
    }

    if (path.indexOf('/departments/') === 0) {
      AccessControlService.require(params, 'DEPARTMENT_MANAGE');
      const departmentId = path.split('/')[2];

      if (!departmentId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'دپارتمان مورد نظر پیدا نشد.');
      }

      return DepartmentService.update(departmentId, body, params);
    }

    const materialSpecUpdateMatch = path.match(/^\/material-specifications\/([^/]+)$/);
    if (materialSpecUpdateMatch) {
      AccessControlService.require(params, 'PROJECT_EDIT');
      return MaterialPlanningService.reviseSpecification(materialSpecUpdateMatch[1], body, params);
    }

    if (path.indexOf('/projects/') === 0) {
      AccessControlService.require(params, 'PROJECT_EDIT');
      return ProjectService.update(path.split('/')[2], body, params);
    }

    if (path.indexOf('/workflows/') === 0) {
      AccessControlService.require(params, 'WORKFLOW_MANAGE');
      return WorkflowService.update(path.split('/')[2], body, params);
    }
    if (path.indexOf('/event-types/') === 0) {
      AccessControlService.require(params, 'EVENT_TYPE_MANAGE');
      return EventTypeService.update(path.split('/')[2], body, params);
    }

    if (path.indexOf('/events/') === 0) {
      const parts = path.split('/');

      if (parts[3] === 'void') {
        AccessControlService.require(params, 'EVENT_EDIT');
        return EventService.void(parts[2], body.reason, params);
      }
    }

    if (path.indexOf('/users/') === 0) {
      AccessControlService.require(params, 'USER_EDIT');
      return UserService.update(path.split('/')[2], body, params);
    }

    if (path.indexOf('/event-fields/') === 0) {
      AccessControlService.require(params, 'EVENT_TYPE_MANAGE');
      return EventFieldService.update(path.split('/')[2], body, params);
    }

    throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مسیر مورد نظر پیدا نشد.');
  },

  delete: function(path, params) {
    path = String(path || '').trim();

    var projectDeleteMatch = path.match(/^\/admin\/projects\/([^/]+)$/);
    if (projectDeleteMatch) {
      var deleteAdmin = AccessControlService.getCurrentUser(params || {});
      if (!AccessControlService.isAdmin(deleteAdmin)) {
        throw ErrorHandler.create(Constants.ERROR.PERMISSION_DENIED, 'فقط مدیر سامانه می‌تواند پروژه را حذف کند.');
      }
      return ProjectDeletionService.remove(
        decodeURIComponent(projectDeleteMatch[1]),
        params.confirmationCode || params.ProjectCode || '',
        params
      );
    }

    const adminSessionMatch = path.match(/^\/admin\/sessions\/([^/]+)$/);
    if (adminSessionMatch) {
      const adminUser = AccessControlService.getCurrentUser(params || {});
      if (!AccessControlService.isAdmin(adminUser)) {
        throw ErrorHandler.create(Constants.ERROR.PERMISSION_DENIED, 'فقط مدیر سامانه می‌تواند نشست‌ها را خاتمه دهد.');
      }
      return SessionManager.revokeForAdmin(
        adminSessionMatch[1],
        adminUser,
        AuthService.getToken_(params)
      );
    }

    if (path.indexOf('/event-fields/') === 0) {
      AccessControlService.require(params, 'EVENT_TYPE_MANAGE');
      return EventFieldService.delete(path.split('/')[2], params);
    }

    if (
      path.indexOf('/roles/') === 0 &&
      path.split('/')[3] === 'permissions' &&
      path.split('/').length === 5
    ) {
      AccessControlService.require(params, 'ROLE_MANAGE');
      const parts = path.split('/');
      return RolePermissionService.remove(parts[2], parts[4], params);
    }

    if (path.indexOf('/users/') === 0 && path.split('/')[3] === 'roles') {
      AccessControlService.require(params, 'USER_EDIT');
      const parts = path.split('/');
      return UserRoleService.remove(parts[2], parts[4], params);
    }

    if (
      path.indexOf('/workflows/') === 0 &&
      path.split('/')[3] === 'department-steps'
    ) {
      AccessControlService.require(params, 'WORKFLOW_MANAGE');

      const parts = path.split('/');
      const workflowId = parts[2];
      const assignmentId = parts[4];

      if (!workflowId || !assignmentId) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'ارتباط مورد نظر پیدا نشد.');
      }

      const assignment = WorkflowStepDepartmentRepository.findById(assignmentId);

      if (
        !assignment ||
        String(assignment.WorkflowID) !== String(workflowId)
      ) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'ارتباط مورد نظر پیدا نشد.');
      }

      return WorkflowStepDepartmentService.remove(assignmentId, params);
    }

    if (path.indexOf('/attachments/') === 0) {
      AccessControlService.require(params, 'ATTACHMENT_DELETE');
      const parts = path.split('/');
      return AttachmentService.delete(parts[2], params.reason, params);
    }

    throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'مسیر مورد نظر پیدا نشد.');
  }

};
