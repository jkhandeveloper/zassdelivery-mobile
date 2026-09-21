import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { restaurantApi } from '@/lib/api/restaurants'
import type { RegisterRestaurantDto, UpdateRestaurantDto, SetBusinessHoursDto, AddRestaurantImageDto, RegisterRestaurantStaffDto } from '@/types/restaurant'

export const restaurantKeys = {
  all: ['restaurants'] as const,
  storefront: () => [...restaurantKeys.all, 'storefront'] as const,
  list: (filters: Record<string, unknown>) => [...restaurantKeys.storefront(), filters] as const,
  detail: (slug: string) => [...restaurantKeys.storefront(), 'detail', slug] as const,
  hours: (id: string) => [...restaurantKeys.all, 'hours', id] as const,
  images: (id: string) => [...restaurantKeys.all, 'images', id] as const,
  admin: () => [...restaurantKeys.all, 'admin'] as const,
  adminList: (filters: Record<string, unknown>) => [...restaurantKeys.admin(), 'list', filters] as const,
  adminDetail: (id: string) => [...restaurantKeys.admin(), 'detail', id] as const,
  adminOwn: (filters: Record<string, unknown>) => [...restaurantKeys.admin(), 'own', filters] as const,
}

export function useRestaurants(query?: Parameters<typeof restaurantApi.listRestaurants>[0]) {
  return useQuery({
    queryKey: restaurantKeys.list(query || {}),
    queryFn: () => restaurantApi.listRestaurants(query),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRestaurant(slug: string) {
  return useQuery({
    queryKey: restaurantKeys.detail(slug),
    queryFn: () => restaurantApi.getRestaurantBySlug(slug),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRestaurantHours(id: string) {
  return useQuery({
    queryKey: restaurantKeys.hours(id),
    queryFn: () => restaurantApi.getRestaurantHours(id),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRestaurantImages(id: string) {
  return useQuery({
    queryKey: restaurantKeys.images(id),
    queryFn: () => restaurantApi.getRestaurantImages(id),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRestaurantCategories(
  query?: Parameters<typeof restaurantApi.getRestaurantCategories>[0],
) {
  return useQuery({
    queryKey: [...restaurantKeys.all, 'categories', query || {}],
    queryFn: () => restaurantApi.getRestaurantCategories(query),
    staleTime: 30 * 60 * 1000,
  })
}

export function useRegisterRestaurant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: RegisterRestaurantDto) => restaurantApi.registerRestaurant(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: restaurantKeys.adminOwn({}) })
      queryClient.setQueryData(restaurantKeys.adminDetail(data.id), data)
    },
  })
}

export function useOwnRestaurants(query?: Parameters<typeof restaurantApi.getOwnRestaurants>[0]) {
  return useQuery({
    queryKey: restaurantKeys.adminOwn(query || {}),
    queryFn: () => restaurantApi.getOwnRestaurants(query),
    staleTime: 2 * 60 * 1000,
  })
}

export function useRestaurantAdmin(id: string) {
  return useQuery({
    queryKey: restaurantKeys.adminDetail(id),
    queryFn: () => restaurantApi.getRestaurantAdmin(id),
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpdateRestaurant(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateRestaurantDto) => restaurantApi.updateRestaurant(id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(restaurantKeys.adminDetail(id), data)
      queryClient.invalidateQueries({ queryKey: restaurantKeys.adminOwn({}) })
    },
  })
}

export function useSetBusinessHours(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetBusinessHoursDto) => restaurantApi.setBusinessHours(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restaurantKeys.hours(id) })
      queryClient.invalidateQueries({ queryKey: restaurantKeys.adminDetail(id) })
    },
  })
}

export function useAddRestaurantImage(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddRestaurantImageDto) => restaurantApi.addRestaurantImage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restaurantKeys.images(id) })
      queryClient.invalidateQueries({ queryKey: restaurantKeys.adminDetail(id) })
    },
  })
}

export function useRegisterRestaurantStaff(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: RegisterRestaurantStaffDto) => restaurantApi.registerRestaurantStaff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...restaurantKeys.all, 'staff', id] })
    },
  })
}
