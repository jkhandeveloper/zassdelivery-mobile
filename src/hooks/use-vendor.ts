"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { menuApi } from "@/lib/api/menus";
import { orderApi } from "@/lib/api/orders";
import { restaurantApi } from "@/lib/api/restaurants";
import type { ListOrdersAdminQueryDto, RefundOrderDto, RejectOrderDto } from "@/types/order";
import type { SetPaymentQrCodesDto } from "@/types/payment";
import type {
  AddRestaurantImageDto,
  RegisterRestaurantStaffDto,
  ReorderImagesDto,
  SetBusinessHoursDto,
  UpdateRestaurantDto,
} from "@/types/restaurant";
import type {
  AdjustStockDto,
  CreateMenuItemDto,
  ListMenuItemsAdminQueryDto,
  UpdateMenuItemDto,
} from "@/types/menu";

import { restaurantKeys } from "./use-restaurants";

export const vendorKeys = {
  all: ["vendor"] as const,
  orders: (restaurantId: string, query: ListOrdersAdminQueryDto) =>
    [...vendorKeys.all, "orders", restaurantId, query] as const,
  staff: (restaurantId: string) => [...vendorKeys.all, "staff", restaurantId] as const,
  items: (restaurantId: string, query: ListMenuItemsAdminQueryDto) =>
    [...vendorKeys.all, "items", restaurantId, query] as const,
  menus: (restaurantId: string) => [...vendorKeys.all, "menus", restaurantId] as const,
};

/**
 * The restaurant this vendor is working in.
 *
 * `GET /restaurant-management/mine` is scoped to the caller by the API, so the
 * first row is the owner's restaurant — there is no id to pass in from a URL,
 * and deliberately so: an id in the URL is an id someone can change.
 */
export function useMyRestaurant(enabled = true) {
  const query = useOwnRestaurantList(enabled);

  return {
    ...query,
    restaurant: query.data?.items[0] ?? null,
    /** More than one listing under the same owner — the vendor picks. */
    restaurants: query.data?.items ?? [],
  };
}

function useOwnRestaurantList(enabled: boolean) {
  return useQuery({
    queryKey: restaurantKeys.adminOwn({}),
    queryFn: () => restaurantApi.getOwnRestaurants(),
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useResubmitRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restaurantApi.resubmitRestaurant(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.admin() });
    },
  });
}

export function useSetAcceptingOrders(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isAcceptingOrders: boolean) =>
      restaurantApi.setAcceptingOrders(restaurantId, { isAcceptingOrders }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.admin() });
    },
  });
}

export function useUpdateMyRestaurant(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRestaurantDto) => restaurantApi.updateRestaurant(restaurantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.admin() });
    },
  });
}

export function useSetHours(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetBusinessHoursDto) => restaurantApi.setBusinessHours(restaurantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.hours(restaurantId) });
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.admin() });
    },
  });
}

/** Owner only — the API refuses staff, who must not be able to redirect the takings. */
export function useSetRestaurantQrCodes(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetPaymentQrCodesDto) =>
      restaurantApi.setPaymentQrCodes(restaurantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.admin() });
    },
  });
}

// ── Gallery ──────────────────────────────────────────────────

export function useAddImage(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddRestaurantImageDto) =>
      restaurantApi.addRestaurantImage(restaurantId, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.images(restaurantId) }),
  });
}

export function useDeleteImage(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => restaurantApi.deleteRestaurantImage(restaurantId, imageId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.images(restaurantId) }),
  });
}

export function useReorderImages(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReorderImagesDto) =>
      restaurantApi.reorderRestaurantImages(restaurantId, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: restaurantKeys.images(restaurantId) }),
  });
}

// ── Staff ────────────────────────────────────────────────────

export function useRestaurantStaff(restaurantId: string | null) {
  return useQuery({
    queryKey: vendorKeys.staff(restaurantId ?? ""),
    queryFn: () => restaurantApi.getRestaurantStaff(restaurantId as string),
    enabled: restaurantId !== null,
    staleTime: 60 * 1000,
  });
}

export function useAddStaff(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterRestaurantStaffDto) =>
      restaurantApi.registerRestaurantStaff(restaurantId, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: vendorKeys.staff(restaurantId) }),
  });
}

// ── Order queue ──────────────────────────────────────────────

/**
 * The kitchen's tickets.
 *
 * Polled on a short interval as a floor under the `restaurant:order` socket
 * event — a kitchen that misses an order because a websocket dropped is a
 * worse failure than a request every fifteen seconds.
 */
