import { Tabs } from "expo-router";
import { BookOpen, LayoutDashboard, ReceiptText, Settings } from "lucide-react-native";
import * as React from "react";

import { RoleGuard } from "@/components/shared/role-guard";
import { TabDock } from "@/components/ui/tab-dock";
import { useSceneStyle } from "@/lib/palette";
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
  const sceneStyle = useSceneStyle();
  return (
    <RoleGuard allow={[UserRole.VENDOR_OWNER, UserRole.VENDOR_STAFF]}>
      <Tabs
        tabBar={(props) => <TabDock {...props} />}
        screenOptions={{ headerShown: false, sceneStyle }}
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
