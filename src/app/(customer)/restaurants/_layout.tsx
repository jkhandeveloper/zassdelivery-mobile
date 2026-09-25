import { Stack } from "expo-router";
import * as React from "react";

import { useSceneStyle } from "@/lib/palette";

/**
 * A stack inside the Restaurants tab, so tapping a restaurant pushes its menu
 * over the list and back returns to the list with its scroll position and
 * filters intact — rather than replacing the tab's root.
 */
export default function RestaurantsLayout() {
  const sceneStyle = useSceneStyle();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: sceneStyle }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
