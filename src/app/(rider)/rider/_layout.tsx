import { useQueryClient } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { Bike, HandCoins, LifeBuoy, Package } from "lucide-react-native";
import * as React from "react";

import { useAuth, useRealtimeEvent } from "@/components/providers";
import { RoleGuard } from "@/components/shared/role-guard";
import { TabDock } from "@/components/ui/tab-dock";
import { useRiderPresence } from "@/hooks/use-rider-location";
import { riderKeys, useRiderDeliveries, useRiderProfile } from "@/hooks/use-riders";
import { useSceneStyle } from "@/lib/palette";
import { UserRole } from "@/types/auth";
import { AssignmentStatus, DriverAvailability, DriverStatus } from "@/types/enums";

/**
 * An online rider's position, reported from whichever rider screen is open.
 *
 * Here rather than on the dashboard because a rider waiting for work is as
 * likely to be looking at their cash or a past delivery, and dispatch needs to
 * know where they are either way. Tracking *during* a run is a different job
 * with its own permissions and stays with the dashboard.
 *
 * Renders nothing, and never prompts — the dashboard asks when going online.
 */
function RiderPresenceReporter() {
  const { user, isReady, isAuthenticated } = useAuth();
  const isRider = isReady && isAuthenticated && user?.role === UserRole.RIDER;

  const profile = useRiderProfile(isRider);
  const rider = profile.data ?? null;

  const working =
    rider !== null &&
    rider.status === DriverStatus.ACTIVE &&
    rider.availability !== DriverAvailability.OFFLINE;

  const active = useRiderDeliveries({ status: AssignmentStatus.ACCEPTED, limit: 1 }, working);
  const onRun = working && (active.data?.items.length ?? 0) > 0;

  useRiderPresence(working && !onRun);

  return null;
}

/**
 * Keeps the rider's screens current with what happens to them from elsewhere.
 *
 * `delivery:updated` is the API saying the run this rider holds moved on or
 * ended — the kitchen marked it ready, the business or support closed it, or
 * the rider confirmed it on another device. Nothing listened for any of that:
 * the dashboard only refetched on a new offer, so after a delivery it could sit
 * on "On a delivery" and the old earnings until it was pulled to refresh.
 *
 * Here rather than on the dashboard for the same reason as the presence
 * reporter: whichever tab is open, the others should already be right.
 * Everything under `riderKeys.all` is invalidated rather than one query
 * patched, because a run ending changes the active run, the history, the
 * rider's availability, the earnings and what they owe the business at once.
 */
function RiderLiveSync() {
  const queryClient = useQueryClient();

  useRealtimeEvent(
    "delivery:updated",
    React.useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: riderKeys.all });
    }, [queryClient]),
  );

  return null;
}

/**
 * The rider portal.
 *
 * `RoleGuard` wraps the navigator rather than each screen, so a customer who
 * follows a stale deep link never sees the rider tab bar flash before being
 * turned away.
 *
 * The rider *gate* — application not filed, awaiting approval, rejected,
 * suspended — is a separate concern handled inside the screens, because those
 * states are not "you may not be here": they are this user's real situation,
 * and each one has its own next step.
 */
export default function RiderLayout() {
  const sceneStyle = useSceneStyle();
  return (
    <RoleGuard allow={[UserRole.RIDER]}>
      <RiderPresenceReporter />
      <RiderLiveSync />
      <Tabs
        tabBar={(props) => <TabDock {...props} />}
        screenOptions={{ headerShown: false, sceneStyle }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
            tabBarIcon: ({ color, size }) => <Bike size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="deliveries"
          options={{
            title: "Deliveries",
            tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="cash"
          options={{
            title: "Cash",
            tabBarIcon: ({ color, size }) => <HandCoins size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="support"
          options={{
            title: "Support",
            tabBarIcon: ({ color, size }) => <LifeBuoy size={size} color={color} />,
          }}
        />

        {/*
          Offers are reached from the dashboard, not a tab: an offer is a
          time-boxed interruption with a countdown, so it belongs in front of
          the rider when it arrives rather than behind a tab they must remember
          to check. Earnings hang off the cash screen.
        */}
        <Tabs.Screen name="offers" options={{ href: null }} />
        <Tabs.Screen name="earnings" options={{ href: null }} />
        {/* The rider's own account, reached from the dashboard hero. */}
        <Tabs.Screen name="profile" options={{ href: null }} />
        {/* Reached from the gate when there is no approved rider yet. */}
        <Tabs.Screen name="apply" options={{ href: null }} />
      </Tabs>
    </RoleGuard>
  );
}
