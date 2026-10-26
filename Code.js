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
