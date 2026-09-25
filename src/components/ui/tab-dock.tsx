import type { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePalette } from "@/lib/palette";

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

/**
 * The floating dock that replaces React Navigation's stock tab bar in every
 * portal.
 *
 * It exists for a crash, not only for looks. The stock bar draws each icon
 * twice and cross-fades them by flipping `opacity` between 0 and 1. On Fabric
 * (Android) a view at opacity 0 cannot be flattened and one at opacity 1 can,
 * so every tab change *re-parents* the icon's native SvgView. If that commit
 * also removes a stack screen — a redirect to /login, a sign-out, a role
 * switch — react-native-screens has already called `startViewTransition` on
 * the outgoing subtree, Android keeps the old parent pointer, and the insert
 * throws "The specified child already has a parent". React Native answers by
 * destroying the JS instance: the app dies.
 *
 * So the rules here are strict:
 * - Every View is `collapsable={false}`. A view that can never be flattened can
 *   never have its children moved, whatever its styles do.
 * - Focus is shown by colour and a background, never by swapping one icon
 *   element for another.
 */
export function TabDock({ state, descriptors, navigation }: TabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  const visible = state.routes.filter((route) => {
    const style = StyleSheet.flatten(descriptors[route.key]?.options.tabBarItemStyle);

    return style?.display !== "none";
  });

  return (
    <View
      collapsable={false}
      style={{
        backgroundColor: palette.canvas,
        paddingHorizontal: 14,
        paddingTop: 8,
        // The gesture bar still needs its own clearance below the dock.
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      <View
        collapsable={false}
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 26,
          paddingHorizontal: 8,
          paddingVertical: 8,
          shadowColor: "#031220",
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {visible.map((route) => {
          const options = descriptors[route.key]?.options;
          const focused = state.routes[state.index]?.key === route.key;
          const label = options?.title ?? route.name;
          const color = focused ? palette.brand : palette.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              if (Platform.OS !== "web") {
                void Haptics.selectionAsync().catch(() => {});
              }

              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              hitSlop={4}
              style={{ flexGrow: focused ? 1.6 : 1, flexBasis: 0 }}
            >
              <View
                collapsable={false}
                style={{
                  height: 46,
                  borderRadius: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  backgroundColor: focused ? palette.brandSoft : "transparent",
                }}
              >
                <View collapsable={false}>
                  {options?.tabBarIcon?.({ focused, color, size: 22 })}
                </View>
                {focused ? (
                  <Text
                    numberOfLines={1}
                    className="font-sans text-[13px] font-semibold"
                    style={{ color }}
                  >
                    {label}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
