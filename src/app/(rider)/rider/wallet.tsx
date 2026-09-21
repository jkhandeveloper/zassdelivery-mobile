import { useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import * as React from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RiderGate } from "@/components/shared/rider-gate";
import { Button } from "@/components/ui/button";
import { Card, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useRiderWallet, useWalletTransactions } from "@/hooks/use-riders";
import { formatDateTime, formatPrice, hasText } from "@/lib/utils";

/**
 * The rider's balance and its statement.
 *
 * Three figures rather than one, because they are genuinely different and
 * riders have been burned by apps that conflate them: the balance is what they
 * have earned, `pendingWithdrawals` is what is already on its way out, and
 * `availableToWithdraw` is the only one they can actually act on. Showing only
 * the balance invites a withdrawal request that is then rejected for
 * insufficient funds.
 */
function RiderWallet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const wallet = useRiderWallet();
  const transactions = useWalletTransactions({ limit: 50, sortOrder: "desc" });

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-2">
        <Heading level={2}>Wallet</Heading>
      </View>

      {wallet.isPending ? (
        <LoadingState />
      ) : wallet.isError ? (
        <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />
      ) : (
        <FlatList
          data={transactions.data?.items ?? []}
          keyExtractor={(entry) => entry.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={wallet.isRefetching || transactions.isRefetching}
          onRefresh={() => {
            void wallet.refetch();
            void transactions.refetch();
          }}
          ListHeaderComponent={
            <View className="gap-3">
              <Card className="gap-1">
                <Text className="font-sans text-[13px] text-muted">Available to withdraw</Text>
                <Text
                  className="font-display text-[30px] font-extrabold text-primary"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatPrice(wallet.data.availableToWithdraw)}
                </Text>

                <View className="mt-2 flex-row justify-between">
                  <View>
                    <Text className="font-sans text-[12px] text-muted">Balance</Text>
                    <Text
                      className="font-sans text-[15px] font-semibold text-primary"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {formatPrice(wallet.data.balance)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-sans text-[12px] text-muted">Being paid out</Text>
                    <Text
                      className="font-sans text-[15px] font-semibold text-secondary"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {formatPrice(wallet.data.pendingWithdrawals)}
                    </Text>
                  </View>
                </View>
              </Card>

              {/*
                A locked wallet is the one case where the withdraw button must
                not simply fail on tap. The rider needs to know it is frozen and
                that talking to support is the only way forward.
              */}
              {wallet.data.isLocked ? (
                <Card className="gap-2 border-danger bg-danger-soft">
                  <View className="flex-row items-center gap-2">
                    <Lock size={16} color="#DC2626" />
                    <Text className="flex-1 font-sans text-[14px] font-semibold text-danger">
                      Your wallet is on hold
                    </Text>
                  </View>
                  <Text className="font-sans text-[13px] text-danger">
                    Withdrawals are paused while this is reviewed. Support can explain why.
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push("/rider/support")}
                  >
                    Contact support
                  </Button>
                </Card>
              ) : (
                <View className="flex-row gap-2">
                  <Button
                    className="flex-1"
                    disabled={wallet.data.availableToWithdraw <= 0}
                    onPress={() => router.push("/rider/withdrawals")}
                  >
                    Withdraw
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={() => router.push("/rider/earnings")}
                  >
                    Earnings
                  </Button>
                </View>
              )}

              <Heading level={3} className="mt-1">
                Statement
              </Heading>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="gap-0.5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-sans text-[14px] font-semibold capitalize text-primary">
                  {item.reason.replace(/_/g, " ").toLowerCase()}
                </Text>
                <Text
                  // A statement where money in and money out look the same is
                  // unreadable; the sign is the most important glyph here.
                  className={
                    item.amount < 0
                      ? "font-sans text-[15px] font-bold text-danger"
                      : "font-sans text-[15px] font-bold text-success"
                  }
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {item.amount < 0 ? "−" : "+"}
                  {formatPrice(Math.abs(item.amount))}
                </Text>
              </View>
              {hasText(item.description) ? (
                <Text className="font-sans text-[12px] text-secondary">{item.description}</Text>
              ) : null}
              <View className="flex-row justify-between">
                <Text className="font-sans text-[12px] text-muted">
                  {formatDateTime(item.createdAt)}
                </Text>
                <Text
                  className="font-sans text-[12px] text-muted"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  Balance {formatPrice(item.balanceAfter)}
                </Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            transactions.isPending ? (
              <LoadingState />
            ) : (
              <EmptyState
                title="No movement yet"
                description="Earnings and payouts will appear here as they happen."
              />
            )
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{() => <RiderWallet />}</RiderGate>;
}
