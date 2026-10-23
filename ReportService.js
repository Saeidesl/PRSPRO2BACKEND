/**
 * ============================================================
 * REPORT SERVICE
 * ============================================================
 */

const ReportService = {

  _unwrapResponse_: function(response) {
    if (!response || typeof response !== 'object') return response;
    if (response.data !== undefined) return response.data;
    return response;
  },

  listReportProjects: function(params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID || '');
    const projects = (ProjectRepository.getAll() || []).filter(function(project) {
      return String(project.TenantID || '') === tenantId &&
        ProjectService._isProjectAvailableToUser_(project, user);
    }).sort(function(a, b) {
      return new Date(b.CreatedAt || 0).getTime() - new Date(a.CreatedAt || 0).getTime();
    }).map(function(project) {
      return {
        ID: project.ID,
        ProjectCode: project.ProjectCode || project.Code || '',
        Title: project.Title || project.Name || '',
        Quantity: project.Quantity !== undefined ? project.Quantity : (project.TotalQuantity || ''),
        Status: project.Status || '',
        WorkflowID: project.WorkflowID || '',
        CurrentStepID: project.CurrentStepID || '',
        CreatedAt: project.CreatedAt || '',
        Description: project.Description || ''
      };
    });
    return Response.success({ items: projects, total: projects.length });
  },

  projectReport: function(projectId, params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const tenantId = String(user.TenantID || '');
    const project = ProjectRepository.findById(projectId);
    if (!project || String(project.TenantID || '') !== tenantId ||
        !ProjectService._isProjectAvailableToUser_(project, user)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'پروژه مورد نظر پیدا نشد.');
    }

    const eventResponse = EventService.listByProject(projectId, params || {});
    const eventPayload = this._unwrapResponse_(eventResponse);
    const eventRows = Array.isArray(eventPayload) ? eventPayload :
      (eventPayload && Array.isArray(eventPayload.items) ? eventPayload.items : []);
    const events = eventRows.filter(function(event) {
      const status = String(event.Status || '').trim().toUpperCase();
      return status !== 'VOID' && status !== 'CANCELLED' && status !== 'CANCELED';
    });

    let procurement = { needs: [], orders: [], calculations: [] };
    if (typeof ProcurementService !== 'undefined' &&
        ProcurementService && typeof ProcurementService.reports === 'function') {
      const procurementPayload = this._unwrapResponse_(ProcurementService.reports(params || {})) || {};
      const allNeeds = Array.isArray(procurementPayload.needs) ? procurementPayload.needs : [];
      const allOrders = Array.isArray(procurementPayload.orders) ? procurementPayload.orders : [];
      procurement.needs = allNeeds.filter(function(need) {
        return String(need.ProjectID || '') === String(projectId);
      });
      procurement.orders = allOrders.map(function(order) {
        const ids = Array.isArray(order.ProjectIDs) ? order.ProjectIDs.map(String) : [];
        if (!ids.length && order.ProjectID) ids.push(String(order.ProjectID));
        const matchingItems = (Array.isArray(order.Items) ? order.Items : []).filter(function(item) {
          const itemIds = Array.isArray(item.ProjectIDs) ? item.ProjectIDs.map(String) : [];
          if (!itemIds.length && item.ProjectID) itemIds.push(String(item.ProjectID));
          return itemIds.indexOf(String(projectId)) !== -1 ||
            (!itemIds.length && String(order.ProjectID || '') === String(projectId));
        });
        const belongsToProject = ids.indexOf(String(projectId)) !== -1 ||
          matchingItems.length > 0 ||
          String(order.ProjectID || '') === String(projectId);
        if (!belongsToProject) return null;
        const copy = Object.assign({}, order);
        copy.Items = matchingItems;
        return copy;
      }).filter(Boolean);
    }

    return Response.success({
      project: {
        ID: project.ID,
        ProjectCode: project.ProjectCode || project.Code || '',
        Title: project.Title || project.Name || '',
        Quantity: project.Quantity !== undefined ? project.Quantity : (project.TotalQuantity || ''),
        Status: project.Status || '',
        WorkflowID: project.WorkflowID || '',
        WorkflowVersion: project.WorkflowVersion || '',
        CurrentStepID: project.CurrentStepID || '',
        CurrentStepStatus: project.CurrentStepStatus || '',
        CreatedAt: project.CreatedAt || '',
        UpdatedAt: project.UpdatedAt || '',
        Description: project.Description || '',
        ColorSizeJSON: project.ColorSizeJSON || ''
      },
      events: events,
      procurement: procurement,
      generatedAt: new Date().toISOString()
    });
  },



  dashboard: function(params) {

    const currentUser =
      AccessControlService.getCurrentUser(
        params || {}
      );


    const tenantId =
      currentUser.TenantID;


    const projects =
      ReportRepository.getProjects()
        .filter(function(project) {

          return String(project.TenantID) === String(tenantId) &&
            ProjectService._isProjectAvailableToUser_(project, currentUser);

        });


    const events =
      ReportRepository.getEvents()
        .filter(function(event) {

          if (String(event.TenantID) !== String(tenantId)) return false;
          if (!event.ProjectID) return true;
          return projects.some(function(project) {
            return String(project.ID) === String(event.ProjectID);
          });

        });


    const attachments =
      ReportRepository.getAttachments()
        .filter(function(attachment) {

          return String(attachment.TenantID) ===
            String(tenantId);

        });


    const users =
      ReportRepository.getUsers()
        .filter(function(user) {

          return String(user.TenantID) ===
            String(tenantId);

        });


    const departments =
      ReportRepository.getDepartments()
        .filter(function(department) {

          return String(department.TenantID) ===
            String(tenantId);

        });


    const workflows =
      ReportRepository.getWorkflows()
        .filter(function(workflow) {

          return String(workflow.TenantID) ===
            String(tenantId);

        });


    const eventTypes =
      ReportRepository.getEventTypes()
        .filter(function(eventType) {

          return String(eventType.TenantID) ===
            String(tenantId);

        });


    const activeProjects =
      projects.filter(function(project) {

        return String(project.Status) ===
          Constants.STATUS.ACTIVE;

      });


    const completedProjects =
      projects.filter(function(project) {

        return String(project.Status) ===
          Constants.STATUS.COMPLETED;

      });


    const cancelledProjects =
      projects.filter(function(project) {

        return String(project.Status) ===
          Constants.STATUS.CANCELLED;

      });


    const onHoldProjects =
      projects.filter(function(project) {

        return String(project.Status) ===
          Constants.STATUS.ON_HOLD;

      });


    const activeEvents =
      events.filter(function(event) {

        return String(event.Status) ===
          Constants.STATUS.ACTIVE;

      });


    const voidEvents =
      events.filter(function(event) {

        return String(event.Status) ===
          Constants.STATUS.VOID;

      });


    const activeAttachments =
      attachments.filter(function(attachment) {

        return String(attachment.Status) ===
          Constants.STATUS.ACTIVE;

      });


    const now =
      new Date().getTime();


    const projectActivity =
      projects.map(function(project) {

        const projectEvents =
          events.filter(function(event) {

            return String(event.ProjectID) ===
              String(project.ID) &&
              String(event.Status) !==
              Constants.STATUS.VOID;

          });


        let lastActivity =
          project.UpdatedAt ||
          project.CreatedAt ||
          null;


        projectEvents.forEach(function(event) {

          const eventDate =
            event.OccurredAt ||
            event.CreatedAt;


          if (
            eventDate &&
            (
              !lastActivity ||
              new Date(eventDate).getTime() >
              new Date(lastActivity).getTime()
            )
          ) {

            lastActivity =
              eventDate;

          }

        });


        let inactiveDays = 0;


        if (lastActivity) {

          const diff =
            now -
            new Date(lastActivity).getTime();


          inactiveDays =
            Math.floor(
              diff /
              (
                1000 *
                60 *
                60 *
                24
              )
            );

        }


        return {

          projectId:
            project.ID,

          projectCode:
            project.ProjectCode,

          title:
            project.Title,

          status:
            project.Status,

          currentStepId:
            project.CurrentStepID,

          lastActivityAt:
            lastActivity,

          inactiveDays:
            inactiveDays

        };

      });


    const inactiveProjects =
      projectActivity
        .filter(function(item) {

          return (
            String(item.status) ===
            Constants.STATUS.ACTIVE
          ) &&
          item.inactiveDays > 0;

        })
        .sort(function(a,b) {

          return b.inactiveDays -
            a.inactiveDays;

        });


    const eventsByDepartment =
      {};


    events.forEach(function(event) {

      const key =
        event.DepartmentID ||
        'UNASSIGNED';


      if (
        !eventsByDepartment[key]
      ) {

        eventsByDepartment[key] =
          0;

      }


      eventsByDepartment[key]++;

    });


    const eventsByType =
      {};


    events.forEach(function(event) {

      const key =
        event.EventTypeID ||
        'UNASSIGNED';


      if (
        !eventsByType[key]
      ) {

        eventsByType[key] =
          0;

      }


      eventsByType[key]++;

    });


    const departmentSummary =
      departments.map(function(department) {

        return {

          id:
            department.ID,

          name:
            department.Name,

          code:
            department.Code,

          eventCount:
            eventsByDepartment[
              department.ID
            ] || 0

        };

      });


    const eventTypeSummary =
      eventTypes.map(function(eventType) {

        return {

          id:
            eventType.ID,

          name:
            eventType.Name,

          code:
            eventType.Code,

          eventCount:
            eventsByType[
              eventType.ID
            ] || 0

        };

      });


    return Response.success({

      summary: {

        projects:
          projects.length,

        activeProjects:
          activeProjects.length,

        completedProjects:
          completedProjects.length,

        cancelledProjects:
          cancelledProjects.length,

        onHoldProjects:
          onHoldProjects.length,

        events:
          events.length,

        activeEvents:
          activeEvents.length,

        voidEvents:
          voidEvents.length,

        attachments:
          attachments.length,

        activeAttachments:
          activeAttachments.length,

        users:
          users.length,

        departments:
          departments.length,

        workflows:
          workflows.length,

        eventTypes:
          eventTypes.length

      },


      inactivity: {

        total:
          inactiveProjects.length,

        projects:
          inactiveProjects.slice(
            0,
            20
          )

      },


      departments:
        departmentSummary,


      eventTypes:
        eventTypeSummary,


      recentEvents:
        this.getRecentEvents_(
          events,
          20
        ),


      recentProjects:
        this.getRecentProjects_(
          projects,
          20
        )

    });

  },


  getRecentEvents_: function(
    events,
    limit
  ) {

    return events
      .slice()
      .sort(function(a,b) {

        return new Date(
          b.OccurredAt ||
          b.CreatedAt
        ).getTime() -
        new Date(
          a.OccurredAt ||
          a.CreatedAt
        ).getTime();

      })
      .slice(
        0,
        limit
      );

  },


  getRecentProjects_: function(
    projects,
    limit
  ) {

    return projects
      .slice()
      .sort(function(a,b) {

        return new Date(
          b.UpdatedAt ||
          b.CreatedAt
        ).getTime() -
        new Date(
          a.UpdatedAt ||
          a.CreatedAt
        ).getTime();

      })
      .slice(
        0,
        limit
      );

  }

};