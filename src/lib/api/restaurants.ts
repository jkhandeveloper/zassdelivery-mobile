import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost, apiPut } from '../api-client'
import type { RestaurantDto, RestaurantAdminDto, CategoryDto, RegisterRestaurantDto, UpdateRestaurantDto, SetBusinessHoursDto, AddRestaurantImageDto, ReorderImagesDto, RegisterRestaurantStaffDto, RestaurantStaffDto, SetAcceptingOrdersDto, RejectRestaurantDto, ChangeRestaurantStatusDto, BusinessHourResponseDto, RestaurantImageDto, CreateRestaurantCategoryDto, UpdateRestaurantCategoryDto } from '@/types/restaurant'
import type { OpenState } from '@/types/restaurant'
import type { BusinessType } from '@/types/enums'
import type { PaymentQrCodeDto, SetPaymentQrCodesDto } from '@/types/payment'

export const restaurantApi = {
  // Public storefront
  listRestaurants: (query?: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
    cityId?: string
    zoneId?: string
    category?: string
    businessType?: BusinessType
    priceRange?: string
    minRating?: number
    acceptingOnly?: boolean
    latitude?: number
    longitude?: number
  }) => apiGetPaginated<RestaurantDto>('/restaurants', { params: query }),

  getRestaurantCategories: (query?: { sortBy?: string; sortOrder?: 'asc' | 'desc'; activeOnly?: boolean }) =>
    apiGetPaginated<CategoryDto>('/restaurants/categories', { params: query }),

  getRestaurantBySlug: (slug: string) => apiGet<RestaurantDto>(`/restaurants/${slug}`),

  getRestaurantHours: (id: string) =>
    apiGet<{ hours: BusinessHourResponseDto[]; current: OpenState }>(`/restaurants/${id}/hours`),

  getRestaurantImages: (id: string) => apiGet<RestaurantImageDto[]>(`/restaurants/${id}/images`),

  // Restaurant owner/staff management
  registerRestaurant: (data: RegisterRestaurantDto) =>
    apiPost<RestaurantAdminDto>('/restaurant-management', data),

  getOwnRestaurants: (query?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) =>
    apiGetPaginated<RestaurantAdminDto>('/restaurant-management/mine', { params: query }),

  listRestaurantsAdmin: (query?: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
    status?: string
    businessType?: BusinessType
    ownerId?: string
    includeDeleted?: boolean
  }) => apiGetPaginated<RestaurantAdminDto>('/restaurant-management', { params: query }),

  getRestaurantAdmin: (id: string) => apiGet<RestaurantAdminDto>(`/restaurant-management/${id}`),

  updateRestaurant: (id: string, data: UpdateRestaurantDto) =>
    apiPatch<RestaurantAdminDto>(`/restaurant-management/${id}`, data),

  deleteRestaurant: (id: string) => apiDelete(`/restaurant-management/${id}`),

  approveRestaurant: (id: string) => apiPost<RestaurantAdminDto>(`/restaurant-management/${id}/approve`, {}),

  rejectRestaurant: (id: string, data: RejectRestaurantDto) =>
    apiPost<RestaurantAdminDto>(`/restaurant-management/${id}/reject`, data),

  resubmitRestaurant: (id: string) =>
    apiPost<RestaurantAdminDto>(`/restaurant-management/${id}/resubmit`, {}),

  changeRestaurantStatus: (id: string, data: ChangeRestaurantStatusDto) =>
    apiPatch<RestaurantAdminDto>(`/restaurant-management/${id}/status`, data),

  setAcceptingOrders: (id: string, data: SetAcceptingOrdersDto) =>
    apiPatch<RestaurantAdminDto>(`/restaurant-management/${id}/accepting-orders`, data),

  setBusinessHours: (id: string, data: SetBusinessHoursDto) =>
    apiPut<BusinessHourResponseDto[]>(`/restaurant-management/${id}/hours`, data),

  addRestaurantImage: (id: string, data: AddRestaurantImageDto) =>
    apiPost<RestaurantImageDto>(`/restaurant-management/${id}/images`, data),

  reorderRestaurantImages: (id: string, data: ReorderImagesDto) =>
    apiPut<RestaurantImageDto[]>(`/restaurant-management/${id}/images/order`, data),

  deleteRestaurantImage: (id: string, imageId: string) =>
    apiDelete(`/restaurant-management/${id}/images/${imageId}`),

  /** Owner only. Replaces the whole list; `[]` turns scan-to-pay off. */
  setPaymentQrCodes: (id: string, data: SetPaymentQrCodesDto) =>
    apiPut<PaymentQrCodeDto[]>(`/restaurant-management/${id}/payment-qr-codes`, data),

  registerRestaurantStaff: (id: string, data: RegisterRestaurantStaffDto) =>
    apiPost<RestaurantStaffDto>(`/restaurant-management/${id}/staff`, data),

  getRestaurantStaff: (id: string) =>
    apiGet<RestaurantStaffDto[]>(`/restaurant-management/${id}/staff`),

  // Cuisine categories — the admin side of the public /restaurants/categories
  // list. Deleting one is refused while restaurants still reference it.
  createCategory: (data: CreateRestaurantCategoryDto) =>
    apiPost<CategoryDto>('/restaurant-categories', data),

  updateCategory: (id: string, data: UpdateRestaurantCategoryDto) =>
    apiPatch<CategoryDto>(`/restaurant-categories/${id}`, data),

  deleteCategory: (id: string) => apiDelete(`/restaurant-categories/${id}`),
}
