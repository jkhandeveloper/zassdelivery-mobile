import { usePathname, useRouter } from "expo-router";
import * as React from "react";
import { toast } from "@/components/ui/toast";

import { useAuth } from "@/components/providers";
import { useAddCartItem } from "@/hooks/use-cart";
import { ApiError } from "@/lib/api-client";
import type { AddCartItemDto } from "@/types/cart";

/**
 * One-tap "Add" for dishes that need no choices made — the tile buttons on the
 * home rails and the menu grid.
 *
 * Items with variants or required add-on groups must not go through here: they
 * open the item dialog instead, or the customer would be charged for a default
 * they never picked.
 */
export function useQuickAdd() {
  const router = useRouter();
  // The web version read `window.location.pathname` at call time. There is no
  // `window` here, and the hook is what knows where the tap came from.
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const addItem = useAddCartItem();

  const add = React.useCallback(
    async (input: AddCartItemDto & { name: string }) => {
      const { name, ...payload } = input;

      if (!isAuthenticated) {
        router.push({ pathname: "/login", params: { next: pathname } });
        return;
      }

      try {
        await addItem.mutateAsync({ quantity: 1, ...payload });
        toast.success(`${name} added to your cart`);
      } catch (error) {
        // The cart is single-restaurant; switching kitchens is a real decision,
        // so say so plainly rather than surfacing a raw conflict error.
        const message =
          error instanceof ApiError
            ? error.status === 409
              ? "Your cart has items from another restaurant. Empty it first to order from here."
              : error.message
            : "We couldn't add that. Please try again.";

        toast.error(message);
      }
    },
    [addItem, isAuthenticated, router, pathname],
  );

  return {
    add,
    /** The dish currently being added, so only its own button shows a spinner. */
    pendingItemId: addItem.isPending ? (addItem.variables?.menuItemId ?? null) : null,
  };
}
