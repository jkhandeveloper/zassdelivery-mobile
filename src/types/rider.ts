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
  PayoutMethod,
  PayoutStatus,
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
  /** Quoted before the tip, which may still change. */
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
  earned: number
  breakdown: EarningDto[]
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

export interface RiderWalletDto {
  balance: number
  currency: string
  /** Frozen during a fraud investigation. */
  isLocked: boolean
  pendingWithdrawals: number
  availableToWithdraw: number
}

export interface WalletTransactionDto {
  id: string
  type: string
  reason: string
  amount: number
  balanceAfter: number
  description: string | null
  createdAt: string
}

export interface RequestPayoutDto {
  amount: number
  method: PayoutMethod
}

export interface PayoutRequestDto {
  id: string
  reference: string
  driverId: string
  amount: number
  method: PayoutMethod
  status: PayoutStatus
  bankName: string | null
  accountTitle: string
  /** Masked to the last four digits. */
  accountNumber: string
  rejectionReason: string | null
  paymentReference: string | null
  processedAt: string | null
  createdAt: string
}

export interface ListPayoutsQueryDto {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'amount' | 'processedAt'
  sortOrder?: 'asc' | 'desc'
  status?: PayoutStatus
  driverId?: string
  from?: string
  to?: string
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
