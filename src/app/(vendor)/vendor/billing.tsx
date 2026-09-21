import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/providers";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { VendorGate } from "@/components/shared/vendor-gate";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useSubmitTransfer, useVendorBilling, useVendorInvoices } from "@/hooks/use-billing";
import { ApiError } from "@/lib/api-client";
import { qrCodeName } from "@/lib/payment-labels";
import { cn, formatDate, formatPrice, hasText } from "@/lib/utils";
import { UserRole } from "@/types/auth";
import type { PaymentQrProvider } from "@/types/enums";
import type { SubscriptionInvoiceDto, VendorBillingDto } from "@/types/billing";
import type { PaymentQrCodeDto } from "@/types/payment";
import type { RestaurantAdminDto } from "@/types/restaurant";

/**
 * The monthly platform fee: what is due, where to pay it, and what has been
 * paid before.
 *
 * This is the only vendor screen that renders for a *suspended* listing, via
 * the gate's `allowSuspended`. A vendor closed for non-payment has to be able
 * to reach the screen that reopens them — a dead end here leaves the fee
 * uncollected and the vendor with nobody to pay.
 *
 * It is also owner-only. `VENDOR_STAFF` is refused by the API, not merely
 * hidden: a kitchen account runs the menu and the order queue, not the owner's
 * bank details.
 *
 * Paying is a declaration, not a transaction. The vendor transfers the money in
 * their own wallet or bank app, then tells us the transaction ID here; an
 * administrator confirms it against the receiving account. Nothing in this
 * screen moves money, which is why the copy never implies that it does.
 */

