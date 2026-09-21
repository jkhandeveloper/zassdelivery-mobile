import { apiGet } from '../api-client'
import type {
  RealtimeHandshakeDto,
  OrderChannelDto,
  RealtimePresenceDto,
} from '@/types/realtime'

export const realtimeApi = {
  /** The server's own description of the socket protocol. */
  getHandshake: () => apiGet<RealtimeHandshakeDto>('/realtime/handshake'),

  /**
   * Resolves the room for one order. 404s rather than 403s when the order is
   * not yours, so treat "not found" as "not visible to you".
   */
  getOrderChannel: (orderId: string) =>
    apiGet<OrderChannelDto>(`/realtime/orders/${orderId}/channel`),

  /** Gateway health for the dispatch board. Requires orders.read. */
  getPresence: () => apiGet<RealtimePresenceDto>('/realtime/presence'),
}
