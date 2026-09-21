import { apiGet, apiGetPaginated, apiPatch, apiPost } from '../api-client'
import type {
  OrderDto,
  PlaceOrderDto,
  ListOrdersQueryDto,
  ListOrdersAdminQueryDto,
  CancelOrderDto,
  RejectOrderDto,
  AdvanceOrderDto,
  RefundOrderDto,
  RefundOutcome,
  OrderTimelineEntryDto,
  OrderTransactionDto,
} from '@/types/order'
import type { InvoiceDto } from '@/types/payment'

export const orderApi = {
  // Customer
  placeOrder: (data: PlaceOrderDto) => apiPost<OrderDto>('/orders', data),

  getOrders: (query?: ListOrdersQueryDto) =>
    apiGetPaginated<OrderDto>('/orders', { params: query }),

  getOrder: (id: string) => apiGet<OrderDto>(`/orders/${id}`),

  cancelOrder: (id: string, data: CancelOrderDto) =>
    apiPost<OrderDto>(`/orders/${id}/cancel`, data),

  getOrderTimeline: (id: string) =>
    apiGet<OrderTimelineEntryDto[]>(`/orders/${id}/timeline`),

  getOrderTransactions: (id: string) =>
    apiGet<OrderTransactionDto[]>(`/orders/${id}/transactions`),

  getOrderInvoice: (id: string) =>
    apiGet<InvoiceDto>(`/orders/${id}/invoice`),

  // Admin/Restaurant/Rider management
  listOrdersForRestaurant: (restaurantId: string, query?: ListOrdersAdminQueryDto) =>
    apiGetPaginated<OrderDto>(`/order-management/restaurants/${restaurantId}`, { params: query }),

  listOrdersForDriver: (driverId: string, query?: ListOrdersAdminQueryDto) =>
    apiGetPaginated<OrderDto>(`/order-management/drivers/${driverId}`, { params: query }),

  listOrdersAdmin: (query?: ListOrdersAdminQueryDto) =>
    apiGetPaginated<OrderDto>('/order-management', { params: query }),

  acceptOrder: (id: string) =>
    apiPost<OrderDto>(`/order-management/${id}/accept`, {}),

  rejectOrder: (id: string, data: RejectOrderDto) =>
    apiPost<OrderDto>(`/order-management/${id}/reject`, data),

  markPreparing: (id: string) =>
    apiPost<OrderDto>(`/order-management/${id}/preparing`, {}),

  markReady: (id: string) =>
    apiPost<OrderDto>(`/order-management/${id}/ready`, {}),

  markPickedUp: (id: string) =>
    apiPost<OrderDto>(`/order-management/${id}/pickup`, {}),

  markOnTheWay: (id: string) =>
    apiPost<OrderDto>(`/order-management/${id}/on-the-way`, {}),

  markDelivered: (id: string) =>
    apiPost<OrderDto>(`/order-management/${id}/delivered`, {}),

  advanceOrderStatus: (id: string, data: AdvanceOrderDto) =>
    apiPatch<OrderDto>(`/order-management/${id}/status`, data),

  cancelOrderAdmin: (id: string, data: CancelOrderDto) =>
    apiPost<OrderDto>(`/order-management/${id}/cancel`, data),

  refundOrder: (id: string, data: RefundOrderDto) =>
    apiPost<RefundOutcome>(`/order-management/${id}/refund`, data),
}
