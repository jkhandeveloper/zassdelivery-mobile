import { Redirect, Tabs } from "expo-router";
import { Home, Receipt, ShoppingCart, User, UtensilsCrossed } from "lucide-react-native";
import * as React from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/components/providers";
import { TabDock } from "@/components/ui/tab-dock";
import { useSceneStyle } from "@/lib/palette";
import { useCart } from "@/hooks/use-cart";
import { isFilledCart } from "@/lib/cart";
import { MOBILE_ROUTES, mobileHomeRouteForRole } from "@/lib/routes";

/**
 * The customer storefront.
 *
 * Deliberately *not* wrapped in a guard. The web app's storefront is public and
 * this matches it: someone has to be able to browse restaurants and fill a cart
 * before being asked who they are. The screens that genuinely need an account —
 * the cart's checkout step, orders, the profile — guard themselves with
 * `RequireAuth`.
 */

/**
 * The item count on the cart tab.
 *
 * Read from the same cart query the cart screen uses, so it cannot disagree
 * with the screen it leads to. It is the one piece of state worth surfacing in
 * navigation: a customer who has added something and navigated away needs to be
 * able to find it again without remembering that they did.
 */
function CartBadge() {
  const { isAuthenticated } = useAuth();

  // The cart belongs to a session, so asking for it while signed out is a
  // guaranteed 401 — and this component is mounted on the public storefront,
  // where being signed out is the normal case.
  const { data } = useCart(isAuthenticated);

  // The endpoint answers with either a full cart or `{ id: null, isEmpty: true }`
  // once everything has been removed, so the union has to be narrowed before
  // reaching for items.
  const count = isFilledCart(data)
    ? data.items.reduce((total, item) => total + item.quantity, 0)
    : 0;

  if (count === 0) {
    return null;
  }

  return (
    <View
      collapsable={false}
      className="absolute -right-2.5 -top-1.5 min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-accent-warm px-1"
    >
      <Text className="font-sans text-[10px] font-bold text-white">{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

export default function CustomerLayout() {
  const sceneStyle = useSceneStyle();
  const { user, isAuthenticated } = useAuth();

  // `/` is the storefront, so it is where every cold start lands. A signed-in
  // rider or vendor belongs in their own portal. Decided once, on mount — a
  // sign-in that happens later navigates onward itself (postLoginRoute), and a
  // second, competing redirect from here would race it.
  const [portal] = React.useState(() => {
    if (!isAuthenticated || user === null) return null;

    const home = mobileHomeRouteForRole(user);

    return home === MOBILE_ROUTES.customerHome ? null : home;
  });

  if (portal !== null) {
    return <Redirect href={portal} />;
  }

  return (
    <Tabs
      tabBar={(props) => <TabDock {...props} />}
      screenOptions={{ headerShown: false, sceneStyle }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="restaurants"
        options={{
          title: "Restaurants",
          tabBarIcon: ({ color, size }) => <UtensilsCrossed size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <View collapsable={false}>
              <ShoppingCart size={size} color={color} />
              <CartBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Receipt size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

      {/*
        Reachable by navigation but not a tab of its own. Without `href: null`
        expo-router adds a tab for every file in the group, which would put
        Checkout, Offers and the legal pages in the bar.
      */}
      <Tabs.Screen name="checkout" options={{ href: null }} />
      <Tabs.Screen name="offers" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="legal" options={{ href: null }} />
    </Tabs>
  );
}
