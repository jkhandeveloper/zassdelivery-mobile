import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationApi } from "@/lib/api/notifications";
import type { ListNotificationsQueryDto } from "@/types/notification";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (query: ListNotificationsQueryDto) => [...notificationKeys.all, "list", query] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

export function useNotifications(query?: ListNotificationsQueryDto, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(query ?? {}),
    queryFn: () => notificationApi.getNotifications(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * The bell badge. Cheap enough to keep warm — the API says as much — so it
 * refetches on focus rather than leaving a stale count on a tab left open.
 */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(),
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Every mutation below invalidates the whole notifications tree rather than
 * patching one page of one filter: a row that becomes read leaves the unread
 * list, changes the badge and stays put in the all list — three cached shapes
 * from one click, and only the server knows what page it lands on.
 */
function useNotificationMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkNotificationRead() {
  return useNotificationMutation((id: string) => notificationApi.markAsRead(id));
}

export function useMarkAllNotificationsRead() {
  return useNotificationMutation(() => notificationApi.markAllAsRead());
}

export function useDeleteNotification() {
  return useNotificationMutation((id: string) => notificationApi.deleteNotification(id));
}

/** Clears what has been read; unread notifications survive it. */
export function useClearReadNotifications() {
  return useNotificationMutation(() => notificationApi.deleteReadNotifications());
}
