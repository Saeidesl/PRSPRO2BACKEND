'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadService(options = {}) {
  const props = Object.assign({
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    TELEGRAM_TENANT_CHAT_IDS: '{}'
  }, options.properties || {});
  const sent = [];
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => props[key] || '' }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    },
    UrlFetchApp: { fetch: (url, options) => {
      sent.push({ url, options });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ ok: true }) };
    } },
    console: { warn() {} },
    JSON, String, Object, Array, RegExp
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'TelegramBotService.js'), 'utf8');
  vm.runInNewContext(source + '\nthis.__service = TelegramBotService;', context);
  return { service: context.__service, sent };
}

test('rejects webhook calls without the configured secret', () => {
  const h = loadService();
  const response = h.service.handleWebhook({ parameter: { telegramSecret: 'wrong' }, postData: { contents: '{}' } });
  assert.deepEqual(JSON.parse(response.text), { ok: false });
  assert.equal(h.sent.length, 0);
});

test('returns the chat ID but does not auto-subscribe arbitrary chats', () => {
  const h = loadService({ properties: { TELEGRAM_BOT_TOKEN: 'fake-token' } });
  h.service.handleWebhook({
    parameter: { telegramSecret: 'test-secret' },
    postData: { contents: JSON.stringify({ message: { chat: { id: 12345 }, from: { first_name: 'Test' }, text: '/start' } }) }
  });
  assert.equal(h.sent.length, 1);
  const payload = JSON.parse(h.sent[0].options.payload);
  assert.equal(payload.chat_id, '12345');
  assert.match(payload.text, /12345/);
  assert.match(payload.text, /مدیر سامانه/);
});

test('sends event notices only to chat IDs mapped to the event tenant', () => {
  const h = loadService({ properties: {
    TELEGRAM_BOT_TOKEN: 'fake-token',
    TELEGRAM_TENANT_CHAT_IDS: JSON.stringify({ T1: ['111', '222'], T2: ['333'] })
  } });
  const result = h.service.notifyEvent(
    { Description: 'شروع دوخت', OccurredAt: '2026-01-01' },
    { ID: 'P1', TenantID: 'T1', ProjectCode: 'P-01', Title: 'نمونه', NotifyEnabled: true },
    { Name: 'شروع دوخت' }, { Name: 'دوخت' }, { Name: 'کاربر' }, 'T1'
  );
  assert.equal(result.sent, 2);
  assert.equal(h.sent.length, 2);
  assert.ok(h.sent.every((call) => {
    const payload = JSON.parse(call.options.payload);
    return ['111', '222'].includes(payload.chat_id);
  }));
});

test('does not send notices when project notifications are disabled', () => {
  const h = loadService({ properties: {
    TELEGRAM_BOT_TOKEN: 'fake-token',
    TELEGRAM_TENANT_CHAT_IDS: JSON.stringify({ T1: ['111'] })
  } });
  const result = h.service.notifyEvent(
    {}, { NotifyEnabled: false }, { Name: 'Test' }, {}, {}, 'T1'
  );
  assert.equal(result.sent, 0);
  assert.equal(h.sent.length, 0);
});
