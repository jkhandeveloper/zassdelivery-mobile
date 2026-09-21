import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import {
  Bell,
  ChevronRight,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  Plus,
  ScrollText,
  TicketPercent,
} from "lucide-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { useAuth, useTheme } from "@/components/providers";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { RequireAuth } from "@/components/shared/role-guard";
import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { Field } from "@/components/ui/input";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useGeolocation } from "@/hooks/use-geo";
import {
  useAddresses,
  useCreateAddress,
  useProfile,
  useSetDefaultAddress,
  useUpdateProfile,
} from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import { cn, formatLandmark, hasText } from "@/lib/utils";
import { AddressLabel } from "@/types/enums";

/**
 * The account: details, addresses, appearance, and the way out.
 *
 * Addresses are the substantial part. They cannot be typed alone — the API
 * requires coordinates, because delivery zones and fees are computed from them —
 * so adding one pins the device's current position. That is the right default
 * for a food app: people order to where they are far more often than not.
 */

const ADDRESS_LABELS: Record<string, string> = {
  [AddressLabel.HOME]: "Home",
  [AddressLabel.WORK]: "Work",
  [AddressLabel.OTHER]: "Other",
};

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120, "That name is too long"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
});

type ProfileValues = z.infer<typeof profileSchema>;

const addressSchema = z.object({
  line1: z.string().trim().min(5, "Enter the street address"),
  line2: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  deliveryNotes: z.string().trim().optional(),
});

type AddressValues = z.infer<typeof addressSchema>;

function AddAddressSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const createAddress = useCreateAddress();
  const location = useGeolocation();

  const [label, setLabel] = React.useState<string>(AddressLabel.HOME);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { line1: "", line2: "", landmark: "", deliveryNotes: "" },
    mode: "onTouched",
  });

  const coordinates = location.status === "ready" ? location.coordinates : null;

  const onSubmit = handleSubmit(async (values) => {
    if (coordinates === null) {
      toast.error("We need your location first", {
        description: "Delivery fees and zones are worked out from it.",
      });
      return;
    }

    try {
      await createAddress.mutateAsync({
        label: label as AddressLabel,
        line1: values.line1,
        ...(hasText(values.line2) && { line2: values.line2 }),
        ...(hasText(values.landmark) && { landmark: values.landmark }),
        ...(hasText(values.deliveryNotes) && { deliveryNotes: values.deliveryNotes }),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });

      toast.success("Address saved");
      reset();
      location.reset();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Couldn't save that address.",
      );
    }
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-4 px-4 pb-8"
        style={{ paddingTop: insets.top + 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Heading level={2}>Add an address</Heading>

        <Field label="What is this place?">
          <View className="flex-row gap-2">
            {Object.entries(ADDRESS_LABELS).map(([value, text]) => {
              const active = label === value;

              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setLabel(value)}
                  className={cn(
                    "flex-1 items-center rounded-input border py-2.5",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[14px]",
                      active ? "font-semibold text-brand" : "text-primary",
                    )}
                  >
                    {text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {/*
          Coordinates are required by the API, so this is not optional polish.
          It is asked for on a tap rather than on mount: a permission prompt the
          user did not ask for is the one they reflexively dismiss, and a denied
          prompt cannot be re-asked.
        */}
        <Card className="gap-2">
          <Text className="font-sans text-[14px] font-semibold text-primary">
            Pin this address
          </Text>

          {coordinates !== null ? (
            <View className="flex-row items-center gap-2">
              <MapPin size={16} color="#047857" />
              <Text className="flex-1 font-sans text-[13px] text-success">
                Location captured
                {location.status === "ready" && location.accuracyMetres !== null
                  ? ` (±${location.accuracyMetres} m)`
                  : ""}
              </Text>
              <Button size="sm" variant="ghost" onPress={location.locate}>
                Redo
              </Button>
            </View>
          ) : location.status === "error" ? (
            <View className="gap-2">
              <Text className="font-sans text-[13px] text-danger">{location.message}</Text>
              <Button size="sm" variant="outline" onPress={location.locate}>
                Try again
              </Button>
            </View>
          ) : (
            <Button
              size="sm"
              variant="outline"
              loading={location.status === "locating"}
              onPress={location.locate}
              icon={<MapPin size={15} color="#0E7490" />}
            >
              Use my current location
            </Button>
          )}
        </Card>

        <ControlledInput
          control={control}
          name="line1"
          label="Street address"
          required
          placeholder="House 12, Street 4"
          editable={!isSubmitting}
        />
        <ControlledInput
          control={control}
          name="line2"
          label="Area or sector"
          placeholder="G-11/3"
          editable={!isSubmitting}
        />
        <ControlledInput
          control={control}
          name="landmark"
          label="Landmark"
          hint="What a rider would recognise from the road."
          placeholder="Pabbi Bus Stand"
          editable={!isSubmitting}
        />
        <ControlledInput
          control={control}
          name="deliveryNotes"
          label="Notes for the rider"
          placeholder="Second gate, ring the bell"
          multiline
          className="min-h-[70px] py-2.5"
          textAlignVertical="top"
          editable={!isSubmitting}
        />

        <Button
          fullWidth
          size="lg"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={coordinates === null}
        >
          Save address
        </Button>
        <Button variant="ghost" fullWidth onPress={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
      </ScrollView>
    </Modal>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 py-3"
    >
      {icon}
      <Text className="flex-1 font-sans text-[15px] text-primary">{label}</Text>
      <ChevronRight size={18} color="#75909F" />
    </Pressable>
  );
}

function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { logout } = useAuth();
  const { preference, setPreference } = useTheme();

  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const addresses = useAddresses({ limit: 20 });
  const setDefault = useSetDefaultAddress();

  const [addingAddress, setAddingAddress] = React.useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", email: "" },
    mode: "onTouched",
  });

  /**
   * Seed the form once the profile arrives.
   *
   * Keyed on the user id so it does not overwrite what someone is mid-way
   * through typing on every background refetch.
   */
  const [seededFor, setSeededFor] = React.useState<string | null>(null);

  if (profile.data !== undefined && seededFor !== profile.data.id) {
    setSeededFor(profile.data.id);
    reset({ fullName: profile.data.fullName, email: profile.data.email ?? "" });
  }

  const onSave = handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync({
        fullName: values.fullName,
        // An empty string is a real instruction here — it clears the email —
        // whereas omitting the field leaves it as it was.
        email: values.email,
      });
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save that.");
    }
  });

  const onLogout = React.useCallback(() => {
    Alert.alert("Sign out?", "You'll need your phone number and password to sign back in.", [
      { text: "Stay signed in", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);
  }, [logout]);

  if (profile.isPending) {
    return <LoadingState />;
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        <Heading level={2} className="pt-2">
          Your account
        </Heading>

        <Card className="gap-4">
          <ImageUploadField
            label="Profile photo"
            folder="avatars"
            aspect="square"
            allowsEditing
            value={profile.data?.avatarUrl ?? null}
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
                {profile.data?.phone}
              </Text>
            </View>
          </Field>

          <Button
            fullWidth
            onPress={() => void onSave()}
            loading={isSubmitting}
            disabled={!isDirty}
          >
            Save changes
          </Button>
        </Card>

        {/* ── Addresses ─────────────────────────────────────── */}
        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-[15px] font-semibold text-primary">Addresses</Text>
            <Button
              size="sm"
              variant="outline"
              icon={<Plus size={15} color="#0E7490" />}
              onPress={() => setAddingAddress(true)}
            >
              Add
            </Button>
          </View>

          {addresses.data !== undefined && addresses.data.items.length > 0 ? (
            addresses.data.items.map((address, index) => (
              <View key={address.id}>
                {index > 0 ? <Divider className="my-1" /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Make ${address.line1} the default address`}
                  disabled={address.isDefault || setDefault.isPending}
                  onPress={() =>
                    setDefault.mutate(address.id, {
                      onSuccess: () => toast.success("Default address updated"),
                      onError: (error) =>
                        toast.error(
                          error instanceof ApiError ? error.message : "Couldn't update that.",
                        ),
                    })
                  }
                  className="flex-row items-start gap-2 py-2"
                >
                  <MapPin size={16} color="#75909F" />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-sans text-[14px] font-semibold text-primary">
                        {hasText(address.label)
                          ? (ADDRESS_LABELS[address.label] ?? address.label)
                          : "Address"}
                      </Text>
                      {address.isDefault ? <Badge tone="brand">Default</Badge> : null}
                    </View>
                    <Text className="font-sans text-[13px] text-secondary">{address.line1}</Text>
                    {hasText(address.landmark) ? (
                      <Text className="font-sans text-[12px] text-muted">
                        {formatLandmark(address.landmark)}
                      </Text>
                    ) : null}
                    {!address.isDeliverable ? (
                      <Text className="font-sans text-[12px] font-medium text-danger">
                        Outside our delivery area
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            ))
          ) : (
            <Body muted className="text-[13px]">
              No addresses saved. Add one so we know where to deliver.
            </Body>
          )}
        </Card>

        {/* ── Appearance ────────────────────────────────────── */}
        <Card className="gap-2">
          <Text className="font-sans text-[15px] font-semibold text-primary">Appearance</Text>
          <View className="flex-row gap-2">
            {(["light", "dark", "system"] as const).map((option) => {
              const active = preference === option;

              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPreference(option)}
                  className={cn(
                    "flex-1 items-center rounded-input border py-2.5",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[14px] capitalize",
                      active ? "font-semibold text-brand" : "text-primary",
                    )}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* ── Elsewhere ─────────────────────────────────────── */}
        <Card>
          <LinkRow
            icon={<Heart size={18} color="#75909F" />}
            label="Favourites"
            onPress={() => router.push("/favorites")}
          />
          <Divider />
          <LinkRow
            icon={<TicketPercent size={18} color="#75909F" />}
            label="Offers"
            onPress={() => router.push("/offers")}
          />
          <Divider />
          <LinkRow
            icon={<Bell size={18} color="#75909F" />}
            label="Notifications"
            onPress={() => router.push("/notifications")}
          />
          <Divider />
          <LinkRow
            icon={<LifeBuoy size={18} color="#75909F" />}
            label="Help & support"
            onPress={() => router.push("/support")}
          />
          <Divider />
          <LinkRow
            icon={<ScrollText size={18} color="#75909F" />}
            label="Terms, privacy & refunds"
            onPress={() => router.push("/legal")}
          />
        </Card>

        <Button
          variant="outline"
          fullWidth
          onPress={onLogout}
          icon={<LogOut size={17} color="#0A1622" />}
        >
          Sign out
        </Button>
      </ScrollView>

      <AddAddressSheet visible={addingAddress} onClose={() => setAddingAddress(false)} />
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <ProfileScreen />
    </RequireAuth>
  );
}
