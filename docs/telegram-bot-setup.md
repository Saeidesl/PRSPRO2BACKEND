# Telegram bot integration

This integration uses Google Apps Script Script Properties; bot tokens and recipient IDs must never be committed to Git.

## Configure securely
In the Apps Script project, open **Project Settings → Script Properties** and add:
- `TELEGRAM_BOT_TOKEN`: token from BotFather.
- `TELEGRAM_WEBHOOK_SECRET`: a long, random secret (at least 32 random characters).
- `TELEGRAM_TENANT_CHAT_IDS`: JSON object mapping the exact PMS TenantID to allowed chat IDs, for example `{"TENANT_ID":["123456789"]}`. Use the real TenantID and chat IDs; do not use this example literally.

After the backend source is synced to Apps Script and the Web App is deployed, run `TelegramBotService.setWebhook()` once from the Apps Script editor and authorize the requested scopes. Test the bot with `/start`; it replies with the chat ID. Add that ID to the mapping for the correct tenant, then save the Script Property. A chat is not automatically subscribed merely by sending /start.

## Current behavior
- Handles `/start`, `/help`, and `/chatid`.
- Keeps Telegram updates isolated from normal PMS API POST requests using a secret query parameter.
- Provides tenant-scoped project-event notifications through `TelegramBotService.notifyEvent(...)`.
- Respects the project's `NotifyEnabled` flag.
- Does not auto-subscribe users or broadcast across tenants.

## Notification hook
Call `TelegramBotService.notifyEvent(event, project, eventType, department, performedUser, user.TenantID)` only after a project event has been successfully persisted. The caller should wrap this call in try/catch so a Telegram outage never turns a successfully saved production event into an API failure.

## Verification
Run `node --test tests/telegram-bot-service.test.js` and the full backend test suite. Telegram delivery itself requires a configured bot token, deployed Web App URL, and authorized Script Properties; do not use production data for test messages.
