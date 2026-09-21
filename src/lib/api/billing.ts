import { apiGet, apiGetPaginated, apiPatch, apiPost, apiPut } from '../api-client'
import type {
  DefaultFeeDto,
  ListBillingInvoicesQueryDto,
  ListSubscriptionsQueryDto,
  RecordPaymentDto,
  RejectTransferDto,
  SetDefaultFeeDto,
  SetMonthlyFeeDto,
  SubmitTransferDto,
  SubscriptionDto,
  SubscriptionInvoiceDto,
  SuspendVendorDto,
  UpdatePaymentRecordDto,
  VendorBillingDto,
  VoidInvoiceDto,
} from '@/types/billing'
import type { PaymentQrCodeDto, SetPaymentQrCodesDto } from '@/types/payment'

export const billingApi = {
  // ── Vendor ──
  /** Where this listing stands, what is owed, and the codes to pay it with. */
  getVendorBilling: (restaurantId: string) =>
    apiGet<VendorBillingDto>(`/vendor-billing/restaurants/${restaurantId}`),

  getVendorInvoices: (restaurantId: string, query?: ListBillingInvoicesQueryDto) =>
    apiGetPaginated<SubscriptionInvoiceDto>(
      `/vendor-billing/restaurants/${restaurantId}/invoices`,
      { params: query },
    ),

  /**
   * Reports a transfer. Does not settle the invoice — there is no gateway
   * behind a QR payment, so the platform confirms it arrived first.
   */
  submitTransfer: (invoiceId: string, data: SubmitTransferDto) =>
    apiPost<SubscriptionInvoiceDto>(`/vendor-billing/invoices/${invoiceId}/pay`, data),

  // ── Administration ──
  listSubscriptions: (query?: ListSubscriptionsQueryDto) =>
    apiGetPaginated<SubscriptionDto>('/billing-management/subscriptions', { params: query }),

  /** Filter to PENDING_REVIEW for the transfers waiting to be checked. */
  listInvoices: (query?: ListBillingInvoicesQueryDto) =>
    apiGetPaginated<SubscriptionInvoiceDto>('/billing-management/invoices', { params: query }),

  confirmTransfer: (invoiceId: string) =>
    apiPost<SubscriptionInvoiceDto>(`/billing-management/invoices/${invoiceId}/confirm`, {}),

  rejectTransfer: (invoiceId: string, data: RejectTransferDto) =>
    apiPost<SubscriptionInvoiceDto>(`/billing-management/invoices/${invoiceId}/reject`, data),

  voidInvoice: (invoiceId: string, data: VoidInvoiceDto) =>
    apiPost<SubscriptionInvoiceDto>(`/billing-management/invoices/${invoiceId}/void`, data),

  setMonthlyFee: (subscriptionId: string, data: SetMonthlyFeeDto) =>
    apiPatch<SubscriptionDto>(`/billing-management/subscriptions/${subscriptionId}/fee`, data),

  /** Closes the listing now. A later payment will not reopen it. */
  disableVendor: (subscriptionId: string, data: SuspendVendorDto) =>
    apiPost<SubscriptionDto>(`/billing-management/subscriptions/${subscriptionId}/disable`, data),

  /** Reopens the listing, with a fresh grace window on anything outstanding. */
  enableVendor: (subscriptionId: string) =>
    apiPost<SubscriptionDto>(`/billing-management/subscriptions/${subscriptionId}/enable`, {}),

  // ── Payment records ──
  /** Money that arrived by phone, bank or over the counter. Settles the invoice. */
  recordPayment: (invoiceId: string, data: RecordPaymentDto) =>
    apiPost<SubscriptionInvoiceDto>(
      `/billing-management/invoices/${invoiceId}/record-payment`,
      data,
    ),

  /** Fixes a mistyped TID, wrong wallet or wrong date after the fact. */
  updatePaymentRecord: (invoiceId: string, data: UpdatePaymentRecordDto) =>
    apiPatch<SubscriptionInvoiceDto>(`/billing-management/invoices/${invoiceId}/payment`, data),

  // ── The standard rate ──
  getDefaultFee: () => apiGet<DefaultFeeDto>('/billing-management/default-fee'),

  /** Re-prices every standard-rate vendor's open invoice and tells them. */
  setDefaultFee: (data: SetDefaultFeeDto) =>
    apiPut<DefaultFeeDto>('/billing-management/default-fee', data),

  // ── Where vendors pay us ──
  getPlatformQrCodes: () => apiGet<PaymentQrCodeDto[]>('/billing-management/payment-qr-codes'),

  setPlatformQrCodes: (data: SetPaymentQrCodesDto) =>
    apiPut<PaymentQrCodeDto[]>('/billing-management/payment-qr-codes', data),
}
