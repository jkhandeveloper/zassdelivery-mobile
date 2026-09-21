import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, Eye, EyeOff, UserPlus } from "lucide-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { useAuth } from "@/components/providers";
import { VendorGate } from "@/components/shared/vendor-gate";
import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { InputAction } from "@/components/ui/input";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useAddStaff, useRestaurantStaff } from "@/hooks/use-vendor";
import { ApiError } from "@/lib/api-client";
import { formatDate, hasText } from "@/lib/utils";
import { UserRole, UserStatus } from "@/types/auth";
import type { RestaurantAdminDto } from "@/types/restaurant";

/**
 * Kitchen accounts.
 *
 * The owner creates these outright — phone, name and a password they hand over
 * — rather than sending an invitation, because that is what the API does and
 * because it fits how these are actually used: a cook is standing next to the
 * owner when the account is made, and does not necessarily have email.
 *
 * Which means the password is shown once, here, and the owner has to pass it
 * on. The screen says so explicitly; a password created and never displayed is
 * an account nobody can use.
 */

const staffSchema = z.object({
  fullName: z.string().trim().min(2, "Enter their name").max(120, "That name is too long"),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => /^(?:\+92|92|0)?3\d{9}$/.test(value.replace(/[\s-]/g, "")),
      "Enter a valid mobile number, like 0300 1234567",
    ),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .refine(
      (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
      "Include at least one letter and one number",
    ),
});

type StaffValues = z.infer<typeof staffSchema>;

function AddStaffForm({ restaurantId }: { restaurantId: string }) {
  const addStaff = useAddStaff(restaurantId);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<StaffValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { fullName: "", phone: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addStaff.mutateAsync({
        fullName: values.fullName,
        phone: values.phone,
        password: values.password,
      });

      toast.success(`${values.fullName.split(" ")[0]}'s account is ready`, {
        description: "Give them the phone number and password you just set.",
      });
      reset();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.status === 409
            ? "An account already exists with that phone number."
            : error.message
          : "Couldn't create that account.",
      );
    }
  });

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Heading level={3}>Add a kitchen account</Heading>
        <Body muted className="text-[13px]">
          They can run the menu and the order queue. They cannot see billing or your bank
          details.
        </Body>
      </View>

      <ControlledInput
        control={control}
        name="fullName"
        label="Their name"
        required
        autoCapitalize="words"
        editable={!isSubmitting}
      />

      <ControlledInput
        control={control}
        name="phone"
        label="Their phone number"
        required
        hint="This is how they sign in."
        keyboardType="phone-pad"
        autoCorrect={false}
        editable={!isSubmitting}
      />

      <ControlledInput
        control={control}
        name="password"
        label="Password you'll give them"
        required
        hint="Shown only while you type it — write it down before saving."
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
        trailing={
          <InputAction
            label={showPassword ? "Hide password" : "Show password"}
            onPress={() => setShowPassword((previous) => !previous)}
          >
            {showPassword ? (
              <EyeOff size={20} color="#75909F" />
            ) : (
              <Eye size={20} color="#75909F" />
            )}
          </InputAction>
        }
      />

      <Button
        fullWidth
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        icon={<UserPlus size={16} color="#04202B" />}
      >
        Create account
      </Button>
    </Card>
  );
}

function VendorStaff({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isOwner = user?.role === UserRole.VENDOR_OWNER;
  const staff = useRestaurantStaff(isOwner ? restaurant.id : null);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/vendor/settings"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Kitchen accounts</Text>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        {!isOwner ? (
          <Card className="gap-2">
            <Heading level={3}>Owner only</Heading>
            <Body muted>Only the restaurant owner can create kitchen accounts.</Body>
          </Card>
        ) : (
          <>
            <Card className="gap-2">
              <Text className="font-sans text-[15px] font-semibold text-primary">
                Your team
              </Text>

              {staff.isPending ? (
                <LoadingState />
              ) : staff.isError ? (
                <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
              ) : staff.data.length === 0 ? (
                <Body muted className="text-[13px]">
                  No kitchen accounts yet. You are running the restaurant on your own account.
                </Body>
              ) : (
                staff.data.map((member, index) => (
                  <View key={member.id}>
                    {index > 0 ? <Divider className="my-1" /> : null}
                    <View className="flex-row items-center justify-between gap-2 py-1">
                      <View className="flex-1">
                        <Text className="font-sans text-[15px] font-semibold text-primary">
                          {member.fullName}
                        </Text>
                        <Text
                          className="font-sans text-[13px] text-secondary"
                          style={{ fontVariant: ["tabular-nums"] }}
                        >
                          {member.phone}
                        </Text>
                        {hasText(member.email) ? (
                          <Text className="font-sans text-[12px] text-muted">{member.email}</Text>
                        ) : null}
                        <Text className="font-sans text-[12px] text-muted">
                          Added {formatDate(member.createdAt)}
                        </Text>
                      </View>

                      <Badge
                        tone={member.status === UserStatus.ACTIVE ? "success" : "warning"}
                      >
                        {member.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <AddStaffForm restaurantId={restaurant.id} />

            {/*
              Removing an account is not offered because the API has no endpoint
              for it from the vendor side. Saying where to go beats a button
              that 404s.
            */}
            <Body muted className="text-[12px]">
              To remove someone&apos;s access, contact support — it cannot be done from here yet.
            </Body>
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  return <VendorGate>{(restaurant) => <VendorStaff restaurant={restaurant} />}</VendorGate>;
}
