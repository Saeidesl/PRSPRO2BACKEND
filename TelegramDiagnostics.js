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
  // Inspect the endpoint without following redirects so Google sign-in redirects are visible.
  function inspectEndpoint_(method, payload) {
    const url = webAppUrl + (webAppUrl.indexOf('?') >= 0 ? '&' : '?') +
      'telegramSecret=' + encodeURIComponent(String(props.getProperty('TELEGRAM_WEBHOOK_SECRET') || ''));
    const options = {
      method: method,
      followRedirects: false,
      muteHttpExceptions: true
    };
    if (method === 'post') {
      options.contentType = 'application/json';
      options.payload = JSON.stringify(payload || { update_id: 0 });
    }
    const response = UrlFetchApp.fetch(url, options);
    const headers = response.getAllHeaders ? response.getAllHeaders() : {};
    const location = String(headers.Location || headers.location || '');
    const body = String(response.getContentText() || '').slice(0, 500);
    return {
      status: response.getResponseCode(),
      redirectType: /accounts\\.google|ServiceLogin|signin/i.test(location)
        ? 'GOOGLE_SIGN_IN_REDIRECT'
        : (location ? 'OTHER_REDIRECT' : 'NO_REDIRECT'),
      contentType: String(headers['Content-Type'] || headers['content-type'] || ''),
      bodyType: /"ok"\\s*:\\s*true/.test(body)
        ? 'WEBHOOK_HANDLER_OK'
        : /"ok"\\s*:\\s*false/.test(body)
          ? 'WEBHOOK_HANDLER_REJECTED'
          : /accounts\\.google|ServiceLogin|Sign in/i.test(body)
            ? 'GOOGLE_AUTH_PAGE'
            : 'NON_JSON_OR_OTHER_RESPONSE'
    };
  }
  try {
    const getCheck = inspectEndpoint_('get');
    report.publicEndpointHttpStatus = getCheck.status;
    report.getRedirectType = getCheck.redirectType;
    report.getContentType = getCheck.contentType;
  } catch (error) {
    report.publicEndpointHttpStatus = 'FETCH_FAILED';
    report.endpointError = String(error && error.message || error);
  }
  try {
    const postCheck = inspectEndpoint_('post', { update_id: 0 });
    report.selfPostHttpStatus = postCheck.status;
    report.selfPostRedirectType = postCheck.redirectType;
    report.selfPostContentType = postCheck.contentType;
    report.selfPostResponseType = postCheck.bodyType;
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
