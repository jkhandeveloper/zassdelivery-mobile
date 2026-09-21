import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { AlertTriangle, Minus, Plus, Trash2, X } from "lucide-react-native";
import * as React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RequireAuth } from "@/components/shared/role-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import {
  useApplyCoupon,
  useCart,
  useClearCart,
  useEnsureCartAddress,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartItem,
} from "@/hooks/use-cart";
import { ApiError } from "@/lib/api-client";
import { isFilledCart } from "@/lib/cart";
import { formatPrice, hasText } from "@/lib/utils";
import type { CartDto, CartLineDto } from "@/types/cart";

/**
 * The basket.
 *
 * Every total on this screen comes from the server. Nothing is added up
 * locally — not even the line totals, which the API already provides. A cart
 * that disagrees with the order it becomes is worse than one that costs a round
 * trip, and delivery fees, free-delivery thresholds and coupon maths are all
 * decided server-side anyway.
 */

/**
 * One line, with its own mutations.
 *
 * A component per row because `useUpdateCartItem` and `useRemoveCartItem` are
 * keyed by item id — hooks cannot be called in a loop, and this is also what
 * lets a single row show its own spinner instead of the whole cart greying out.
 */
function CartRow({ line }: { line: CartLineDto }) {
  const updateItem = useUpdateCartItem(line.id);
  const removeItem = useRemoveCartItem(line.id);

  const busy = updateItem.isPending || removeItem.isPending;

  const onError = React.useCallback((error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : "Couldn't update your cart.");
  }, []);

  const setQuantity = (next: number) => {
    // Zero removes the line, per the API — but going through the explicit
    // remove call keeps the intent readable and the cache update the same.
    if (next <= 0) {
      removeItem.mutate(undefined, { onError });
      return;
    }

    updateItem.mutate({ quantity: next }, { onError });
  };

  return (
    <View className="flex-row gap-3 py-3">
      {hasText(line.imageUrl) ? (
        <Image
          source={{ uri: line.imageUrl }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 12,
            backgroundColor: "#E4EEF5",
            opacity: line.isAvailable ? 1 : 0.45,
          }}
          contentFit="cover"
          accessible={false}
        />
      ) : null}

      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-[15px] font-semibold text-primary">{line.name}</Text>

        {hasText(line.variantName) ? (
          <Text className="font-sans text-[12px] text-muted">{line.variantName}</Text>
        ) : null}

        {line.addOns.map((addOn) => (
          <Text key={addOn.id} className="font-sans text-[12px] text-muted">
            + {addOn.name}
            {addOn.price > 0 ? ` (${formatPrice(addOn.price)})` : ""}
          </Text>
        ))}

        {hasText(line.notes) ? (
          <Text className="font-sans text-[12px] italic text-muted">{line.notes}</Text>
        ) : null}

        {/*
          An unavailable line is a blocking issue elsewhere on the screen, but
          it also has to be visible *here* — otherwise the customer reads
          "something is unavailable" and cannot tell which thing.
        */}
        {!line.isAvailable ? (
          <Text className="font-sans text-[12px] font-medium text-danger">
            No longer available — remove it to check out
          </Text>
        ) : null}

        <View className="mt-1 flex-row items-center justify-between">
          <View className="flex-row items-center rounded-input border border-border-default">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reduce ${line.name}`}
              onPress={() => setQuantity(line.quantity - 1)}
              disabled={busy}
              className="h-9 w-9 items-center justify-center"
            >
              {line.quantity === 1 ? (
                <Trash2 size={15} color="#DC2626" />
              ) : (
                <Minus size={15} color="#0A1622" />
              )}
            </Pressable>
            <Text
              className="min-w-[22px] text-center font-sans text-[15px] font-bold text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {line.quantity}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add another ${line.name}`}
              onPress={() => setQuantity(line.quantity + 1)}
              disabled={busy || !line.isAvailable}
              className="h-9 w-9 items-center justify-center"
            >
              <Plus size={15} color={line.isAvailable ? "#0A1622" : "#A7C0D1"} />
            </Pressable>
          </View>

          <Text
            className="font-sans text-[15px] font-semibold text-primary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatPrice(line.lineTotal)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CouponField({ cart }: { cart: CartDto }) {
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const [code, setCode] = React.useState("");

  if (hasText(cart.couponCode)) {
    return (
      <View className="flex-row items-center justify-between gap-2 rounded-input bg-success-soft px-3 py-2.5">
        <Text className="flex-1 font-sans text-[14px] font-semibold text-success">
          {cart.couponCode} applied
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove coupon"
          hitSlop={8}
          disabled={removeCoupon.isPending}
          onPress={() =>
            removeCoupon.mutate(undefined, {
              onError: (error) =>
                toast.error(
                  error instanceof ApiError ? error.message : "Couldn't remove that coupon.",
                ),
            })
          }
          className="h-8 w-8 items-center justify-center"
        >
          <X size={16} color="#047857" />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-row items-end gap-2">
      <View className="flex-1">
        <Input
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase().trim())}
          placeholder="Coupon code"
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Coupon code"
        />
      </View>
      <Button
        variant="outline"
        disabled={code === ""}
        loading={applyCoupon.isPending}
        onPress={() =>
          applyCoupon.mutate(
            { code },
            {
              onSuccess: () => {
                setCode("");
                toast.success("Coupon applied");
              },
              onError: (error) =>
                toast.error(
                  error instanceof ApiError ? error.message : "That coupon didn't work.",
                ),
            },
          )
        }
      >
        Apply
      </Button>
    </View>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className={
          strong === true
            ? "font-display text-[16px] font-bold text-primary"
            : "font-sans text-[14px] text-secondary"
        }
      >
        {label}
      </Text>
      <Text
        className={
          strong === true
            ? "font-display text-[16px] font-bold text-primary"
            : "font-sans text-[14px] text-secondary"
        }
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}

