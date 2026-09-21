import { ChefHat, CircleCheck, Clock, Phone } from "lucide-react-native";
import * as React from "react";
import { Alert, Linking, SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRealtimeEvent, useRestaurantRoom } from "@/components/providers";
import { VendorGate } from "@/components/shared/vendor-gate";
import { Button } from "@/components/ui/button";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import {
  useAcceptOrder,
  useMarkDelivered,
  useMarkPreparing,
  useMarkReady,
  useRejectOrder,
  useRestaurantOrders,
} from "@/hooks/use-vendor";
import { ApiError } from "@/lib/api-client";
import { formatPrice, formatRelative, hasText } from "@/lib/utils";
import { OrderStatus } from "@/types/enums";
import type { OrderDto } from "@/types/order";
import type { RestaurantAdminDto } from "@/types/restaurant";

/**
 * The live queue, grouped by what the kitchen has to do next.
 *
 * Three groups rather than one list, because in a kitchen they are three
 * different jobs done by different people at different moments: decide whether
 * to take it, cook it, hand it over. A single date-sorted list makes the cook
 * re-read every ticket to find the ones that are theirs.
 *
 * Every button is gated on `allowedTransitions` — the API's own answer for what
 * this order can do next, for this caller's role. Deriving the buttons from the
 * status here instead would be a second copy of the state machine, and the two
 * would disagree the first time a dispatcher moved an order by hand.
 */

const GROUPS: readonly { key: string; title: string; statuses: readonly OrderStatus[] }[] = [
  { key: "new", title: "New — waiting on you", statuses: [OrderStatus.PLACED] },
  {
    key: "cooking",
    title: "Cooking",
    statuses: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
  },
  { key: "ready", title: "Ready for pickup", statuses: [OrderStatus.READY_FOR_PICKUP] },
];

