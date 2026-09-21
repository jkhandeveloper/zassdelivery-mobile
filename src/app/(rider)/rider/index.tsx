import { useRouter } from "expo-router";
import { ChevronRight, MapPinOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRealtimeEvent } from "@/components/providers";
import { OfferCard } from "@/components/shared/offer-card";
import { RiderGate } from "@/components/shared/rider-gate";
import { Button } from "@/components/ui/button";
import { Badge, Body, Card, Heading } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useRiderLocationReporting } from "@/hooks/use-rider-location";
import {
  useEarningsSummary,
  useRiderDeliveries,
  useRiderOffers,
  useSetAvailability,
} from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";
import { AssignmentStatus, DriverAvailability } from "@/types/enums";
import type { RiderDto } from "@/types/rider";

/**
 * The rider's day: are they online, what have they earned, what is in front of
 * them right now.
 *
 * This screen also owns location reporting, because it is the one screen a
 * working rider leaves open. Putting it here rather than in the root layout
 * keeps the customer and vendor apps from ever touching the location APIs —
 * they would only inherit the permission prompts and none of the purpose.
 */

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-card border border-border-subtle bg-surface p-3">
      <Text className="font-sans text-[12px] text-muted">{label}</Text>
      <Text
        className="mt-0.5 font-display text-[19px] font-extrabold text-primary"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}

function RiderDashboard({ rider }: { rider: RiderDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const setAvailability = useSetAvailability();
  const summary = useEarningsSummary();
  const offers = useRiderOffers({ liveOnly: true }, rider.availability !== DriverAvailability.OFFLINE);

  // The run in progress. `ACCEPTED` is the only assignment status that means
  // "carrying something right now" — COMPLETED is history and OFFERED is an
  // offer, not a run.
  const active = useRiderDeliveries({ status: AssignmentStatus.ACCEPTED, limit: 1 });
  const activeRun = active.data?.items[0] ?? null;

  /**
   * Location reporting is tied to having a run, not to being online. See
   * `useRiderLocationReporting` — a rider with nothing in their bag has no
   * customer watching a map and has not agreed to be followed.
   */
  const { permission, request } = useRiderLocationReporting(activeRun !== null);

  const isOnline = rider.availability !== DriverAvailability.OFFLINE;

  /**
   * A new offer arriving over the socket.
   *
   * `useRiderOffers` also polls every twenty seconds as a floor under this, so
   * the list is correct either way — the socket is what makes it *immediate*,
   * which for a thirty-second offer window is the difference between a rider
   * seeing it and not. The toast matters because the rider may be looking at
   * a different tab.
   */
  useRealtimeEvent(
    "delivery:offered",
    React.useCallback(
      (payload) => {
        toast(`New offer · ${formatPrice(payload.estimatedEarning)}`, {
          description: payload.restaurantName,
        });
        void offers.refetch();
      },
      [offers],
    ),
  );

  const onToggleOnline = React.useCallback(
    (next: boolean) => {
      setAvailability.mutate(
        { availability: next ? DriverAvailability.ONLINE : DriverAvailability.OFFLINE },
        {
          onError: (error) =>
            toast.error(
              error instanceof ApiError ? error.message : "Couldn't change your availability.",
            ),
        },
      );
    },
    [setAvailability],
  );

  const liveOffers = offers.data?.items.filter((offer) => offer.isLive) ?? [];

  const refreshing = summary.isRefetching || active.isRefetching;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void summary.refetch();
              void active.refetch();
              void offers.refetch();
            }}
          />
        }
      >
        <View className="flex-row items-center justify-between gap-3 pt-2">
          <View className="flex-1">
            <Heading level={2}>{rider.fullName.split(" ")[0]}</Heading>
            <Text className="font-sans text-[13px] text-secondary">
              {rider.availability === DriverAvailability.ON_DELIVERY
                ? "On a delivery"
                : isOnline
                  ? "Online — offers will come to you"
                  : "Offline"}
            </Text>
          </View>

          <Switch
            value={isOnline}
            onValueChange={onToggleOnline}
            disabled={setAvailability.isPending || !rider.canGoOnline}
            accessibilityLabel={isOnline ? "Go offline" : "Go online"}
            trackColor={{ false: "#CFDFE9", true: "#22D3EE" }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/*
          `canGoOnline` is false while something blocks them — an unverified
          document, usually. The switch is disabled either way, so say why.
        */}
        {!rider.canGoOnline ? (
          <Card className="border-warning bg-warning-soft">
            <Text className="font-sans text-[13px] font-medium text-warning">
              {rider.statusText}
            </Text>
          </Card>
        ) : null}

        {/*
          Only raised once a run is underway, which is the only time it costs
          the customer something. Before that it is a prompt with no stakes.
        */}
        {activeRun !== null && permission !== "granted" ? (
          <Card className="gap-2 border-warning bg-warning-soft">
            <View className="flex-row items-center gap-2">
              <MapPinOff size={16} color="#B45309" />
              <Text className="flex-1 font-sans text-[13px] font-semibold text-warning">
                {permission === "foreground-only"
                  ? "Tracking stops when you leave the app"
                  : "Your customer can't see where their order is"}
              </Text>
            </View>
            <Button size="sm" variant="outline" onPress={() => void request()}>
              Fix location access
            </Button>
          </Card>
        ) : null}

        <View className="flex-row gap-2">
          <StatTile label="Today" value={formatPrice(summary.data?.today ?? 0)} />
          <StatTile label="This week" value={formatPrice(summary.data?.thisWeek ?? 0)} />
          <StatTile
            label="Deliveries"
            value={String(summary.data?.deliveriesToday ?? 0)}
          />
        </View>

        {activeRun !== null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/rider/deliveries")}
            className="overflow-hidden rounded-card border border-brand bg-brand-soft p-4"
          >
            <View className="flex-row items-center justify-between">
              <Badge tone="brand">Active run</Badge>
              <ChevronRight size={18} color="#0E7490" />
            </View>
            <Text className="mt-2 font-display text-[17px] font-bold text-primary">
              {activeRun.order.restaurantName}
            </Text>
            <Text numberOfLines={2} className="font-sans text-[13px] text-secondary">
              {activeRun.order.deliveryAddress}
            </Text>
            {activeRun.order.cashToCollect > 0 ? (
              <Text className="mt-1 font-sans text-[13px] font-semibold text-warning">
                Collect {formatPrice(activeRun.order.cashToCollect)} in cash
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Heading level={3}>Offers</Heading>
            {liveOffers.length > 0 ? (
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => router.push("/rider/offers")}
              >
                <Text className="font-sans text-[14px] font-semibold text-brand">See all</Text>
              </Pressable>
            ) : null}
          </View>

          {!isOnline ? (
            <Body muted>Go online to start receiving offers.</Body>
          ) : liveOffers.length === 0 ? (
            <Body muted>No offers right now. We&apos;ll alert you the moment one lands.</Body>
          ) : (
            // Two on the dashboard; the rest behind "See all". A rider deciding
            // on a thirty-second timer should not be scrolling a long list.
            liveOffers.slice(0, 2).map((offer) => <OfferCard key={offer.id} offer={offer} />)
          )}
        </View>

        <View className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => router.push("/rider/earnings")}
          >
            Earnings
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => router.push("/rider/wallet")}
          >
            Wallet
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{(rider) => <RiderDashboard rider={rider} />}</RiderGate>;
}
