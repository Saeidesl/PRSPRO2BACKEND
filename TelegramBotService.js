/**
 * Telegram Bot integration for PMS.
 *
 * Script Properties required:
 * TELEGRAM_BOT_TOKEN: token from BotFather (never commit it).
 * TELEGRAM_WEBHOOK_SECRET: long random secret used in the webhook URL.
 * TELEGRAM_TENANT_CHAT_IDS: JSON object mapping TenantID to an array of chat IDs,
 * e.g. {"TENANT_ID":["123456789"]}. Only configured chats receive project notifications.
 */
const TelegramBotService = {
  _properties_: function() {
    return PropertiesService.getScriptProperties();
  },

  _getToken_: function() {
    return String(this._properties_().getProperty('TELEGRAM_BOT_TOKEN') || '').trim();
  },

  _getWebhookSecret_: function() {
    return String(this._properties_().getProperty('TELEGRAM_WEBHOOK_SECRET') || '').trim();
  },

  _json_: function(value) {
    return ContentService.createTextOutput(JSON.stringify(value))
      .setMimeType(ContentService.MimeType.JSON);
  },

  handleWebhook: function(e) {
    const suppliedSecret = String(e && e.parameter && e.parameter.telegramSecret || '');
    const expectedSecret = this._getWebhookSecret_();
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return this._json_({ ok: false });
    }

    let update;
    try {
      update = JSON.parse(String(e && e.postData && e.postData.contents || '{}'));
    } catch (error) {
      return this._json_({ ok: false });
    }

    const message = update && (update.message || update.edited_message);
    if (!message || !message.chat || !message.chat.id) {
      return this._json_({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text || '').trim();
    const firstName = String(message.from && message.from.first_name || 'دوست');

    // No automatic subscription: chat IDs must be explicitly allow-listed by a PMS administrator.
    if (/^\/(start|help)(@\w+)?$/i.test(text)) {
      this.sendMessage(chatId,
        'سلام ' + firstName + '، ربات اطلاع‌رسانی سامانه مدیریت تولید آماده است.\n' +
        'شناسه گفت‌وگوی شما: ' + chatId + '\n\n' +
        'برای دریافت اعلان‌ها، مدیر سامانه باید این شناسه را در تنظیمات امن بک‌اند و زیر Tenant مربوط ثبت کند.\n' +
        'فرمان‌ها: /chatid ، /help');
    } else if (/^\/chatid(@\w+)?$/i.test(text)) {
      this.sendMessage(chatId, 'شناسه گفت‌وگوی شما: ' + chatId);
    } else {
      this.sendMessage(chatId, 'فرمان شناخته نشد. برای راهنما /help را بفرستید.');
    }

    return this._json_({ ok: true });
  },

  sendMessage: function(chatId, text) {
    const token = this._getToken_();
    if (!token || !chatId) return { ok: false, reason: 'NOT_CONFIGURED' };

    const response = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + token + '/sendMessage',
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: String(chatId),
          text: String(text || '').slice(0, 4000),
          disable_web_page_preview: true
        }),
        muteHttpExceptions: true
      }
    );

    const code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      console.warn('Telegram sendMessage failed with HTTP ' + code);
      return { ok: false, reason: 'HTTP_' + code };
    }
    let result;
    try { result = JSON.parse(response.getContentText()); } catch (error) { result = null; }
    return result && result.ok ? { ok: true } : { ok: false, reason: 'TELEGRAM_REJECTED' };
  },

  notifyEvent: function(event, project, eventType, department, performedUser, tenantId) {
    if (!event || !tenantId || !project) return { sent: 0, status: 'NOT_APPLICABLE' };
    if (String(project.NotifyEnabled).toLowerCase() === 'false' ||
        String(project.NotifyEnabled) === '0') {
      return { sent: 0, status: 'PROJECT_NOTIFICATIONS_DISABLED' };
    }

    const props = this._properties_();
    let mapping;
    try { mapping = JSON.parse(props.getProperty('TELEGRAM_TENANT_CHAT_IDS') || '{}'); }
    catch (error) { return { sent: 0, status: 'INVALID_CHAT_MAPPING' }; }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      return { sent: 0, status: 'INVALID_CHAT_MAPPING' };
    }

    const recipients = Array.isArray(mapping[String(tenantId)])
      ? mapping[String(tenantId)].map(String).filter(Boolean)
      : [];
    if (!recipients.length || !this._getToken_()) {
      return { sent: 0, status: 'NOT_CONFIGURED' };
    }

    const projectCode = String(project.ProjectCode || project.ID || '-');
    const projectTitle = String(project.Title || project.Name || '');
    const eventName = String(eventType && (eventType.Name || eventType.Code) || 'رویداد');
    const departmentName = String(department && (department.Name || department.Code) || '');
    const performerName = String(performedUser && (performedUser.Name || performedUser.Username) || '');
    const description = String(event.Description || '').trim();
    const text = [
      '🔔 ثبت رویداد جدید در سامانه مدیریت تولید',
      'پروژه: ' + projectCode + (projectTitle ? ' — ' + projectTitle : ''),
      'رویداد: ' + eventName,
      departmentName ? 'واحد: ' + departmentName : '',
      performerName ? 'ثبت‌کننده/انجام‌دهنده: ' + performerName : '',
      event.OccurredAt ? 'زمان: ' + event.OccurredAt : '',
      description ? 'توضیحات: ' + description : ''
    ].filter(Boolean).join('\n');

    let sent = 0;
    recipients.forEach(function(chatId) {
      try {
        if (TelegramBotService.sendMessage(chatId, text).ok) sent += 1;
      } catch (error) {
        console.warn('Telegram notification failed: ' + String(error && error.message || error));
      }
    });
    return { sent: sent, status: sent ? 'SENT' : 'FAILED' };
  },

  setWebhook: function() {
    const token = this._getToken_();
    const secret = this._getWebhookSecret_();
    const url = ScriptApp.getService().getUrl();
    if (!token || !secret || !url) {
      throw new Error('برای راه‌اندازی وب‌هوک، TELEGRAM_BOT_TOKEN و TELEGRAM_WEBHOOK_SECRET را در Script Properties تنظیم و اسکریپت را به‌عنوان Web App منتشر کنید.');
    }
    const webhookUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') +
      'telegramSecret=' + encodeURIComponent(secret);
    const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText() || '{}');
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !result.ok) {
      throw new Error('ثبت وب‌هوک تلگرام ناموفق بود؛ تنظیمات توکن و آدرس Web App را بررسی کنید.');
    }
    return { ok: true, description: result.description || 'Webhook configured' };
  },

  getWebhookInfo: function() {
    const token = this._getToken_();
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN تنظیم نشده است.');
    const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getWebhookInfo', {
      muteHttpExceptions: true
    });
    return JSON.parse(response.getContentText() || '{}');
  }
};
