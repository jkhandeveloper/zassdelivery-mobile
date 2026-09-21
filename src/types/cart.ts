/**
 * The cart, mirroring the backend DTOs exactly.
 *
 * Totals are recomputed server-side on every read, so nothing here is derived
 * on the client — a cart that disagrees with the order it becomes is worse
 * than one that costs a round trip.
 */

export interface CartDto {
  id: string
  restaurant: CartRestaurantDto
  items: CartLineDto[]
  totals: CartTotalsDto
  delivery: CartDeliveryDto
  couponCode: string | null
  notes: string | null
  issues: CartIssueDto[]
  canCheckout: boolean
  expiresAt: string
}

/**
 * An empty cart has no restaurant, no lines and no totals to report, so the API
 * answers with this stub instead — verified against `EmptyCartDto` on the
 * backend. Nothing but `isEmpty` and `message` exists on it, so narrow with
 * `isFilledCart` before reaching for items or totals.
 */
export interface EmptyCartDto {
  id: null
  isEmpty: true
  message: string
}

export interface CartRestaurantDto {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  minOrderAmount: number
  avgPreparationMinutes: number
  isAcceptingOrders: boolean
}

export interface CartLineDto {
  id: string
  menuItemId: string
  name: string
  imageUrl: string | null
  variantId: string | null
  variantName: string | null
  /** Per-unit price of the item or its chosen variant, before add-ons. */
  unitPrice: number
  /** Per-unit total of the selected add-ons. */
  addOnsTotal: number
  quantity: number
  /** (unitPrice + addOnsTotal) × quantity, as computed by the server. */
  lineTotal: number
  notes: string | null
  addOns: CartAddOnDto[]
  isAvailable: boolean
}

export interface CartAddOnDto {
  id: string
  addOnId: string
  name: string
  price: number
  quantity: number
  isAvailable: boolean
}

export interface CartTotalsDto {
  subtotal: number
  discountAmount: number
  deliveryFee: number
  serviceFee: number
  taxAmount: number
  tipAmount: number
  totalAmount: number
  /** Why delivery is free, when it is — e.g. a coupon or a spend threshold. */
  freeDeliveryReason: string | null
  /** Distinct lines. */
  itemCount: number
  /** Units across all lines. */
  totalQuantity: number
}

export interface CartDeliveryDto {
  addressId: string | null
  addressLine: string | null
  distanceKm: number | null
  etaMinutes: number | null
  isDeliverable: boolean
}

export interface CartIssueDto {
  code: string
  message: string
  cartItemId: string | null
  /** Blocking issues are why `canCheckout` is false. */
  blocking: boolean
}

export interface AddCartItemDto {
  menuItemId: string
  variantId?: string
  quantity?: number
  notes?: string
  addOns?: CartAddOnSelectionDto[]
}

export interface CartAddOnSelectionDto {
  addOnId: string
  quantity?: number
}

export interface UpdateCartItemDto {
  /** Zero removes the line. */
  quantity: number
}

export interface ApplyCouponDto {
  code: string
}

export interface SetCartAddressDto {
  addressId: string
}

export interface SetTipDto {
  tipAmount: number
}
