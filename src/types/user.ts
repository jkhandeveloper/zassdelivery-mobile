import type { AddressLabel } from './enums'
import type { UserStatus } from './auth'

/** The account, mirroring `user-response.dto.ts` — optional strings arrive null. */
export interface UserDto {
  id: string
  phone: string
  fullName: string
  email: string | null
  avatarUrl: string | null
  locale: string
  role: string
  status: UserStatus
  staffRestaurantId: string | null
  isPhoneVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  deletedAt?: string | null
}

export interface UpdateProfileDto {
  fullName?: string
  email?: string
  /** `null` removes the photo; omitting the field leaves it as it is. */
  avatarUrl?: string | null
  locale?: string
  pushToken?: string
}

export interface AddressDto {
  id: string
  label: AddressLabel | null
  line1: string
  line2: string | null
  landmark: string | null
  cityId: string
  zoneId: string
  latitude: number
  longitude: number
  recipientName: string | null
  recipientPhone: string | null
  deliveryNotes: string | null
  isDefault: boolean
  isDeliverable: boolean
  createdAt: string
}

export interface CreateAddressDto {
  label?: AddressLabel
  line1: string
  line2?: string
  landmark?: string
  latitude: number
  longitude: number
  recipientName?: string
  recipientPhone?: string
  deliveryNotes?: string
  isDefault?: boolean
}

export interface UpdateAddressDto {
  label?: AddressLabel
  line1?: string
  line2?: string
  landmark?: string
  latitude?: number
  longitude?: number
  recipientName?: string
  recipientPhone?: string
  deliveryNotes?: string
  isDefault?: boolean
}

export interface FavoriteDto {
  id: string
  target: 'restaurant' | 'menuItem'
  item: {
    id: string
    name: string
    imageUrl?: string
  }
  createdAt: string
}

export interface CreateFavoriteDto {
  restaurantId?: string
  menuItemId?: string
}

export interface ListAddressesQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ListFavoritesQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  target?: 'restaurant' | 'menuItem'
}

export interface ListUsersQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  role?: string
  status?: UserStatus
  includeDeleted?: boolean
  createdFrom?: string
  createdTo?: string
}

export interface CreateUserDto {
  phone: string
  fullName: string
  role: string
  staffRestaurantId?: string
  email?: string
  password?: string
  status?: UserStatus
}

export interface AdminUpdateUserDto {
  fullName?: string
  email?: string
  avatarUrl?: string
  locale?: string
  role?: string
  status?: UserStatus
}

export interface ChangeUserStatusDto {
  status: UserStatus
  reason?: string
}

export interface NotificationPreferenceDto {
  id: string
  userId: string
  type: string
  inApp: boolean
  push: boolean
  sms: boolean
  email: boolean
  quietHoursEnabled: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
  createdAt: string
  updatedAt: string
}

export interface UpdateNotificationPreferencesDto {
  preferences: NotificationPreferenceEntryDto[]
}

export interface NotificationPreferenceEntryDto {
  type: string
  inApp: boolean
  push: boolean
  sms: boolean
  email: boolean
}

export interface EffectivePreferencesDto {
  categories: ChannelPreferenceDto[]
  activeDevices: number
  pushConfigured: boolean
  quietHours?: { start: string; end: string }
  inQuietHoursNow: boolean
  editAt: string
}

export interface ChannelPreferenceDto {
  type: string
  inApp: boolean
  push: boolean
  sms: boolean
  email: boolean
}
