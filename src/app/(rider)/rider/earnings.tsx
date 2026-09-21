import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RiderGate } from "@/components/shared/rider-gate";
import { Card, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useEarningsSummary, useRiderEarnings } from "@/hooks/use-riders";
import { formatDateTime, formatPrice, hasText } from "@/lib/utils";

/**
 * What the rider has earned, and where each figure came from.
 *
 * The ledger matters as much as the totals. A rider who thinks a delivery paid
 * less than promised needs to see the breakdown — base fare, distance, tip —
 * and a single "today: ₨1,240" cannot answer that. This is the screen that
 * settles a disagreement.
 */

function SummaryTile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View
      className={
        wide
          ? "w-full rounded-card border border-border-subtle bg-surface p-3"
          : "flex-1 rounded-card border border-border-subtle bg-surface p-3"
      }
    >
      <Text className="font-sans text-[12px] text-muted">{label}</Text>
      <Text
        className="mt-0.5 font-display text-[19px] font-extrabold text-primary"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}

function RiderEarnings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const summary = useEarningsSummary();
  const ledger = useRiderEarnings({ limit: 50, sortBy: "earnedAt", sortOrder: "desc" });

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/rider"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Earnings</Text>
      </View>

      {ledger.isPending ? (
        <LoadingState />
      ) : ledger.isError ? (
        <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
      ) : (
        <FlatList
          data={ledger.data.items}
          keyExtractor={(entry) => entry.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={ledger.isRefetching}
          onRefresh={() => {
            void ledger.refetch();
            void summary.refetch();
          }}
          ListHeaderComponent={
            <View className="gap-3 pb-1">
              <View className="flex-row gap-2">
                <SummaryTile label="Today" value={formatPrice(summary.data?.today ?? 0)} />
                <SummaryTile label="This week" value={formatPrice(summary.data?.thisWeek ?? 0)} />
              </View>
              <View className="flex-row gap-2">
                <SummaryTile label="This month" value={formatPrice(summary.data?.thisMonth ?? 0)} />
                <SummaryTile
                  label="Per delivery"
                  value={formatPrice(summary.data?.averagePerDelivery ?? 0)}
                />
              </View>
              <SummaryTile
                wide
                label={`Lifetime · ${summary.data?.deliveriesLifetime ?? 0} deliveries`}
                value={formatPrice(summary.data?.lifetime ?? 0)}
              />
              <Heading level={3} className="mt-2">
                Ledger
              </Heading>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="gap-0.5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-sans text-[14px] font-semibold capitalize text-primary">
                  {item.type.replace(/_/g, " ").toLowerCase()}
                </Text>
                <Text
                  className="font-sans text-[15px] font-bold text-success"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatPrice(item.amount)}
                </Text>
              </View>
              {/* The order is what a rider recognises a line by. */}
              {hasText(item.orderNumber) ? (
                <Text
                  className="font-sans text-[12px] text-secondary"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {item.orderNumber}
                </Text>
              ) : null}
              {hasText(item.description) ? (
                <Text className="font-sans text-[12px] text-muted">{item.description}</Text>
              ) : null}
              <Text className="font-sans text-[12px] text-muted">
                {formatDateTime(item.earnedAt)}
              </Text>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title="Nothing earned yet"
              description="Complete a delivery and its breakdown appears here."
            />
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{() => <RiderEarnings />}</RiderGate>;
}
