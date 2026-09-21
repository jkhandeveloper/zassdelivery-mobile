import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronRight, Trash2, Users } from "lucide-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { useAuth } from "@/components/providers";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { VendorGate } from "@/components/shared/vendor-gate";
import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { Field, Input } from "@/components/ui/input";
import { Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useRestaurantHours, useRestaurantImages } from "@/hooks/use-restaurants";
import {
  useAddImage,
  useDeleteImage,
  useSetHours,
  useSetRestaurantQrCodes,
  useUpdateMyRestaurant,
} from "@/hooks/use-vendor";
import { ApiError } from "@/lib/api-client";
import { MAX_PAYMENT_QR_CODES, QR_PROVIDER_LABELS, QR_PROVIDER_ORDER } from "@/lib/payment-labels";
import { cn, hasText } from "@/lib/utils";
import { UserRole } from "@/types/auth";
import { DayOfWeek, type PaymentQrProvider } from "@/types/enums";
import type { BusinessHourDto, RestaurantAdminDto } from "@/types/restaurant";
import type { PaymentQrCodeInputDto } from "@/types/payment";

/**
 * Everything about the listing that is not the menu or the order queue.
 *
 * The web app splits this into four routes. Here it is one scrolling screen
 * with four sections, because on a phone four taps to reach "change my opening
 * hours" is worse than one scroll — and unlike the web there is no sidebar to
 * make the split navigable.
 *
 * Payment QR codes are the section to be careful about: they are where a
 * customer's money goes. The platform never holds it, so an incorrect code
 * means a customer paying a stranger with no way to reverse it.
 */

const DAYS: readonly { key: string; label: string }[] = [
  { key: DayOfWeek.MONDAY, label: "Monday" },
  { key: DayOfWeek.TUESDAY, label: "Tuesday" },
  { key: DayOfWeek.WEDNESDAY, label: "Wednesday" },
  { key: DayOfWeek.THURSDAY, label: "Thursday" },
  { key: DayOfWeek.FRIDAY, label: "Friday" },
  { key: DayOfWeek.SATURDAY, label: "Saturday" },
  { key: DayOfWeek.SUNDAY, label: "Sunday" },
];

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter the restaurant name").max(120, "That name is too long"),
  description: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => /^(?:\+92|92|0)?3\d{9}$/.test(value.replace(/[\s-]/g, "")),
      "Enter a valid mobile number, like 0300 1234567",
    ),
  addressLine: z.string().trim().min(5, "Enter the street address"),
  landmark: z.string().trim().optional(),
  minOrderAmount: z.string().trim(),
  avgPreparationMinutes: z.string().trim(),
});

type ProfileValues = z.infer<typeof profileSchema>;

function ProfileSection({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const update = useUpdateMyRestaurant(restaurant.id);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: restaurant.name,
      description: restaurant.description ?? "",
      phone: restaurant.phone,
      addressLine: restaurant.addressLine,
      landmark: restaurant.landmark ?? "",
      minOrderAmount: String(restaurant.minOrderAmount),
      avgPreparationMinutes: String(restaurant.avgPreparationMinutes),
    },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    const minOrder = Number(values.minOrderAmount);
    const prepMinutes = Number(values.avgPreparationMinutes);

    // Numbers come out of text inputs as strings; a NaN here would be sent to
    // the API and rejected with a message the vendor cannot act on.
    if (!Number.isFinite(minOrder) || minOrder < 0) {
      toast.error("Minimum order must be a number");
      return;
    }

    if (!Number.isFinite(prepMinutes) || prepMinutes <= 0) {
      toast.error("Preparation time must be a number of minutes");
      return;
    }

    try {
      await update.mutateAsync({
        name: values.name,
        ...(hasText(values.description) && { description: values.description }),
        phone: values.phone,
        addressLine: values.addressLine,
        ...(hasText(values.landmark) && { landmark: values.landmark }),
        minOrderAmount: minOrder,
        avgPreparationMinutes: Math.round(prepMinutes),
      });

      toast.success("Details saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save those details.");
    }
  });

  return (
    <Card className="gap-4">
      <Heading level={3}>Your restaurant</Heading>

      {/*
        No logo or cover uploader here, deliberately. `PATCH
        /restaurant-management/:id` has no `logoUrl` or `coverUrl` field — the
        API exposes no way for a vendor to change either, and the web app only
        ever reads them. Adding a field that silently does nothing would be
        worse than its absence; the gallery below is the photo surface a vendor
        actually controls.
      */}
      <ControlledInput control={control} name="name" label="Name" required editable={!isSubmitting} />
      <ControlledInput
        control={control}
        name="description"
        label="Description"
        placeholder="What you cook, in a line or two"
        multiline
        className="min-h-[80px] py-2.5"
        textAlignVertical="top"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="phone"
        label="Phone"
        required
        keyboardType="phone-pad"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="addressLine"
        label="Address"
        required
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="landmark"
        label="Landmark"
        hint="What a rider would recognise from the road."
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="minOrderAmount"
        label="Minimum order"
        required
        keyboardType="number-pad"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="avgPreparationMinutes"
        label="Typical preparation time (minutes)"
        required
        hint="Customers see this as the wait before a rider collects."
        keyboardType="number-pad"
        editable={!isSubmitting}
      />

      <Button fullWidth onPress={() => void onSubmit()} loading={isSubmitting} disabled={!isDirty}>
        Save details
      </Button>
    </Card>
  );
}

