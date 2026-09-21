import { OrderStatus, OrderType, PaymentMethod, PaymentStatus, ActorType } from './enums'

/**
 * Orders, mirroring `order-response.dto.ts` on the backend.
 *
 * Verified against live responses: totals are named after the fee they carry
 * (`discountAmount`, `deliveryFee`, `totalAmount`), a line is `name`/`unitPrice`
 * rather than `itemName`/`itemPrice`, and a timeline entry describes a
 * transition (`fromStatus` → `toStatus`) rather than carrying an id of its own.
 */
export interface OrderDto {
  id: string
  orderNumber: string
  status: OrderStatus
  /** Customer-facing status text, already phrased by the API. */
  statusText: string
  type: OrderType
  restaurant: OrderPartyDto
  driver: OrderPartyDto | null
  items: OrderItemDto[]
  totals: OrderTotalsDto
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  /** Already returned to the customer by the restaurant. */
  refundedAmount: number
  couponCode: string | null
  deliveryAddress: string
  deliveryLandmark: string | null
  deliveryNotes: string | null
  distanceKm: number | null
  estimatedDeliveryAt: string | null
  placedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelledBy: ActorType | null
  cancellationReason: string | null
  /** Statuses this order can legally move to next, for the caller's role. */
  allowedTransitions: OrderStatus[]
  canCancel: boolean
  timeline: OrderTimelineEntryDto[]
  transactions?: OrderTransactionDto[]
  createdAt: string
}

export interface OrderPartyDto {
  id: string
  name: string
  phone: string | null
}

export interface OrderItemDto {
  id: string
  /** Null once the dish has been removed from the menu. */
  menuItemId: string | null
  name: string
  variantName: string | null
  /** Variant price when one was chosen, otherwise the dish price. */
  unitPrice: number
  quantity: number
  lineTotal: number
  notes: string | null
  addOns: OrderAddOnDto[]
}

/** Order add-ons are snapshots — they carry no id of their own. */
export interface OrderAddOnDto {
  name: string
  price: number
  quantity: number
}

export interface OrderTotalsDto {
  subtotal: number
  discountAmount: number
  deliveryFee: number
  serviceFee: number
  taxAmount: number
  tipAmount: number
  /** subtotal − discount + delivery + service + tax + tip. */
  totalAmount: number
  currency: string
}

export interface OrderTimelineEntryDto {
  /** Null on the first entry, where there is no status to move from. */
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actor: ActorType
  /** Human-readable, written by the API — e.g. "Accepted by restaurant". */
  label: string
  note: string | null
  at: string
}

export interface OrderTransactionDto {
  id: string
  type: string
  status: string
  amount: number
  reference: string
  description: string | null
  createdAt: string
}

export interface PlaceOrderDto {
  paymentMethod?: PaymentMethod
  customerNote?: string
}

export interface ListOrdersQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: OrderStatus
  activeOnly?: boolean
  from?: string
  to?: string
}

export interface ListOrdersAdminQueryDto extends ListOrdersQueryDto {
  restaurantId?: string
  driverId?: string
  customerId?: string
}

export interface CancelOrderDto {
  reason?: string
}

export interface RejectOrderDto {
  reason: string
}

export interface AdvanceOrderDto {
  status: OrderStatus
  note?: string
}

export interface RefundOrderDto {
  amount?: number
  reason: string
}

/**
 * What a refund actually did.
 *
 * `refunded` is the amount moved by *this* call and `totalRefunded` is the
 * running total on the order — a partial refund makes them differ, so a screen
 * that shows only one of them will eventually mislead.
 */
export interface RefundOutcome {
  message: string
  refunded: number
  totalRefunded: number
}
