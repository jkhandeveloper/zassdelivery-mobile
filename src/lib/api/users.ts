import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from '../api-client'
import type {
  UserDto,
  UpdateProfileDto,
  AddressDto,
  CreateAddressDto,
  UpdateAddressDto,
  FavoriteDto,
  CreateFavoriteDto,
  ListAddressesQueryDto,
  ListFavoritesQueryDto,
  ListUsersQueryDto,
  CreateUserDto,
  AdminUpdateUserDto,
  ChangeUserStatusDto,
  NotificationPreferenceDto,
  UpdateNotificationPreferencesDto,
} from '@/types/user'

export const userApi = {
  // Me endpoints
  getProfile: () => apiGet<UserDto>('/me'),

  updateProfile: (data: UpdateProfileDto) =>
    apiPatch<UserDto>('/me', data),

  getNotificationPreferences: () =>
    apiGet<NotificationPreferenceDto[]>('/me/notification-preferences'),

  updateNotificationPreferences: (data: UpdateNotificationPreferencesDto) =>
    apiPatch<NotificationPreferenceDto[]>('/me/notification-preferences', data),

  resetNotificationPreferences: () =>
    apiDelete<NotificationPreferenceDto[]>('/me/notification-preferences'),

  getAddresses: (query?: ListAddressesQueryDto) =>
    apiGetPaginated<AddressDto>('/me/addresses', { params: query }),

  getAddress: (id: string) =>
    apiGet<AddressDto>(`/me/addresses/${id}`),

  createAddress: (data: CreateAddressDto) =>
    apiPost<AddressDto>('/me/addresses', data),

  updateAddress: (id: string, data: UpdateAddressDto) =>
    apiPatch<AddressDto>(`/me/addresses/${id}`, data),

  setDefaultAddress: (id: string) =>
    apiPatch<AddressDto>(`/me/addresses/${id}/default`, {}),

  deleteAddress: (id: string) =>
    apiDelete(`/me/addresses/${id}`),

  getFavorites: (query?: ListFavoritesQueryDto) =>
    apiGetPaginated<FavoriteDto>('/me/favorites', { params: query }),

  addFavorite: (data: CreateFavoriteDto) =>
    apiPost<FavoriteDto>('/me/favorites', data),

  removeFavoriteRestaurant: (restaurantId: string) =>
    apiDelete(`/me/favorites/restaurants/${restaurantId}`),

  removeFavoriteMenuItem: (menuItemId: string) =>
    apiDelete(`/me/favorites/menu-items/${menuItemId}`),

  // Admin user management
  listUsers: (query?: ListUsersQueryDto) =>
    apiGetPaginated<UserDto>('/users', { params: query }),

  getUser: (id: string) =>
    apiGet<UserDto>(`/users/${id}`),

  createUser: (data: CreateUserDto) =>
    apiPost<UserDto>('/users', data),

  updateUser: (id: string, data: AdminUpdateUserDto) =>
    apiPatch<UserDto>(`/users/${id}`, data),

  changeUserStatus: (id: string, data: ChangeUserStatusDto) =>
    apiPatch<UserDto>(`/users/${id}/status`, data),

  deleteUser: (id: string) =>
    apiDelete(`/users/${id}`),

  restoreUser: (id: string) =>
    apiPost<UserDto>(`/users/${id}/restore`, {}),
}
