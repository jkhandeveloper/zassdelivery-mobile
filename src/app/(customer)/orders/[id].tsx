import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Phone, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RequireAuth } from "@/components/shared/role-guard";
import { DeliveryMap } from "@/components/shared/delivery-map";
import { OrderStatusSteps } from "@/components/shared/order-status-steps";
import { Button } from "@/components/ui/button";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useCancelOrder, useOrder } from "@/hooks/use-orders";
import { useOrderTracking } from "@/hooks/use-order-tracking";
import { ApiError } from "@/lib/api-client";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { formatDateTime, formatPrice, hasText } from "@/lib/utils";
import { OrderStatus } from "@/types/enums";

/**
 * Live order tracking.
 *
 * Two sources, deliberately: the socket for anything that moves (status, the
 * rider, their position) and REST for everything that does not (items, totals,
 * the address). The socket is the source of truth for progress because the
 * whole point of this screen is a marker that slides across a map — polling
 * would render a delivery as a series of teleports — while the REST order is
 * simply re-fetched whenever the status moves, which is the only moment its
 * content can have changed.
 *
 * Where the two disagree, the socket wins: it is strictly fresher.
 */

/** "Arriving by 7:45 pm", or the minutes left once it is close. */
function useEta(estimatedDeliveryAt: string | null): string | null {
  /**
   * The clock, as state rather than a `Date.now()` read during render.
   *
   * Two reasons and both matter: reading the wall clock while rendering is an
   * impure render, which the React Compiler refuses to compile, and a component
   * whose output depends on an untracked clock cannot be told when to update.
   * Ticking it is what makes "in 12 min" count down instead of sitting there.
   */
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (estimatedDeliveryAt === null) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => clearInterval(timer);
  }, [estimatedDeliveryAt]);

  if (estimatedDeliveryAt === null) {
    return null;
  }

  const target = new Date(estimatedDeliveryAt).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  const minutes = Math.round((target - now) / 60_000);

  // Past the estimate is the case that most needs honest copy: claiming
  // "in -3 min" or silently showing the old time is worse than admitting it.
  if (minutes <= 0) {
    return "Arriving any moment";
  }

  if (minutes <= 45) {
    return `Arriving in about ${minutes} min`;
  }

  return `Arriving by ${new Intl.DateTimeFormat("en-PK", {
    hour: "numeric",
    minute: "2-digit",
  }).format(target)}`;
}

function TrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderId = typeof id === "string" ? id : null;

  const order = useOrder(orderId ?? "", orderId !== null);
  const tracking = useOrderTracking(orderId);
  const cancelOrder = useCancelOrder(orderId ?? "");

  // The socket is fresher, so it wins wherever both have an answer.
  const status = tracking.status ?? order.data?.status ?? null;
  const statusText = tracking.statusText ?? order.data?.statusText ?? null;
  const estimatedDeliveryAt = tracking.estimatedDeliveryAt ?? order.data?.estimatedDeliveryAt ?? null;

  const eta = useEta(estimatedDeliveryAt);

  const isMoving =
    status === OrderStatus.PICKED_UP || status === OrderStatus.ON_THE_WAY;

  const isFinished =
    status === OrderStatus.DELIVERED ||
    status === OrderStatus.CANCELLED ||
    status === OrderStatus.REJECTED ||
    status === OrderStatus.FAILED;

  const rider = tracking.rider ?? order.data?.driver ?? null;
  const riderPhone = rider !== null && "phone" in rider ? rider.phone : null;

  const onCall = React.useCallback(() => {
    if (!hasText(riderPhone)) {
      return;
    }

    void Linking.openURL(`tel:${riderPhone}`).catch(() => {
      toast.error("Couldn't open the dialler", { description: riderPhone });
    });
  }, [riderPhone]);

  const onCancel = React.useCallback(() => {
    Alert.alert(
      "Cancel this order?",
      "The restaurant will be told. This cannot be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: () => {
            cancelOrder.mutate(
              { reason: "Cancelled by customer from the app" },
              {
                onSuccess: () => toast.success("Order cancelled"),
                onError: (error) =>
                  toast.error(
                    error instanceof ApiError
                      ? error.message
                      : "We couldn't cancel that. Please try again.",
                  ),
              },
            );
          },
        },
      ],
    );
  }, [cancelOrder]);

  if (orderId === null) {
    return <ErrorState error={new Error("No order was named.")} />;
  }

  if (order.isPending) {
    return <LoadingState label="Loading your order…" />;
  }

  if (order.isError) {
    return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  }

  const data = order.data;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/orders"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text
          className="font-display text-[17px] font-bold text-primary"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          Order {data.orderNumber}
        </Text>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8">
        {/*
          The distinction that matters most on this screen: a rider who has not
          moved and a connection that is not delivering updates look identical
          otherwise, and the second is the one where the map is lying.
        */}
        {tracking.connection !== "connected" && !isFinished ? (
          <View
            accessibilityRole="alert"
            className="flex-row items-center gap-2 rounded-input border border-warning bg-warning-soft px-3 py-2.5"
          >
            <WifiOff size={16} color="#B45309" />
            <Text className="flex-1 font-sans text-[13px] font-medium text-warning">
              {tracking.connection === "offline"
                ? "Not receiving live updates. Check your connection."
                : "Reconnecting to live updates…"}
            </Text>
          </View>
        ) : null}

        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Heading level={2} className="flex-1">
              {statusText ?? "Your order"}
            </Heading>
            {isMoving ? <Badge tone="brand">Live</Badge> : null}
          </View>

          {eta !== null && !isFinished ? (
            <Body muted style={{ fontVariant: ["tabular-nums"] }}>
              {eta}
            </Body>
          ) : null}

          {status === OrderStatus.DELIVERED && data.deliveredAt !== null ? (
            <Body muted>Delivered {formatDateTime(data.deliveredAt)}</Body>
          ) : null}
        </View>

        {/*
          The map is only worth its screen space while something is moving. A
          delivered order's last known rider position is noise, and a
          not-yet-confirmed order has no rider to show.
        */}
        {!isFinished ? (
          <DeliveryMap
            pickup={tracking.pickup}
            destination={tracking.destination}
            rider={
              tracking.riderLocation !== null
                ? {
                    latitude: tracking.riderLocation.latitude,
                    longitude: tracking.riderLocation.longitude,
                  }
                : null
            }
            restaurantName={data.restaurant.name}
            distanceKm={tracking.riderLocation?.distanceKm ?? null}
          />
        ) : null}

        {rider !== null ? (
          <Card className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-violet-soft">
              <Text className="font-display text-[16px] font-bold text-accent-violet">
                {rider.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View className="flex-1">
              <Text className="font-sans text-[15px] font-semibold text-primary">
                {rider.name}
              </Text>
              <Text className="font-sans text-[13px] text-secondary">
                {tracking.riderLocation?.distanceKm !== null &&
                tracking.riderLocation?.distanceKm !== undefined
                  ? `${tracking.riderLocation.distanceKm.toFixed(1)} km away`
                  : "Your rider"}
              </Text>
            </View>

            {hasText(riderPhone) && !isFinished ? (
              <Button
                variant="outline"
                size="sm"
                onPress={onCall}
                icon={<Phone size={16} color="#0E7490" />}
                accessibilityLabel={`Call ${rider.name}`}
              >
                Call
              </Button>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <OrderStatusSteps status={status} timeline={data.timeline} />
        </Card>

        <Card className="gap-3">
          <Text className="font-display text-[16px] font-bold text-primary">
            {data.restaurant.name}
          </Text>

          {data.items.map((item) => (
            <View key={item.id} className="flex-row gap-2">
              <Text
                className="font-sans text-[14px] font-semibold text-secondary"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {item.quantity}×
              </Text>
              <View className="flex-1">
                <Text className="font-sans text-[14px] text-primary">{item.name}</Text>
                {hasText(item.variantName) ? (
                  <Text className="font-sans text-[12px] text-muted">{item.variantName}</Text>
                ) : null}
                {item.addOns.map((addOn, index) => (
                  <Text key={`${item.id}-${index}`} className="font-sans text-[12px] text-muted">
                    + {addOn.name}
                  </Text>
                ))}
                {hasText(item.notes) ? (
                  <Text className="font-sans text-[12px] italic text-muted">{item.notes}</Text>
                ) : null}
              </View>
              <Text
                className="font-sans text-[14px] text-primary"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(item.lineTotal)}
              </Text>
            </View>
          ))}

          <Divider />

          <TotalRow label="Subtotal" value={data.totals.subtotal} />
          {data.totals.discountAmount > 0 ? (
            <TotalRow
              label={hasText(data.couponCode) ? `Discount (${data.couponCode})` : "Discount"}
              value={-data.totals.discountAmount}
            />
          ) : null}
          <TotalRow label="Delivery" value={data.totals.deliveryFee} />
          {data.totals.serviceFee > 0 ? (
            <TotalRow label="Service fee" value={data.totals.serviceFee} />
          ) : null}
          {data.totals.taxAmount > 0 ? (
            <TotalRow label="Tax" value={data.totals.taxAmount} />
          ) : null}
          {data.totals.tipAmount > 0 ? (
            <TotalRow label="Rider tip" value={data.totals.tipAmount} />
          ) : null}

          <Divider />

          <View className="flex-row items-center justify-between">
            <Text className="font-display text-[16px] font-bold text-primary">Total</Text>
            <Text
              className="font-display text-[16px] font-bold text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(data.totals.totalAmount)}
            </Text>
          </View>

          <Text className="font-sans text-[12px] text-muted">
            {PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod}
          </Text>
        </Card>

        <Card className="gap-1">
          <Text className="font-sans text-[13px] font-semibold text-secondary">
            Delivering to
          </Text>
          <Text className="font-sans text-[14px] text-primary">{data.deliveryAddress}</Text>
          {hasText(data.deliveryLandmark) ? (
            <Text className="font-sans text-[13px] text-muted">{data.deliveryLandmark}</Text>
          ) : null}
          {hasText(data.deliveryNotes) ? (
            <Text className="font-sans text-[13px] italic text-muted">{data.deliveryNotes}</Text>
          ) : null}
        </Card>

        {data.canCancel ? (
          <Button variant="outline" onPress={onCancel} loading={cancelOrder.isPending} fullWidth>
            Cancel order
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-sans text-[14px] text-secondary">{label}</Text>
      <Text
        className="font-sans text-[14px] text-secondary"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {formatPrice(value)}
      </Text>
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <TrackingScreen />
    </RequireAuth>
  );
}
