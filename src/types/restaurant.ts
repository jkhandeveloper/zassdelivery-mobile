import type { UserStatus } from './auth'
import { RestaurantStatus, PriceRange, BusinessType } from './enums'
import type { PaymentQrCodeDto } from './payment'

/**
 * A restaurant, mirroring `restaurant-response.dto.ts` on the backend.
 *
 * The optional strings are `null` on the wire, not absent — checking them with
 * `!== undefined` passes a null straight through to an <img> or a paragraph.
 */
export interface RestaurantDto {
  id: string
  name: string
  nameUr: string | null
  slug: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  phone: string
  addressLine: string
  landmark: string | null
  latitude: number
  longitude: number
  city: { id: string; name: string; slug: string }
  zone: { id: string; name: string; slug: string }
  categories: Array<{ id: string; name: string; slug?: string }>
  status: RestaurantStatus
  /** What sort of place this is. `categories` is what it cooks. */
  businessType: BusinessType
  priceRange: PriceRange
  /** The owner's manual on/off switch. */
  isAcceptingOrders: boolean
  isFeatured: boolean
  isOpenNow: boolean
  /** Approved, accepting orders *and* open — the flag to gate ordering on. */
  canOrderNow: boolean
  opensInMinutes: number | null
  rating: number
  ratingCount: number
  minOrderAmount: number
  avgPreparationMinutes: number
  deliveryRadiusMeters: number
  /** Metres from the coordinates supplied in the query, when they were. */
  distanceMeters?: number | null
  images?: RestaurantImageDto[]
  hours?: BusinessHourResponseDto[]
  createdAt: string
}

export interface RestaurantAdminDto extends RestaurantDto {
  ownerId: string
  /** Platform commission percentage. */
  commissionRate: number
  submittedAt: string | null
  approvedAt: string | null
  approvedById: string | null
  rejectionReason: string | null
  deletedAt: string | null
  /** Where scan-to-pay customers send money. Empty turns the option off at checkout. */
  paymentQrCodes: PaymentQrCodeDto[]
}

export interface CategoryDto {
  id: string
  name: string
  nameUr: string | null
  slug: string
  iconUrl: string | null
  sortOrder: number
  isActive: boolean
}

export interface CreateRestaurantCategoryDto {
  name: string
  nameUr?: string
  slug?: string
  iconUrl?: string
  sortOrder?: number
  isActive?: boolean
}

export type UpdateRestaurantCategoryDto = Partial<CreateRestaurantCategoryDto>

export interface RestaurantImageDto {
  id: string
  url: string
  caption: string | null
  sortOrder: number
}

export interface BusinessHourResponseDto {
  dayOfWeek: string
  /** "11:00", in the restaurant's local time. */
  opensAt: string
  closesAt: string
  isClosed: boolean
}

export interface OpenState {
  isOpenNow: boolean
  opensInMinutes: number | null
  closesInMinutes: number | null
}

export interface RegisterRestaurantDto {
  name: string
  nameUr?: string
  description?: string
  phone: string
  email?: string
  addressLine: string
  landmark?: string
  latitude: number
  longitude: number
  categoryIds: string[]
  businessType?: BusinessType
  priceRange?: PriceRange
  minOrderAmount?: number
  avgPreparationMinutes?: number
  deliveryRadiusMeters?: number
}

export interface UpdateRestaurantDto {
  name?: string
  nameUr?: string
  description?: string
  phone?: string
  email?: string
  addressLine?: string
  landmark?: string
  latitude?: number
  longitude?: number
  categoryIds?: string[]
  businessType?: BusinessType
  priceRange?: PriceRange
  minOrderAmount?: number
  avgPreparationMinutes?: number
  deliveryRadiusMeters?: number
}

export interface SetBusinessHoursDto {
  hours: BusinessHourDto[]
}

export interface BusinessHourDto {
  dayOfWeek: string
  opensAt: string
  closesAt: string
  isClosed?: boolean
}

export interface AddRestaurantImageDto {
  url: string
  caption?: string
}

export interface ReorderImagesDto {
  imageIds: string[]
}

export interface RegisterRestaurantStaffDto {
  phone: string
  fullName: string
  password: string
  email?: string
}

export interface RestaurantStaffDto {
  id: string
  phone: string
  fullName: string
  email: string | null
  status: UserStatus
  createdAt: string
}

export interface SetAcceptingOrdersDto {
  isAcceptingOrders: boolean
}

export interface RejectRestaurantDto {
  reason: string
}

export interface ChangeRestaurantStatusDto {
  status: RestaurantStatus
  reason?: string
}
