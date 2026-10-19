import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { useAddresses } from '@/hooks/use-users'
import { cartApi } from '@/lib/api/cart'
import { orderApi } from '@/lib/api/orders'
import type {
  AddCartItemDto,
  CartDto,
  UpdateCartItemDto,
  ApplyCouponDto,
  SetCartAddressDto,
  SetCartRiderDto,
  SetFulfilmentDto,
  SetTipDto,
} from '@/types/cart'
import { OrderType } from '@/types/enums'

export const cartKeys = {
  all: ['cart'] as const,
  current: () => [...cartKeys.all, 'current'] as const,
  riders: (addressId: string | null) => [...cartKeys.all, 'riders', addressId] as const,
}

/**
 * The cart belongs to a session — asking for it while signed out is a
 * guaranteed 401, so callers that render for visitors pass `enabled`.
 */
export function useCart(enabled = true) {
  return useQuery({
    queryKey: cartKeys.current(),
    queryFn: () => cartApi.getCart(),
    enabled,
    staleTime: 0,
  })
}

export function useAddCartItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddCartItemDto) => cartApi.addItem(data),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
    },
  })
}

export function useUpdateCartItem(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateCartItemDto) => cartApi.updateItem(itemId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
    },
  })
}

export function useRemoveCartItem(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => cartApi.removeItem(itemId),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
    },
  })
}

export function useClearCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => cartApi.clearCart(),
    onSuccess: () => {
      queryClient.setQueryData(cartKeys.current(), null)
    },
  })
}

export function useApplyCoupon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ApplyCouponDto) => cartApi.applyCoupon(data),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
    },
  })
}

export function useRemoveCoupon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
    },
  })
}

export function useSetDeliveryAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetCartAddressDto) => cartApi.setDeliveryAddress(data),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
    },
  })
}

/**
 * Attaches the customer's default saved address to the cart when it carries
 * none.
 *
 * The cart owns its own delivery address, and only `PATCH /cart/address` sets
 * it — the header's "Deliver to" merely reads the address book, so a customer
 * who has an address saved still lands on a cart the API refuses to price
 * ("Choose a delivery address to see the final total."). Sending the default on
 * their behalf clears that, and every screen that shows totals does it so the
 * basket is priced the same way wherever it is read.
 *
 * Once per cart, and the ref is what keeps "once" true: the mutation object is
 * new on every render, so a guard on its pending flag alone would fire again
 * before the first call lands. A failed attempt is not retried — the customer
 * picks an address by hand at checkout instead of watching a request loop.
 *
 * @returns `isResolving` — an address is on its way, so the cart's missing
 *   address issue is about to answer itself and should not be shown yet.
 */
export function useEnsureCartAddress(cart: CartDto | null, enabled = true) {
  const addresses = useAddresses({ limit: 20 }, enabled)
  const setAddress = useSetDeliveryAddress()
  const attemptedFor = React.useRef<string | null>(null)

  const items = React.useMemo(() => addresses.data?.items ?? [], [addresses.data])
  // A customer collecting the order themselves has nowhere to send it.
  const needsAddress =
    enabled &&
    cart !== null &&
    cart.fulfilment !== OrderType.PICKUP &&
    cart.delivery.addressId === null
  const cartId = cart?.id ?? null

  React.useEffect(() => {
    if (!needsAddress || cartId === null || attemptedFor.current === cartId) return
    if (items.length === 0) return

    attemptedFor.current = cartId
    const preferred = items.find((address) => address.isDefault) ?? items[0]
    setAddress.mutate({ addressId: preferred.id })
  }, [cartId, items, needsAddress, setAddress])

  // An idle mutation with addresses to choose from is the gap between this
  // render and the effect below it; a failed one is a real dead end, so the
  // issue is left to show.
  const isResolving =
    needsAddress &&
    (addresses.isPending || setAddress.isPending || (items.length > 0 && setAddress.isIdle))

  return { isResolving }
}

export function useSetTip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetTipDto) => cartApi.setTip(data),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
    },
  })
}

/** Delivery or self-pickup. Switching to pickup also drops a chosen rider. */
export function useSetFulfilment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetFulfilmentDto) => cartApi.setFulfilment(data),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
      void queryClient.invalidateQueries({ queryKey: [...cartKeys.all, 'riders'] })
    },
  })
}

/**
 * Riders free to deliver this cart, each with their own rate and the fee to
 * the cart's address. Keyed on the address because every fee depends on it,
 * and refreshed every half minute because riders come and go.
 */
export function useCartRiders(addressId: string | null, enabled = true) {
  return useQuery({
    queryKey: cartKeys.riders(addressId),
    queryFn: () => cartApi.getRiders(),
    enabled,
    refetchInterval: 30 * 1000,
  })
}

/** Chooses the rider, or hands the choice back to dispatch with null. */
export function useSetCartRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetCartRiderDto) => cartApi.setRider(data),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.current(), data)
      void queryClient.invalidateQueries({ queryKey: [...cartKeys.all, 'riders'] })
    },
  })
}

export function usePlaceOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof orderApi.placeOrder>[0]) => orderApi.placeOrder(data),
    onSuccess: () => {
      queryClient.setQueryData(cartKeys.current(), null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
