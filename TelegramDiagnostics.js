/** Run this function from Apps Script to inspect Telegram connection without exposing credentials. */
function diagnoseTelegramConnection() {
  const props = PropertiesService.getScriptProperties();
  const hasToken = !!String(props.getProperty('TELEGRAM_BOT_TOKEN') || '').trim();
  const hasSecret = !!String(props.getProperty('TELEGRAM_WEBHOOK_SECRET') || '').trim();
  const hasWebAppUrl = !!ScriptApp.getService().getUrl();
  const report = {
    tokenConfigured: hasToken,
    webhookSecretConfigured: hasSecret,
    webAppUrlAvailable: hasWebAppUrl,
    webhookRegistered: false,
    pendingUpdates: null,
    lastErrorDate: null,
    lastErrorMessage: null,
    result: 'UNKNOWN'
  };
  if (!hasToken || !hasSecret || !hasWebAppUrl) {
    report.result = 'CONFIGURATION_MISSING';
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
  try {
    const info = TelegramBotService.getWebhookInfo();
    if (!info || !info.ok) {
      report.result = 'TELEGRAM_API_ERROR';
      report.telegramDescription = String(info && info.description || 'Telegram API returned an error');
    } else {
      const result = info.result || {};
      report.webhookRegistered = !!result.url;
      report.pendingUpdates = Number(result.pending_update_count || 0);
      report.lastErrorDate = result.last_error_date || null;
      report.lastErrorMessage = result.last_error_message || null;
      report.result = report.webhookRegistered
        ? (report.lastErrorMessage ? 'WEBHOOK_HAS_DELIVERY_ERROR' : 'WEBHOOK_REGISTERED')
        : 'WEBHOOK_NOT_REGISTERED';
    }
  } catch (error) {
    report.result = 'DIAGNOSTIC_FAILED';
    report.error = String(error && error.message || error);
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}
