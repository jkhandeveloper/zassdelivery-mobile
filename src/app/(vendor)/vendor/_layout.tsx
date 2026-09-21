import { Tabs } from "expo-router";
import { BookOpen, LayoutDashboard, ReceiptText, Settings } from "lucide-react-native";
import * as React from "react";

import { useTheme } from "@/components/providers";
import { RoleGuard } from "@/components/shared/role-guard";
import { UserRole } from "@/types/auth";

/**
 * The vendor portal.
 *
 * Both vendor roles are allowed in, and the distinction between them is
 * enforced per screen rather than here — a kitchen account runs the menu and
 * the order queue, but billing is owner-only and the API refuses it for
 * `VENDOR_STAFF` rather than merely hiding it.
 */
export default function VendorLayout() {
  const { resolved } = useTheme();

  const colors =
    resolved === "dark"
      ? { active: "#22D3EE", inactive: "#6B8599", background: "#111F2D", border: "#1C3145" }
      : { active: "#0E7490", inactive: "#75909F", background: "#FFFFFF", border: "#E3EDF4" };

  return (
    <RoleGuard allow={[UserRole.VENDOR_OWNER, UserRole.VENDOR_STAFF]}>
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
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, size }) => <ReceiptText size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          }}
        />

        {/* Reached from Settings and the dashboard. */}
        <Tabs.Screen name="billing" options={{ href: null }} />
        <Tabs.Screen name="staff" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        {/* Reached from the gate when the owner has no listing yet. */}
        <Tabs.Screen name="register" options={{ href: null }} />
      </Tabs>
    </RoleGuard>
  );
}
