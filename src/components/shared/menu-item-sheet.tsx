import { Image } from "expo-image";
import { Minus, Plus, X } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Body, Divider, Heading } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useAddCartItem } from "@/hooks/use-cart";
import { ApiError } from "@/lib/api-client";
import { cn, formatPrice, hasText } from "@/lib/utils";
import type { AddCartItemDto } from "@/types/cart";
import type { AddOnGroupDto, MenuItemDto } from "@/types/menu";

/**
 * One dish, with its choices.
 *
 * Any item with variants or a required add-on group has to come through here
 * rather than a one-tap add — otherwise the customer is charged for a default
 * they never picked, which is the kind of bug that turns into a refund.
 *
 * The total is recomputed as choices change and shown on the button itself. On
 * a phone the button is often the only thing visible under the keyboard, and a
 * customer should never have to scroll to find out what they are about to pay.
 */

/** Add-ons chosen, as `{ [addOnId]: quantity }`. */
type Selections = Record<string, number>;

function selectedCount(group: AddOnGroupDto, selections: Selections): number {
  return group.addOns.reduce((total, addOn) => total + (selections[addOn.id] ?? 0), 0);
}

/**
 * Which required groups are not yet satisfied.
 *
 * Checked against `minSelect` rather than "at least one", because a group can
 * legitimately require two — a pick-any-two-sides deal — and treating that as
 * satisfied by one would have the API reject the add with a message the
 * customer cannot act on.
 */
function unmetGroups(item: MenuItemDto, selections: Selections): AddOnGroupDto[] {
  return item.addOnGroups.filter(
    (group) => group.isRequired && selectedCount(group, selections) < Math.max(1, group.minSelect),
  );
}