function HoursSection({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const hours = useRestaurantHours(restaurant.id);
  const setHours = useSetHours(restaurant.id);

  /**
   * The week, as editable rows.
   *
   * Seeded from the server once and then owned locally, because the seven days
   * are saved as one payload — `PUT …/hours` replaces the whole week. Saving
   * per-row would mean seven requests and a half-updated week if one failed.
   */
  const [draft, setDraft] = React.useState<BusinessHourDto[] | null>(null);
  const [seededFor, setSeededFor] = React.useState<string | null>(null);

  if (hours.data !== undefined && seededFor !== restaurant.id) {
    setSeededFor(restaurant.id);
    setDraft(
      DAYS.map((day) => {
        const existing = hours.data.hours.find((entry) => entry.dayOfWeek === day.key);

        return {
          dayOfWeek: day.key,
          opensAt: existing?.opensAt ?? "10:00",
          closesAt: existing?.closesAt ?? "23:00",
          isClosed: existing?.isClosed ?? existing === undefined,
        };
      }),
    );
  }

  if (hours.isPending || draft === null) {
    return (
      <Card>
        <LoadingState />
      </Card>
    );
  }

  const setDay = (dayOfWeek: string, patch: Partial<BusinessHourDto>) => {
    setDraft((current) =>
      (current ?? []).map((entry) =>
        entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry,
      ),
    );
  };

  return (
    <Card className="gap-3">
      <Heading level={3}>Opening hours</Heading>
      <Body muted className="text-[13px]">
        Customers can browse any time, but can only order inside these hours.
      </Body>

      {draft.map((entry) => {
        const day = DAYS.find((item) => item.key === entry.dayOfWeek);
        const open = entry.isClosed !== true;

        return (
          <View key={entry.dayOfWeek} className="gap-2">
            <Divider />
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[14px] font-semibold text-primary">
                {day?.label ?? entry.dayOfWeek}
              </Text>
              <Switch
                value={open}
                accessibilityLabel={`${day?.label ?? entry.dayOfWeek}: ${open ? "open" : "closed"}`}
                onValueChange={(next) => setDay(entry.dayOfWeek, { isClosed: !next })}
                trackColor={{ false: "#CFDFE9", true: "#22D3EE" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {open ? (
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Input
                    value={entry.opensAt}
                    onChangeText={(text) => setDay(entry.dayOfWeek, { opensAt: text })}
                    placeholder="10:00"
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel={`${day?.label ?? ""} opening time`}
                  />
                </View>
                <Text className="font-sans text-[14px] text-muted">to</Text>
                <View className="flex-1">
                  <Input
                    value={entry.closesAt}
                    onChangeText={(text) => setDay(entry.dayOfWeek, { closesAt: text })}
                    placeholder="23:00"
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel={`${day?.label ?? ""} closing time`}
                  />
                </View>
              </View>
            ) : (
              <Text className="font-sans text-[13px] text-muted">Closed all day</Text>
            )}
          </View>
        );
      })}

      <Button
        fullWidth
        loading={setHours.isPending}
        onPress={() => {
          // 24-hour HH:MM. Validated here because the API rejects anything else
          // with one message for the whole payload, which would not say which
          // day was wrong.
          const bad = draft.find(
            (entry) =>
              entry.isClosed !== true &&
              (!/^\d{2}:\d{2}$/.test(entry.opensAt) || !/^\d{2}:\d{2}$/.test(entry.closesAt)),
          );

          if (bad !== undefined) {
            const label = DAYS.find((item) => item.key === bad.dayOfWeek)?.label ?? bad.dayOfWeek;
            toast.error(`Check ${label}`, { description: "Times must look like 10:00 and 23:00." });
            return;
          }

          setHours.mutate(
            { hours: draft },
            {
              onSuccess: () => toast.success("Hours saved"),
              onError: (error) =>
                toast.error(error instanceof ApiError ? error.message : "Couldn't save hours."),
            },
          );
        }}
      >
        Save hours
      </Button>
    </Card>
  );
}

function GallerySection({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const images = useRestaurantImages(restaurant.id);
  const addImage = useAddImage(restaurant.id);
  const deleteImage = useDeleteImage(restaurant.id);

  return (
    <Card className="gap-3">
      <Heading level={3}>Photos</Heading>
      <Body muted className="text-[13px]">
        Pictures of your food and your place. These show on your listing.
      </Body>

      <ImageUploadField
        label="Add a photo"
        folder="restaurant-gallery"
        value={null}
        onChange={(url) => {
          if (url === null) return;

          addImage.mutate(
            { url },
            {
              onSuccess: () => toast.success("Photo added"),
              onError: (error) =>
                toast.error(error instanceof ApiError ? error.message : "Couldn't add that."),
            },
          );
        }}
      />

      {images.data !== undefined && images.data.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {images.data.map((image) => (
            <View key={image.id} className="relative">
              <Image
                source={{ uri: image.url }}
                style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: "#E4EEF5" }}
                contentFit="cover"
                accessible={false}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove this photo"
                hitSlop={6}
                onPress={() =>
                  Alert.alert("Remove this photo?", undefined, [
                    { text: "Keep it", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () =>
                        deleteImage.mutate(image.id, {
                          onSuccess: () => toast.success("Photo removed"),
                          onError: (error) =>
                            toast.error(
                              error instanceof ApiError ? error.message : "Couldn't remove that.",
                            ),
                        }),
                    },
                  ])
                }
                className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/60"
              >
                <Trash2 size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Body muted className="text-[13px]">
          No photos yet.
        </Body>
      )}
    </Card>
  );
}

function PaymentsSection({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const setCodes = useSetRestaurantQrCodes(restaurant.id);

  const existing = restaurant.paymentQrCodes ?? [];

  const [provider, setProvider] = React.useState<PaymentQrProvider>(QR_PROVIDER_ORDER[0]);
  const [accountTitle, setAccountTitle] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  /**
   * The whole set is replaced on every save, so adding one means sending the
   * existing ones back alongside it. `PUT` semantics, not `POST` — dropping the
   * existing codes here would silently delete a vendor's other accounts.
   */
  const save = (next: PaymentQrCodeInputDto[]) => {
    setCodes.mutate(
      { codes: next },
      {
        onSuccess: () => toast.success("Payment codes updated"),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Couldn't save those."),
      },
    );
  };

  const asInput = (): PaymentQrCodeInputDto[] =>
    existing.map((code) => ({
      provider: code.provider,
      ...(hasText(code.label) && { label: code.label }),
      accountTitle: code.accountTitle,
      ...(hasText(code.accountNumber) && { accountNumber: code.accountNumber }),
      imageUrl: code.imageUrl,
    }));

  const onAdd = () => {
    if (imageUrl === null) {
      toast.error("Add a photo of the QR code");
      return;
    }

    if (accountTitle.trim() === "") {
      toast.error("Enter the account title", {
        description: "It is what the customer sees before confirming.",
      });
      return;
    }

    save([
      ...asInput(),
      {
        provider,
        accountTitle: accountTitle.trim(),
        ...(accountNumber.trim() !== "" && { accountNumber: accountNumber.trim() }),
        imageUrl,
      },
    ]);

    setAccountTitle("");
    setAccountNumber("");
    setImageUrl(null);
  };

  return (
    <Card className="gap-3">
      <Heading level={3}>Scan &amp; pay</Heading>
      <Body muted className="text-[13px]">
        Customers scan these to pay you directly. ZassDelivery never holds your money, so make
        sure the account details are yours and correct.
      </Body>

      {existing.length > 0 ? (
        <View className="gap-2">
          {existing.map((code, index) => (
            <View
              key={`${code.provider}-${index}`}
              className="flex-row items-center gap-3 rounded-input border border-border-subtle bg-surface-muted p-2"
            >
              <Image
                source={{ uri: code.imageUrl }}
                style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: "#FFFFFF" }}
                contentFit="contain"
                accessible={false}
              />
              <View className="flex-1">
                <Text className="font-sans text-[14px] font-semibold text-primary">
                  {hasText(code.label) ? code.label : QR_PROVIDER_LABELS[code.provider]}
                </Text>
                <Text className="font-sans text-[12px] text-secondary">{code.accountTitle}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${code.accountTitle}`}
                hitSlop={8}
                onPress={() =>
                  Alert.alert(
                    "Remove this payment code?",
                    "Customers will no longer be able to pay you this way.",
                    [
                      { text: "Keep it", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () =>
                          save(asInput().filter((_, position) => position !== index)),
                      },
                    ],
                  )
                }
                className="h-9 w-9 items-center justify-center"
              >
                <Trash2 size={16} color="#DC2626" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View className="rounded-input bg-warning-soft px-3 py-2.5">
          <Text className="font-sans text-[13px] font-medium text-warning">
            No codes yet — scan-to-pay is switched off at checkout until you add one.
          </Text>
        </View>
      )}

      {existing.length < MAX_PAYMENT_QR_CODES ? (
        <View className="gap-3">
          <Divider />
          <Text className="font-sans text-[14px] font-semibold text-primary">Add a code</Text>

          <Field label="Wallet or bank" required>
            <View className="flex-row flex-wrap gap-2">
              {QR_PROVIDER_ORDER.map((option) => {
                const active = provider === option;

                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setProvider(option)}
                    className={cn(
                      "rounded-full border px-3.5 py-2",
                      active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                    )}
                  >
                    <Text
                      className={cn(
                        "font-sans text-[13px] font-semibold",
                        active ? "text-brand" : "text-secondary",
                      )}
                    >
                      {QR_PROVIDER_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field
            label="Account title"
            required
            hint="The name the customer sees in their app before confirming."
          >
            <Input
              value={accountTitle}
              onChangeText={setAccountTitle}
              placeholder="As it appears on the account"
              autoCapitalize="words"
            />
          </Field>

          <Field label="Account or wallet number">
            <Input
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="Optional"
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
          </Field>

          <ImageUploadField
            label="Photo of the QR code"
            folder="payment-qr-codes"
            aspect="square"
            value={imageUrl}
            onChange={setImageUrl}
            hint="A screenshot from your wallet app is fine."
          />

          <Button fullWidth loading={setCodes.isPending} onPress={onAdd}>
            Add this code
          </Button>
        </View>
      ) : (
        <Body muted className="text-[12px]">
          You have the maximum of {MAX_PAYMENT_QR_CODES} codes. Remove one to add another.
        </Body>
      )}
    </Card>
  );
}

function VendorSettings({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isOwner = user?.role === UserRole.VENDOR_OWNER;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        <Heading level={2} className="pt-2">
          Settings
        </Heading>

        <ProfileSection restaurant={restaurant} />
        <HoursSection restaurant={restaurant} />
        <GallerySection restaurant={restaurant} />

        {/*
          Both of these are owner business. The API enforces it, so a kitchen
          account seeing them would only find a 403 on the other side.
        */}
        {isOwner ? (
          <>
            <PaymentsSection restaurant={restaurant} />

            <Card>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/vendor/staff")}
                className="flex-row items-center gap-3 py-1"
              >
                <Users size={18} color="#75909F" />
                <Text className="flex-1 font-sans text-[15px] text-primary">
                  Kitchen accounts
                </Text>
                <ChevronRight size={18} color="#75909F" />
              </Pressable>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  return <VendorGate>{(restaurant) => <VendorSettings restaurant={restaurant} />}</VendorGate>;
}
