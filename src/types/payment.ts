import {
  PaymentMethod,
  PaymentQrProvider,
  PaymentStatus,
  TransactionType,
  TransactionStatus,
  WebhookStatus,
} from './enums'

/** One scan-to-pay QR — a restaurant's or a rider's. */
export interface PaymentQrCodeDto {
  provider: PaymentQrProvider
  /** "Meezan Bank", "SadaPay" — set for BANK and OTHER. */
  label: string | null
  /** The name the customer sees in their app before confirming. */
  accountTitle: string
  accountNumber: string | null
  imageUrl: string
}

export interface PaymentQrCodeInputDto {
  provider: PaymentQrProvider
  label?: string
  accountTitle: string
  accountNumber?: string
  imageUrl: string
}

/** The whole list: the API replaces rather than patches, and `[]` turns it off. */
export interface SetPaymentQrCodesDto {
  codes: PaymentQrCodeInputDto[]
}

export interface PaymentQrPayeeDto {
  name: string
  codes: PaymentQrCodeDto[]
}

/** What a customer can scan to pay for one order, and whether it has been. */
export interface OrderPaymentQrDto {
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  restaurant: PaymentQrPayeeDto
  /** The rider carrying the order, once one has accepted it. */
  rider: PaymentQrPayeeDto | null
}

export interface MarkPaymentReceivedDto {
  /** Which app or bank the money arrived through. */
  channel: PaymentQrProvider
  /** The transfer's TID. One TID can confirm one order only. */
  reference?: string
}

/**
 * A payment attempt, mirroring `payment-response.dto.ts`.
 *
 * `refundableAmount` is the figure a refund form must be bounded by — it is
 * `amount` minus what has already gone back, computed by the API so two clients
 * cannot disagree about how much of an order is still refundable.
 */
export interface PaymentDto {
  id: string
  /** Our merchant reference, quoted to the gateway and to support. */
  reference: string | null
  orderId: string
  orderNumber: string
  method: PaymentMethod
  status: PaymentStatus
  /** Status phrasing already written by the API — prefer it to a local map. */
  statusText: string
  amount: number
  currency: string
  refundedAmount: number
  /** What can still be refunded on this attempt. */
  refundableAmount: number
  gateway: string | null
  /** The gateway's own transaction id, once it has issued one. */
  gatewayTransactionId: string | null
  failureReason: string | null
  expiresAt: string | null
  paidAt: string | null
  failedAt: string | null
  createdAt: string
}

/** One movement of money. Append-only: a correction is another row, not an edit. */
export interface TransactionDto {
  id: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  currency: string
  reference: string
  description: string | null
  orderId: string | null
  paymentId: string | null
  processedAt: string | null
  createdAt: string
}

export interface StartCheckoutDto {
  method: PaymentMethod
}

export interface CheckoutDto {
  payment: PaymentDto
  action: 'REDIRECT' | 'SETTLED' | 'ON_DELIVERY' | 'SCAN_QR'
  message: string
  checkout?: CheckoutFieldsDto
  /** Present only for SCAN_QR: the restaurant's codes. */
  qrCodes?: PaymentQrCodeDto[]
}

export interface CheckoutFieldsDto {
  formFields?: Record<string, unknown>
  redirectUrl?: string
}

export interface PaymentVerificationDto {
  payment: PaymentDto
  settled: boolean
  message: string
  source: 'LOCAL' | 'GATEWAY'
}

export interface GatewayAvailabilityDto {
  name: string
  method: PaymentMethod
  available: boolean
}

export interface ListPaymentsQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  /** Matches our reference, the gateway transaction id or the order number. */
  search?: string
  status?: PaymentStatus
  method?: PaymentMethod
  gateway?: string
  orderId?: string
  /** Staff view: the paying customer. */
  userId?: string
  from?: string
  to?: string
}

export interface ListTransactionsQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  type?: TransactionType
  status?: TransactionStatus
  orderId?: string
  userId?: string
  paymentId?: string
  from?: string
  to?: string
}

export interface ListInvoicesQueryDto {
  page?: number
  limit?: number
  from?: string
  to?: string
}

export interface InvoiceSummaryDto {
  orderId: string
  orderNumber: string
  total: number
  method: PaymentMethod
  status: PaymentStatus
  issuedAt: string
}

export interface InvoiceDto {
  orderId: string
  orderNumber: string
  restaurant: { id: string; name: string; phone?: string }
  customer: { id: string; fullName: string; phone: string }
  items: Array<{ name: string; quantity: number; price: number; total: number }>
  totals: {
    subtotal: number
    discount: number
    delivery: number
    service: number
    tax: number
    tip: number
    total: number
  }
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  deliveryAddress: string
  issuedAt: string
  notes?: string
}

export interface FailPaymentDto {
  reason: string
}

export interface LedgerSummaryQueryDto {
  from?: string
  to?: string
}

export interface LedgerLineDto {
  type: TransactionType
  status: TransactionStatus
  count: number
  amount: number
}

/**
 * Money moved over a window.
 *
 * Counts only what actually succeeded: a refund the gateway is still processing
 * is money promised, not money gone.
 */
export interface LedgerSummaryDto {
  from: string
  to: string
  lines: LedgerLineDto[]
  /** Successful customer payments in the window. */
  collected: number
  refunded: number
  commission: number
  /** Money paid out to riders in the window. */
  payouts: number
  /** Collected minus refunded. */
  net: number
}

export interface WebhookEventDto {
  id: string
  gateway: string
  eventId: string
  status: WebhookStatus
  paymentId: string | null
  error: string | null
  /** Deliveries received, including replays. */
  attempts: number
  receivedAt: string
  processedAt: string | null
  /** The callback as received. Staff view only. */
  payload?: unknown
}

export interface ListWebhookEventsQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  gateway?: string
  status?: WebhookStatus
  paymentId?: string
  from?: string
  to?: string
}
