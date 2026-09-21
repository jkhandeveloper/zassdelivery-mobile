"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { restaurantApi } from "@/lib/api/restaurants";
import { UserRole } from "@/types/auth";
import type { RestaurantAdminDto } from "@/types/restaurant";

import { restaurantKeys } from "./use-restaurants";
import { useProfile } from "./use-users";

export interface VendorRestaurantState {
  restaurant: RestaurantAdminDto | null;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  /** True when the owner is signed in but has not registered a listing yet. */
  needsRegistration: boolean;
  refetch: () => void;
}

/**
 * The restaurant the signed-in vendor works in.
 *
 * Owners and staff reach it differently, and neither takes an id from the URL:
 *
 * - An owner asks `GET /restaurant-management/mine`, which the API scopes to
 *   the caller. That endpoint is `@Roles(VENDOR_OWNER)`, so staff get a 403.
 * - Staff are pinned to one restaurant by `staffRestaurantId` on their account,
 *   which only `GET /me` carries — the access token's user block does not have
 *   it — and then read that one listing by id.
 *
 * Doing this once here is what keeps every vendor screen from re-deriving it,
 * and keeps an id out of the address bar where it could be edited.
 */
export function useVendorRestaurant(): VendorRestaurantState {
  const { user, isReady, isAuthenticated } = useAuth();

  const isStaff = user?.role === UserRole.VENDOR_STAFF;
  const isOwner = user?.role === UserRole.VENDOR_OWNER;
  const signedIn = isReady && isAuthenticated;

  const owned = useQuery({
    queryKey: restaurantKeys.adminOwn({}),
    queryFn: () => restaurantApi.getOwnRestaurants(),
    enabled: signedIn && isOwner,
    staleTime: 60 * 1000,
    retry: false,
  });

  const profile = useProfile(signedIn && isStaff);
  const staffRestaurantId = profile.data?.staffRestaurantId ?? null;

  const assigned = useQuery({
    queryKey: restaurantKeys.adminDetail(staffRestaurantId ?? ""),
    queryFn: () => restaurantApi.getRestaurantAdmin(staffRestaurantId as string),
    enabled: staffRestaurantId !== null,
    staleTime: 60 * 1000,
    retry: false,
  });

  if (isStaff) {
    return {
      restaurant: assigned.data ?? null,
      isPending: profile.isPending || (staffRestaurantId !== null && assigned.isPending),
      isError: profile.isError || assigned.isError,
      error: profile.error ?? assigned.error,
      // A staff account with no restaurant is an administrative mistake, not
      // something the member of staff can fix by filling in a form.
      needsRegistration: false,
      refetch: () => {
        void profile.refetch();
        void assigned.refetch();
      },
    };
  }

  const first = owned.data?.items[0] ?? null;

  return {
    restaurant: first,
    isPending: owned.isPending,
    isError: owned.isError,
    error: owned.error,
    needsRegistration: owned.isSuccess && first === null,
    refetch: () => void owned.refetch(),
  };
}
