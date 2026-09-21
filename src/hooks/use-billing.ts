"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingApi } from "@/lib/api/billing";
import type {
  ListBillingInvoicesQueryDto,
  ListSubscriptionsQueryDto,
  RecordPaymentDto,
  RejectTransferDto,
  SetDefaultFeeDto,
  SetMonthlyFeeDto,
  SubmitTransferDto,
  SuspendVendorDto,
  UpdatePaymentRecordDto,
  VoidInvoiceDto,
} from "@/types/billing";
import type { SetPaymentQrCodesDto } from "@/types/payment";

import { restaurantKeys } from "./use-restaurants";

export const billingKeys = {
  all: ["billing"] as const,
  vendor: (restaurantId: string) => [...billingKeys.all, "vendor", restaurantId] as const,
  vendorInvoices: (restaurantId: string, query: ListBillingInvoicesQueryDto) =>
    [...billingKeys.all, "vendor-invoices", restaurantId, query] as const,
  subscriptions: (query: ListSubscriptionsQueryDto) =>
    [...billingKeys.all, "subscriptions", query] as const,
  invoices: (query: ListBillingInvoicesQueryDto) =>
    [...billingKeys.all, "invoices", query] as const,
  platformQr: () => [...billingKeys.all, "platform-qr"] as const,
  defaultFee: () => [...billingKeys.all, "default-fee"] as const,
};

// ── Vendor ──────────────────────────────────────────────────

/**
 * This listing's subscription.
 *
 * Kept fresh on a short stale time: a vendor watching this screen is usually
 * waiting to hear that the transfer they just reported has been confirmed.
 */
export function useVendorBilling(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.vendor(restaurantId),
    queryFn: () => billingApi.getVendorBilling(restaurantId),
    enabled: enabled && restaurantId !== "",
    staleTime: 30 * 1000,
    retry: false,
  });
}

export function useVendorInvoices(
  restaurantId: string,
  query: ListBillingInvoicesQueryDto = {},
  enabled = true,
) {
  return useQuery({
    queryKey: billingKeys.vendorInvoices(restaurantId, query),
    queryFn: () => billingApi.getVendorInvoices(restaurantId, query),
    enabled: enabled && restaurantId !== "",
    staleTime: 60 * 1000,
  });
}

export function useSubmitTransfer(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: SubmitTransferDto }) =>
      billingApi.submitTransfer(invoiceId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.vendor(restaurantId) });
      void queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

// ── Administration ──────────────────────────────────────────

export function useBillingSubscriptions(query: ListSubscriptionsQueryDto = {}) {
  return useQuery({
    queryKey: billingKeys.subscriptions(query),
    queryFn: () => billingApi.listSubscriptions(query),
    staleTime: 30 * 1000,
  });
}

export function useBillingInvoices(query: ListBillingInvoicesQueryDto = {}) {
  return useQuery({
    queryKey: billingKeys.invoices(query),
    queryFn: () => billingApi.listInvoices(query),
    staleTime: 30 * 1000,
  });
}

/**
 * Invalidates everything a billing decision can move.
 *
 * Confirming or rejecting a transfer can take a listing down or put it back up,
 * so the restaurant lists are stale too — an admin who confirms a payment and
 * then sees the restaurant still marked suspended will report it as a bug.
 */
function useBillingMutation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: billingKeys.all });
    void queryClient.invalidateQueries({ queryKey: restaurantKeys.admin() });
  };
}

export function useConfirmTransfer() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: (invoiceId: string) => billingApi.confirmTransfer(invoiceId),
    onSuccess: invalidate,
  });
}

export function useRejectTransfer() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: RejectTransferDto }) =>
      billingApi.rejectTransfer(invoiceId, data),
    onSuccess: invalidate,
  });
}

export function useVoidInvoice() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: VoidInvoiceDto }) =>
      billingApi.voidInvoice(invoiceId, data),
    onSuccess: invalidate,
  });
}

/** The platform's standard rate. */
export function useDefaultFee() {
  return useQuery({
    queryKey: billingKeys.defaultFee(),
    queryFn: () => billingApi.getDefaultFee(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Changing it re-prices every standard-rate vendor's open invoice, so the
 * subscription and invoice lists on screen are stale the moment it succeeds.
 */
export function useSetDefaultFee() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: (data: SetDefaultFeeDto) => billingApi.setDefaultFee(data),
    onSuccess: invalidate,
  });
}

export function useRecordPayment() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: RecordPaymentDto }) =>
      billingApi.recordPayment(invoiceId, data),
    onSuccess: invalidate,
  });
}

export function useUpdatePaymentRecord() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: UpdatePaymentRecordDto }) =>
      billingApi.updatePaymentRecord(invoiceId, data),
    onSuccess: invalidate,
  });
}

export function useDisableVendor() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: ({
      subscriptionId,
      data,
    }: {
      subscriptionId: string;
      data: SuspendVendorDto;
    }) => billingApi.disableVendor(subscriptionId, data),
    onSuccess: invalidate,
  });
}

export function useEnableVendor() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: (subscriptionId: string) => billingApi.enableVendor(subscriptionId),
    onSuccess: invalidate,
  });
}

/**
 * The platform's own QR codes — where vendors send the monthly fee.
 *
 * Long stale time: these change when someone rotates a bank account, which is
 * approximately never.
 */
export function usePlatformQrCodes() {
  return useQuery({
    queryKey: billingKeys.platformQr(),
    queryFn: () => billingApi.getPlatformQrCodes(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetPlatformQrCodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetPaymentQrCodesDto) => billingApi.setPlatformQrCodes(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useSetMonthlyFee() {
  const invalidate = useBillingMutation();

  return useMutation({
    mutationFn: ({
      subscriptionId,
      data,
    }: {
      subscriptionId: string;
      data: SetMonthlyFeeDto;
    }) => billingApi.setMonthlyFee(subscriptionId, data),
    onSuccess: invalidate,
  });
}
