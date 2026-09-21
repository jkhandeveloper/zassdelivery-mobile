import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RiderGate } from "@/components/shared/rider-gate";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge, Body, Card, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import {
  useCancelWithdrawal,
  useRequestWithdrawal,
  useRiderWallet,
  useWithdrawals,
} from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { cn, formatDateTime, formatPrice, hasText } from "@/lib/utils";
import { PayoutMethod, PayoutStatus } from "@/types/enums";

/**
 * Requesting a payout, and tracking the ones already asked for.
 *
 * The amount is validated against `availableToWithdraw` before the request is
 * sent. The API would reject an over-request anyway, but doing it here means
 * the rider finds out while the number is still under their thumb rather than
 * after a round trip — and the ceiling is shown, so they do not have to guess.
 */

const METHOD_LABELS: Record<string, string> = {
  [PayoutMethod.BANK_TRANSFER]: "Bank transfer",
  [PayoutMethod.JAZZCASH]: "JazzCash",
  [PayoutMethod.EASYPAISA]: "Easypaisa",
};

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case PayoutStatus.PAID:
      return "success";
    case PayoutStatus.PENDING:
    case PayoutStatus.APPROVED:
      return "warning";
    case PayoutStatus.REJECTED:
      return "danger";
    default:
      return "neutral";
  }
}

function RiderWithdrawals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const wallet = useRiderWallet();
  const withdrawals = useWithdrawals({ limit: 30, sortBy: "createdAt", sortOrder: "desc" });
  const requestWithdrawal = useRequestWithdrawal();
  const cancelWithdrawal = useCancelWithdrawal();

  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<string>(PayoutMethod.BANK_TRANSFER);

  const available = wallet.data?.availableToWithdraw ?? 0;
  const parsed = Number(amount);

  const amountError =
    amount === ""
      ? null
      : !Number.isFinite(parsed) || parsed <= 0
        ? "Enter an amount"
        : parsed > available
          ? `You can withdraw up to ${formatPrice(available)}`
          : null;

  const canSubmit = amount !== "" && amountError === null && !(wallet.data?.isLocked ?? false);

  const onRequest = React.useCallback(() => {
    requestWithdrawal.mutate(
      { amount: parsed, method: method as (typeof PayoutMethod)[keyof typeof PayoutMethod] },
      {
        onSuccess: () => {
          setAmount("");
          toast.success("Withdrawal requested", {
            description: "You'll be told once it has been processed.",
          });
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : "Couldn't request that withdrawal.",
          ),
      },
    );
  }, [requestWithdrawal, parsed, method]);

  const onCancel = React.useCallback(
    (id: string, reference: string) => {
      Alert.alert("Cancel this withdrawal?", `Request ${reference} will be withdrawn.`, [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: () =>
            cancelWithdrawal.mutate(id, {
              onSuccess: () => toast.success("Withdrawal cancelled"),
              onError: (error) =>
                toast.error(error instanceof ApiError ? error.message : "Couldn't cancel that."),
            }),
        },
      ]);
    },
    [cancelWithdrawal],
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/rider/wallet"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Withdrawals</Text>
      </View>

      {withdrawals.isError ? (
        <ErrorState error={withdrawals.error} onRetry={() => void withdrawals.refetch()} />
      ) : (
        <FlatList
          data={withdrawals.data?.items ?? []}
          keyExtractor={(payout) => payout.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          keyboardShouldPersistTaps="handled"
          refreshing={withdrawals.isRefetching}
          onRefresh={() => {
            void withdrawals.refetch();
            void wallet.refetch();
          }}
          ListHeaderComponent={
            <View className="gap-3">
              <Card className="gap-3">
                <View>
                  <Text className="font-sans text-[13px] text-muted">Available</Text>
                  <Text
                    className="font-display text-[24px] font-extrabold text-primary"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {formatPrice(available)}
                  </Text>
                </View>

                <Field
                  label="Amount"
                  required
                  error={amountError ?? undefined}
                  hint={amountError === null ? `Up to ${formatPrice(available)}` : undefined}
                >
                  <Input
                    value={amount}
                    onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                    keyboardType="number-pad"
                    invalid={amountError !== null}
                    editable={!requestWithdrawal.isPending}
                  />
                </Field>

                <Field label="Pay me by" required>
                  <View className="gap-2">
                    {Object.entries(METHOD_LABELS).map(([value, label]) => {
                      const active = method === value;

                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          onPress={() => setMethod(value)}
                          className={cn(
                            "rounded-input border px-3 py-2.5",
                            active
                              ? "border-brand bg-brand-soft"
                              : "border-border-default bg-surface",
                          )}
                        >
                          <Text
                            className={cn(
                              "font-sans text-[14px]",
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

                <Button
                  fullWidth
                  disabled={!canSubmit}
                  loading={requestWithdrawal.isPending}
                  onPress={onRequest}
                >
                  Request withdrawal
                </Button>

                <Body muted className="text-[12px]">
                  Payouts go to the account on your rider profile. Update it there first if it
                  has changed.
                </Body>
              </Card>

              <Heading level={3}>History</Heading>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="gap-1">
              <View className="flex-row items-start justify-between gap-2">
                <Text
                  className="font-display text-[17px] font-bold text-primary"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatPrice(item.amount)}
                </Text>
                <Badge tone={statusTone(item.status)}>{item.status.toLowerCase()}</Badge>
              </View>

              <Text className="font-sans text-[13px] text-secondary">
                {METHOD_LABELS[item.method] ?? item.method} · {item.accountNumber}
              </Text>
              <Text
                className="font-sans text-[12px] text-muted"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {item.reference} · {formatDateTime(item.createdAt)}
              </Text>

              {hasText(item.rejectionReason) ? (
                <Text className="font-sans text-[13px] text-danger">{item.rejectionReason}</Text>
              ) : null}

              {/*
                Only a request nobody has acted on yet can be withdrawn. Once it
                is approved the money is in motion and cancelling is a support
                matter, not a button.
              */}
              {item.status === PayoutStatus.PENDING ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1 self-start"
                  loading={cancelWithdrawal.isPending}
                  onPress={() => onCancel(item.id, item.reference)}
                >
                  Cancel request
                </Button>
              ) : null}
            </Card>
          )}
          ListEmptyComponent={
            withdrawals.isPending ? (
              <LoadingState />
            ) : (
              <EmptyState
                title="No withdrawals yet"
                description="Requests you make will be tracked here."
              />
            )
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{() => <RiderWithdrawals />}</RiderGate>;
}
