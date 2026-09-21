import * as React from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import type { TextInput, TextInputProps } from "react-native";

import { Field, Input } from "@/components/ui/input";

/**
 * A react-hook-form field, wired the way RHF expects on native.
 *
 * On the web the library can lean on uncontrolled inputs and `register()`.
 * React Native has no DOM refs to hook into, so every field has to be a
 * `Controller`. Doing that inline at each call site is both noisy and easy to
 * get wrong in a specific way: reaching for `watch()` + `setValue()` instead
 * re-renders the entire form on every keystroke, which is visible as input lag
 * on a mid-range phone once a form has more than a few fields.
 *
 * `Controller` re-renders only the field that changed.
 */

interface ControlledInputProps<T extends FieldValues>
  extends Omit<TextInputProps, "value" | "onChangeText" | "onBlur"> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  hint?: string;
  trailing?: React.ReactNode;
  className?: string;
}

export function ControlledInput<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  trailing,
  className,
  ...inputProps
}: ControlledInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          required={required}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
        >
          <Input
            ref={field.ref as React.Ref<TextInput>}
            value={typeof field.value === "string" ? field.value : ""}
            onChangeText={field.onChange}
            // RHF needs the blur to move the field out of its untouched state,
            // which is what makes `mode: "onTouched"` validation behave.
            onBlur={field.onBlur}
            invalid={fieldState.error !== undefined}
            trailing={trailing}
            {...inputProps}
          />
        </Field>
      )}
    />
  );
}