function Ticket({ order }: { order: OrderDto }) {
  const acceptOrder = useAcceptOrder();
  const rejectOrder = useRejectOrder();
  const markPreparing = useMarkPreparing();
  const markReady = useMarkReady();
  const markDelivered = useMarkDelivered();

  const busy =
    acceptOrder.isPending ||
    rejectOrder.isPending ||
    markPreparing.isPending ||
    markReady.isPending ||
    markDelivered.isPending;

  const onError = React.useCallback((error: unknown) => {
    toast.error(
      error instanceof ApiError ? error.message : "That didn't go through. Please try again.",
    );
  }, []);

  const can = (status: OrderStatus) => order.allowedTransitions.includes(status);

  const onReject = React.useCallback(() => {
    Alert.alert(
      `Reject ${order.orderNumber}?`,
      "The customer is told immediately and is not charged.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () =>
            rejectOrder.mutate(
              { id: order.id, data: { reason: "The restaurant could not accept this order" } },
              { onSuccess: () => toast.success("Order rejected"), onError },
            ),
        },
      ],
    );
  }, [order.id, order.orderNumber, rejectOrder, onError]);

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text
            className="font-display text-[17px] font-bold text-primary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {order.orderNumber}
          </Text>
          <View className="flex-row items-center gap-1">
            <Clock size={12} color="#75909F" />
            <Text className="font-sans text-[12px] text-muted">
              {formatRelative(order.placedAt ?? order.createdAt)}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text
            className="font-display text-[17px] font-extrabold text-primary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatPrice(order.totals.totalAmount)}
          </Text>
          {/*
            The customer paid the kitchen directly, so whether the money has
            arrived is the kitchen's business — and it is what decides whether
            they hand food over.
          */}
          <Badge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>
            {order.paymentStatus === "PAID" ? "Paid" : "Unpaid"}
          </Badge>
        </View>
      </View>

      <Divider />

      <View className="gap-1.5">
        {order.items.map((item) => (
          <View key={item.id} className="flex-row gap-2">
            <Text
              className="font-sans text-[15px] font-bold text-brand"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {item.quantity}×
            </Text>
            <View className="flex-1">
              <Text className="font-sans text-[15px] text-primary">{item.name}</Text>
              {hasText(item.variantName) ? (
                <Text className="font-sans text-[13px] text-secondary">{item.variantName}</Text>
              ) : null}
              {item.addOns.map((addOn, index) => (
                <Text key={`${item.id}-${index}`} className="font-sans text-[13px] text-secondary">
                  + {addOn.name}
                </Text>
              ))}
              {/*
                The kitchen note is the single most important line on a ticket
                and the easiest to miss, so it is coloured rather than muted.
              */}
              {hasText(item.notes) ? (
                <Text className="font-sans text-[13px] font-semibold text-accent-warm">
                  {item.notes}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {hasText(order.deliveryNotes) ? (
        <View className="rounded-input bg-surface-muted px-3 py-2">
          <Text className="font-sans text-[13px] text-secondary">{order.deliveryNotes}</Text>
        </View>
      ) : null}

      {order.driver !== null ? (
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 font-sans text-[13px] text-secondary">
            Rider: {order.driver.name}
          </Text>
          {hasText(order.driver.phone) ? (
            <Button
              size="sm"
              variant="ghost"
              accessibilityLabel={`Call ${order.driver.name}`}
              icon={<Phone size={14} color="#0E7490" />}
              onPress={() => {
                const phone = order.driver?.phone;
                if (!hasText(phone)) return;
                void Linking.openURL(`tel:${phone}`).catch(() =>
                  toast.error("Couldn't open the dialler", { description: phone }),
                );
              }}
            >
              Call
            </Button>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row gap-2">
        {can(OrderStatus.REJECTED) ? (
          <Button
            variant="outline"
            className="flex-1"
            onPress={onReject}
            loading={rejectOrder.isPending}
            disabled={busy}
          >
            Reject
          </Button>
        ) : null}

        {can(OrderStatus.CONFIRMED) ? (
          <Button
            className="flex-1"
            onPress={() =>
              acceptOrder.mutate(order.id, {
                onSuccess: () => toast.success(`${order.orderNumber} accepted`),
                onError,
              })
            }
            loading={acceptOrder.isPending}
            disabled={busy}
          >
            Accept
          </Button>
        ) : null}

        {can(OrderStatus.PREPARING) ? (
          <Button
            className="flex-1"
            icon={<ChefHat size={15} color="#04202B" />}
            onPress={() =>
              markPreparing.mutate(order.id, {
                onSuccess: () => toast.success("Marked as cooking"),
                onError,
              })
            }
            loading={markPreparing.isPending}
            disabled={busy}
          >
            Start cooking
          </Button>
        ) : null}

        {can(OrderStatus.READY_FOR_PICKUP) ? (
          <Button
            className="flex-1"
            icon={<CircleCheck size={15} color="#04202B" />}
            onPress={() =>
              markReady.mutate(order.id, {
                onSuccess: () => toast.success("Marked ready — the rider is told"),
                onError,
              })
            }
            loading={markReady.isPending}
            disabled={busy}
          >
            Ready
          </Button>
        ) : null}

        {/*
          Only offered where the API allows it — a vendor who delivers
          themselves has no rider to confirm a code, so they close the order out.
        */}
        {can(OrderStatus.DELIVERED) ? (
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() =>
              markDelivered.mutate(order.id, {
                onSuccess: () => toast.success("Marked delivered"),
                onError,
              })
            }
            loading={markDelivered.isPending}
            disabled={busy}
          >
            Delivered
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

function VendorOrders({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const insets = useSafeAreaInsets();
  const orders = useRestaurantOrders(restaurant.id, { limit: 100 });

  useRestaurantRoom(restaurant.id);

  /**
   * Both kitchen events refresh the queue.
   *
   * `useRestaurantOrders` also polls every fifteen seconds as a floor under
   * this. That redundancy is deliberate on the one screen a kitchen leaves open
   * all day: a silently dead socket here means orders going uncooked.
   */
  const refetch = React.useCallback(() => {
    void orders.refetch();
  }, [orders]);

  useRealtimeEvent("restaurant:order", refetch);
  useRealtimeEvent("restaurant:order-updated", refetch);

  const all = orders.data?.items ?? [];

  const sections = React.useMemo(
    () =>
      GROUPS.map((group) => ({
        title: group.title,
        data: all
          .filter((order) => group.statuses.includes(order.status))
          // Oldest first inside a group: the ticket that has been waiting
          // longest is the one to deal with next.
          .sort(
            (left, right) =>
              new Date(left.placedAt ?? left.createdAt).getTime() -
              new Date(right.placedAt ?? right.createdAt).getTime(),
          ),
      })).filter((section) => section.data.length > 0),
    [all],
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-2">
        <Heading level={2}>Orders</Heading>
        {!restaurant.isAcceptingOrders ? (
          <Body muted className="text-[13px]">
            You are paused — no new orders will arrive until you switch back on.
          </Body>
        ) : null}
      </View>

      {orders.isPending ? (
        <LoadingState label="Loading the queue…" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={refetch} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(order) => order.id}
          stickySectionHeadersEnabled
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={orders.isRefetching}
          onRefresh={refetch}
          renderSectionHeader={({ section }) => (
            <View className="bg-canvas py-1.5">
              <Text className="font-display text-[14px] font-bold uppercase tracking-wide text-secondary">
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <Ticket order={item} />}
          ListEmptyComponent={
            <EmptyState
              title="Nothing in the queue"
              description="New orders appear here the moment they come in."
            />
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return <VendorGate>{(restaurant) => <VendorOrders restaurant={restaurant} />}</VendorGate>;
}
