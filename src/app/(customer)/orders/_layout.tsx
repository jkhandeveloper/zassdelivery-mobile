import { Stack } from "expo-router";
import * as React from "react";

import { useSceneStyle } from "@/lib/palette";

/** A stack, so an order's tracking screen pushes over the list. */
export default function OrdersLayout() {
  const sceneStyle = useSceneStyle();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: sceneStyle }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
