import { Redirect, Stack } from "expo-router";
import * as React from "react";

import { useAuth } from "@/components/providers";
import { useSceneStyle } from "@/lib/palette";
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
  const sceneStyle = useSceneStyle();
  const { user, isAuthenticated } = useAuth();

  // Decided once, on arrival. Signing in *here* flips `isAuthenticated` too,
  // and the login screen already navigates onward itself; redirecting as well
  // would unmount this stack in the same commit as that navigation — two
  // competing transitions over a screen that is being torn down.
  const [arrivedSignedIn] = React.useState(isAuthenticated && user !== null);

  if (arrivedSignedIn && user !== null) {
    return <Redirect href={mobileHomeRouteForRole(user)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: sceneStyle,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
