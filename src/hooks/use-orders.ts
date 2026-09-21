import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/lib/api/orders'
import type { ListOrdersQueryDto, CancelOrderDto } from '@/types/order'

export const orderKeys = {
  all: ['orders'] as const,
  list: (filters: ListOrdersQueryDto) => [...orderKeys.all, 'list', filters] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  timeline: (id: string) => [...orderKeys.all, 'timeline', id] as const,
  transactions: (id: string) => [...orderKeys.all, 'transactions', id] as const,
  invoice: (id: string) => [...orderKeys.all, 'invoice', id] as const,
}

/**
 * Orders are scoped to the session, so a signed-out caller would only ever get
 * a 401 — screens that render for visitors pass `enabled`.
 */
export function useOrders(query?: ListOrdersQueryDto, enabled = true) {
  return useQuery({
    queryKey: orderKeys.list(query || {}),
    queryFn: () => orderApi.getOrders(query),
    enabled,
    staleTime: 30 * 1000,
  })
}

/** Same session scoping as `useOrders` — a signed-out caller only gets a 401. */
export function useOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orderApi.getOrder(id),
    enabled,
    staleTime: 30 * 1000,
  })
}

export function useOrderTimeline(id: string) {
  return useQuery({
    queryKey: orderKeys.timeline(id),
    queryFn: () => orderApi.getOrderTimeline(id),
    staleTime: 10 * 1000,
  })
}

export function useOrderTransactions(id: string) {
  return useQuery({
    queryKey: orderKeys.transactions(id),
    queryFn: () => orderApi.getOrderTransactions(id),
    staleTime: 60 * 1000,
  })
}

export function useOrderInvoice(id: string) {
  return useQuery({
    queryKey: orderKeys.invoice(id),
    queryFn: () => orderApi.getOrderInvoice(id),
    staleTime: 60 * 1000,
  })
}

export function useCancelOrder(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CancelOrderDto) => orderApi.cancelOrder(id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(orderKeys.detail(id), data)
      queryClient.invalidateQueries({ queryKey: orderKeys.list({}) })
    },
  })
}
