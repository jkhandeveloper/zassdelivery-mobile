import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RiderGate } from "@/components/shared/rider-gate";
import {
  BalanceBadge,
  LedgerEntriesCard,
  RecordReceiptForm,
  SettlementPaymentsCard,
} from "@/components/shared/settlement-parts";
import { Button } from "@/components/ui/button";
import { Body, Card, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  useRecordFeesReceived,
  useRiderSettlementEntries,
  useRiderSettlementPayments,
  useRiderSettlements,
} from "@/hooks/use-riders";
import { formatPrice } from "@/lib/utils";

/**
 * What the rider and each restaurant owe each other.
 *
 * The rider keeps every order's delivery fee and tip. On a cash order they hand
 * the rest to the restaurant; on an order the restaurant was paid for directly,
 * the restaurant owes them the fee. The platform only keeps score — there is no
 * wallet and nothing to withdraw.
 */
function RiderCash() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const balances = useRiderSettlements();
  const entries = useRiderSettlementEntries({ limit: 20 });
  const payments = useRiderSettlementPayments({ limit: 20 });
  const record = useRecordFeesReceived();
  const [receivingFrom, setReceivingFrom] = React.useState<string | null>(null);

  const rows = balances.data ?? [];
  const youOwe = rows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const owedToYou = rows.reduce((sum, row) => sum + Math.max(0, -row.balance), 0);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-2">
        <Heading level={2}>Cash & fees</Heading>
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
            You keep each order’s delivery fee and tip. Hand the rest of any cash you collect to
            the business. When a business was paid directly, it owes you your fee.
          </Body>

          <View className="flex-row gap-3">
            <Card className="flex-1 gap-1">
              <Text className="font-sans text-[12px] text-muted">You owe businesses</Text>
              <Text
                className="font-display text-[22px] font-extrabold text-primary"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(youOwe)}
              </Text>
            </Card>
            <Card className="flex-1 gap-1">
              <Text className="font-sans text-[12px] text-muted">Businesses owe you</Text>
              <Text
                className="font-display text-[22px] font-extrabold text-success"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(owedToYou)}
              </Text>
            </Card>
          </View>

          {rows.length === 0 ? (
            <Card>
              <Body muted className="text-[13px]">
                Businesses you deliver for appear here after your first delivery.
              </Body>
            </Card>
          ) : (
            rows.map((row) => (
              <Card key={row.restaurantId} className="gap-2">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-sans text-[15px] font-semibold text-primary">
                    {row.restaurantName}
                  </Text>
                  <BalanceBadge balance={row.balance} viewer="rider" />
                </View>
                <Text className="font-sans text-[12px] text-muted">
                  {row.deliveries} {row.deliveries === 1 ? "delivery" : "deliveries"} · collected{" "}
                  {formatPrice(row.cashCollected)} · your fees {formatPrice(row.riderFees)}
                </Text>

                {row.balance < 0 ? (
                  receivingFrom === row.restaurantId ? (
                    <RecordReceiptForm
                      max={-row.balance}
                      submitLabel="Record fees"
                      onSubmit={(amount, note) =>
                        record.mutateAsync({ restaurantId: row.restaurantId, amount, note })
                      }
                      onDone={() => setReceivingFrom(null)}
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setReceivingFrom(row.restaurantId)}
                    >
                      Record fees received
                    </Button>
                  )
                ) : row.balance > 0 ? (
                  <Body muted className="text-[12px]">
                    Hand this to the business. They confirm it from their app.
                  </Body>
                ) : null}
              </Card>
            ))
          )}

          <LedgerEntriesCard query={entries} viewer="rider" />
          <SettlementPaymentsCard query={payments} viewer="rider" />

          <Button variant="outline" onPress={() => router.push("/rider/earnings")}>
            Earnings history
          </Button>
        </ScrollView>
      )}
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{() => <RiderCash />}</RiderGate>;
}
