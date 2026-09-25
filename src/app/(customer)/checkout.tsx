import { useRouter } from "expo-router";
import { Check, ChevronLeft, MapPin, Plus } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RequireAuth } from "@/components/shared/role-guard";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import {
  useCart,
  usePlaceOrder,
  useSetDeliveryAddress,
  useSetTip,
} from "@/hooks/use-cart";
import { usePaymentMethods } from "@/hooks/use-payments";
import { useAddresses } from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import { isFilledCart } from "@/lib/cart";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { cn, formatLandmark, formatPrice, hasText } from "@/lib/utils";
import type { PaymentMethod } from "@/types/enums";

/**
 * Address, payment method, place the order.
 *
 * Both choices write straight to the cart rather than being held locally and
 * sent with the order. That is not incidental — the address changes the
 * delivery fee and the ETA, and the API reprices the basket when it is set. A
 * locally-held address would show the customer one total and charge another.
 *
 * The tip is the same: `PATCH /cart/tip` because it is part of the priced
 * basket, not a field on the order.
 */

/** Tip options, as a proportion of the subtotal. */
const TIP_PRESETS = [0, 0.05, 0.1, 0.15] as const;

function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cart = useCart();
  const addresses = useAddresses({ limit: 20 });
  const setAddress = useSetDeliveryAddress();
  const setTip = useSetTip();
  const placeOrder = usePlaceOrder();

  const filled = isFilledCart(cart.data) ? cart.data : null;
  const restaurantId = filled?.restaurant.id ?? null;

  // Scan-to-pay is reported per restaurant — a kitchen with no QR codes on file
  // simply does not offer it — so the restaurant has to be named.
  const methods = usePaymentMethods(restaurantId, restaurantId !== null);

  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [note, setNote] = React.useState("");

  const available = React.useMemo(
    () => (methods.data ?? []).filter((gateway) => gateway.available),
    [methods.data],
  );

  /**
   * Default to the first available method once they load.
   *
   * Adjusted during render rather than in an effect so the first paint already
   * has a selection — an unselected payment section with a disabled button
   * reads as a broken screen for the frame before the effect runs.
   */
  const [defaultedFor, setDefaultedFor] = React.useState<string | null>(null);

  if (available.length > 0 && defaultedFor !== restaurantId) {
    setDefaultedFor(restaurantId);
    setPaymentMethod(available[0].method);
  }

  if (cart.isPending) {
    return <LoadingState label="Loading your order…" />;
  }

  if (cart.isError) {
    return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;
  }

  if (filled === null) {
    // Reached by going back to checkout after the cart emptied, or by a deep
    // link. Bouncing straight out beats an empty screen with a dead button.
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas px-8">
        <Heading level={3} className="text-center">
          Nothing to check out
        </Heading>
        <Button variant="outline" onPress={() => router.replace("/restaurants")}>
          Browse restaurants
        </Button>
      </View>
    );
  }

  const onPlaceOrder = () => {
    placeOrder.mutate(
      {
        ...(paymentMethod !== null && { paymentMethod }),
        ...(note.trim() !== "" && { customerNote: note.trim() }),
      },
      {
        onSuccess: (order) => {
          toast.success("Order placed", { description: order.orderNumber });
          // `replace`, not `push`: checkout must not be behind the tracking
          // screen, or the back gesture returns to a cart that no longer exists.
          router.replace(`/orders/${order.id}`);
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError
              ? error.message
              : "We couldn't place that order. Please try again.",
          ),
      },
    );
  };

  const subtotal = filled.totals.subtotal;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/cart"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Checkout</Text>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        {/* ── Address ───────────────────────────────────────── */}
        <Card className="gap-3">
          <Text className="font-sans text-[15px] font-semibold text-primary">Deliver to</Text>

          {addresses.isPending ? (
            <LoadingState />
          ) : addresses.data !== undefined && addresses.data.items.length > 0 ? (
            addresses.data.items.map((address) => {
              const active = filled.delivery.addressId === address.id;

              return (
                <Pressable
                  key={address.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: !address.isDeliverable }}
                  disabled={!address.isDeliverable || setAddress.isPending}
                  onPress={() =>
                    setAddress.mutate(
                      { addressId: address.id },
                      {
                        onError: (error) =>
                          toast.error(
                            error instanceof ApiError
                              ? error.message
                              : "Couldn't use that address.",
                          ),
                      },
                    )
                  }
                  className={cn(
                    "flex-row items-start gap-2 rounded-input border px-3 py-3",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                    !address.isDeliverable && "opacity-60",
                  )}
                >
                  <MapPin size={16} color={active ? "#0E7490" : "#75909F"} />
                  <View className="flex-1">
                    {hasText(address.label) ? (
                      <Text className="font-sans text-[13px] font-semibold text-secondary">
                        {address.label}
                      </Text>
                    ) : null}
                    <Text className="font-sans text-[14px] text-primary">{address.line1}</Text>
                    {hasText(address.landmark) ? (
                      <Text className="font-sans text-[12px] text-muted">
                        {formatLandmark(address.landmark)}
                      </Text>
                    ) : null}
                    {/*
                      An address outside every delivery zone can be saved but
                      not ordered to. Saying which one is the problem beats a
                      generic "we don't deliver there".
                    */}
                    {!address.isDeliverable ? (
                      <Text className="font-sans text-[12px] font-medium text-danger">
                        Outside our delivery area
                      </Text>
                    ) : null}
                  </View>
                  {active ? <Check size={18} color="#0E7490" /> : null}
                </Pressable>
              );
            })
          ) : (
            <Body muted className="text-[13px]">
              You have no saved addresses yet.
            </Body>
          )}

          <Button
            variant="outline"
            size="sm"
            icon={<Plus size={15} color="#0E7490" />}
            onPress={() => router.push("/profile")}
          >
            Add an address
          </Button>
        </Card>

        {/* ── Payment ───────────────────────────────────────── */}
        <Card className="gap-3">
          <Text className="font-sans text-[15px] font-semibold text-primary">How you&apos;ll pay</Text>

          {methods.isPending ? (
            <LoadingState />
          ) : available.length === 0 ? (
            <Body muted className="text-[13px]">
              No payment method is available for this restaurant right now.
            </Body>
          ) : (
            available.map((gateway) => {
              const active = paymentMethod === gateway.method;

              return (
                <Pressable
                  key={gateway.method}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPaymentMethod(gateway.method)}
                  className={cn(
                    "flex-row items-center justify-between rounded-input border px-3 py-3",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[14px]",
                      active ? "font-semibold text-brand" : "text-primary",
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[gateway.method] ?? gateway.name}
                  </Text>
                  {active ? <Check size={18} color="#0E7490" /> : null}
                </Pressable>
              );
            })
          )}

          {/*
            Scan-to-pay means paying the restaurant directly — the platform
            never holds the money. Saying so here prevents the doorstep
            surprise of being asked to scan a code the customer did not expect.
          */}
          {paymentMethod === "QR_TRANSFER" ? (
            <Body muted className="text-[12px]">
              You&apos;ll scan the restaurant&apos;s QR code and pay them directly. The code
              appears on your order screen once it&apos;s placed.
            </Body>
          ) : null}
        </Card>

        {/* ── Tip ───────────────────────────────────────────── */}
        <Card className="gap-3">
          <Text className="font-sans text-[15px] font-semibold text-primary">
            Tip your rider
          </Text>
          <View className="flex-row gap-2">
            {TIP_PRESETS.map((fraction) => {
              const amount = Math.round(subtotal * fraction);
              const active = filled.totals.tipAmount === amount;

              return (
                <Pressable
                  key={fraction}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  disabled={setTip.isPending}
                  onPress={() =>
                    setTip.mutate(
                      { tipAmount: amount },
                      {
                        onError: (error) =>
                          toast.error(
                            error instanceof ApiError ? error.message : "Couldn't set that tip.",
                          ),
                      },
                    )
                  }
                  className={cn(
                    "flex-1 items-center rounded-input border py-2.5",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[13px] font-semibold",
                      active ? "text-brand" : "text-primary",
                    )}
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {fraction === 0 ? "None" : `${fraction * 100}%`}
                  </Text>
                  {fraction > 0 ? (
                    <Text
                      className="font-sans text-[11px] text-muted"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {formatPrice(amount)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* ── Note ──────────────────────────────────────────── */}
        <Card>
          <Field label="Note for the restaurant">
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Ring the bell, leave at the gate…"
              multiline
              className="min-h-[70px] py-2.5"
              textAlignVertical="top"
            />
          </Field>
        </Card>

        {/* ── Summary ───────────────────────────────────────── */}
        <Card className="gap-2">
          <Text className="font-sans text-[15px] font-semibold text-primary">
            {filled.restaurant.name}
          </Text>
          <Divider />

          <View className="flex-row justify-between">
            <Text className="font-sans text-[14px] text-secondary">
              Subtotal ({filled.totals.totalQuantity}{" "}
              {filled.totals.totalQuantity === 1 ? "item" : "items"})
            </Text>
            <Text
              className="font-sans text-[14px] text-secondary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(filled.totals.subtotal)}
            </Text>
          </View>

          {filled.totals.discountAmount > 0 ? (
            <View className="flex-row justify-between">
              <Text className="font-sans text-[14px] text-success">Discount</Text>
              <Text
                className="font-sans text-[14px] text-success"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                −{formatPrice(filled.totals.discountAmount)}
              </Text>
            </View>
          ) : null}

          <View className="flex-row justify-between">
            <Text className="font-sans text-[14px] text-secondary">Delivery</Text>
            <Text
              className="font-sans text-[14px] text-secondary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {filled.totals.deliveryFee === 0 ? "Free" : formatPrice(filled.totals.deliveryFee)}
            </Text>
          </View>

          {filled.totals.tipAmount > 0 ? (
            <View className="flex-row justify-between">
              <Text className="font-sans text-[14px] text-secondary">Rider tip</Text>
              <Text
                className="font-sans text-[14px] text-secondary"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(filled.totals.tipAmount)}
              </Text>
            </View>
          ) : null}

          <Divider />
          <View className="flex-row justify-between">
            <Text className="font-display text-[17px] font-bold text-primary">Total</Text>
            <Text
              className="font-display text-[17px] font-bold text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(filled.totals.totalAmount)}
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View
        className="border-t border-border-subtle bg-surface px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          fullWidth
          size="lg"
          loading={placeOrder.isPending}
          disabled={!filled.canCheckout || paymentMethod === null}
          onPress={onPlaceOrder}
        >
          Place order · {formatPrice(filled.totals.totalAmount)}
        </Button>
      </View>
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <CheckoutScreen />
    </RequireAuth>
  );
}
