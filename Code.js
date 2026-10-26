function doGet(e) {
  return webAppDoGet(e);
}

function doPost(e) {
  // Telegram posts are separated from the PMS JSON API by a secret query parameter.
  // All other requests continue through the existing API router unchanged.
  if (e && e.parameter && e.parameter.telegramSecret !== undefined) {
    return TelegramBotService.handleWebhook(e);
  }
  return webAppDoPost(e);
}

/**
 * Configure reliable Telegram polling. This replaces inbound webhooks because
 * Google Apps Script's anonymous POST endpoint can currently return HTTP 401
 * before doPost executes.
 */
function runTelegramWebhookSetup() {
  return TelegramBotService.setupPolling();
}

/** Poll Telegram updates. Also invoked automatically by a one-minute trigger. */
function runTelegramPolling() {
  return TelegramBotService.pollUpdates();
}

/** Inspect Telegram webhook status (polling mode normally reports no webhook). */
function runTelegramWebhookInfo() {
  return TelegramBotService.getWebhookInfo();
}


/**
 * One-time setup: register the confirmed Telegram chat for the main PMS tenant.
 * Run once from the Apps Script editor after deployment; credentials stay in Script Properties.
 */
function registerTelegramMainTenantChat() {
  return TelegramBotService.registerTenantChat('TEN_MAIN', '8508458192');
}
