
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
    if (String(workflow.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'اتصال واحد به گردش‌کار غیرفعال امکان‌پذیر نیست.');
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

  assignMany: function(workflowId, assignments, params) {
    const user = AccessControlService.getCurrentUser(params || {});
    const id = String(workflowId || '');
    const input = Array.isArray(assignments) ? assignments : [];

    if (!id || !input.length) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'گردش‌کار و حداقل یک اتصال الزامی هستند.');
    }
    if (input.length > 100) {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'در هر بار حداکثر ۱۰۰ اتصال قابل ثبت است.');
    }

    const workflow = WorkflowRepository.findById(id);
    if (!workflow || String(workflow.TenantID) !== String(user.TenantID)) {
      throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'گردش‌کار مورد نظر پیدا نشد.');
    }
    if (String(workflow.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'اتصال واحد به گردش‌کار غیرفعال امکان‌پذیر نیست.');
    }

    // Read each lookup sheet once for the entire batch instead of once per row.
    const steps = WorkflowStepRepository.getAll().filter(function(step) {
      return String(step.TenantID) === String(user.TenantID) &&
        String(step.WorkflowID) === id &&
        String(step.Status).toUpperCase() === 'ACTIVE';
    });
    const departments = DepartmentRepository.getAll().filter(function(department) {
      return String(department.TenantID) === String(user.TenantID) &&
        String(department.Status).toUpperCase() === 'ACTIVE';
    });
    const existing = WorkflowStepDepartmentRepository.findByWorkflowId(id).filter(function(item) {
      return String(item.TenantID) === String(user.TenantID) &&
        String(item.Status).toUpperCase() === 'ACTIVE';
    });

    const stepById = {};
    steps.forEach(function(step) { stepById[String(step.ID)] = step; });
    const departmentById = {};
    departments.forEach(function(department) { departmentById[String(department.ID)] = department; });
    const existingByDepartment = {};
    existing.forEach(function(item) {
      existingByDepartment[String(item.DepartmentID)] = item;
    });

    const seenDepartments = {};
    const toInsert = [];
    const unchanged = [];
    const now = new Date();

    input.forEach(function(item) {
      const stepId = String(item && (item.WorkflowStepID || item.workflowStepId) || '');
      const departmentId = String(item && (item.DepartmentID || item.departmentId) || '');
      if (!stepId || !departmentId) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'برای هر اتصال باید بخش و مرحله مشخص باشد.');
      }
      if (seenDepartments[departmentId]) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'یک بخش در فهرست چند بار انتخاب شده است.');
      }
      seenDepartments[departmentId] = true;

      if (!stepById[stepId]) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'یکی از مراحل انتخاب‌شده معتبر یا فعال نیست.');
      }
      if (!departmentById[departmentId]) {
        throw ErrorHandler.create(Constants.ERROR.VALIDATION, 'یکی از بخش‌های انتخاب‌شده معتبر یا فعال نیست.');
      }

      const prior = existingByDepartment[departmentId];
      if (prior) {
        if (String(prior.WorkflowStepID) !== stepId) {
          throw ErrorHandler.create(Constants.ERROR.VALIDATION,
            'بخش «' + departmentById[departmentId].Name +
            '» قبلاً به مرحله دیگری متصل است. اتصال قبلی را ابتدا حذف کنید.');
        }
        unchanged.push(prior);
        return;
      }

      toInsert.push({
        ID: 'WSD_' + Utilities.getUuid(),
        TenantID: user.TenantID,
        WorkflowID: id,
        WorkflowStepID: stepId,
        DepartmentID: departmentId,
        Status: 'ACTIVE',
        CreatedAt: now,
        UpdatedAt: now
      });
    });

    if (toInsert.length) {
      // Keep batch writes as the preferred path, but remain compatible with
      // an older deployed repository object that does not expose insertMany.
      if (typeof WorkflowStepDepartmentRepository.insertMany === 'function') {
        WorkflowStepDepartmentRepository.insertMany(toInsert);
      } else {
        toInsert.forEach(function(record) {
          WorkflowStepDepartmentRepository.insert(record);
        });
      }
    }

    return {
      created: toInsert.length,
      unchanged: unchanged.length,
      assignments: toInsert.concat(unchanged)
    };
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
