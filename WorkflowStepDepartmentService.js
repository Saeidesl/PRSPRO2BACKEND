
const WorkflowStepDepartmentService = {

  listByWorkflow: function(workflowId, params) {
    const user = AccessControlService.getCurrentUser(params || {});

    if (!workflowId) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'شناسه گردش‌کار الزامی است.');
    }

    const workflow = WorkflowRepository.findById(workflowId);

    if (!workflow || String(workflow.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'گردش‌کار مورد نظر پیدا نشد.');
    }

    return WorkflowStepDepartmentRepository.findByWorkflowId(workflowId).filter(function(item) {
      return String(item.TenantID) === String(user.TenantID) &&
        String(item.Status).toUpperCase() === 'ACTIVE';
    });
  },

  assign: function(data, params) {
    const user = AccessControlService.getCurrentUser(params || {});
    data = data || {};

    const workflowId = data.WorkflowID;
    const stepId = data.WorkflowStepID;
    const departmentId = data.DepartmentID;

    if (!workflowId || !stepId || !departmentId) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'گردش‌کار، مرحله و دپارتمان الزامی هستند.');
    }

    const workflow = WorkflowRepository.findById(workflowId);
    if (!workflow || String(workflow.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'گردش‌کار مورد نظر پیدا نشد.');
    }

    const step = WorkflowStepRepository.findById(stepId);
    if (!step ||
        String(step.TenantID) !== String(user.TenantID) ||
        String(step.WorkflowID) !== String(workflowId) ||
        String(step.Status).toUpperCase() !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'مرحله انتخاب‌شده معتبر یا فعال نیست.');
    }

    const department = DepartmentRepository.findById(departmentId);
    if (!department ||
        String(department.TenantID) !== String(user.TenantID) ||
        String(department.Status).toUpperCase() !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'دپارتمان انتخاب‌شده معتبر یا فعال نیست.');
    }

    const assignments = WorkflowStepDepartmentRepository.findByWorkflowId(workflowId).filter(function(item) {
      return String(item.TenantID) === String(user.TenantID) &&
        String(item.DepartmentID) === String(departmentId) &&
        String(item.Status).toUpperCase() === 'ACTIVE';
    });

    if (assignments.length > 0) {
      if (String(assignments[0].WorkflowStepID) === String(stepId)) {
        return assignments[0];
      }
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'این دپارتمان قبلاً به مرحله دیگری در همین گردش‌کار متصل شده است.');
    }

    const now = new Date();
    return WorkflowStepDepartmentRepository.insert({
      ID: 'WSD_' + Utilities.getUuid(),
      TenantID: user.TenantID,
      WorkflowID: workflowId,
      WorkflowStepID: stepId,
      DepartmentID: departmentId,
      Status: 'ACTIVE',
      CreatedAt: now,
      UpdatedAt: now
    });
  },

  remove: function(id, params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const item = WorkflowStepDepartmentRepository.findById(id);

    if (!item || String(item.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'ارتباط مورد نظر پیدا نشد.');
    }

    if (String(item.Status).toUpperCase() !== 'ACTIVE') {
      return item;
    }

    return WorkflowStepDepartmentRepository.update(id, {
      Status: 'DELETED',
      UpdatedAt: new Date()
    });
  }
};
