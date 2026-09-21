import { Redirect, Stack } from "expo-router";
import * as React from "react";

import { useAuth } from "@/components/providers";
import { mobileHomeRouteForRole } from "@/lib/routes";

/**
 * The sign-in and sign-up screens.
 *
 * Signed-in users are bounced to their own portal rather than being shown a
 * login form they have no use for. This is safe to do during render because the
 * root layout holds the splash screen until `isReady`, so by the time anything
 * here mounts the session is known — it cannot redirect on a session that is
 * merely still loading.
 */
export default function AuthLayout() {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && user !== null) {
    return <Redirect href={mobileHomeRouteForRole(user)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
