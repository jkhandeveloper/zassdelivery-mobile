/**
 * Riders, mirroring the backend's `rider-response.dto.ts` and `rider.dto.ts`.
 *
 * Transcribed from the source, not from the endpoint list: an assignment nests
 * the whole order under `order`, carries its own `estimatedEarning` and
 * `expiresAt`, and is `isLive` rather than being inferred from a status. The
 * CNIC and account numbers arrive masked — the API never returns them in full
 * once stored, so there is nothing to reveal in the UI.
 */

import type {
  AssignmentStatus,
  DriverAvailability,
  DriverDocumentStatus,
  DriverDocumentType,
  DriverEarningType,
  DriverStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RiderSettlementDirection,
  VehicleType,
} from './enums'
import type { PaymentQrCodeDto } from './payment'

export interface RiderVehicleDto {
  id: string
  type: VehicleType
  make: string | null
  model: string | null
  year: number | null
  color: string | null
  plateNumber: string | null
  isPrimary: boolean
  isActive: boolean
}

export interface RiderDocumentDto {
  id: string
  type: DriverDocumentType
  status: DriverDocumentStatus
  fileUrl: string
  number: string | null
  expiresAt: string | null
  /** True once the expiry date has passed — an expired licence is not a licence. */
  isExpired: boolean
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string
}

export interface RiderPayoutDetailsDto {
  bankName: string | null
  accountTitle: string | null
  /** Masked to the last four digits. */
  accountNumber: string | null
}

export interface RiderDto {
  id: string
  userId: string
  fullName: string
  phone: string
  email: string | null
  avatarUrl: string | null
  /** Masked; the full CNIC is never returned once stored. */
  cnic: string
  licenseNumber: string | null
  status: DriverStatus
  /** Status text already phrased by the API. */
  statusText: string
  availability: DriverAvailability
  rejectionReason: string | null
  zoneId: string | null
  zoneName: string | null
  currentLat: number | null
  currentLng: number | null
  lastLocationAt: string | null
  onlineSince: string | null
  rating: number
  ratingCount: number
  totalDeliveries: number
  vehicles: RiderVehicleDto[]
  documents: RiderDocumentDto[]
  /** Verified documents still outstanding before approval is possible. */
  missingDocuments: DriverDocumentType[]
  /** Whether the rider may go online right now. */
  canGoOnline: boolean
  payout?: RiderPayoutDetailsDto
  /** Codes a customer can scan to pay this rider at the door. Own profile only. */
  paymentQrCodes?: PaymentQrCodeDto[]
  verifiedAt: string | null
  createdAt: string
}

export interface RiderVehicleInputDto {
  type: VehicleType
  make?: string
  model?: string
  year?: number
  color?: string
  plateNumber?: string
}

export interface PayoutDetailsInputDto {
  bankName?: string
  accountTitle?: string
  accountNumber?: string
}

export interface RegisterRiderDto {
  /** 13 digits. Dashes are accepted and stripped by the API. */
  cnic: string
  licenseNumber?: string
  zoneId?: string
  vehicle: RiderVehicleInputDto
  payout?: PayoutDetailsInputDto
}

export interface UpdateRiderDto {
  licenseNumber?: string
  zoneId?: string
  payout?: PayoutDetailsInputDto
}

export interface UploadDocumentDto {
  type: DriverDocumentType
  /** Absolute URL of the uploaded file. Re-uploading replaces the previous one. */
  fileUrl: string
  number?: string
  expiresAt?: string
}

/** ON_DELIVERY is not settable — it is what accepting a delivery does. */
export type SelfServiceAvailability = Extract<
  DriverAvailability,
  'ONLINE' | 'OFFLINE' | 'ON_BREAK'
>

export interface SetAvailabilityDto {
  availability: SelfServiceAvailability
  latitude?: number
  longitude?: number
}

export interface UpdateLocationDto {
  latitude: number
  longitude: number
}

/** The order behind an assignment. Customer contact is withheld until accepted. */
export interface AssignmentOrderDto {
  id: string
  orderNumber: string
  status: OrderStatus
  totalAmount: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  /** Cash to collect at the door. Zero for prepaid orders. */
  cashToCollect: number
  /** Delivery fee plus tip: what the rider keeps for this run. */
  riderFee: number
  /**
   * What the rider owes the restaurant from the cash they collect
   * (cashToCollect − riderFee). Zero for prepaid orders, where the restaurant
   * owes the rider their fee instead.
   */
  cashForRestaurant: number
  restaurantName: string
  restaurantAddress: string
  restaurantPhone: string | null
  restaurantLat: number | null
  restaurantLng: number | null
  deliveryAddress: string
  deliveryLandmark: string | null
  deliveryNotes: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  /** Null until the rider has accepted the run. */
  customerName: string | null
  customerPhone: string | null
  distanceKm: number | null
  estimatedDeliveryAt: string | null
}

