import { useQuery } from "@tanstack/react-query";

import { menuApi } from "@/lib/api/menus";
import type { ListMenuItemsQueryDto } from "@/types/menu";

export const menuKeys = {
  all: ["menus"] as const,
  ofRestaurant: (restaurantId: string) => [...menuKeys.all, "restaurant", restaurantId] as const,
  items: (restaurantId: string, filters: ListMenuItemsQueryDto) =>
    [...menuKeys.all, "items", restaurantId, filters] as const,
  item: (id: string) => [...menuKeys.all, "item", id] as const,
};

/** Menus with their categories nested — one call renders the whole menu nav. */
export function useRestaurantMenus(restaurantId: string | undefined) {
  return useQuery({
    queryKey: menuKeys.ofRestaurant(restaurantId ?? ""),
    queryFn: () => menuApi.getRestaurantMenus(restaurantId as string),
    enabled: restaurantId !== undefined && restaurantId !== "",
    staleTime: 5 * 60 * 1000,
  });
}

export function useMenuItems(restaurantId: string | undefined, query?: ListMenuItemsQueryDto) {
  return useQuery({
    queryKey: menuKeys.items(restaurantId ?? "", query ?? {}),
    queryFn: () => menuApi.getMenuItems(restaurantId as string, query),
    enabled: restaurantId !== undefined && restaurantId !== "",
    staleTime: 5 * 60 * 1000,
  });
}

export function useMenuItem(id: string | undefined) {
  return useQuery({
    queryKey: menuKeys.item(id ?? ""),
    queryFn: () => menuApi.getMenuItem(id as string),
    enabled: id !== undefined && id !== "",
    staleTime: 5 * 60 * 1000,
  });
}
