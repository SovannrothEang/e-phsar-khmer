import { useAuth } from "@/contexts/AuthContext";
import {
  deleteAllNotifications,
  deleteNotification as deleteNotificationRequest,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type BackendNotification,
} from "@/lib/api/notifications";
import { formatListingDate } from "@/lib/listings";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type NotificationCategory =
  | "message"
  | "price_drop"
  | "ad_status"
  | "promo"
  | "security";

export interface AppNotification {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  createdAt: string;
  itemImage?: string;
  actionText?: string;
  actionRoute?: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  priceDropAlerts: boolean;
  chatMessages: boolean;
  adStatusUpdates: boolean;
  promotionsAndDeals: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  priceDropAlerts: true,
  chatMessages: true,
  adStatusUpdates: true,
  promotionsAndDeals: true,
  soundEnabled: true,
  vibrateEnabled: true,
};

const PAGE_SIZE = 20;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatListingDate(iso);
}

function categoryFor(type: string): NotificationCategory {
  if (type.startsWith("follow.")) return "message";
  if (type.startsWith("listing.")) return "ad_status";
  if (type.startsWith("payment.") || type.startsWith("subscription.")) {
    return "promo";
  }
  return "security";
}

/**
 * The signed-in user's own ads, where a removed/inactive ad is still visible.
 * `?tab=all` because the screen defaults to the `active` tab, which would hide
 * exactly the ad the notice is about.
 */
const MY_ADS_ROUTE = "/account/my-ads?tab=all";

/**
 * A public product page 404s once the ad is gone, so the notices that mean
 * "this ad is no longer public" must land on My Ads instead. The countdown
 * notices still point at the (still public) ad.
 */
const MY_ADS_NOTICE_TYPES = [
  "listing.removed",
  "listing.inactivated",
  "listing.restricted",
];

function actionFor(
  type: string,
  data: Record<string, unknown>,
): { actionText?: string; actionRoute?: string } {
  const username = typeof data.username === "string" ? data.username : null;
  const listingId = typeof data.listingId === "string" ? data.listingId : null;

  if (type.startsWith("follow.") && username) {
    return {
      actionText: "View Profile",
      actionRoute: `/user/${encodeURIComponent(username)}`,
    };
  }
  if (MY_ADS_NOTICE_TYPES.includes(type)) {
    return { actionText: "View My Ads", actionRoute: MY_ADS_ROUTE };
  }
  if (type.startsWith("listing.") && listingId) {
    return { actionText: "View Ad", actionRoute: `/product/${listingId}` };
  }
  return {};
}

function toAppNotification(row: BackendNotification): AppNotification {
  const data = row.data ?? {};
  const imageUrl =
    typeof data.imageUrl === "string" ? data.imageUrl : undefined;

  return {
    id: row.id,
    type: row.type,
    category: categoryFor(row.type),
    title: row.title,
    description: row.body ?? "",
    timestamp: relativeTime(row.createdAt),
    isRead: row.isRead,
    createdAt: row.createdAt,
    itemImage: imageUrl,
    ...actionFor(row.type, data),
  };
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markMultipleAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteMultiple: (ids: string[]) => Promise<void>;
  clearAll: () => Promise<void>;
  preferences: NotificationPreferences;
  updatePreferences: (updates: Partial<NotificationPreferences>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [rows, setRows] = useState<BackendNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setRows([]);
      setUnreadCount(0);
      setHasMore(false);
      setPage(1);
      return;
    }

    setIsLoading(true);
    try {
      const [listing, unread] = await Promise.all([
        fetchNotifications(1, PAGE_SIZE),
        fetchUnreadCount(),
      ]);
      setRows(listing.items);
      setHasMore(listing.hasMore);
      setPage(1);
      setUnreadCount(unread);
    } catch {
      /* keep the last good list */
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    setIsLoading(true);
    try {
      const next = page + 1;
      const listing = await fetchNotifications(next, PAGE_SIZE);
      setRows((current) => [...current, ...listing.items]);
      setPage(next);
      setHasMore(listing.hasMore);
    } catch {
      /* keep the current page */
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, page]);

  const markAsRead = useCallback(
    async (id: string) => {
      const target = rows.find((row) => row.id === id);
      if (!target || target.isRead) return;

      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, isRead: true } : row)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));

      try {
        await markNotificationRead(id);
      } catch {
        await refresh();
      }
    },
    [rows, refresh],
  );

  const markMultipleAsRead = useCallback(
    async (ids: string[]) => {
      const unreadIds = ids.filter((id) =>
        rows.some((row) => row.id === id && !row.isRead),
      );
      if (unreadIds.length === 0) return;

      setRows((current) =>
        current.map((row) =>
          unreadIds.includes(row.id) ? { ...row, isRead: true } : row,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - unreadIds.length));

      const results = await Promise.all(
        unreadIds.map((id) =>
          markNotificationRead(id).then(
            () => true,
            () => false,
          ),
        ),
      );
      if (results.some((ok) => !ok)) await refresh();
    },
    [rows, refresh],
  );

  const markAllAsRead = useCallback(async () => {
    setRows((current) => current.map((row) => ({ ...row, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      await refresh();
    }
  }, [refresh]);

  const deleteNotification = useCallback(
    async (id: string) => {
      const target = rows.find((row) => row.id === id);
      setRows((current) => current.filter((row) => row.id !== id));
      if (target && !target.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      try {
        await deleteNotificationRequest(id);
      } catch {
        await refresh();
      }
    },
    [rows, refresh],
  );

  const deleteMultiple = useCallback(
    async (ids: string[]) => {
      const unreadIds = ids.filter((id) =>
        rows.some((row) => row.id === id && !row.isRead),
      );
      setRows((current) => current.filter((row) => !ids.includes(row.id)));
      setUnreadCount((count) => Math.max(0, count - unreadIds.length));

      const results = await Promise.all(
        ids.map((id) =>
          deleteNotificationRequest(id).then(
            () => true,
            () => false,
          ),
        ),
      );
      if (results.some((ok) => !ok)) await refresh();
    },
    [rows, refresh],
  );

  const clearAll = useCallback(async () => {
    setRows([]);
    setUnreadCount(0);
    setHasMore(false);
    try {
      await deleteAllNotifications();
    } catch {
      await refresh();
    }
  }, [refresh]);

  const updatePreferences = useCallback(
    (updates: Partial<NotificationPreferences>) => {
      setPreferences((current) => ({ ...current, ...updates }));
    },
    [],
  );

  const notifications = useMemo(() => rows.map(toAppNotification), [rows]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        hasMore,
        refresh,
        loadMore,
        markAsRead,
        markMultipleAsRead,
        markAllAsRead,
        deleteNotification,
        deleteMultiple,
        clearAll,
        preferences,
        updatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
};
