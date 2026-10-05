import { X } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageUploadField } from "@/components/shared/image-upload-field";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Body } from "@/components/ui/primitives";
import { LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useCreateMenuItem, useVendorMenus } from "@/hooks/use-vendor";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SpiceLevel } from "@/types/enums";

/**
 * Adding a dish, including for a business that has no menu yet.
 *
 * A dish belongs to a section, so the section has to exist first — but making
 * a vendor build a menu tree before they can type in their first kebab is the
 * wrong order. Choosing "New section" here creates the menu and the section on
 * the way through; see `useCreateMenuItem`.
 *
 * The same fields as the web app's form, and deliberately no more: sizes and
 * add-on groups are still authored on the web, where there is room for them.
 * What a vendor with only a phone must be able to do is get a dish on sale.
 */

/** The picker value that means "type a name and make the section as we go". */
const NEW_SECTION = "__new__";

const SPICE_LABELS: readonly { value: SpiceLevel; label: string }[] = [
  { value: SpiceLevel.NONE, label: "Not spicy" },
  { value: SpiceLevel.MILD, label: "Mild" },
  { value: SpiceLevel.MEDIUM, label: "Medium" },
  { value: SpiceLevel.HOT, label: "Hot" },
  { value: SpiceLevel.EXTRA_HOT, label: "Extra hot" },
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}

