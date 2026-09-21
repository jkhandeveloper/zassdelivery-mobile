import * as React from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { cn } from "@/lib/utils";

/**
 * `Field` + `Input`, matching the web app's pair.
 *
 * The error is rendered with `accessibilityLiveRegion` so a screen reader
 * announces a validation failure instead of leaving it as text the user only
 * finds by exploring — which on a form they have just failed to submit is
 * effectively never.
 */

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  /** Guidance shown when there is no error; the error replaces it. */
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, required, error, hint, children, className }: FieldProps) {
  const hasError = error !== undefined && error !== "";

  return (
    <View className={cn("gap-1.5", className)}>
      <Text className="font-sans text-[14px] font-medium text-primary">
        {label}
        {required === true ? <Text className="text-danger"> *</Text> : null}
      </Text>

      {children}

      {hasError ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-sans text-[13px] font-medium text-danger"
        >
          {error}
        </Text>
      ) : hint !== undefined && hint !== "" ? (
        <Text className="font-sans text-[13px] text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}

interface InputProps extends TextInputProps {
  invalid?: boolean;
  /** Rendered inside the field, on the right — a reveal toggle or a unit. */
  trailing?: React.ReactNode;
  className?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { invalid = false, trailing, className, ...rest },
  ref,
) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View
      className={cn(
        "flex-row items-center rounded-input border bg-surface px-3",
        invalid
          ? "border-danger"
          : focused
            ? // Stands in for the web's focus ring. Without a visible focused
              // state, a form with several fields gives no clue which one the
              // keyboard is typing into.
              "border-brand"
            : "border-border-default",
      )}
    >
      <TextInput
        ref={ref}
        // The API is Pakistan-facing and the palette is dark-first; the OS
        // default placeholder grey disappears against the navy surface.
        placeholderTextColor="#75909F"
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        className={cn(
          "min-h-[48px] flex-1 font-sans text-[16px] text-primary",
          // 16px is not styling. Anything smaller makes iOS Safari-style
          // zoom-on-focus behaviour kick in on some Android keyboards, and it
          // is the smallest size that stays legible on a cheap 720p screen.
          className,
        )}
        {...rest}
      />
      {trailing !== undefined ? <View className="pl-2">{trailing}</View> : null}
    </View>
  );
});

/** A tap target for the reveal toggle, sized for a finger rather than a cursor. */
export function InputAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={12}
      className="h-10 w-10 items-center justify-center"
    >
      {children}
    </Pressable>
  );
}