function SubmitTransferSheet({
  invoice,
  payTo,
  restaurantId,
  visible,
  onClose,
}: {
  invoice: SubscriptionInvoiceDto;
  payTo: readonly PaymentQrCodeDto[];
  restaurantId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const submitTransfer = useSubmitTransfer(restaurantId);

  const [channel, setChannel] = React.useState<PaymentQrProvider | null>(
    payTo[0]?.provider ?? null,
  );
  const [reference, setReference] = React.useState("");
  const [proofUrl, setProofUrl] = React.useState<string | null>(null);

  const onSubmit = () => {
    if (channel === null) {
      toast.error("Choose where you sent the money");
      return;
    }

    submitTransfer.mutate(
      {
        invoiceId: invoice.id,
        data: {
          channel,
          ...(reference.trim() !== "" && { reference: reference.trim() }),
          ...(proofUrl !== null && { proofImageUrl: proofUrl }),
        },
      },
      {
        onSuccess: () => {
          toast.success("Transfer submitted", {
            description: "We'll confirm it against the receiving account.",
          });
          setReference("");
          setProofUrl(null);
          onClose();
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError
              ? // A replayed TID is the common failure: one transaction settles
                // one invoice, so quoting an old one is rejected.
                error.status === 409
                ? "That transaction ID has already been used for another invoice."
                : error.message
              : "Couldn't submit that. Please try again.",
          ),
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-4 px-4 pb-8"
        style={{ paddingTop: insets.top + 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Heading level={2}>Tell us you&apos;ve paid</Heading>
        <Body muted className="text-[13px]">
          Send {formatPrice(invoice.amount)} using one of the accounts below, then quote the
          transaction ID here.
        </Body>

        <Field label="Where did you send it?" required>
          <View className="gap-2">
            {payTo.map((code) => {
              const active = channel === code.provider;

              return (
                <Pressable
                  key={`${code.provider}-${code.accountNumber ?? code.accountTitle}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setChannel(code.provider)}
                  className={cn(
                    "rounded-input border px-3 py-3",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[14px]",
                      active ? "font-semibold text-brand" : "text-primary",
                    )}
                  >
                    {qrCodeName(code)}
                  </Text>
                  <Text className="font-sans text-[12px] text-muted">{code.accountTitle}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field
          label="Transaction ID"
          hint="From your wallet or bank app. One transaction settles one invoice."
        >
          <Input
            value={reference}
            onChangeText={setReference}
            placeholder="TID / TRX number"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!submitTransfer.isPending}
          />
        </Field>

        <ImageUploadField
          label="Screenshot of the receipt"
          folder="payment-qr-codes"
          value={proofUrl}
          onChange={setProofUrl}
          hint="Optional, but it gets confirmed faster."
        />

        <Button fullWidth size="lg" onPress={onSubmit} loading={submitTransfer.isPending}>
          Submit
        </Button>
        <Button variant="ghost" fullWidth onPress={onClose} disabled={submitTransfer.isPending}>
          Cancel
        </Button>
      </ScrollView>
    </Modal>
  );
}

function invoiceTone(
  invoice: SubscriptionInvoiceDto,
): "success" | "warning" | "danger" | "neutral" {
  if (invoice.paidAt !== null) {
    return "success";
  }

  if (hasText(invoice.rejectionReason) || invoice.daysUntilDue < 0) {
    return "danger";
  }

  if (invoice.submittedAt !== null) {
    return "warning";
  }

  return "neutral";
}

function BillingBody({
  billing,
  restaurant,
}: {
  billing: VendorBillingDto;
  restaurant: RestaurantAdminDto;
}) {
  const [submitting, setSubmitting] = React.useState(false);

  const invoices = useVendorInvoices(restaurant.id, { limit: 24 });

  const { subscription, currentInvoice, payTo } = billing;

  /** Whether the vendor can act: something owed, and somewhere to send it. */
  const canPay =
    currentInvoice !== null && currentInvoice.paidAt === null && payTo.length > 0;

  return (
    <>
      <Card className="gap-2">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="font-sans text-[13px] text-muted">Monthly platform fee</Text>
            <Text
              className="font-display text-[28px] font-extrabold text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(subscription.monthlyFee)}
            </Text>
          </View>
          <Badge
            tone={
              subscription.suspendedAt !== null
                ? "danger"
                : subscription.isTrialing
                  ? "brand"
                  : subscription.daysUntilDue < 0
                    ? "warning"
                    : "success"
            }
          >
            {subscription.statusText}
          </Badge>
        </View>

        {subscription.hasCustomRate ? (
          <Text className="font-sans text-[12px] text-muted">
            This is a rate agreed for your restaurant.
          </Text>
        ) : null}

        <Divider />

        <View className="flex-row justify-between">
          <Text className="font-sans text-[14px] text-secondary">Next due</Text>
          <Text
            className="font-sans text-[14px] font-semibold text-primary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatDate(subscription.currentPeriodEnd)}
          </Text>
        </View>

        {/*
          `daysUntilDue` goes negative once the date has passed, which is the
          number that actually matters to a vendor about to be closed.
        */}
        <Text
          className={
            subscription.daysUntilDue < 0
              ? "font-sans text-[13px] font-semibold text-danger"
              : "font-sans text-[13px] text-muted"
          }
        >
          {subscription.daysUntilDue < 0
            ? `${Math.abs(subscription.daysUntilDue)} days overdue`
            : subscription.isTrialing
              ? "Your first month is free."
              : `${subscription.daysUntilDue} days to go`}
        </Text>

        {subscription.suspendedAt !== null ? (
          <View className="mt-1 rounded-input bg-danger-soft px-3 py-2.5">
            <Text className="font-sans text-[13px] font-semibold text-danger">
              {subscription.suspendedForNonPayment
                ? "Your listing is closed for non-payment. Settling the invoice below reopens it."
                : "Your listing was closed by an administrator. Paying will not reopen it — contact support."}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* ── What's owed ────────────────────────────────────── */}
      {currentInvoice !== null && currentInvoice.paidAt === null ? (
        <Card className="gap-2">
          <Text className="font-sans text-[15px] font-semibold text-primary">Due now</Text>

          <View className="flex-row items-center justify-between">
            <Text
              className="font-sans text-[13px] text-muted"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {currentInvoice.invoiceNumber}
            </Text>
            <Text
              className="font-display text-[19px] font-bold text-primary"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(currentInvoice.amount)}
            </Text>
          </View>

          <Text className="font-sans text-[12px] text-muted">
            For {formatDate(currentInvoice.periodStart)} – {formatDate(currentInvoice.periodEnd)}
          </Text>

          {currentInvoice.submittedAt !== null ? (
            <View className="rounded-input bg-warning-soft px-3 py-2.5">
              <Text className="font-sans text-[13px] font-medium text-warning">
                You reported a transfer on {formatDate(currentInvoice.submittedAt)}. We&apos;re
                confirming it against the receiving account.
              </Text>
            </View>
          ) : null}

          {hasText(currentInvoice.rejectionReason) ? (
            <View className="rounded-input bg-danger-soft px-3 py-2.5">
              <Text className="font-sans text-[13px] font-medium text-danger">
                {currentInvoice.rejectionReason}
              </Text>
            </View>
          ) : null}

          <Text className="font-sans text-[12px] text-muted">
            Unpaid after {formatDate(currentInvoice.blockAt)} closes the listing.
          </Text>

          {payTo.length > 0 ? (
            <Button
              fullWidth
              className="mt-1"
              onPress={() => setSubmitting(true)}
              disabled={!canPay}
            >
              {currentInvoice.submittedAt !== null ? "Resubmit transfer" : "I've paid"}
            </Button>
          ) : (
            // Nobody has configured a receiving account, so there is genuinely
            // nowhere to send the money. Saying so beats a button that fails.
            <View className="rounded-input bg-surface-muted px-3 py-2.5">
              <Text className="font-sans text-[13px] text-secondary">
                No payment account has been set up yet. Contact support before paying.
              </Text>
            </View>
          )}
        </Card>
      ) : null}

      {/* ── Where to pay ───────────────────────────────────── */}
      {payTo.length > 0 ? (
        <Card className="gap-3">
          <Text className="font-sans text-[15px] font-semibold text-primary">Pay to</Text>
          <Body muted className="text-[13px]">
            Scan one of these in your wallet or bank app.
          </Body>

          {payTo.map((code) => (
            <View
              key={`${code.provider}-${code.accountNumber ?? code.accountTitle}`}
              className="items-center gap-2 rounded-card border border-border-subtle bg-surface-muted p-3"
            >
              <Text className="font-sans text-[14px] font-semibold text-primary">
                {qrCodeName(code)}
              </Text>
              <Image
                source={{ uri: code.imageUrl }}
                // Square and large: this is scanned off the screen by another
                // phone, so it has to be big enough for a camera to lock on.
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
        </Card>
      ) : null}

      {/* ── History ────────────────────────────────────────── */}
      <Card className="gap-2">
        <Text className="font-sans text-[15px] font-semibold text-primary">History</Text>

        {invoices.isPending ? (
          <LoadingState />
        ) : invoices.isError ? (
          <ErrorState error={invoices.error} onRetry={() => void invoices.refetch()} />
        ) : invoices.data.items.length === 0 ? (
          <Body muted className="text-[13px]">
            Nothing invoiced yet.
          </Body>
        ) : (
          invoices.data.items.map((invoice, index) => (
            <View key={invoice.id}>
              {index > 0 ? <Divider className="my-1" /> : null}
              <View className="flex-row items-center justify-between gap-2 py-1">
                <View className="flex-1">
                  <Text
                    className="font-sans text-[14px] font-semibold text-primary"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {invoice.invoiceNumber}
                  </Text>
                  <Text className="font-sans text-[12px] text-muted">
                    {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                  </Text>
                  {invoice.isTrial ? (
                    <Text className="font-sans text-[12px] text-brand">Free first month</Text>
                  ) : null}
                </View>

                <View className="items-end gap-1">
                  <Text
                    className="font-sans text-[14px] font-semibold text-primary"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {formatPrice(invoice.amount)}
                  </Text>
                  <Badge tone={invoiceTone(invoice)}>{invoice.statusText}</Badge>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      {currentInvoice !== null ? (
        <SubmitTransferSheet
          invoice={currentInvoice}
          payTo={payTo}
          restaurantId={restaurant.id}
          visible={submitting}
          onClose={() => setSubmitting(false)}
        />
      ) : null}
    </>
  );
}

function VendorBilling({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isOwner = user?.role === UserRole.VENDOR_OWNER;
  const billing = useVendorBilling(restaurant.id, isOwner);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/vendor"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Billing</Text>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        {/*
          Refused by the API for staff rather than merely hidden, so this is not
          a cosmetic guard — without it a kitchen account gets a bare 403.
        */}
        {!isOwner ? (
          <Card className="gap-2">
            <Heading level={3}>Owner only</Heading>
            <Body muted>
              Billing is the restaurant owner&apos;s. Your account runs the menu and the order
              queue.
            </Body>
          </Card>
        ) : billing.isPending ? (
          <LoadingState label="Loading your billing…" />
        ) : billing.isError ? (
          <ErrorState error={billing.error} onRetry={() => void billing.refetch()} />
        ) : (
          <BillingBody billing={billing.data} restaurant={restaurant} />
        )}
      </ScrollView>
    </View>
  );
}

export default function Screen() {
  // The one vendor screen that renders for a suspended listing — see the gate.
  return (
    <VendorGate allowSuspended>
      {(restaurant) => <VendorBilling restaurant={restaurant} />}
    </VendorGate>
  );
}
