import { Tabs } from "expo-router";
import { Bike, LifeBuoy, Package, Wallet } from "lucide-react-native";
import * as React from "react";

import { useTheme } from "@/components/providers";
import { RoleGuard } from "@/components/shared/role-guard";
import { UserRole } from "@/types/auth";

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
  const { resolved } = useTheme();

  const colors =
    resolved === "dark"
      ? { active: "#22D3EE", inactive: "#6B8599", background: "#111F2D", border: "#1C3145" }
      : { active: "#0E7490", inactive: "#75909F", background: "#FFFFFF", border: "#E3EDF4" };

  return (
    <RoleGuard allow={[UserRole.RIDER]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.active,
          tabBarInactiveTintColor: colors.inactive,
          tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
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
          name="wallet"
          options={{
            title: "Wallet",
            tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
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
          to check. Earnings and withdrawals hang off the wallet.
        */}
        <Tabs.Screen name="offers" options={{ href: null }} />
        <Tabs.Screen name="earnings" options={{ href: null }} />
        <Tabs.Screen name="withdrawals" options={{ href: null }} />
        {/* Reached from the gate when there is no approved rider yet. */}
        <Tabs.Screen name="apply" options={{ href: null }} />
      </Tabs>
    </RoleGuard>
  );
}
