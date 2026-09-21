import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft, MapPin } from "lucide-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { Field } from "@/components/ui/input";
import { Body, Card, Heading } from "@/components/ui/primitives";
import { LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useGeolocation } from "@/hooks/use-geo";
import { useRestaurantCategories, useRegisterRestaurant } from "@/hooks/use-restaurants";
import { ApiError } from "@/lib/api-client";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { cn, hasText } from "@/lib/utils";
import { BusinessType, PriceRange, type PriceRange as PriceRangeType } from "@/types/enums";

/**
 * A vendor registering their own restaurant.
 *
 * Self-registration, matching the web app: the owner files this and an
 * administrator only approves or rejects it. There is no path where staff
 * register a restaurant on someone's behalf, which is why this sits inside the
 * vendor group rather than being an admin tool.
 *
 * Coordinates are mandatory — delivery radius, zone assignment and the map on
 * every order are computed from them — so the form cannot be submitted without
 * standing at the restaurant and pinning it. That is the correct constraint
 * rather than an inconvenience: a listing pinned from the owner's sofa delivers
 * to the wrong place.
 */

const registerSchema = z.object({
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
  minOrderAmount: z.string().trim().optional(),
  avgPreparationMinutes: z.string().trim().optional(),
});

type RegisterValues = z.infer<typeof registerSchema>;

const PRICE_LABELS: Record<PriceRangeType, string> = {
  [PriceRange.BUDGET]: "₨ Budget",
  [PriceRange.MODERATE]: "₨₨ Moderate",
  [PriceRange.PREMIUM]: "₨₨₨ Premium",
};

export default function VendorRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const registerRestaurant = useRegisterRestaurant();
  const categories = useRestaurantCategories({ activeOnly: true });
  const location = useGeolocation();

  const [businessType, setBusinessType] = React.useState<string>(BusinessType.RESTAURANT);
  const [priceRange, setPriceRange] = React.useState<string>(PriceRange.MODERATE);
  const [categoryIds, setCategoryIds] = React.useState<string[]>([]);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      description: "",
      phone: "",
      addressLine: "",
      landmark: "",
      minOrderAmount: "",
      avgPreparationMinutes: "30",
    },
    mode: "onTouched",
  });

  const coordinates = location.status === "ready" ? location.coordinates : null;

  const toggleCategory = (id: string) => {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    if (coordinates === null) {
      toast.error("Pin your location first", {
        description: "Delivery zones and the order map are worked out from it.",
      });
      return;
    }

    // `categoryIds` is required by the API, not optional — a listing with no
    // cuisine cannot be filtered or found.
    if (categoryIds.length === 0) {
      toast.error("Choose at least one cuisine");
      return;
    }

    const minOrder = Number(values.minOrderAmount);
    const prepMinutes = Number(values.avgPreparationMinutes);

    try {
      await registerRestaurant.mutateAsync({
        name: values.name,
        ...(hasText(values.description) && { description: values.description }),
        phone: values.phone,
        addressLine: values.addressLine,
        ...(hasText(values.landmark) && { landmark: values.landmark }),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        categoryIds,
        businessType: businessType as BusinessType,
        priceRange: priceRange as PriceRangeType,
        ...(Number.isFinite(minOrder) && minOrder > 0 && { minOrderAmount: minOrder }),
        ...(Number.isFinite(prepMinutes) &&
          prepMinutes > 0 && { avgPreparationMinutes: Math.round(prepMinutes) }),
      });

      toast.success("Registered", {
        description: "An administrator will review your listing.",
      });
      router.replace("/vendor");
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.status === 409
            ? "You already have a restaurant registered."
            : error.message
          : "Couldn't register that. Please try again.",
      );
    }
  });

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/vendor"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">
          Register your restaurant
        </Text>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        <Body muted className="text-[13px]">
          An administrator reviews every listing before it goes live. You can set up your menu
          and hours while you wait.
        </Body>

        <ControlledInput
          control={control}
          name="name"
          label="Restaurant name"
          required
          editable={!isSubmitting}
        />

        <Field label="What kind of place is it?" required>
          <View className="gap-2">
            {Object.entries(BUSINESS_TYPES).map(([value, meta]) => {
              const active = businessType === value;

              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setBusinessType(value)}
                  className={cn(
                    "rounded-input border px-3 py-2.5",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[14px]",
                      active ? "font-semibold text-brand" : "text-primary",
                    )}
                  >
                    {meta.label}
                  </Text>
                  <Text className="font-sans text-[12px] text-secondary">{meta.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field
          label="What do you cook?"
          required
          hint="Pick every cuisine that applies — this is how customers find you."
        >
          {categories.isPending ? (
            <LoadingState />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {(categories.data?.items ?? []).map((category) => {
                const active = categoryIds.includes(category.id);

                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => toggleCategory(category.id)}
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
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Field>

        <Field label="Price range" required>
          <View className="flex-row gap-2">
            {Object.entries(PRICE_LABELS).map(([value, label]) => {
              const active = priceRange === value;

              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPriceRange(value)}
                  className={cn(
                    "flex-1 items-center rounded-input border py-2.5",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[13px]",
                      active ? "font-semibold text-brand" : "text-primary",
                    )}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <ControlledInput
          control={control}
          name="description"
          label="Description"
          placeholder="What you're known for"
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
          hint="Riders and customers call this."
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

        {/*
          Required by the API and genuinely load-bearing — this has to be done
          standing at the restaurant, not from home.
        */}
        <Card className="gap-2">
          <Text className="font-sans text-[14px] font-semibold text-primary">
            Pin your location
          </Text>
          <Body muted className="text-[13px]">
            Do this while you are at the restaurant. Your delivery area and every order map are
            worked out from this point.
          </Body>

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
          name="minOrderAmount"
          label="Minimum order"
          hint="Leave blank for no minimum."
          keyboardType="number-pad"
          editable={!isSubmitting}
        />

        <ControlledInput
          control={control}
          name="avgPreparationMinutes"
          label="Typical preparation time (minutes)"
          keyboardType="number-pad"
          editable={!isSubmitting}
        />

        <Button
          fullWidth
          size="lg"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={coordinates === null}
        >
          Submit for review
        </Button>
      </ScrollView>
    </View>
  );
}
