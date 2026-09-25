import { useRouter } from "expo-router";
import { ChefHat, ChevronRight } from "lucide-react-native";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, useRestaurantRoom, useRealtimeEvent } from "@/components/providers";
import { HeroSignOut } from "@/components/shared/hero-sign-out";
import { VendorGate } from "@/components/shared/vendor-gate";
import { Button } from "@/components/ui/button";
import { HeroBackdrop, useLightStatusBar } from "@/components/ui/hero-backdrop";
import { Badge, Body, Card, Heading } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useRestaurantOrders, useSetAcceptingOrders } from "@/hooks/use-vendor";
import { ApiError } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";
import { UserRole } from "@/types/auth";
import { OrderStatus } from "@/types/enums";
import type { RestaurantAdminDto } from "@/types/restaurant";

/**
 * The kitchen's day at a glance: are we open, what is in the queue, what has
 * today taken.
 *
 * Takings are summed from today's own orders rather than read from a reports
 * endpoint, because the admin reporting surface is not built. Delivered orders
 * only — counting a cancelled order's total as revenue would be wrong, and
 * counting one still cooking would make the figure move backwards when it is
 * rejected.
 */

/** Statuses the kitchen still has work to do on. */
const IN_QUEUE: readonly OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
];

function Tile({ label, value, tone }: { label: string; value: string; tone?: "brand" }) {
  return (
    <View
      collapsable={false}
      className="flex-1 rounded-[18px] px-3 py-3"
      style={{
        backgroundColor: tone === "brand" ? "#FF8A3D" : "rgba(255,255,255,0.08)",
      }}
    >
      <Text
        className="font-sans text-[12px] font-medium"
        style={{ color: tone === "brand" ? "#3A1A08" : "#9CB5C8" }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="mt-0.5 font-display text-[20px] font-extrabold"
        style={{
          fontVariant: ["tabular-nums"],
          color: tone === "brand" ? "#1A0B03" : "#FFFFFF",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function VendorDashboard({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  useLightStatusBar();

  const setAccepting = useSetAcceptingOrders(restaurant.id);
  const orders = useRestaurantOrders(restaurant.id, { limit: 100 });

  // Joins the kitchen's room so new tickets arrive without waiting on the poll.
  useRestaurantRoom(restaurant.id);

  useRealtimeEvent(
    "restaurant:order",
    React.useCallback(
      (payload) => {
        toast(`New order · ${payload.orderNumber}`, {
          description: `${payload.itemCount} items · ${formatPrice(payload.totalAmount)}`,
        });
        void orders.refetch();
      },
      [orders],
    ),
  );

  const all = orders.data?.items ?? [];

  const queue = all.filter((order) => IN_QUEUE.includes(order.status));
  const newCount = all.filter((order) => order.status === OrderStatus.PLACED).length;

  /** Today's delivered takings. */
  const takings = React.useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const from = startOfDay.getTime();

    return all
      .filter((order) => {
        if (order.status !== OrderStatus.DELIVERED) {
          return false;
        }

        const at = new Date(order.deliveredAt ?? order.createdAt).getTime();

        return !Number.isNaN(at) && at >= from;
      })
      .reduce((total, order) => total + order.totals.totalAmount, 0);
  }, [all]);

  const isOwner = user?.role === UserRole.VENDOR_OWNER;

  const status = restaurant.canOrderNow
    ? { label: "Taking orders", dot: "#34D399" }
    : restaurant.isAcceptingOrders
      ? { label: "Closed — outside opening hours", dot: "#FBBF24" }
      : { label: "Paused", dot: "#6B8599" };

  const toggleAccepting = () =>
    setAccepting.mutate(!restaurant.isAcceptingOrders, {
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Couldn't change that."),
    });

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={orders.isRefetching}
            onRefresh={() => void orders.refetch()}
          />
        }
      >
        <View
          collapsable={false}
          className="overflow-hidden rounded-b-hero px-5 pb-6"
          style={{ paddingTop: insets.top + 14 }}
        >
          <HeroBackdrop variant="saffron" />

          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <View
                  collapsable={false}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: status.dot }}
                />
                <Text className="font-sans text-[13px] font-medium" style={{ color: "#FFD2B8" }}>
                  {status.label}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                className="mt-1 font-display text-[28px] font-extrabold text-white"
                style={{ letterSpacing: -0.6 }}
              >
                {restaurant.name}
              </Text>
            </View>
            <HeroSignOut />
          </View>

          {/*
            The owner's manual on/off switch. Distinct from opening hours: this
            is "stop sending me orders right now", which a kitchen needs when it
            is swamped regardless of what the schedule says.
          */}
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{
              checked: restaurant.isAcceptingOrders,
              busy: setAccepting.isPending,
            }}
            accessibilityLabel={
              restaurant.isAcceptingOrders ? "Pause new orders" : "Start taking orders"
            }
            disabled={setAccepting.isPending}
            onPress={toggleAccepting}
            className="mt-5 flex-row items-center gap-3 rounded-[22px] p-3"
            // Static, not a ({ pressed }) function: NativeWind drops the
            // function's background when a className is present too.
            style={{
              backgroundColor: restaurant.isAcceptingOrders ? "#FF8A3D" : "rgba(255,255,255,0.1)",
            }}
          >
            <View
              collapsable={false}
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: restaurant.isAcceptingOrders
                  ? "#1A0B03"
                  : "rgba(255,255,255,0.12)",
              }}
            >
              <ChefHat size={22} color={restaurant.isAcceptingOrders ? "#FF8A3D" : "#FFFFFF"} />
            </View>
            <View className="flex-1">
              <Text
                className="font-display text-[17px] font-extrabold"
                style={{
                  color: restaurant.isAcceptingOrders ? "#1A0B03" : "#FFFFFF",
                }}
              >
                {restaurant.isAcceptingOrders ? "Kitchen is open" : "Kitchen is paused"}
              </Text>
              <Text
                className="font-sans text-[12px]"
                style={{
                  color: restaurant.isAcceptingOrders ? "#5A2A0E" : "#9CB5C8",
                }}
              >
                {setAccepting.isPending
                  ? "Updating…"
                  : restaurant.isAcceptingOrders
                    ? "Tap to pause new orders"
                    : "Tap to start taking orders"}
              </Text>
            </View>
          </Pressable>

          <View className="mt-3 flex-row gap-2">
            <Tile label="New" value={String(newCount)} tone={newCount > 0 ? "brand" : undefined} />
            <Tile label="In the queue" value={String(queue.length)} />
            <Tile label="Today" value={formatPrice(takings)} />
          </View>
        </View>

        <View className="gap-4 px-4 pt-5">
          {newCount > 0 ? (
            <Button fullWidth size="lg" onPress={() => router.push("/vendor/orders")}>
              {newCount === 1 ? "1 order waiting" : `${newCount} orders waiting`}
            </Button>
          ) : (
            <Card>
              <Body muted>
                Nothing waiting on you. New orders appear here and on the Orders tab the moment they
                come in.
              </Body>
            </Card>
          )}

          {/*
          Billing is owner-only — the API refuses it for VENDOR_STAFF rather
          than merely hiding it, so showing the link to a kitchen account would
          be an invitation to a 403.
        */}
          {isOwner ? (
            <Card>
              <Button
                variant="ghost"
                fullWidth
                onPress={() => router.push("/vendor/billing")}
                icon={<ChevronRight size={16} color="#0E7490" />}
              >
                Platform fee & billing
              </Button>
            </Card>
          ) : null}

          <View className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => router.push("/vendor/menu")}
            >
              Menu
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => router.push("/vendor/settings")}
            >
              Settings
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  return <VendorGate>{(restaurant) => <VendorDashboard restaurant={restaurant} />}</VendorGate>;
}
