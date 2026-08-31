export const OUTBOX_WAKEUP_EVENT = 'outbox.wakeup';

export interface OutboxWakeupEvent {
  source: 'transaction' | 'retry' | 'startup';
}
