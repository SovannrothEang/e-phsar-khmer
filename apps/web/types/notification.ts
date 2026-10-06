/** Wire shape of one `notifications` row from `GET /api/v1/notifications`. */
export interface BackendNotification {
  id: string;
  /** Dotted namespace, e.g. `payment.succeeded`. */
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  /** ISO string; null until the row is first marked read. */
  readAt: string | null;
  createdAt: string;
}

/** One page of the feed, as `actions/notifications.ts` hands it to the UI. */
export interface NotificationPage {
  items: BackendNotification[];
  hasMore: boolean;
}
