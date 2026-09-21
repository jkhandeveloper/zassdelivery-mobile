import type {
  PaymentQrProvider,
  SubscriptionInvoiceStatus,
  SubscriptionStatus,
} from './enums'
import type { PaymentQrCodeDto } from './payment'

/**
 * Vendor subscriptions, mirroring `billing-response.dto.ts`.
 *
 * Dates arrive as ISO strings, like everywhere else on the wire — pass them
 * through `formatDate`/`formatDateTime` rather than constructing a Date.
 */

export interface BillingListingDto {
  id: string
  name: string
  slug: string
}

export interface BillingOwnerDto {
  id: string
  fullName: string
  phone: string
}

export interface SubscriptionDto {
  id: string
  restaurant: BillingListingDto
  /** Present on the administrator's view only. */
  owner: BillingOwnerDto | null

  status: SubscriptionStatus
  /** Human wording, already resolved by the API. */
  statusText: string

  /** What this vendor actually pays — their own rate, or the platform default. */
  monthlyFee: number
  /** Whether that amount was negotiated for this vendor alone. */
  hasCustomRate: boolean
  currency: string

  currentPeriodStart: string
  /** The next due date. Cycles are a fixed 30 days. */
  currentPeriodEnd: string
  /** Whole days until the next payment falls due; negative once it has passed. */
  daysUntilDue: number

  trialEndsAt: string | null
  isTrialing: boolean

  lastPaidAt: string | null
  suspendedAt: string | null
  /**
   * Whether non-payment is what closed this listing. A listing an administrator
   * closed for its own reasons is not reopened by paying.
   */
  suspendedForNonPayment: boolean

  createdAt: string
}

export interface SubscriptionInvoiceDto {
  id: string
  invoiceNumber: string
  restaurant: BillingListingDto
  owner: BillingOwnerDto | null

  status: SubscriptionInvoiceStatus
  statusText: string

  amount: number
  currency: string

  periodStart: string
  periodEnd: string
  /** The fee buys the month ahead, so this equals the period start. */
  dueAt: string
  /** When an unpaid invoice takes the listing down. */
  blockAt: string
  daysUntilDue: number

  /** The free first month. */
  isTrial: boolean

  channel: PaymentQrProvider | null
  /** The transaction ID the vendor quoted. */
  reference: string | null
  proofImageUrl: string | null
  submittedAt: string | null

  paidAt: string | null
  rejectionReason: string | null
  voidReason: string | null

  createdAt: string
}

/** The vendor's whole billing screen in one response. */
export interface VendorBillingDto {
  subscription: SubscriptionDto
  /** What is owed right now, if anything. */
  currentInvoice: SubscriptionInvoiceDto | null
  /** Where to send the money. Empty means nobody has configured it yet. */
  payTo: PaymentQrCodeDto[]
}

export interface SubmitTransferDto {
  channel: PaymentQrProvider
  /** The TID from the wallet or bank app. One TID settles one invoice. */
  reference?: string
  proofImageUrl?: string
}

export interface RejectTransferDto {
  reason: string
}

export interface VoidInvoiceDto {
  reason: string
}

/** The platform's standard rate, for a vendor with no deal of their own. */
export interface DefaultFeeDto {
  monthlyFee: number
  currency: string
}

export interface SetDefaultFeeDto {
  monthlyFee: number
}

/** A payment the platform received, entered by an administrator. */
export interface RecordPaymentDto {
  channel: PaymentQrProvider
  reference?: string
  /** When the money actually arrived. Defaults to now. */
  paidAt?: string
}

export interface UpdatePaymentRecordDto {
  channel?: PaymentQrProvider
  reference?: string
  paidAt?: string
}

export interface SuspendVendorDto {
  /** Shown to the vendor on their own screens. */
  reason: string
}

export interface SetMonthlyFeeDto {
  /** Null returns the vendor to the platform default rate. */
  monthlyFee: number | null
}

export interface ListSubscriptionsQueryDto {
  page?: number
  limit?: number
  status?: SubscriptionStatus
  search?: string
}

export interface ListBillingInvoicesQueryDto {
  page?: number
  limit?: number
  status?: SubscriptionInvoiceStatus
  restaurantId?: string
  search?: string
  from?: string
  to?: string
}
