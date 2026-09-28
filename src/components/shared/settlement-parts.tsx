import { Image } from "expo-image";
import * as React from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge, Body, Card } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { PAYMENT_METHOD_LABELS, qrCodeName } from "@/lib/payment-labels";
import { cn, formatDateTime, formatPrice, hasText } from "@/lib/utils";
import { RiderSettlementDirection } from "@/types/enums";
import type { PaymentQrCodeDto } from "@/types/payment";
import type { RiderLedgerEntryDto, RiderSettlementDto } from "@/types/rider";

/** Whose side of the counter is looking at the numbers. */
export type SettlementViewer = "rider" | "restaurant";

/**
 * A balance in words, from the viewer's side.
 *
 * `balance` is always "what the rider owes the restaurant", so the same number
 * reads as a debt to one side and money due to the other.
 */
export function BalanceBadge({ balance, viewer }: { balance: number; viewer: SettlementViewer }) {
  if (Math.abs(balance) < 0.01) {
    return <Badge>Settled</Badge>;
  }

  const riderOwes = balance > 0;
  const viewerOwes = viewer === "rider" ? riderOwes : !riderOwes;

  return (
    <Badge tone={viewerOwes ? "warning" : "success"}>
      {viewerOwes ? "You owe" : "Owes you"} {formatPrice(Math.abs(balance))}
    </Badge>
  );
}

/**
 * Records money that reached the viewer, inline under the balance it clears.
 *
 * Only the receiving side is offered this: whoever got the money is the only
 * one who can honestly say it arrived. The amount starts at the full balance —
 * the common case is clearing it — and the API refuses anything more.
 */
export function RecordReceiptForm({
  max,
  submitLabel,
  onSubmit,
  onDone,
}: {
  max: number;
  submitLabel: string;
  onSubmit: (amount: number, note: string | undefined) => Promise<unknown>;
  onDone: () => void;
}) {
  const [amount, setAmount] = React.useState(String(max));
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const value = Number(amount);
  const error =
    amount === ""
      ? null
      : !Number.isFinite(value) || value <= 0
        ? "Enter the amount you received"
        : value > max
          ? `Only ${formatPrice(max)} is owed`
          : null;

  async function submit() {
    if (error !== null || amount === "") return;
    setPending(true);

    try {
      await onSubmit(value, hasText(note) ? note.trim() : undefined);
      toast.success(`${formatPrice(value)} recorded`);
      onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "That did not go through.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-3 rounded-input bg-surface-muted p-3">
      <Field
        label="Amount received"
        required
        error={error ?? undefined}
        hint={error === null ? `Up to ${formatPrice(max)}` : undefined}
      >
        <Input
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          invalid={error !== null}
          editable={!pending}
        />
      </Field>
      <Field label="Note">
        <Input
          value={note}
          onChangeText={setNote}
          placeholder="e.g. cash at the counter"
          maxLength={300}
          editable={!pending}
        />
      </Field>
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          loading={pending}
          disabled={error !== null || amount === ""}
          onPress={() => void submit()}
        >
          {submitLabel}
        </Button>
      </View>
    </View>
  );
}

/** The rider's QR codes, big enough to scan off the screen. */
export function QrCodes({ codes }: { codes: PaymentQrCodeDto[] }) {
  return (
    <View className="gap-3">
      {codes.map((code) => (
        <View
          key={`${code.provider}-${code.accountNumber ?? code.accountTitle}`}
          className="items-center gap-2 rounded-card border border-border-subtle bg-surface-muted p-3"
        >
          <Text className="font-sans text-[14px] font-semibold text-primary">
            {qrCodeName(code)}
          </Text>
          <Image
            source={{ uri: code.imageUrl }}
            style={{ width: 200, height: 200, backgroundColor: "#FFFFFF", borderRadius: 12 }}
            contentFit="contain"
            accessibilityLabel={`QR code for ${qrCodeName(code)}`}
          />
          <Text className="font-sans text-[13px] text-secondary">{code.accountTitle}</Text>
          {hasText(code.accountNumber) ? (
            <Text
              selectable
              className="font-sans text-[13px] text-muted"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {code.accountNumber}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

type Query<T> = {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data?: { items: T[] };
  refetch: () => unknown;
};

/** One line per delivered order: what it added to the balance. */
export function LedgerEntriesCard({
  query,
  viewer,
}: {
  query: Query<RiderLedgerEntryDto>;
  viewer: SettlementViewer;
}) {
  return (
    <Card className="gap-2">
      <Text className="font-sans text-[15px] font-semibold text-primary">Per order</Text>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError || query.data === undefined ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <Body muted className="text-[13px]">
          Delivered orders show up here once the customer’s code is confirmed.
        </Body>
      ) : (
        query.data.items.map((entry, index) => (
          <View
            key={entry.id}
            className={cn("gap-1 py-2", index > 0 && "border-t border-border-subtle")}
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-sans text-[14px] font-semibold text-primary">
                {viewer === "rider" ? entry.restaurantName : entry.riderName} ·{" "}
                {entry.orderNumber}
              </Text>
              <BalanceBadge balance={entry.netAmount} viewer={viewer} />
            </View>
            <Text className="font-sans text-[12px] text-muted">
              {PAYMENT_METHOD_LABELS[entry.paymentMethod] ?? entry.paymentMethod} ·{" "}
              {entry.collectedAmount > 0
                ? `rider collected ${formatPrice(entry.collectedAmount)}`
                : "paid to the business"}{" "}
              · rider fee {formatPrice(entry.riderFee)} · {formatDateTime(entry.createdAt)}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

/** Cash handed over and fees paid, as confirmed by whoever received them. */
export function SettlementPaymentsCard({
  query,
  viewer,
}: {
  query: Query<RiderSettlementDto>;
  viewer: SettlementViewer;
}) {
  return (
    <Card className="gap-2">
      <Text className="font-sans text-[15px] font-semibold text-primary">
        Money that changed hands
      </Text>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError || query.data === undefined ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <Body muted className="text-[13px]">
          Cash handovers and fee payments appear here once they are confirmed.
        </Body>
      ) : (
        query.data.items.map((payment, index) => {
          const toRestaurant = payment.direction === RiderSettlementDirection.RIDER_TO_RESTAURANT;
          const incoming = viewer === "restaurant" ? toRestaurant : !toRestaurant;

          return (
            <View
              key={payment.id}
              className={cn("gap-0.5 py-2", index > 0 && "border-t border-border-subtle")}
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-sans text-[14px] font-semibold text-primary">
                  {toRestaurant
                    ? `Cash handed to ${payment.restaurantName}`
                    : `Fees paid to ${payment.riderName}`}
                </Text>
                <Text
                  className={cn(
                    "font-sans text-[15px] font-bold",
                    incoming ? "text-success" : "text-warning",
                  )}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {incoming ? "+" : "−"}
                  {formatPrice(payment.amount)}
                </Text>
              </View>
              <Text className="font-sans text-[12px] text-muted">
                {formatDateTime(payment.createdAt)}
                {payment.recordedByName !== null ? ` · confirmed by ${payment.recordedByName}` : ""}
                {payment.note !== null ? ` · ${payment.note}` : ""}
              </Text>
            </View>
          );
        })
      )}
    </Card>
  );
}
