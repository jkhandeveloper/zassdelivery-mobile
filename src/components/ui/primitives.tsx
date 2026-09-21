import * as React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

/**
 * Layout and type primitives.
 *
 * `Screen` exists because three concerns have to be handled on every single
 * screen and are easy to get subtly wrong one at a time: the notch and the home
 * indicator, the keyboard covering the field being typed into, and the canvas
 * colour (a screen without an explicit background flashes white on a dark-theme
 * device during navigation).
 */

interface ScreenProps {
  children: React.ReactNode;
  /** Wraps children in a ScrollView. Off for screens that own a FlatList. */
  scroll?: boolean;
  /** Skip the top inset where a header already accounts for it. */
  edges?: { top?: boolean; bottom?: boolean };
  className?: string;
  contentContainerClassName?: string;
  refreshControl?: ScrollViewProps["refreshControl"];
}

export function Screen({
  children,
  scroll = false,
  edges,
  className,
  contentContainerClassName,
  refreshControl,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: edges?.top === false ? 0 : insets.top,
    paddingBottom: edges?.bottom === false ? 0 : insets.bottom,
  };

  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn("grow px-4 pb-8", contentContainerClassName)}
      keyboardShouldPersistTaps="handled"
      // Otherwise a tap on a button while the keyboard is open only dismisses
      // the keyboard, and the user has to tap the same button twice.
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn("flex-1", contentContainerClassName)}>{children}</View>
  );

  return (
    <View className={cn("flex-1 bg-canvas", className)} style={padding}>
      <KeyboardAvoidingView
        // iOS moves the whole view; Android's windowSoftInputMode already
        // resizes it, and "padding" there double-counts the keyboard.
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn("rounded-card border border-border-subtle bg-surface p-4", className)}
      style={{
        // NativeWind has no cross-platform shadow utility, so the web's
        // --shadow-card is expressed directly. Cool-tinted: a warm shadow on
        // navy reads as mud.
        shadowColor: "#031220",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

export function Heading({
  children,
  level = 1,
  className,
}: {
  children: React.ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}) {
  const size = level === 1 ? "text-[28px]" : level === 2 ? "text-[22px]" : "text-[18px]";

  return (
    <Text
      accessibilityRole="header"
      className={cn("font-display font-extrabold text-primary", size, className)}
      // Matches the web's -0.02em on headings.
      style={{ letterSpacing: -0.5 }}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted = false,
  className,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
  /** For the few things NativeWind has no utility for — `fontVariant`, mainly. */
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      className={cn(
        "font-sans text-[15px] leading-6",
        muted ? "text-secondary" : "text-primary",
        className,
      )}
      style={style}
    >
      {children}
    </Text>
  );
}

/**
 * Prices, totals, counters and order numbers.
 *
 * `fontVariant: ["tabular-nums"]` is the native equivalent of the web's
 * `.numeric` class. Without it a live countdown or a changing total jitters
 * sideways as the glyph widths change.
 */
export function Numeric({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={cn("font-sans text-primary", className)}
      style={{ fontVariant: ["tabular-nums"] }}
    >
      {children}
    </Text>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cn("h-px bg-border-subtle", className)} />;
}

/** A status pill — order state, rider availability, billing state. */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-muted text-secondary",
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  } as const;

  return (
    <View className={cn("self-start rounded-full px-2.5 py-1", tones[tone].split(" ")[0])}>
      <Text className={cn("font-sans text-[12px] font-semibold", tones[tone].split(" ")[1])}>
        {children}
      </Text>
    </View>
  );
}
