const ReportRepository = {

  getProjects: function() {

    return ProjectRepository.getAll();

  },


  getEvents: function() {

    return EventRepository.getAll();

  },


  getAttachments: function() {

    return AttachmentRepository.getAll();

  },


  getUsers: function() {

    return UserRepository.getAll();

  },


  getDepartments: function() {

    return DepartmentRepository.getAll();

  },


  getWorkflows: function() {

    return WorkflowRepository.getAll();

  },


  getWorkflowSteps: function() {

    const workflows =
      this.getWorkflows();

    let result = [];

    workflows.forEach(function(workflow) {

      const steps =
        WorkflowStepRepository
          .findByWorkflowId(workflow.ID);

      if (steps && steps.length) {

        result =
          result.concat(steps);

      }

    });

    return result;

  },


  getEventTypes: function() {

    return EventTypeRepository.getAll();

  }

};