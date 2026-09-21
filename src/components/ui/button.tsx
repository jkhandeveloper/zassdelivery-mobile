import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from "react-native";

import { cn } from "@/lib/utils";

/**
 * The web app's button, as a touch target.
 *
 * Two things change from the web version and both are platform requirements
 * rather than taste. Hover and focus-visible variants are dropped, because
 * neither exists here; in their place is a pressed state, which is the only
 * feedback a finger gets. And the minimum height is 48, not the web's 40 — 44
 * is Apple's floor and 48 is Android's, so 48 satisfies both.
 */

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Rendered before the label, at the label's colour. */
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  primary: "bg-brand",
  secondary: "bg-accent-warm",
  outline: "border border-border-strong bg-transparent",
  ghost: "bg-transparent",
  danger: "bg-danger",
};

const LABEL: Record<Variant, string> = {
  primary: "text-brand-contrast",
  secondary: "text-white",
  outline: "text-primary",
  ghost: "text-brand",
  danger: "text-white",
};

const SIZING: Record<Size, string> = {
  sm: "min-h-[40px] px-3",
  md: "min-h-[48px] px-4",
  lg: "min-h-[56px] px-6",
};

const LABEL_SIZE: Record<Size, string> = {
  sm: "text-[14px]",
  md: "text-[15px]",
  lg: "text-[17px]",
};

/** The spinner has to match the label, or it vanishes on a coloured button. */
const SPINNER: Record<Variant, string> = {
  primary: "#04202B",
  secondary: "#FFFFFF",
  outline: "#4C6577",
  ghost: "#0E7490",
  danger: "#FFFFFF",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  // A loading button is not pressable. Leaving it live is how a customer taps
  // "Place order" twice and is charged twice.
  const isInert = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      disabled={isInert}
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-input",
        CONTAINER[variant],
        SIZING[size],
        fullWidth && "w-full",
        isInert && "opacity-50",
        className,
      )}
      // Pressable's own feedback, since there is no :hover to lean on.
      style={({ pressed }) => (pressed ? { opacity: isInert ? 0.5 : 0.85 } : undefined)}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={SPINNER[variant]} />
      ) : (
        icon !== undefined && <View>{icon}</View>
      )}
      <Text
        numberOfLines={1}
        className={cn("font-sans font-semibold", LABEL[variant], LABEL_SIZE[size])}
      >
        {children}
      </Text>
    </Pressable>
  );
}
