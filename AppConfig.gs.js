const AppConfig = {
  APP_NAME: 'Production Management System',
  VERSION: '1.0.0',
  ENVIRONMENT: 'MVP',

  // Temporary diagnostics for procurement performance testing.
  // Disable after collecting the baseline.
  PERFORMANCE_LOG_TO_CONSOLE: true,

  DATABASE: {
    SPREADSHEET_ID: '',
  },

  API: {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
  },

  AUTH: {
    // 0 means sessions remain valid until the user logs out.
    SESSION_DURATION_HOURS: 0
  },

  FILES: {
    MAX_SIZE_MB: 10,

    GOOGLE_DRIVE_FOLDER_ID: '',

    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  }
};