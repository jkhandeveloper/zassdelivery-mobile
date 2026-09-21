import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/lib/api/admin";
import type { ListCouponsQueryDto } from "@/types/admin";

export const couponKeys = {
  all: ["coupons"] as const,
  available: (filters: ListCouponsQueryDto) => [...couponKeys.all, "available", filters] as const,
};

/**
 * Coupons the signed-in customer can use right now.
 *
 * Requires a session — the API scopes the list to the caller, so a signed-out
 * visitor gets a 401 rather than a public list.
 */
export function useAvailableCoupons(query?: ListCouponsQueryDto, enabled = true) {
  return useQuery({
    queryKey: couponKeys.available(query ?? {}),
    queryFn: () => adminApi.listCouponsPublic(query),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
