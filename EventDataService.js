/**
 * Read-only access to legacy event data for historical event details.
 */
const EventDataService = {
getByEventId: function(eventId, params) {

    Validator.required(eventId, 'EventID');

    const currentUser =
      AccessControlService.getCurrentUser(params || {});

    const event =
      EventRepository.findById(eventId);

    if (!event) {
      throw ErrorHandler.create(
        Constants.ERROR.EVENT_NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }

    if (
      String(event.TenantID) !==
      String(currentUser.TenantID)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.NOT_FOUND,
        'رویداد مورد نظر پیدا نشد.'
      );
    }
    if (event.ProjectID) {
      const project = ProjectRepository.findById(event.ProjectID);
      if (!project || String(project.TenantID) !== String(currentUser.TenantID) ||
          !ProjectService._isProjectAvailableToUser_(project, currentUser)) {
        throw ErrorHandler.create(Constants.ERROR.NOT_FOUND, 'رویداد مورد نظر پیدا نشد.');
      }
    }

    const stored =
      EventDataRepository.findByEventId(eventId);

    if (!stored) {
      return Response.success(null);
    }

    let parsedData = {};

    if (
      stored.DataJSON !== undefined &&
      stored.DataJSON !== null &&
      String(stored.DataJSON).trim() !== ''
    ) {
      try {
        parsedData = JSON.parse(stored.DataJSON);
      } catch (error) {
        throw ErrorHandler.create(
          Constants.ERROR.INTERNAL_ERROR,
          'اطلاعات پویای رویداد قابل خواندن نیست.'
        );
      }
    }

    if (
      !parsedData ||
      typeof parsedData !== 'object' ||
      Array.isArray(parsedData)
    ) {
      throw ErrorHandler.create(
        Constants.ERROR.INTERNAL_ERROR,
        'ساختار اطلاعات پویای رویداد معتبر نیست.'
      );
    }

    return Response.success(parsedData);
  }
};
