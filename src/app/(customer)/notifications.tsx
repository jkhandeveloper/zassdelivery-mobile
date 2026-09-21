import { useRouter } from "expo-router";
import { CheckCheck, ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRealtimeEvent } from "@/components/providers";
import { RequireAuth } from "@/components/shared/role-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/hooks/use-notifications";
import { ApiError } from "@/lib/api-client";
import { cn, formatRelative } from "@/lib/utils";

/**
 * The notification history.
 *
 * Tapping one marks it read and, where the payload names an order, opens it —
 * which is what the notification was about in almost every case. A list that
 * only marks read makes the customer find the order themselves, having just
 * been told something about it.
 */

/** What the API puts in a notification's `data` for order events. */
interface OrderNotificationData {
  kind?: string;
  orderId?: string;
}

function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const notifications = useNotifications({ limit: 50 });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // A notification arriving while this screen is open should appear on it.
  useRealtimeEvent(
    "notification:new",
    React.useCallback(() => {
      void notifications.refetch();
      void unread.refetch();
    }, [notifications, unread]),
  );

  const onOpen = React.useCallback(
    (id: string, readAt: string | undefined, data: Record<string, unknown> | undefined) => {
      if (readAt === undefined) {
        markRead.mutate(id);
      }

      const payload = (data ?? {}) as OrderNotificationData;

      if (typeof payload.orderId === "string" && payload.orderId !== "") {
        router.push(`/orders/${payload.orderId}`);
      }
    },
    [markRead, router],
  );

  const unreadTotal = unread.data?.total ?? 0;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="flex-1 font-display text-[19px] font-bold text-primary">
          Notifications
        </Text>

        {unreadTotal > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            loading={markAllRead.isPending}
            icon={<CheckCheck size={16} color="#0E7490" />}
            onPress={() =>
              markAllRead.mutate(undefined, {
                onError: (error) =>
                  toast.error(
                    error instanceof ApiError ? error.message : "Couldn't mark those read.",
                  ),
              })
            }
          >
            Mark all read
          </Button>
        ) : null}
      </View>

      {notifications.isPending ? (
        <LoadingState />
      ) : notifications.isError ? (
        <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
      ) : (
        <FlatList
          data={notifications.data.items}
          keyExtractor={(entry) => entry.id}
          contentContainerClassName="gap-2 px-4 pb-8"
          refreshing={notifications.isRefetching}
          onRefresh={() => {
            void notifications.refetch();
            void unread.refetch();
          }}
          renderItem={({ item }) => {
            const isUnread = item.readAt === undefined;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.body}`}
                onPress={() => onOpen(item.id, item.readAt, item.data)}
              >
                <Card className={cn("gap-0.5", isUnread && "border-brand bg-brand-soft")}>
                  <View className="flex-row items-start gap-2">
                    {/* A dot rather than bold text: it survives long titles. */}
                    {isUnread ? (
                      <View className="mt-1.5 h-2 w-2 rounded-full bg-brand" />
                    ) : null}
                    <Text
                      className={cn(
                        "flex-1 font-sans text-[15px]",
                        isUnread ? "font-bold text-primary" : "font-semibold text-secondary",
                      )}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <Text className="font-sans text-[13px] text-secondary">{item.body}</Text>
                  <Text className="font-sans text-[12px] text-muted">
                    {formatRelative(item.createdAt)}
                  </Text>
                </Card>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet"
              description="Updates about your orders will show up here."
            />
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <NotificationsScreen />
    </RequireAuth>
  );
}