export function AddDishSheet({
  restaurantId,
  visible,
  onClose,
}: {
  restaurantId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const menus = useVendorMenus(visible ? restaurantId : null);
  const create = useCreateMenuItem(restaurantId);

  const sections = React.useMemo(
    () =>
      (menus.data?.items ?? []).flatMap((menu) =>
        menu.categories.map((category) => ({
          id: category.id,
          // The menu name only earns its place when there is more than one.
          label:
            (menus.data?.items.length ?? 0) > 1
              ? `${menu.name} · ${category.name}`
              : category.name,
        })),
      ),
    [menus.data],
  );

  const [chosenSection, setChosenSection] = React.useState<string | null>(null);
  const [newSection, setNewSection] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [basePrice, setBasePrice] = React.useState("");
  const [discountedPrice, setDiscountedPrice] = React.useState("");
  const [prepMinutes, setPrepMinutes] = React.useState("");
  const [spiceLevel, setSpiceLevel] = React.useState<SpiceLevel>(SpiceLevel.NONE);
  const [isVegetarian, setIsVegetarian] = React.useState(false);

  // Falls back to the first section once the menu tree arrives, without
  // overwriting a choice already made — and to "new section" when there are none.
  const section = chosenSection ?? sections[0]?.id ?? NEW_SECTION;
  const creatingSection = section === NEW_SECTION;

  const price = Number(basePrice);
  const discount = discountedPrice.trim() === "" ? null : Number(discountedPrice);

  const priceError =
    basePrice.trim() !== "" && (!Number.isFinite(price) || price < 0)
      ? "Enter a price in rupees, e.g. 450."
      : undefined;

  // The API refuses an offer price above the normal one; saying so here beats
  // a round trip to find out.
  const discountError =
    discount !== null && (!Number.isFinite(discount) || discount < 0)
      ? "Enter an amount in rupees, or leave it empty."
      : discount !== null && Number.isFinite(price) && discount > price
        ? "An offer price has to be below the normal price."
        : undefined;

  const canSubmit =
    !menus.isPending &&
    name.trim().length >= 2 &&
    basePrice.trim() !== "" &&
    priceError === undefined &&
    discountError === undefined &&
    (creatingSection ? newSection.trim() !== "" : true);

  const reset = () => {
    setChosenSection(null);
    setNewSection("");
    setName("");
    setDescription("");
    setImageUrl(null);
    setBasePrice("");
    setDiscountedPrice("");
    setPrepMinutes("");
    setSpiceLevel(SpiceLevel.NONE);
    setIsVegetarian(false);
  };

  const onSubmit = () => {
    if (!canSubmit) {
      return;
    }

    create.mutate(
      {
        menuCategoryId: creatingSection ? null : section,
        ...(creatingSection && { newSectionName: newSection.trim() }),
        dish: {
          name: name.trim(),
          basePrice: price,
          spiceLevel,
          isVegetarian,
          ...(description.trim() !== "" && { description: description.trim() }),
          ...(imageUrl !== null && { imageUrl }),
          ...(discount !== null && { discountedPrice: discount }),
          ...(prepMinutes.trim() !== "" && { preparationMinutes: Number(prepMinutes) }),
        },
      },
      {
        onSuccess: (dish) => {
          toast.success(`${dish.name} is on your menu`);
          reset();
          onClose();
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "We couldn't add that dish.",
          ),
      },
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-2 py-2">
          <Text className="flex-1 px-2 font-display text-[19px] font-bold text-primary">
            Add a dish
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center"
          >
            <X size={22} color="#4C6577" />
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="gap-4 px-4 pb-6" keyboardShouldPersistTaps="handled">
          <Body muted className="text-[13px]">
            It goes on your menu as soon as it&apos;s saved — mark it sold out any time.
          </Body>

          {menus.isPending ? (
            <LoadingState label="Loading your menu…" />
          ) : (
            <>
              <Field
                label="Section"
                required
                hint={
                  sections.length === 0
                    ? "You have no sections yet — name one and we'll create it."
                    : undefined
                }
              >
                <View className="flex-row flex-wrap gap-2">
                  {sections.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      active={section === option.id}
                      onPress={() => setChosenSection(option.id)}
                    />
                  ))}
                  <Chip
                    label="+ New section"
                    active={creatingSection}
                    onPress={() => setChosenSection(NEW_SECTION)}
                  />
                </View>
              </Field>

              {creatingSection ? (
                <Field
                  label="New section name"
                  required
                  hint="How it's headed on your storefront, e.g. Karahi."
                >
                  <Input
                    value={newSection}
                    onChangeText={setNewSection}
                    placeholder="Starters"
                    autoCapitalize="words"
                    maxLength={80}
                  />
                </Field>
              ) : null}

              <Field label="Dish name" required>
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Chapli Kabab"
                  autoCapitalize="words"
                  maxLength={140}
                />
              </Field>

              <View className="flex-row gap-3">
                <Field label="Price (Rs)" required error={priceError} className="flex-1">
                  <Input
                    value={basePrice}
                    onChangeText={(text) => setBasePrice(text.replace(/[^\d.]/g, ""))}
                    placeholder="450"
                    keyboardType="decimal-pad"
                  />
                </Field>
                <Field
                  label="Offer price (Rs)"
                  hint={discountError === undefined ? "Optional." : undefined}
                  error={discountError}
                  className="flex-1"
                >
                  <Input
                    value={discountedPrice}
                    onChangeText={(text) => setDiscountedPrice(text.replace(/[^\d.]/g, ""))}
                    placeholder="399"
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>

              <Field label="Description" hint="Optional. What's in it, in a line.">
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Minced beef patty with tomato and coriander."
                  multiline
                  maxLength={800}
                  className="min-h-[70px] py-2.5"
                  textAlignVertical="top"
                />
              </Field>

              <ImageUploadField
                label="Photo"
                folder="menu-items"
                value={imageUrl}
                onChange={setImageUrl}
                hint="Optional, but a dish with a photo sells noticeably better."
              />

              <Field
                label="Preparation time (minutes)"
                hint="Optional — your business's average is used otherwise."
              >
                <Input
                  value={prepMinutes}
                  onChangeText={(text) => setPrepMinutes(text.replace(/\D/g, ""))}
                  placeholder="15"
                  keyboardType="number-pad"
                />
              </Field>

              <Field label="Spice level">
                <View className="flex-row flex-wrap gap-2">
                  {SPICE_LABELS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      active={spiceLevel === option.value}
                      onPress={() => setSpiceLevel(option.value)}
                    />
                  ))}
                </View>
              </Field>

              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-[14px] font-medium text-primary">Vegetarian</Text>
                <Switch
                  value={isVegetarian}
                  onValueChange={setIsVegetarian}
                  accessibilityLabel="Vegetarian"
                  trackColor={{ false: "#CFDFE9", true: "#22D3EE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </>
          )}
        </ScrollView>

        <View
          className="border-t border-border-subtle bg-surface px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Button
            fullWidth
            size="lg"
            onPress={onSubmit}
            loading={create.isPending}
            disabled={!canSubmit}
          >
            Add to menu
          </Button>
        </View>
      </View>
    </Modal>
  );
}
