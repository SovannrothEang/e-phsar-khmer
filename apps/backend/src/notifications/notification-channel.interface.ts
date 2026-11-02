export const NOTIFICATION_CHANNELS = 'NOTIFICATION_CHANNELS';

/** What any producer (payment settlement today, others later) hands to `NotificationsService.notify()`. */
export interface NotificationPayload {
  userId: string;
  /** Dotted namespace, e.g. 'payment.succeeded' — mirrors `outbox_events.eventType`. */
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * One delivery channel. `InAppNotificationChannel` (the `notifications`
 * table + REST feed) is the durable record every notification gets and
 * `RealtimeNotificationChannel` is the best-effort WebSocket push — those two
 * are the array's contents today. Adding email or push later is adding another
 * class implementing this interface and listing it in
 * `NOTIFICATION_CHANNELS`' factory in `notifications.module.ts` — nothing
 * else in this module, or any caller of `NotificationsService.notify()`,
 * needs to change. SMS deliberately does NOT belong here: it is opt-in
 * (`data.sendSms`) and is delivered out-of-band through the transactional
 * outbox (`notifications/sms/SmsOutboxHandler`), never inline — see the
 * notifications section of ARCHITECTURE.md.
 */
export interface NotificationChannel {
  send(payload: NotificationPayload): Promise<void>;
}
