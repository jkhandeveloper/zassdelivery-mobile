import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import * as React from "react";
import { RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, useRestaurantRoom, useRealtimeEvent } from "@/components/providers";
import { VendorGate } from "@/components/shared/vendor-gate";
import { Button } from "@/components/ui/button";
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
      className={
        tone === "brand"
          ? "flex-1 rounded-card border border-brand bg-brand-soft p-3"
          : "flex-1 rounded-card border border-border-subtle bg-surface p-3"
      }
    >
      <Text className="font-sans text-[12px] text-muted">{label}</Text>
      <Text
        className="mt-0.5 font-display text-[20px] font-extrabold text-primary"
        style={{ fontVariant: ["tabular-nums"] }}
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

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-8"
        refreshControl={
          <RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />
        }
      >
        <View className="flex-row items-start justify-between gap-3 pt-2">
          <View className="flex-1">
            <Heading level={2}>{restaurant.name}</Heading>
            <View className="mt-1 flex-row items-center gap-2">
              {restaurant.canOrderNow ? (
                <Badge tone="success">Taking orders</Badge>
              ) : restaurant.isAcceptingOrders ? (
                <Badge tone="warning">Closed — outside opening hours</Badge>
              ) : (
                <Badge tone="neutral">Paused</Badge>
              )}
            </View>
          </View>

          {/*
            The owner's manual on/off switch. Distinct from opening hours: this
            is "stop sending me orders right now", which a kitchen needs when it
            is swamped regardless of what the schedule says.
          */}
          <Switch
            value={restaurant.isAcceptingOrders}
            disabled={setAccepting.isPending}
            accessibilityLabel={
              restaurant.isAcceptingOrders ? "Pause new orders" : "Start taking orders"
            }
            onValueChange={(next) =>
              setAccepting.mutate(next, {
                onError: (error) =>
                  toast.error(error instanceof ApiError ? error.message : "Couldn't change that."),
              })
            }
            trackColor={{ false: "#CFDFE9", true: "#22D3EE" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View className="flex-row gap-2">
          <Tile label="New" value={String(newCount)} tone={newCount > 0 ? "brand" : undefined} />
          <Tile label="In the queue" value={String(queue.length)} />
          <Tile label="Today" value={formatPrice(takings)} />
        </View>

        {newCount > 0 ? (
          <Button fullWidth size="lg" onPress={() => router.push("/vendor/orders")}>
            {newCount === 1 ? "1 order waiting" : `${newCount} orders waiting`}
          </Button>
        ) : (
          <Card>
            <Body muted>
              Nothing waiting on you. New orders appear here and on the Orders tab the moment
              they come in.
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
          <Button variant="outline" className="flex-1" onPress={() => router.push("/vendor/menu")}>
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
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  return <VendorGate>{(restaurant) => <VendorDashboard restaurant={restaurant} />}</VendorGate>;
}