function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cart = useCart();
  const clearCart = useClearCart();

  const filled = isFilledCart(cart.data) ? cart.data : null;

  // The cart owns its delivery address, and it has to be set before the API
  // will price the basket. See the hook for why every totals screen does this.
  const { isResolving } = useEnsureCartAddress(filled);

  const onClear = React.useCallback(() => {
    Alert.alert("Empty your cart?", "Everything in it will be removed.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Empty cart",
        style: "destructive",
        onPress: () =>
          clearCart.mutate(undefined, {
            onError: (error) =>
              toast.error(error instanceof ApiError ? error.message : "Couldn't empty the cart."),
          }),
      },
    ]);
  }, [clearCart]);

  if (cart.isPending) {
    return <LoadingState label="Loading your cart…" />;
  }

  if (cart.isError) {
    return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;
  }

  if (filled === null) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Find something to eat and it will show up here."
        action={{ label: "Browse restaurants", onPress: () => router.push("/restaurants") }}
      />
    );
  }

  // Non-blocking issues are worth showing but must not stop checkout; blocking
  // ones are exactly why `canCheckout` is false, so they are shown as errors.
  const blocking = filled.issues.filter((issue) => issue.blocking);
  const advisory = filled.issues.filter((issue) => !issue.blocking);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Heading level={2}>Your cart</Heading>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Empty cart"
          hitSlop={8}
          onPress={onClear}
          className="h-10 w-10 items-center justify-center"
        >
          <Trash2 size={19} color="#DC2626" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        <Card>
          <Text className="font-display text-[16px] font-bold text-primary">
            {filled.restaurant.name}
          </Text>
          {!filled.restaurant.isAcceptingOrders ? (
            <Text className="mt-1 font-sans text-[13px] font-medium text-danger">
              This kitchen has stopped taking orders.
            </Text>
          ) : null}

          <Divider className="my-1" />

          {filled.items.map((line, index) => (
            <View key={line.id}>
              {index > 0 ? <Divider /> : null}
              <CartRow line={line} />
            </View>
          ))}
        </Card>

        {blocking.length > 0 ? (
          <Card className="gap-1.5 border-danger bg-danger-soft">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#DC2626" />
              <Text className="font-sans text-[14px] font-semibold text-danger">
                Before you can check out
              </Text>
            </View>
            {blocking.map((issue) => (
              <Text key={issue.code} className="font-sans text-[13px] text-danger">
                • {issue.message}
              </Text>
            ))}
          </Card>
        ) : null}

        {advisory.length > 0 ? (
          <Card className="gap-1 border-warning bg-warning-soft">
            {advisory.map((issue) => (
              <Text key={issue.code} className="font-sans text-[13px] text-warning">
                {issue.message}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card className="gap-3">
          <Text className="font-sans text-[15px] font-semibold text-primary">Have a coupon?</Text>
          <CouponField cart={filled} />
        </Card>

        <Card className="gap-2">
          <TotalRow label={`Subtotal (${filled.totals.totalQuantity} items)`} value={formatPrice(filled.totals.subtotal)} />

          {filled.totals.discountAmount > 0 ? (
            <TotalRow label="Discount" value={`−${formatPrice(filled.totals.discountAmount)}`} />
          ) : null}

          <TotalRow
            label="Delivery"
            value={
              // A zero fee with a reason is a saving worth naming, not a blank.
              filled.totals.deliveryFee === 0 && hasText(filled.totals.freeDeliveryReason)
                ? "Free"
                : formatPrice(filled.totals.deliveryFee)
            }
          />
          {filled.totals.deliveryFee === 0 && hasText(filled.totals.freeDeliveryReason) ? (
            <Text className="font-sans text-[12px] text-success">
              {filled.totals.freeDeliveryReason}
            </Text>
          ) : null}

          {filled.totals.serviceFee > 0 ? (
            <TotalRow label="Service fee" value={formatPrice(filled.totals.serviceFee)} />
          ) : null}
          {filled.totals.taxAmount > 0 ? (
            <TotalRow label="Tax" value={formatPrice(filled.totals.taxAmount)} />
          ) : null}

          <Divider />
          <TotalRow label="Total" value={formatPrice(filled.totals.totalAmount)} strong />

          {filled.delivery.etaMinutes !== null ? (
            <Text className="font-sans text-[12px] text-muted">
              Arriving in about {filled.delivery.etaMinutes} min
              {filled.delivery.distanceKm !== null
                ? ` · ${filled.delivery.distanceKm.toFixed(1)} km`
                : ""}
            </Text>
          ) : null}
        </Card>

        {filled.restaurant.minOrderAmount > filled.totals.subtotal ? (
          <Body muted className="text-[13px]">
            This restaurant has a minimum of {formatPrice(filled.restaurant.minOrderAmount)}. Add{" "}
            {formatPrice(filled.restaurant.minOrderAmount - filled.totals.subtotal)} more to order.
          </Body>
        ) : null}
      </ScrollView>

      <View
        className="border-t border-border-subtle bg-surface px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          fullWidth
          size="lg"
          // `canCheckout` is the server's own verdict. Deriving it here from
          // issues and minimums would be a second implementation of a rule that
          // already exists, and the two would drift.
          disabled={!filled.canCheckout || isResolving}
          loading={isResolving}
          onPress={() => router.push("/checkout")}
        >
          {isResolving
            ? "Pricing your order…"
            : `Checkout · ${formatPrice(filled.totals.totalAmount)}`}
        </Button>
      </View>
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <CartScreen />
    </RequireAuth>
  );
}