export interface AssignmentDto {
  id: string
  status: AssignmentStatus
  /** Still open and answerable — offered, and not yet expired. */
  isLive: boolean
  order: AssignmentOrderDto
  pickupDistanceKm: number | null
  /** The order's delivery fee, quoted before the tip, which may still change. */
  estimatedEarning: number
  /** False when a dispatcher assigned it by hand. */
  isAuto: boolean
  offeredAt: string
  expiresAt: string
  respondedAt: string | null
  completedAt: string | null
  rejectionReason: string | null
  /** A delivery code has been issued and is awaiting confirmation. */
  awaitingDeliveryCode: boolean
}

export interface ListAssignmentsQueryDto {
  page?: number
  limit?: number
  sortBy?: 'offeredAt' | 'respondedAt' | 'completedAt'
  sortOrder?: 'asc' | 'desc'
  status?: AssignmentStatus
  /** Only offers still open and unanswered — the rider's inbox. */
  liveOnly?: boolean
  from?: string
  to?: string
}

export interface RejectOfferDto {
  reason?: string
}

export interface DeliveryCodeIssuedDto {
  message: string
  codeSent: boolean
  codeLength: number
}

export interface ConfirmDeliveryDto {
  /** The four digits the customer reads out at the door. */
  code: string
}

export interface DeliveryCompletedDto {
  message: string
  /** Delivery fee plus tip. */
  earned: number
  breakdown: EarningDto[]
  /** Money the rider took from the customer. */
  collected: number
  /** What the rider now owes the restaurant for this order. */
  owedToRestaurant: number
  /** What the restaurant now owes the rider for this order. */
  owedByRestaurant: number
}

export interface EarningDto {
  id: string
  type: DriverEarningType
  amount: number
  description: string | null
  orderId: string | null
  orderNumber: string | null
  earnedAt: string
}

export interface ListEarningsQueryDto {
  page?: number
  limit?: number
  sortBy?: 'earnedAt' | 'amount'
  sortOrder?: 'asc' | 'desc'
  from?: string
  to?: string
}

export interface EarningsSummaryDto {
  today: number
  thisWeek: number
  thisMonth: number
  lifetime: number
  deliveriesToday: number
  deliveriesThisWeek: number
  deliveriesLifetime: number
  averagePerDelivery: number
}

// ── Rider ↔ restaurant settlement ──────────────────────────────
//
// The platform never holds order money. A rider who collected cash owes the
// restaurant everything but their fee (delivery fee + tip); a restaurant that
// was paid directly owes the rider that fee. Only the party who received money
// can record it.

export interface SettlementTotalsDto {
  deliveries: number
  /** Order money the rider took from customers. */
  cashCollected: number
  /** Delivery fees and tips the rider kept. */
  riderFees: number
  /** Cash the restaurant has confirmed receiving. */
  cashHandedOver: number
  /** Fees the rider has confirmed receiving. */
  feesPaid: number
  /** What the rider owes the restaurant. Negative: the restaurant owes the rider. */
  balance: number
  lastActivityAt: string | null
}

/** The rider's view: one row per restaurant. */
export interface RestaurantBalanceDto extends SettlementTotalsDto {
  restaurantId: string
  restaurantName: string
  restaurantPhone: string | null
  restaurantAddress: string
}

/** The restaurant's view: one row per rider. */
export interface RiderBalanceDto extends SettlementTotalsDto {
  driverId: string
  riderName: string
  riderPhone: string
  /** Where the restaurant can send the rider the fees it owes. */
  paymentQrCodes: PaymentQrCodeDto[]
}

export interface RiderLedgerEntryDto {
  id: string
  orderId: string
  orderNumber: string
  paymentMethod: PaymentMethod
  driverId: string
  riderName: string
  restaurantId: string
  restaurantName: string
  /** Zero when the restaurant was paid directly. */
  collectedAmount: number
  riderFee: number
  /** Positive: the rider owes the restaurant. Negative: the reverse. */
  netAmount: number
  createdAt: string
}

export interface RiderSettlementDto {
  id: string
  direction: RiderSettlementDirection
  amount: number
  note: string | null
  driverId: string
  riderName: string
  restaurantId: string
  restaurantName: string
  /** Who confirmed receiving the money. */
  recordedByName: string | null
  createdAt: string
}

export interface ListSettlementQueryDto {
  page?: number
  limit?: number
  /** Rider view: narrow to one restaurant. */
  restaurantId?: string
  /** Restaurant view: narrow to one rider. */
  driverId?: string
}

export interface RecordFeesReceivedDto {
  restaurantId: string
  amount: number
  note?: string
}

export interface RecordCashReceivedDto {
  driverId: string
  amount: number
  note?: string
}

export interface ListRidersQueryDto {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'rating' | 'totalDeliveries'
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: DriverStatus
  availability?: DriverAvailability
  zoneId?: string
}

export interface RejectRiderDto {
  reason: string
}

export interface SuspendRiderDto {
  reason: string
}

export interface AssignOrderDto {
  driverId?: string
  timeoutSeconds?: number
}

export interface CancelAssignmentDto {
  reason: string
}

export interface RejectDocumentDto {
  reason: string
}
