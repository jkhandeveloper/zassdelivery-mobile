import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userApi } from "@/lib/api/users";
import type {
  CreateAddressDto,
  ListAddressesQueryDto,
  ListFavoritesQueryDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from "@/types/user";

export const userKeys = {
  all: ["users"] as const,
  profile: () => [...userKeys.all, "profile"] as const,
  addresses: (query: ListAddressesQueryDto) => [...userKeys.all, "addresses", query] as const,
  favorites: (query: ListFavoritesQueryDto) => [...userKeys.all, "favorites", query] as const,
};

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: userKeys.profile(),
    queryFn: () => userApi.getProfile(),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileDto) => userApi.updateProfile(data),
    onSuccess: (user) => {
      queryClient.setQueryData(userKeys.profile(), user);
    },
  });
}

/** Saved delivery addresses — the picker at checkout reads this. */
export function useAddresses(query?: ListAddressesQueryDto, enabled = true) {
  return useQuery({
    queryKey: userKeys.addresses(query ?? {}),
    queryFn: () => userApi.getAddresses(query),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAddressDto) => userApi.createAddress(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...userKeys.all, "addresses"] });
    },
  });
}

export function useUpdateAddress(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateAddressDto) => userApi.updateAddress(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...userKeys.all, "addresses"] });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userApi.setDefaultAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...userKeys.all, "addresses"] });
    },
  });
}

export function useFavorites(query?: ListFavoritesQueryDto, enabled = true) {
  return useQuery({
    queryKey: userKeys.favorites(query ?? {}),
    queryFn: () => userApi.getFavorites(query),
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Saving and unsaving a restaurant are two different endpoints; the caller only
 * ever means "flip it", so the decision lives here rather than in every card.
 */
export function useToggleFavoriteRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ restaurantId, saved }: { restaurantId: string; saved: boolean }) =>
      saved
        ? userApi.removeFavoriteRestaurant(restaurantId)
        : userApi.addFavorite({ restaurantId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...userKeys.all, "favorites"] });
    },
  });
}
