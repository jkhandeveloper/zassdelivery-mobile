import { Stack } from "expo-router";
import * as React from "react";

/** A stack, so an order's tracking screen pushes over the list. */
export default function OrdersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
