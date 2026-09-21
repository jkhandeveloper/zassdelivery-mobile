import { apiGet, apiGetPaginated, apiPost } from '../api-client'
import type {
  PaymentDto,
  TransactionDto,
  StartCheckoutDto,
  CheckoutDto,
  PaymentVerificationDto,
  GatewayAvailabilityDto,
  ListPaymentsQueryDto,
  ListTransactionsQueryDto,
  ListInvoicesQueryDto,
  InvoiceSummaryDto,
  InvoiceDto,
  FailPaymentDto,
  LedgerSummaryQueryDto,
  LedgerSummaryDto,
  WebhookEventDto,
  ListWebhookEventsQueryDto,
  OrderPaymentQrDto,
  MarkPaymentReceivedDto,
} from '@/types/payment'

export const paymentApi = {
  // Customer checkout
  /** Scan-to-pay is reported per restaurant, so pass the one being checked out from. */
  getPaymentMethods: (restaurantId?: string) =>
    apiGet<GatewayAvailabilityDto[]>('/payments/methods', { params: { restaurantId } }),

  startCheckout: (orderId: string, data: StartCheckoutDto) =>
    apiPost<CheckoutDto>(`/payments/orders/${orderId}/checkout`, data),

  getOrderPaymentQr: (orderId: string) =>
    apiGet<OrderPaymentQrDto>(`/payments/orders/${orderId}/qr-codes`),

  /** The restaurant or the rider, once the transfer shows in their app. */
  markPaymentReceived: (orderId: string, data: MarkPaymentReceivedDto) =>
    apiPost<PaymentDto>(`/payments/orders/${orderId}/mark-received`, data),

  verifyPayment: (paymentId: string) =>
    apiPost<PaymentVerificationDto>(`/payments/${paymentId}/verify`, {}),

  cancelPayment: (paymentId: string) =>
    apiPost<PaymentDto>(`/payments/${paymentId}/cancel`, {}),

  getPayments: (query?: ListPaymentsQueryDto) =>
    apiGetPaginated<PaymentDto>('/payments', { params: query }),

  getTransactions: (query?: ListTransactionsQueryDto) =>
    apiGetPaginated<TransactionDto>('/payments/transactions', { params: query }),

  getInvoices: (query?: ListInvoicesQueryDto) =>
    apiGetPaginated<InvoiceSummaryDto>('/payments/invoices', { params: query }),

  getInvoice: (orderId: string) =>
    apiGet<InvoiceDto>(`/payments/invoices/${orderId}`),

  getOrderTransactions: (orderId: string) =>
    apiGet<TransactionDto[]>(`/payments/orders/${orderId}/transactions`),

  getPayment: (id: string) => apiGet<PaymentDto>(`/payments/${id}`),

  // Admin management
  listPaymentsAdmin: (query?: ListPaymentsQueryDto) =>
    apiGetPaginated<PaymentDto>('/payment-management/payments', { params: query }),

  /** Cash orders still owing — anything lingering is a reconciliation question. */
  getOutstandingCash: (query?: ListPaymentsQueryDto) =>
    apiGetPaginated<PaymentDto>('/payment-management/payments/outstanding-cash', {
      params: query,
    }),

  markCollected: (id: string) =>
    apiPost<PaymentDto>(`/payment-management/payments/${id}/mark-collected`, {}),

  failPayment: (id: string, data: FailPaymentDto) =>
    apiPost<PaymentDto>(`/payment-management/payments/${id}/fail`, data),

  expirePayments: () =>
    apiPost<{ expired: number; settled: number }>('/payment-management/payments/expire', {}),

  listTransactionsAdmin: (query?: ListTransactionsQueryDto) =>
    apiGetPaginated<TransactionDto>('/payment-management/transactions', { params: query }),

  getLedgerSummary: (query?: LedgerSummaryQueryDto) =>
    apiGet<LedgerSummaryDto>('/payment-management/transactions/summary', { params: query }),

  listInvoicesAdmin: (query?: ListInvoicesQueryDto) =>
    apiGetPaginated<InvoiceSummaryDto>('/payment-management/invoices', { params: query }),

  getInvoiceAdmin: (orderId: string) =>
    apiGet<InvoiceDto>(`/payment-management/invoices/${orderId}`),

  listWebhookEvents: (query?: ListWebhookEventsQueryDto) =>
    apiGetPaginated<WebhookEventDto>('/payment-management/webhooks', { params: query }),

  replayWebhook: (id: string) =>
    apiPost<WebhookEventDto>(`/payment-management/webhooks/${id}/replay`, {}),
}
