import { Navigation, Phone, Store } from "lucide-react-native";
import * as React from "react";
import { Linking, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RiderGate } from "@/components/shared/rider-gate";
import { Button } from "@/components/ui/button";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import {
  useConfirmDelivery,
  useIssueDeliveryCode,
  useMarkOnTheWay,
  useRiderDeliveries,
} from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { formatDateTime, formatPrice, hasText } from "@/lib/utils";
import { AssignmentStatus, OrderStatus } from "@/types/enums";
import type { AssignmentDto, RiderDto } from "@/types/rider";

/**
 * The active run, and the history behind it.
 *
 * The run is a sequence of steps the rider works through, and only the step
 * they are actually on is offered. That is the point: a screen showing
 * "Picked up", "On the way" and "Confirm delivery" as three live buttons
 * invites tapping them out of order, and the API rejects that — leaving the
 * rider with an error they cannot interpret while standing at a door.
 *
 * The order's own status drives which step is current, not local state, so the
 * screen is correct after a reconnect, an app restart, or a dispatcher moving
 * the order by hand.
 */

/** Opens the platform's maps app for turn-by-turn directions. */
function openDirections(latitude: number | null, longitude: number | null, label: string): void {
  if (latitude === null || longitude === null) {
    toast.error("No coordinates for that address", {
      description: "Call the customer for directions.",
    });
    return;
  }

  // Apple Maps on iOS, Google Maps on Android — the geo: scheme is honoured by
  // whatever the rider has set as their default, which is what they will be
  // fastest in.
  const url =
    Platform.OS === "ios"
      ? `maps://app?daddr=${latitude},${longitude}&dirflg=d`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(label)})`;

  void Linking.openURL(url).catch(() => {
    // Falling back to the web keeps this working on a device with no maps app
    // and inside an emulator without Play services.
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    ).catch(() => toast.error("Couldn't open a maps app."));
  });
}

function CallButton({ phone, label }: { phone: string | null; label: string }) {
  if (!hasText(phone)) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      accessibilityLabel={`Call ${label}`}
      icon={<Phone size={15} color="#0E7490" />}
      onPress={() => {
        void Linking.openURL(`tel:${phone}`).catch(() =>
          toast.error("Couldn't open the dialler", { description: phone }),
        );
      }}
    >
      Call
    </Button>
  );
}

/** The step the rider is on, derived from the order's status. */
function ActiveRun({ run }: { run: AssignmentDto }) {
  const markOnTheWay = useMarkOnTheWay();
  const issueCode = useIssueDeliveryCode();
  const confirmDelivery = useConfirmDelivery();

  const [code, setCode] = React.useState("");

  const order = run.order;
  const status = order.status;

  const onError = React.useCallback((error: unknown) => {
    toast.error(
      error instanceof ApiError ? error.message : "That didn't go through. Please try again.",
    );
  }, []);

  return (
    <Card className="gap-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Badge tone="brand">Active run</Badge>
          <Text
            className="mt-1.5 font-display text-[17px] font-bold text-primary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {order.orderNumber}
          </Text>
        </View>
        <Text
          className="font-display text-[17px] font-extrabold text-primary"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {formatPrice(run.estimatedEarning)}
        </Text>
      </View>

      <Divider />

      {/* Pick-up */}
      <View className="gap-1.5">
        <View className="flex-row items-center gap-2">
          <Store size={15} color="#D9480F" />
          <Text className="flex-1 font-sans text-[15px] font-semibold text-primary">
            {order.restaurantName}
          </Text>
        </View>
        <Text className="font-sans text-[13px] text-secondary">{order.restaurantAddress}</Text>
        <View className="mt-1 flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Navigation size={15} color="#0E7490" />}
            onPress={() =>
              openDirections(order.restaurantLat, order.restaurantLng, order.restaurantName)
            }
          >
            Directions
          </Button>
          <CallButton phone={order.restaurantPhone} label="the restaurant" />
        </View>
      </View>

      <Divider />

      {/* Drop-off */}
      <View className="gap-1.5">
        <Text className="font-sans text-[13px] font-semibold text-secondary">Deliver to</Text>
        <Text className="font-sans text-[15px] text-primary">{order.deliveryAddress}</Text>
        {hasText(order.deliveryLandmark) ? (
          <Text className="font-sans text-[13px] text-muted">{order.deliveryLandmark}</Text>
        ) : null}
        {hasText(order.deliveryNotes) ? (
          <Text className="font-sans text-[13px] italic text-muted">{order.deliveryNotes}</Text>
        ) : null}
        {hasText(order.customerName) ? (
          <Text className="font-sans text-[13px] text-secondary">{order.customerName}</Text>
        ) : null}
        <View className="mt-1 flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Navigation size={15} color="#0E7490" />}
            onPress={() => openDirections(order.deliveryLat, order.deliveryLng, "Customer")}
          >
            Directions
          </Button>
          <CallButton phone={order.customerPhone} label="the customer" />
        </View>
      </View>

      {order.cashToCollect > 0 ? (
        <View className="rounded-input bg-warning-soft px-3 py-2.5">
          <Text className="font-sans text-[14px] font-semibold text-warning">
            Collect {formatPrice(order.cashToCollect)} in cash at the door
          </Text>
        </View>
      ) : null}

      <Divider />

      {/*
        One step at a time, chosen by the order's status — the same sequence
        as the web app's delivery panel, because the API enforces it:

        READY_FOR_PICKUP → "I've collected it". POST …/pickup moves the order
          to PICKED_UP *and* texts the customer their four-digit code.
        PICKED_UP → mark the leg to the customer.
        ON_THE_WAY → at the door; take the code and confirm with it.
        CONFIRMED / PREPARING → nothing to do but wait for the kitchen.
      */}
      {status === OrderStatus.READY_FOR_PICKUP ? (
        <View className="gap-2">
          <Body muted className="text-[13px]">
            At the restaurant? Confirming pickup sends the customer a four-digit code you&apos;ll
            need at the door.
          </Body>
          <Button
            fullWidth
            loading={issueCode.isPending}
            onPress={() =>
              issueCode.mutate(order.id, {
                onSuccess: (result) =>
                  toast.success("Order collected", {
                    description: result.codeSent
                      ? "The customer has their delivery code."
                      : "Ask the customer for their code at the door.",
                  }),
                onError,
              })
            }
          >
            I&apos;ve collected the order
          </Button>
        </View>
      ) : status === OrderStatus.PICKED_UP ? (
        <Button
          fullWidth
          loading={markOnTheWay.isPending}
          onPress={() =>
            markOnTheWay.mutate(order.id, {
              onSuccess: () => toast.success("Marked on the way"),
              onError,
            })
          }
        >
          I&apos;m on the way
        </Button>
      ) : status === OrderStatus.ON_THE_WAY ? (
        <View className="gap-2">
          <Body muted className="text-[13px]">
            At the door? Ask the customer for the four digits we sent them.
          </Body>
          <Input
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000"
            keyboardType="number-pad"
            maxLength={4}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            accessibilityLabel="Delivery code"
          />
          <Button
            fullWidth
            disabled={code.length !== 4}
            loading={confirmDelivery.isPending}
            onPress={() =>
              confirmDelivery.mutate(
                { orderId: order.id, data: { code } },
                {
                  onSuccess: (result) => {
                    setCode("");
                    toast.success("Delivered", {
                      description: `You earned ${formatPrice(result.earned)}`,
                    });
                  },
                  onError,
                },
              )
            }
          >
            Confirm delivery
          </Button>
        </View>
      ) : (
        <Body muted className="text-[13px]">
          Waiting on the restaurant. The next step appears once the food is ready to collect.
        </Body>
      )}
    </Card>
  );
}

function HistoryRow({ run }: { run: AssignmentDto }) {
  return (
    <Card className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text
          className="font-sans text-[14px] font-semibold text-primary"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {run.order.orderNumber}
        </Text>
        <Text
          className="font-sans text-[14px] font-semibold text-success"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {formatPrice(run.estimatedEarning)}
        </Text>
      </View>
      <Text numberOfLines={1} className="font-sans text-[13px] text-secondary">
        {run.order.restaurantName}
      </Text>
      <Text className="font-sans text-[12px] text-muted">
        {formatDateTime(run.completedAt ?? run.respondedAt ?? run.offeredAt)}
      </Text>
    </Card>
  );
}

function RiderDeliveries({ rider: _rider }: { rider: RiderDto }) {
  const insets = useSafeAreaInsets();

  const active = useRiderDeliveries({ status: AssignmentStatus.ACCEPTED, limit: 1 });
  const history = useRiderDeliveries({
    status: AssignmentStatus.COMPLETED,
    limit: 20,
    sortBy: "completedAt",
    sortOrder: "desc",
  });

  const run = active.data?.items[0] ?? null;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={active.isRefetching || history.isRefetching}
            onRefresh={() => {
              void active.refetch();
              void history.refetch();
            }}
          />
        }
      >
        <Heading level={2} className="pt-2">
          Deliveries
        </Heading>

        {active.isPending ? (
          <LoadingState label="Checking your run…" />
        ) : active.isError ? (
          <ErrorState error={active.error} onRetry={() => void active.refetch()} />
        ) : run !== null ? (
          <ActiveRun run={run} />
        ) : (
          <Card>
            <Body muted>
              No active run. Accept an offer and it will appear here with directions and the
              steps to complete it.
            </Body>
          </Card>
        )}

        <Heading level={3}>Completed</Heading>

        {history.isPending ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : history.data.items.length === 0 ? (
          <EmptyState title="Nothing yet" description="Your finished deliveries will show here." />
        ) : (
          history.data.items.map((item) => <HistoryRow key={item.id} run={item} />)
        )}
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{(rider) => <RiderDeliveries rider={rider} />}</RiderGate>;
}
