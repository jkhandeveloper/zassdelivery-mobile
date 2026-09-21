import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRealtimeEvent } from "@/components/providers";
import { RequireAuth } from "@/components/shared/role-guard";
import { Badge, Card, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useOrders } from "@/hooks/use-orders";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { OrderStatus } from "@/types/enums";
import type { OrderDto } from "@/types/order";

/**
 * Active orders, then everything before them.
 *
 * Split rather than one date-sorted list because the two have different jobs: an
 * active order is something the customer is *waiting on* and wants to open, and
 * a past one is a record they might reorder from. A single list buries a live
 * delivery under yesterday's receipt as soon as the day turns over.
 */

/** Statuses that mean the order is still moving. */
const ACTIVE: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
];

function statusTone(status: OrderStatus): "brand" | "success" | "danger" | "neutral" {
  if (ACTIVE.includes(status)) {
    return "brand";
  }

  if (status === OrderStatus.DELIVERED) {
    return "success";
  }

  if (
    status === OrderStatus.CANCELLED ||
    status === OrderStatus.REJECTED ||
    status === OrderStatus.FAILED
  ) {
    return "danger";
  }

  return "neutral";
}

function OrderRow({ order }: { order: OrderDto }) {
  const isActive = ACTIVE.includes(order.status);

  return (
    <Link href={`/orders/${order.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Order ${order.orderNumber}, ${order.statusText}`}
      >
        <Card className="gap-1.5">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text numberOfLines={1} className="font-sans text-[15px] font-semibold text-primary">
                {order.restaurant.name}
              </Text>
              <Text
                className="font-sans text-[12px] text-muted"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {order.orderNumber}
              </Text>
            </View>
            <Badge tone={statusTone(order.status)}>{order.statusText}</Badge>
          </View>

          <Text numberOfLines={1} className="font-sans text-[13px] text-secondary">
            {order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
          </Text>

          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-[12px] text-muted">
              {formatDateTime(order.placedAt ?? order.createdAt)}
            </Text>
            <Text
              className="font-sans text-[15px] font-semibold text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(order.totals.totalAmount)}
            </Text>
          </View>

          {/*
            "Track" only on something still moving. On a delivered order it
            would open a map of a journey that finished yesterday.
          */}
          {isActive ? (
            <View className="mt-0.5 flex-row items-center gap-0.5">
              <Text className="font-sans text-[13px] font-semibold text-brand">Track order</Text>
              <ChevronRight size={15} color="#0E7490" />
            </View>
          ) : null}
        </Card>
      </Pressable>
    </Link>
  );
}

function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const orders = useOrders({ limit: 50, sortBy: "createdAt", sortOrder: "desc" });

  /**
   * Any status change refreshes the list.
   *
   * `order:status` reaches the customer's own user room, which the server joins
   * them to unasked — so this works without subscribing to each order
   * individually, and is the only signal a screen not watching a specific order
   * would otherwise get.
   */
  useRealtimeEvent(
    "order:status",
    React.useCallback(() => {
      void orders.refetch();
    }, [orders]),
  );

  const all = orders.data?.items ?? [];
  const active = all.filter((order) => ACTIVE.includes(order.status));
  const past = all.filter((order) => !ACTIVE.includes(order.status));

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-2">
        <Heading level={2}>Your orders</Heading>
      </View>

      {orders.isPending ? (
        <LoadingState label="Loading your orders…" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : (
        <FlatList
          data={past}
          keyExtractor={(order) => order.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={orders.isRefetching}
          onRefresh={() => void orders.refetch()}
          ListHeaderComponent={
            active.length > 0 ? (
              <View className="gap-3 pb-2">
                <Text className="font-display text-[15px] font-bold uppercase tracking-wide text-secondary">
                  On the way
                </Text>
                {active.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
                {past.length > 0 ? (
                  <Text className="mt-2 font-display text-[15px] font-bold uppercase tracking-wide text-secondary">
                    Previously
                  </Text>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }) => <OrderRow order={item} />}
          ListEmptyComponent={
            active.length === 0 ? (
              <EmptyState
                title="No orders yet"
                description="Once you order something, you'll be able to track it here."
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <OrdersScreen />
    </RequireAuth>
  );
}
