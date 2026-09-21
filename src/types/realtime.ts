import type { OrderStatus } from './enums'

/**
 * The websocket contract, served over HTTP.
 *
 * `socket-events.ts` hardcodes the same event names so the client is typed at
 * compile time; this endpoint is the server's own description of them, useful
 * for verifying the two have not drifted.
 */
export interface RealtimeHandshakeDto {
  url: string
  namespace: string
  authentication: string
  transports: string[]
  reconnectWindowSeconds: number
  autoJoinedRooms: string[]
  commands: RealtimeCommandDto[]
  events: RealtimeEventDto[]
}

export interface RealtimeCommandDto {
  event: string
  payload: string
  description: string
}

export interface RealtimeEventDto {
  event: string
  description: string
  room: string
}

/** Which room to subscribe to for one order, and where that order currently is. */
export interface OrderChannelDto {
  room: string
  orderId: string
  orderNumber: string
  status: OrderStatus
  hasRider: boolean
  estimatedDeliveryAt?: string
}

export interface RealtimePresenceDto {
  connections: number
  gatewayReady: boolean
  dispatchWatchers: number
}
