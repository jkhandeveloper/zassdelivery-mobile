import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "@/components/providers";
import { usePalette } from "@/lib/palette";

/**
 * Light status-bar icons while a screen with a hero at the top is focused.
 *
 * Imperative and focus-scoped rather than a <StatusBar> element: tabs stay
 * mounted when you leave them, so an element would keep the icons white on
 * the next, light-backgrounded screen.
 */
export function useLightStatusBar() {
  const { resolved } = useTheme();

  useFocusEffect(
    React.useCallback(() => {
      setStatusBarStyle("light");

      return () => setStatusBarStyle(resolved === "dark" ? "light" : "dark");
    }, [resolved]),
  );
}

/**
 * The navy "night market" panel behind every hero: the home greeting, the
 * sign-in screens, and the rider and vendor dashboards.
 *
 * A deep gradient with two soft glows — cyan for the brand, saffron for the
 * food — so the top of each portal is instantly recognisable as ZassDeliver
 * rather than a stock white header. Drawn in SVG, not with an image or a
 * gradient library, so it scales to any height without a new native module.
 *
 * Purely decorative: it fills its parent absolutely and ignores touches.
 */
export function HeroBackdrop({ variant = "brand" }: { variant?: "brand" | "saffron" }) {
  const palette = usePalette();
  const glowA = variant === "brand" ? palette.heroGlow : "#FF8A3D";
  const glowB = variant === "brand" ? "#FF8A3D" : palette.heroGlow;

  return (
    <View collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hero-base" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.heroFrom} />
            <Stop offset="1" stopColor={palette.heroTo} />
          </LinearGradient>
          <RadialGradient id="hero-glow-a" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glowA} stopOpacity="0.55" />
            <Stop offset="1" stopColor={glowA} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="hero-glow-b" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glowB} stopOpacity="0.4" />
            <Stop offset="1" stopColor={glowB} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero-base)" />
        <Circle cx="88%" cy="8%" r="180" fill="url(#hero-glow-a)" />
        <Circle cx="4%" cy="100%" r="150" fill="url(#hero-glow-b)" />
        {/* Faint rings: the "radar" of a delivery on its way. */}
        <Circle cx="88%" cy="8%" r="90" stroke="#FFFFFF" strokeOpacity="0.06" fill="none" />
        <Circle cx="88%" cy="8%" r="140" stroke="#FFFFFF" strokeOpacity="0.04" fill="none" />
      </Svg>
    </View>
  );
}
