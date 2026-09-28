import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VendorGate } from "@/components/shared/vendor-gate";
import {
  BalanceBadge,
  LedgerEntriesCard,
  QrCodes,
  RecordReceiptForm,
  SettlementPaymentsCard,
} from "@/components/shared/settlement-parts";
import { Button } from "@/components/ui/button";
import { Body, Card, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  useRecordCashReceived,
  useRestaurantRiderEntries,
  useRestaurantRiderPayments,
  useRestaurantRiderSettlements,
} from "@/hooks/use-riders";
import { formatPrice } from "@/lib/utils";
import type { RestaurantAdminDto } from "@/types/restaurant";

/**
 * What the restaurant and the riders who deliver for it owe each other.
 *
 * Open to kitchen staff as well as the owner: cash changes hands at the
 * counter, with whoever is on shift, and they are the one who should confirm it.
 */
function RiderCash({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const balances = useRestaurantRiderSettlements(restaurant.id);
  const entries = useRestaurantRiderEntries(restaurant.id, { limit: 20 });
  const payments = useRestaurantRiderPayments(restaurant.id, { limit: 20 });
  const record = useRecordCashReceived(restaurant.id);
  const [open, setOpen] = React.useState<{ driverId: string; mode: "receive" | "pay" } | null>(
    null,
  );

  const rows = balances.data ?? [];
  const ridersOwe = rows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const youOwe = rows.reduce((sum, row) => sum + Math.max(0, -row.balance), 0);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/vendor"))}
          hitSlop={12}
        >
          <ChevronLeft size={22} color="#0F172A" />
        </Pressable>
        <Heading level={2}>Rider cash</Heading>
      </View>

      {balances.isPending ? (
        <LoadingState />
      ) : balances.isError ? (
        <ErrorState error={balances.error} onRetry={() => void balances.refetch()} />
      ) : (
        <ScrollView
          contentContainerClassName="gap-3 px-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Body muted className="text-[13px]">
            Riders keep each order’s delivery fee and tip. On cash orders they hand you the rest;
            on orders you were paid for directly, you pay them their fee.
          </Body>

          <View className="flex-row gap-3">
            <Card className="flex-1 gap-1">
              <Text className="font-sans text-[12px] text-muted">Riders owe you</Text>
              <Text
                className="font-display text-[22px] font-extrabold text-success"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(ridersOwe)}
              </Text>
            </Card>
            <Card className="flex-1 gap-1">
              <Text className="font-sans text-[12px] text-muted">You owe riders</Text>
              <Text
                className="font-display text-[22px] font-extrabold text-primary"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(youOwe)}
              </Text>
            </Card>
          </View>

          {rows.length === 0 ? (
            <Card>
              <Body muted className="text-[13px]">
                Riders appear here after their first delivery for you.
              </Body>
            </Card>
          ) : (
            rows.map((row) => {
              const expanded = open?.driverId === row.driverId ? open.mode : null;

              return (
                <Card key={row.driverId} className="gap-2">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 font-sans text-[15px] font-semibold text-primary">
                      {row.riderName}
                    </Text>
                    <BalanceBadge balance={row.balance} viewer="restaurant" />
                  </View>
                  <Text className="font-sans text-[12px] text-muted">
                    {row.riderPhone} · {row.deliveries}{" "}
                    {row.deliveries === 1 ? "delivery" : "deliveries"} · handed over{" "}
                    {formatPrice(row.cashHandedOver)}
                  </Text>

                  {row.balance > 0 ? (
                    expanded === "receive" ? (
                      <RecordReceiptForm
                        max={row.balance}
                        submitLabel="Record cash"
                        onSubmit={(amount, note) =>
                          record.mutateAsync({ driverId: row.driverId, amount, note })
                        }
                        onDone={() => setOpen(null)}
                      />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => setOpen({ driverId: row.driverId, mode: "receive" })}
                      >
                        Record cash received
                      </Button>
                    )
                  ) : row.balance < 0 ? (
                    expanded === "pay" ? (
                      <View className="gap-2">
                        {row.paymentQrCodes.length > 0 ? (
                          <QrCodes codes={row.paymentQrCodes} />
                        ) : (
                          <Body muted className="text-[12px]">
                            This rider has not added a payment QR. Pay them in cash.
                          </Body>
                        )}
                        <Body muted className="text-[12px]">
                          The rider confirms the payment from their app.
                        </Body>
                        <Button size="sm" variant="ghost" onPress={() => setOpen(null)}>
                          Close
                        </Button>
                      </View>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => setOpen({ driverId: row.driverId, mode: "pay" })}
                      >
                        Pay rider
                      </Button>
                    )
                  ) : null}
                </Card>
              );
            })
          )}

          <LedgerEntriesCard query={entries} viewer="restaurant" />
          <SettlementPaymentsCard query={payments} viewer="restaurant" />
        </ScrollView>
      )}
    </View>
  );
}

export default function Screen() {
  return <VendorGate>{(restaurant) => <RiderCash restaurant={restaurant} />}</VendorGate>;
}
