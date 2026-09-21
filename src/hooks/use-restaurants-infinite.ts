import { useInfiniteQuery } from "@tanstack/react-query";

import { restaurantApi } from "@/lib/api/restaurants";
import { restaurantKeys } from "@/hooks/use-restaurants";

/**
 * Mobile-only. Deliberately a *new* file rather than an edit to the copied
 * `use-restaurants.ts`, so that one stays byte-identical to the web app's and
 * the drift check can diff it.
 *
 * The web app paginates the restaurant list with numbered pages, which is the
 * right control for a mouse and the wrong one for a thumb. Same endpoint, same
 * filters, same query keys — only the paging strategy differs.
 */

type RestaurantQuery = Parameters<typeof restaurantApi.listRestaurants>[0];

export function useInfiniteRestaurants(query?: RestaurantQuery) {
  return useInfiniteQuery({
    queryKey: [...restaurantKeys.list(query ?? {}), "infinite"],
    queryFn: ({ pageParam }) => restaurantApi.listRestaurants({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      // `meta` is the server's own pagination block, so this never guesses at
      // whether more exist by comparing lengths against the limit.
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
  });
}
