import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "@/components/providers";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { Field } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useProfile, useUpdateProfile } from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import { authApi } from "@/lib/api/auth";

/**
 * The parts of a profile every portal shares: the person's own details and
 * their password.
 *
 * Riders and vendors had neither. Their portals were built around the work —
 * runs, the order queue — and the account behind it could only be changed by
 * support. These are the two cards both profile screens are built from.
 */

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120, "That name is too long"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
});

type DetailsValues = z.infer<typeof detailsSchema>;

/** Photo, name, email, and the phone number the account is keyed on. */
export function AccountDetailsCard() {
  const { refreshUser } = useAuth();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { fullName: "", email: "" },
    mode: "onTouched",
  });

  // Seeded once per account, so a background refetch never overwrites what
  // someone is half-way through typing.
  const [seededFor, setSeededFor] = React.useState<string | null>(null);

  if (profile.data !== undefined && seededFor !== profile.data.id) {
    setSeededFor(profile.data.id);
    reset({ fullName: profile.data.fullName, email: profile.data.email ?? "" });
  }

  const onSave = handleSubmit(async (values) => {
    try {
      const saved = await updateProfile.mutateAsync({
        fullName: values.fullName,
        // An empty string is a real instruction here — it clears the email —
        // whereas omitting the field leaves it as it was.
        email: values.email,
      });

      reset({ fullName: saved.fullName, email: saved.email ?? "" });
      // The portal heroes greet the session user, not this query.
      void refreshUser();
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save that.");
    }
  });

  if (profile.isPending) {
    return (
      <Card>
        <LoadingState label="Loading your account…" />
      </Card>
    );
  }

  if (profile.isError) {
    return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  }

  return (
    <Card className="gap-4">
      <ImageUploadField
        label="Profile photo"
        folder="avatars"
        aspect="square"
        allowsEditing
        value={profile.data.avatarUrl}
        onChange={(url) =>
          updateProfile.mutate(
            { avatarUrl: url },
            {
              onSuccess: () => toast.success(url === null ? "Photo removed" : "Photo updated"),
              onError: (error) =>
                toast.error(
                  error instanceof ApiError ? error.message : "Couldn't update your photo.",
                ),
            },
          )
        }
      />

      <ControlledInput
        control={control}
        name="fullName"
        label="Full name"
        required
        autoCapitalize="words"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="email"
        label="Email"
        hint="For receipts and account recovery."
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
      />

      {/* Phone is the login identifier and is not editable in-app. */}
      <Field label="Phone number" hint="Contact support to change this.">
        <View className="rounded-input border border-border-subtle bg-surface-muted px-3 py-3">
          <Text
            className="font-sans text-[16px] text-secondary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {profile.data.phone}
          </Text>
        </View>
      </Field>

      <Button fullWidth onPress={() => void onSave()} loading={isSubmitting} disabled={!isDirty}>
        Save changes
      </Button>
    </Card>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    // The API's own rule, checked here so the rider is told before the round
    // trip rather than after it.
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "That password is too long")
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Include at least one letter and one number"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.confirmPassword === values.newPassword, {
    path: ["confirmPassword"],
    message: "The two passwords don't match",
  });

type PasswordValues = z.infer<typeof passwordSchema>;

/**
 * Change the password behind the account.
 *
 * The API signs out every *other* session when this succeeds and leaves this
 * one alone, so there is nothing to do afterwards but say so.
 */
export function ChangePasswordCard() {
  const change = useMutation({ mutationFn: authApi.changePassword });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      reset();
      toast.success("Password changed", {
        description: "Your other devices have been signed out.",
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't change your password.");
    }
  });

  return (
    <Card className="gap-4">
      <Text className="font-sans text-[15px] font-semibold text-primary">Password</Text>

      <ControlledInput
        control={control}
        name="currentPassword"
        label="Current password"
        required
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="newPassword"
        label="New password"
        required
        hint="At least 8 characters, with a letter and a number."
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="confirmPassword"
        label="Confirm new password"
        required
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        editable={!isSubmitting}
      />

      <Button variant="outline" fullWidth onPress={() => void onSubmit()} loading={isSubmitting}>
        Change password
      </Button>
    </Card>
  );
}
