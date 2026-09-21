import type { CartDto, EmptyCartDto } from "@/types/cart";

/**
 * The cart endpoint answers with one of two shapes: a full cart, or `{ id: null,
 * isEmpty: true, message }` once everything has been removed. The empty stub
 * carries no items, totals or restaurant at all, so every read has to be
 * narrowed through here first.
 */
export function isFilledCart(cart: CartDto | EmptyCartDto | undefined | null): cart is CartDto {
  return cart !== undefined && cart !== null && "items" in cart && cart.items.length > 0;
}