export function useRestaurantOrders(
  restaurantId: string | null,
  query?: ListOrdersAdminQueryDto,
) {
  const enabled = restaurantId !== null;

  return useQuery({
    queryKey: vendorKeys.orders(restaurantId ?? "", query ?? {}),
    queryFn: () => orderApi.listOrdersForRestaurant(restaurantId as string, query),
    enabled,
    staleTime: 5 * 1000,
    refetchInterval: enabled ? 15 * 1000 : false,
  });
}

/** Every kitchen transition invalidates the same queue, so they share a helper. */
function useOrderTransition<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, "orders"] });
    },
  });
}

export function useAcceptOrder() {
  return useOrderTransition((id: string) => orderApi.acceptOrder(id));
}

export function useRejectOrder() {
  return useOrderTransition(({ id, data }: { id: string; data: RejectOrderDto }) =>
    orderApi.rejectOrder(id, data),
  );
}

export function useMarkPreparing() {
  return useOrderTransition((id: string) => orderApi.markPreparing(id));
}

export function useMarkReady() {
  return useOrderTransition((id: string) => orderApi.markReady(id));
}

/**
 * Closes an order out from the kitchen's side.
 *
 * For a vendor who delivers themselves there is no rider to confirm a code, so
 * the API lets the restaurant mark it delivered — the button is still gated on
 * `allowedTransitions`, which is what decides whether it is offered at all.
 */
export function useMarkDelivered() {
  return useOrderTransition((id: string) => orderApi.markDelivered(id));
}

/**
 * Records money the restaurant has already handed back to a customer.
 *
 * The customer paid the kitchen directly, so the kitchen returns it — by cash
 * or a transfer back — and this only puts it on the order and the ledger.
 */
export function useRecordRefund() {
  return useOrderTransition(({ id, data }: { id: string; data: RefundOrderDto }) =>
    orderApi.refundOrder(id, data),
  );
}

// ── Menu ─────────────────────────────────────────────────────

export function useVendorMenus(restaurantId: string | null) {
  return useQuery({
    queryKey: vendorKeys.menus(restaurantId ?? ""),
    queryFn: () => menuApi.getRestaurantMenusAdmin(restaurantId as string),
    enabled: restaurantId !== null,
    staleTime: 60 * 1000,
  });
}

export function useVendorMenuItems(
  restaurantId: string | null,
  query?: ListMenuItemsAdminQueryDto,
) {
  return useQuery({
    queryKey: vendorKeys.items(restaurantId ?? "", query ?? {}),
    queryFn: () => menuApi.getRestaurantItemsAdmin(restaurantId as string, query),
    enabled: restaurantId !== null,
    staleTime: 30 * 1000,
  });
}

export interface CreateDishInput {
  /** An existing section, or `null` to create `newSectionName` first. */
  menuCategoryId: string | null;
  /** Only read when `menuCategoryId` is null. */
  newSectionName?: string;
  dish: Omit<CreateMenuItemDto, "menuCategoryId">;
}

/**
 * Adds a dish, creating the menu and section it needs if they do not exist.
 *
 * The API hangs items off a category and categories off a menu, so a
 * restaurant that has never had a menu cannot be given a dish in one call. A
 * vendor should not have to know that: they type a section name, and the two
 * parents are created underneath them.
 */
export function useCreateMenuItem(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuCategoryId, newSectionName, dish }: CreateDishInput) => {
      let categoryId = menuCategoryId;

      if (categoryId === null) {
        const name = newSectionName?.trim() ?? "";

        if (name === "") {
          throw new Error("A dish needs a section to sit in.");
        }

        const menus = await menuApi.getRestaurantMenusAdmin(restaurantId);
        const menu =
          menus.items[0] ?? (await menuApi.createMenu(restaurantId, { name: "Main Menu" }));

        categoryId = (await menuApi.createMenuCategory(menu.id, { name })).id;
      }

      return menuApi.createMenuItem({ ...dish, menuCategoryId: categoryId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, "items"] });
      // A new section changes the menu tree the picker reads from.
      void queryClient.invalidateQueries({ queryKey: vendorKeys.menus(restaurantId) });
    },
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateMenuItemDto }) =>
      menuApi.updateMenuItem(itemId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, "items"] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: AdjustStockDto }) =>
      menuApi.adjustStock(itemId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, "items"] });
    },
  });
}