export function MenuItemSheet({
  item,
  visible,
  onClose,
}: {
  item: MenuItemDto | null;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const addItem = useAddCartItem();

  const [variantId, setVariantId] = React.useState<string | null>(null);
  const [selections, setSelections] = React.useState<Selections>({});
  const [quantity, setQuantity] = React.useState(1);
  const [notes, setNotes] = React.useState("");
  const [showErrors, setShowErrors] = React.useState(false);

  /**
   * Reset when a different dish is opened.
   *
   * Keyed on the item id and adjusted during render rather than in an effect,
   * so the sheet never paints the previous dish's choices for a frame — which
   * with a price on the button would be showing the wrong number.
   */
  const [openedId, setOpenedId] = React.useState<string | null>(item?.id ?? null);

  if (item !== null && openedId !== item.id) {
    setOpenedId(item.id);
    setVariantId(item.variants.find((variant) => variant.isDefault)?.id ?? item.variants[0]?.id ?? null);
    setSelections({});
    setQuantity(1);
    setNotes("");
    setShowErrors(false);
  }

  if (item === null) {
    return null;
  }

  const variant = item.variants.find((entry) => entry.id === variantId) ?? null;

  // A variant's price is absolute, not a delta on the base price.
  const unitBase = variant !== null ? variant.price : item.effectivePrice;

  const addOnsTotal = item.addOnGroups.reduce(
    (total, group) =>
      total +
      group.addOns.reduce(
        (groupTotal, addOn) => groupTotal + addOn.price * (selections[addOn.id] ?? 0),
        0,
      ),
    0,
  );

  const total = (unitBase + addOnsTotal) * quantity;

  const unmet = unmetGroups(item, selections);
  const canAdd = item.isAvailable && unmet.length === 0;

  const toggleAddOn = (group: AddOnGroupDto, addOnId: string) => {
    setSelections((current) => {
      const has = (current[addOnId] ?? 0) > 0;

      if (has) {
        const next = { ...current };
        delete next[addOnId];
        return next;
      }

      // At the group's ceiling, picking a new one replaces the oldest rather
      // than silently doing nothing — a disabled row with no explanation reads
      // as a broken tap.
      if (selectedCount(group, current) >= group.maxSelect && group.maxSelect > 0) {
        if (group.maxSelect === 1) {
          const next = { ...current };
          for (const addOn of group.addOns) {
            delete next[addOn.id];
          }
          next[addOnId] = 1;
          return next;
        }

        toast(`Choose up to ${group.maxSelect} from ${group.name}`);
        return current;
      }

      return { ...current, [addOnId]: 1 };
    });
  };

  const onAdd = () => {
    if (unmet.length > 0) {
      setShowErrors(true);
      toast.error(`Choose your ${unmet[0].name.toLowerCase()}`);
      return;
    }

    const addOns = Object.entries(selections)
      .filter(([, count]) => count > 0)
      .map(([addOnId, count]) => ({ addOnId, quantity: count }));

    const payload: AddCartItemDto = {
      menuItemId: item.id,
      quantity,
      ...(variantId !== null && { variantId }),
      ...(notes.trim() !== "" && { notes: notes.trim() }),
      ...(addOns.length > 0 && { addOns }),
    };

    addItem.mutate(payload, {
      onSuccess: () => {
        toast.success(`${item.name} added to your cart`);
        onClose();
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? // The cart is single-restaurant; switching kitchens is a real
              // decision, so say so plainly rather than surfacing a raw 409.
              error.status === 409
              ? "Your cart has items from another restaurant. Empty it first to order from here."
              : error.message
            : "We couldn't add that. Please try again.",
        );
      },
    });
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
          <Text numberOfLines={1} className="flex-1 px-2 font-display text-[17px] font-bold text-primary">
            {item.name}
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
          {hasText(item.imageUrl) ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: "100%", height: 180, borderRadius: 20, backgroundColor: "#E4EEF5" }}
              contentFit="cover"
              transition={200}
              accessible={false}
            />
          ) : null}

          <View className="gap-1.5">
            <Heading level={2}>{item.name}</Heading>
            {hasText(item.description) ? <Body muted>{item.description}</Body> : null}

            <View className="flex-row flex-wrap items-center gap-2 pt-1">
              <Text
                className="font-display text-[19px] font-extrabold text-primary"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(unitBase)}
              </Text>
              {item.discountedPrice !== null && variant === null ? (
                <Text
                  className="font-sans text-[14px] text-muted line-through"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatPrice(item.basePrice)}
                </Text>
              ) : null}
              {item.isVegetarian ? <Badge tone="success">Veg</Badge> : null}
              {item.preparationMinutes > 0 ? (
                <Text className="font-sans text-[12px] text-muted">
                  {item.preparationMinutes} min
                </Text>
              ) : null}
            </View>

            {/*
              `availabilityReason` is the server's own explanation. Showing it
              beats a generic "unavailable" — "sold out" and "not served at this
              time of day" call for completely different responses.
            */}
            {!item.isAvailable ? (
              <View className="mt-1 rounded-input bg-danger-soft px-3 py-2">
                <Text className="font-sans text-[13px] font-medium text-danger">
                  {item.availabilityReason === "sold_out" ||
                  item.availabilityReason === "out_of_stock"
                    ? "Sold out for today."
                    : item.availabilityReason === "outside_window"
                      ? "Not served at this time of day."
                      : "Not available right now."}
                </Text>
              </View>
            ) : item.stockRemaining !== null && item.stockRemaining <= 5 ? (
              <Text className="font-sans text-[13px] font-medium text-warning">
                Only {item.stockRemaining} left
              </Text>
            ) : null}
          </View>

          {item.variants.length > 0 ? (
            <View className="gap-2">
              <Divider />
              <Text className="font-sans text-[15px] font-semibold text-primary">Choose a size</Text>
              {item.variants.map((entry) => {
                const active = variantId === entry.id;

                return (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: !entry.isAvailable }}
                    disabled={!entry.isAvailable}
                    onPress={() => setVariantId(entry.id)}
                    className={cn(
                      "flex-row items-center justify-between rounded-input border px-3 py-3",
                      active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                      !entry.isAvailable && "opacity-50",
                    )}
                  >
                    <Text
                      className={cn(
                        "font-sans text-[14px]",
                        active ? "font-semibold text-brand" : "text-primary",
                      )}
                    >
                      {entry.name}
                      {!entry.isAvailable ? " · sold out" : ""}
                    </Text>
                    <Text
                      className="font-sans text-[14px] font-semibold text-primary"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {formatPrice(entry.price)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {item.addOnGroups.map((group) => {
            const count = selectedCount(group, selections);
            const isUnmet = showErrors && unmet.some((entry) => entry.id === group.id);

            return (
              <View key={group.id} className="gap-2">
                <Divider />
                <View className="flex-row items-center justify-between">
                  <Text className="font-sans text-[15px] font-semibold text-primary">
                    {group.name}
                  </Text>
                  {group.isRequired ? (
                    <Badge tone={isUnmet ? "danger" : count > 0 ? "success" : "warning"}>
                      Required
                    </Badge>
                  ) : null}
                </View>

                <Text className={isUnmet ? "font-sans text-[12px] text-danger" : "font-sans text-[12px] text-muted"}>
                  {group.maxSelect === 1
                    ? "Choose one"
                    : `Choose ${group.minSelect > 0 ? `${group.minSelect}–` : "up to "}${group.maxSelect}`}
                </Text>

                {group.addOns.map((addOn) => {
                  const chosen = (selections[addOn.id] ?? 0) > 0;

                  return (
                    <Pressable
                      key={addOn.id}
                      accessibilityRole={group.maxSelect === 1 ? "radio" : "checkbox"}
                      accessibilityState={{ checked: chosen, disabled: !addOn.isAvailable }}
                      disabled={!addOn.isAvailable}
                      onPress={() => toggleAddOn(group, addOn.id)}
                      className={cn(
                        "flex-row items-center justify-between rounded-input border px-3 py-3",
                        chosen ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                        !addOn.isAvailable && "opacity-50",
                      )}
                    >
                      <Text
                        className={cn(
                          "flex-1 font-sans text-[14px]",
                          chosen ? "font-semibold text-brand" : "text-primary",
                        )}
                      >
                        {addOn.name}
                        {!addOn.isAvailable ? " · unavailable" : ""}
                      </Text>
                      {addOn.price > 0 ? (
                        <Text
                          className="font-sans text-[14px] text-secondary"
                          style={{ fontVariant: ["tabular-nums"] }}
                        >
                          +{formatPrice(addOn.price)}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <Divider />

          <View className="gap-1.5">
            <Text className="font-sans text-[15px] font-semibold text-primary">
              Anything else?
            </Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="No onions, extra spicy…"
              multiline
              className="min-h-[70px] py-2.5"
              textAlignVertical="top"
              accessibilityLabel="Notes for the kitchen"
            />
          </View>
        </ScrollView>

        {/* The action bar: quantity and the total, always in reach. */}
        <View
          className="flex-row items-center gap-3 border-t border-border-subtle bg-surface px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="flex-row items-center gap-1 rounded-input border border-border-default">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reduce quantity"
              onPress={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={quantity <= 1}
              className="h-11 w-11 items-center justify-center"
            >
              <Minus size={18} color={quantity <= 1 ? "#A7C0D1" : "#0A1622"} />
            </Pressable>
            <Text
              className="min-w-[24px] text-center font-sans text-[16px] font-bold text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {quantity}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              onPress={() => setQuantity((current) => current + 1)}
              className="h-11 w-11 items-center justify-center"
            >
              <Plus size={18} color="#0A1622" />
            </Pressable>
          </View>

          <Button
            className="flex-1"
            size="lg"
            onPress={onAdd}
            loading={addItem.isPending}
            disabled={!canAdd}
          >
            {item.isAvailable ? `Add · ${formatPrice(total)}` : "Unavailable"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
