/** Run this function from Apps Script to inspect Telegram connection without exposing credentials. */
function diagnoseTelegramConnection() {
  const props = PropertiesService.getScriptProperties();
  const hasToken = !!String(props.getProperty('TELEGRAM_BOT_TOKEN') || '').trim();
  const hasSecret = !!String(props.getProperty('TELEGRAM_WEBHOOK_SECRET') || '').trim();
  const webAppUrl = ScriptApp.getService().getUrl();
  const report = {
    tokenConfigured: hasToken,
    webhookSecretConfigured: hasSecret,
    webAppUrlAvailable: !!webAppUrl,
    publicEndpointHttpStatus: null,
    webhookRegistered: false,
    pendingUpdates: null,
    lastErrorDate: null,
    lastErrorMessage: null,
    result: 'UNKNOWN'
  };
  if (!hasToken || !hasSecret || !webAppUrl) {
    report.result = 'CONFIGURATION_MISSING';
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
  // Check whether the deployed /exec endpoint can be reached without exposing its URL.
  try {
    const endpointResponse = UrlFetchApp.fetch(webAppUrl, {
      method: 'get',
      followRedirects: true,
      muteHttpExceptions: true
    });
    report.publicEndpointHttpStatus = endpointResponse.getResponseCode();
  } catch (error) {
    report.publicEndpointHttpStatus = 'FETCH_FAILED';
    report.endpointError = String(error && error.message || error);
  }
  // Exercise the same anonymous POST path Telegram uses, with a harmless empty update.
  // Only report the status and a coarse response classification; never log the URL or secrets.
  try {
    const testUrl = webAppUrl + (webAppUrl.indexOf('?') >= 0 ? '&' : '?') +
      'telegramSecret=' + encodeURIComponent(String(props.getProperty('TELEGRAM_WEBHOOK_SECRET') || ''));
    const postResponse = UrlFetchApp.fetch(testUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ update_id: 0 }),
      followRedirects: true,
      muteHttpExceptions: true
    });
    report.selfPostHttpStatus = postResponse.getResponseCode();
    const postBody = String(postResponse.getContentText() || '').slice(0, 500);
    report.selfPostResponseType = /"ok"\\s*:\\s*true/.test(postBody)
      ? 'WEBHOOK_HANDLER_OK'
      : /"ok"\\s*:\\s*false/.test(postBody)
        ? 'WEBHOOK_HANDLER_REJECTED'
        : /accounts\\.google|ServiceLogin|Sign in/i.test(postBody)
          ? 'GOOGLE_AUTH_PAGE'
          : 'NON_JSON_OR_OTHER_RESPONSE';
  } catch (error) {
    report.selfPostHttpStatus = 'FETCH_FAILED';
    report.selfPostResponseType = 'FETCH_EXCEPTION';
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
      if (report.publicEndpointHttpStatus === 401 || report.publicEndpointHttpStatus === 403) {
        report.result = 'WEB_APP_ACCESS_REJECTED';
      } else {
        report.result = report.webhookRegistered
          ? (report.lastErrorMessage ? 'WEBHOOK_HAS_DELIVERY_ERROR' : 'WEBHOOK_REGISTERED')
          : 'WEBHOOK_NOT_REGISTERED';
      }
    }
  } catch (error) {
    report.result = 'DIAGNOSTIC_FAILED';
    report.error = String(error && error.message || error);
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}
