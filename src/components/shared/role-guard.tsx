import { Redirect, usePathname, useRouter } from "expo-router";
import { LockKeyhole } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Body, Heading, Screen } from "@/components/ui/primitives";
import { usePalette } from "@/lib/palette";
import { mobileHomeRouteForRole } from "@/lib/routes";
import type { UserRole } from "@/types/auth";

/**
 * A UX guard, not a security boundary.
 *
 * Worth stating plainly because it is easy to mistake for one: the API
 * authorises every request independently, and that is what actually protects
 * the data. This exists so a rider does not see a vendor's navigation, and so
 * an unauthenticated tap lands on a login screen rather than a wall of failed
 * requests.
 *
 * Safe to decide during render because the root layout holds the splash screen
 * until the session is known — see `SplashGate`. Without that, this component
 * would redirect every signed-in user to the login screen on cold start.
 */
export function RoleGuard({
  allow,
  children,
}: {
  allow: readonly UserRole[];
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!isAuthenticated || user === null) {
    // Carrying `next` is what makes a deep link into a guarded screen work:
    // sign in, and the app continues to where the link pointed.
    return <Redirect href={{ pathname: "/login", params: { next: pathname } }} />;
  }

  if (!allow.includes(user.role)) {
    const home = mobileHomeRouteForRole(user);

    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Heading level={2} className="text-center">
            This area isn&apos;t yours
          </Heading>
          <Body muted className="text-center">
            Your account doesn&apos;t have access to this part of ZassDelivery.
          </Body>
          <Button variant="outline" className="mt-2" onPress={() => router.replace(home)}>
            Go to your dashboard
          </Button>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

/**
 * For screens inside the customer storefront that need an account — the cart,
 * checkout, orders, the profile.
 *
 * Separate from `RoleGuard` because the storefront itself is deliberately
 * public: someone must be able to browse restaurants and build a cart before
 * being asked who they are, which is the difference between a shop and a
 * members' club.
 */
export function RequireAuth({
  children,
  title = "Sign in to continue",
  description = "Track your orders, save addresses and check out in a couple of taps.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const palette = usePalette();

  if (!isAuthenticated) {
    // A prompt in place, not a <Redirect>. These screens are tabs, and a
    // redirect fired by a tab press replaces the whole tab navigator in the
    // same commit as the tab bar's own update — the combination that crashes
    // Fabric on Android (see TabDock). `push` also keeps the storefront under
    // the login screen, so back returns the customer to where they were.
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View
            collapsable={false}
            className="h-20 w-20 items-center justify-center rounded-full bg-brand-soft"
          >
            <LockKeyhole size={34} color={palette.brand} />
          </View>
          <Heading level={2} className="text-center">
            {title}
          </Heading>
          <Body muted className="text-center">
            {description}
          </Body>
          <View className="mt-2 w-full gap-2">
            <Button
              size="lg"
              fullWidth
              onPress={() => router.push({ pathname: "/login", params: { next: pathname } })}
            >
              Sign in
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onPress={() =>
                router.push({
                  pathname: "/register",
                  params: { next: pathname },
                })
              }
            >
              Create an account
            </Button>
          </View>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}
