import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { ChevronLeft, Copy, TicketPercent } from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RequireAuth } from "@/components/shared/role-guard";
import { Badge, Body, Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useAvailableCoupons } from "@/hooks/use-coupons";
import { formatDate, formatPrice, hasText } from "@/lib/utils";
import { CouponType } from "@/types/enums";
import type { CouponDto } from "@/types/admin";

/**
 * Coupons the customer can actually use.
 *
 * The code is copyable rather than applied from here, because applying it needs
 * a cart and this screen is usually reached before there is one. Copying is the
 * honest halfway step — the customer keeps the code and pastes it at checkout.
 */

/** "20% off, up to ₨300" or "₨150 off" — what the coupon is actually worth. */
function describeValue(coupon: CouponDto): string {
  if (coupon.type === CouponType.PERCENTAGE) {
    const cap =
      coupon.maxDiscountAmount !== null
        ? `, up to ${formatPrice(coupon.maxDiscountAmount)}`
        : "";

    return `${coupon.value}% off${cap}`;
  }

  if (coupon.type === CouponType.FREE_DELIVERY) {
    return "Free delivery";
  }

  return `${formatPrice(coupon.value)} off`;
}

function CouponCard({ coupon }: { coupon: CouponDto }) {
  const onCopy = React.useCallback(() => {
    void Clipboard.setStringAsync(coupon.code)
      .then(() => toast.success(`${coupon.code} copied`, { description: "Paste it at checkout." }))
      .catch(() => toast.error("Couldn't copy that code"));
  }, [coupon.code]);

  return (
    <Card className="gap-2">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-warm-soft">
          <TicketPercent size={20} color="#D9480F" />
        </View>

        <View className="flex-1 gap-0.5">
          <Text className="font-display text-[17px] font-bold text-primary">
            {describeValue(coupon)}
          </Text>
          {hasText(coupon.description) ? (
            <Text className="font-sans text-[13px] text-secondary">{coupon.description}</Text>
          ) : null}

          {coupon.minOrderAmount > 0 ? (
            <Text className="font-sans text-[12px] text-muted">
              On orders over {formatPrice(coupon.minOrderAmount)}
            </Text>
          ) : null}

          {coupon.firstOrderOnly ? <Badge tone="brand">First order only</Badge> : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy code ${coupon.code}`}
        onPress={onCopy}
        className="flex-row items-center justify-between rounded-input border border-dashed border-border-strong bg-surface-muted px-3 py-2.5"
      >
        <Text
          className="font-sans text-[15px] font-bold tracking-wider text-primary"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {coupon.code}
        </Text>
        <Copy size={16} color="#0E7490" />
      </Pressable>

      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-[12px] text-muted">
          Ends {formatDate(coupon.expiresAt)}
        </Text>
        {/*
          A coupon running out of uses is the difference between "save this for
          later" and "use it now". Only shown when the count is low enough to
          matter — "847 uses left" is noise.
        */}
        {coupon.remainingUses !== null && coupon.remainingUses <= 20 ? (
          <Text className="font-sans text-[12px] font-medium text-warning">
            {coupon.remainingUses} left
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const coupons = useAvailableCoupons({ limit: 50 });

  // `isLive` is the server's verdict — active, inside its window and not
  // exhausted. Re-deriving that from dates and counts here would drift.
  const live = coupons.data?.items.filter((coupon) => coupon.isLive) ?? [];

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Offers</Text>
      </View>

      {coupons.isPending ? (
        <LoadingState label="Finding offers…" />
      ) : coupons.isError ? (
        <ErrorState error={coupons.error} onRetry={() => void coupons.refetch()} />
      ) : (
        <FlatList
          data={live}
          keyExtractor={(coupon) => coupon.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={coupons.isRefetching}
          onRefresh={() => void coupons.refetch()}
          ListHeaderComponent={
            live.length > 0 ? (
              <Body muted className="text-[13px]">
                Copy a code and paste it in your cart before checking out.
              </Body>
            ) : null
          }
          renderItem={({ item }) => <CouponCard coupon={item} />}
          ListEmptyComponent={
            <EmptyState
              title="No offers right now"
              description="Check back — new codes are added regularly."
              action={{ label: "Browse restaurants", onPress: () => router.push("/restaurants") }}
            />
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <OffersScreen />
    </RequireAuth>
  );
}
