import { useRouter } from "expo-router";
import { ChevronRight, MapPinOff, Power } from "lucide-react-native";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRealtimeEvent } from "@/components/providers";
import { HeroSignOut } from "@/components/shared/hero-sign-out";
import { OfferCard } from "@/components/shared/offer-card";
import { RiderGate } from "@/components/shared/rider-gate";
import { Button } from "@/components/ui/button";
import { HeroBackdrop, useLightStatusBar } from "@/components/ui/hero-backdrop";
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

/** A figure on the hero panel — translucent, so the navy shows through. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View
      collapsable={false}
      className="flex-1 rounded-[18px] px-3 py-3"
      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
    >
      <Text className="font-sans text-[12px] font-medium" style={{ color: "#9CB5C8" }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="mt-0.5 font-display text-[18px] font-extrabold text-white"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The shift switch, as the biggest control on the screen. Going online is the
 * one thing a rider opens the app to do, so it is a full-width press target
 * rather than a small platform Switch in a corner.
 */
function ShiftToggle({
  isOnline,
  onDelivery,
  disabled,
  pending,
  onToggle,
}: {
  isOnline: boolean;
  onDelivery: boolean;
  disabled: boolean;
  pending: boolean;
  onToggle: (next: boolean) => void;
}) {
  const label = onDelivery ? "On a delivery" : isOnline ? "You're online" : "You're offline";
  const hint = onDelivery
    ? "Finish this run to take the next one"
    : isOnline
      ? "Offers will come to you — tap to go offline"
      : "Tap to start your shift";

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{
        checked: isOnline,
        disabled: disabled || onDelivery,
        busy: pending,
      }}
      accessibilityLabel={isOnline ? "Go offline" : "Go online"}
      disabled={disabled || onDelivery || pending}
      onPress={() => onToggle(!isOnline)}
      className="mt-5 flex-row items-center gap-3 rounded-[22px] p-3"
      // A static style, not a ({ pressed }) function: NativeWind drops the
      // function's background when a className is present too.
      style={{
        backgroundColor: isOnline ? "#22D3EE" : "rgba(255,255,255,0.1)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View
        collapsable={false}
        className="h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: isOnline ? "#04202B" : "rgba(255,255,255,0.12)",
        }}
      >
        <Power size={22} color={isOnline ? "#22D3EE" : "#FFFFFF"} />
      </View>
      <View className="flex-1">
        <Text
          className="font-display text-[17px] font-extrabold"
          style={{ color: isOnline ? "#04202B" : "#FFFFFF" }}
        >
          {label}
        </Text>
        <Text className="font-sans text-[12px]" style={{ color: isOnline ? "#0B4A5C" : "#9CB5C8" }}>
          {pending ? "Updating…" : hint}
        </Text>
      </View>
      <View
        collapsable={false}
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: isOnline ? "#04202B" : "#6B8599" }}
      />
    </Pressable>
  );
}

function RiderDashboard({ rider }: { rider: RiderDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLightStatusBar();

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
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerClassName="pb-8"
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
        <View
          collapsable={false}
          className="overflow-hidden rounded-b-hero px-5 pb-6"
          style={{ paddingTop: insets.top + 14 }}
        >
          <HeroBackdrop />

          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-sans text-[13px] font-medium" style={{ color: "#9CD8E6" }}>
                Rider · {rider.zoneName ?? "Delivery partner"}
              </Text>
              <Text
                className="font-display text-[28px] font-extrabold text-white"
                style={{ letterSpacing: -0.6 }}
              >
                Salaam, {rider.fullName.split(" ")[0]}
              </Text>
            </View>
            <HeroSignOut />
          </View>

          <ShiftToggle
            isOnline={isOnline}
            onDelivery={rider.availability === DriverAvailability.ON_DELIVERY}
            disabled={!rider.canGoOnline}
            pending={setAvailability.isPending}
            onToggle={onToggleOnline}
          />

          <View className="mt-3 flex-row gap-2">
            <StatTile label="Today" value={formatPrice(summary.data?.today ?? 0)} />
            <StatTile label="This week" value={formatPrice(summary.data?.thisWeek ?? 0)} />
            <StatTile label="Drops" value={String(summary.data?.deliveriesToday ?? 0)} />
          </View>
        </View>

        <View className="gap-4 px-4 pt-5">
          {/*
          `canGoOnline` is false while something blocks them — an unverified
          document, usually. The toggle is disabled either way, so say why.
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
        </View>
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{(rider) => <RiderDashboard rider={rider} />}</RiderGate>;
}
