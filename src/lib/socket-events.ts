/**
 * The socket wire protocol, transcribed from the backend's
 * `realtime/domain/events.ts` and `rooms.ts`.
 *
 * §3/§9 say to read GET /realtime/handshake rather than hardcode names — this
 * file is the typed mirror of that catalogue, kept in one place for the same
 * reason the backend keeps it in one place: a mistyped event name does not
 * throw, it just silently never fires.
 */

export const ServerEvents = {
  ready: "connection:ready",
  orderSnapshot: "order:snapshot",
  orderStatus: "order:status",
  riderLocation: "rider:location",
  riderAssigned: "rider:assigned",
  deliveryOffered: "delivery:offered",
  restaurantOrder: "restaurant:order",
  restaurantOrderUpdated: "restaurant:order-updated",
  notification: "notification:new",
  subscriptionError: "subscription:error",
} as const;

export const ClientEvents = {
  orderSubscribe: "order:subscribe",
  orderUnsubscribe: "order:unsubscribe",
  restaurantSubscribe: "restaurant:subscribe",
  restaurantUnsubscribe: "restaurant:unsubscribe",
  riderLocation: "rider:location",
  ping: "ping",
} as const;

/** Room naming, mirroring the backend's `Rooms` helper. */
export const Rooms = {
  user: (userId: string) => `user:${userId}`,
  order: (orderId: string) => `order:${orderId}`,
  restaurant: (restaurantId: string) => `restaurant:${restaurantId}`,
  rider: (driverId: string) => `rider:${driverId}`,
  dispatch: () => "dispatch",
} as const;

// ── Payloads ─────────────────────────────────────────────────

export interface ReadyPayload {
  userId: string;
  role: string;
  /** Rooms joined automatically, before the client asks for anything. */
  rooms: string[];
  /** True when Socket.IO restored a dropped session rather than opening a new one. */
  recovered: boolean;
  serverTime: string;
}

export interface OrderStatusPayload {
  orderId: string;
  orderNumber: string;
  status: string;
  statusText: string;
  actor: string | null;
  at: string;
}

export interface RiderLocationPayload {
  orderId: string | null;
  driverId: string;
  latitude: number;
  longitude: number;
  /** Straight-line distance left to the drop-off, when the order is known. */
  distanceKm: number | null;
  at: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface OrderSnapshotPayload extends OrderStatusPayload {
  restaurantName: string;
  estimatedDeliveryAt: string | null;
  rider: { id: string; name: string; phone: string } | null;
  riderLocation: RiderLocationPayload | null;
  /** Where the rider collects from. */
  pickup: Coordinates;
  /**
   * Where the order is going, or null for an address that never resolved to
   * coordinates — the map draws the route it can and says so.
   */
  destination: Coordinates | null;
}

export interface RiderAssignedPayload {
  orderId: string;
  driverId: string;
  riderName: string;
  riderPhone: string;
  at: string;
}

export interface DeliveryOfferedPayload {
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  estimatedEarning: number;
  pickupDistanceKm: number | null;
  expiresAt: string;
}

export interface RestaurantOrderPayload {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  customerName: string;
  placedAt: string | null;
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  createdAt: string;
}

export interface SubscriptionErrorPayload {
  room: string;
  reason: string;
}

/**
 * What a subscribe call is answered with.
 *
 * The snapshot arrives both here and as an `order:snapshot` event — the server
 * sends it twice on purpose, because a callback-style client has not attached
 * its listener yet when the event fires.
 */
export interface SubscriptionAck {
  ok: boolean;
  room: string | null;
  error: string | null;
  snapshot?: OrderSnapshotPayload;
}

/** Events the server sends, mapped to their payloads. */
export interface ServerToClientEvents {
  "connection:ready": (payload: ReadyPayload) => void;
  "order:snapshot": (payload: OrderSnapshotPayload) => void;
  "order:status": (payload: OrderStatusPayload) => void;
  "rider:location": (payload: RiderLocationPayload) => void;
  "rider:assigned": (payload: RiderAssignedPayload) => void;
  "delivery:offered": (payload: DeliveryOfferedPayload) => void;
  "restaurant:order": (payload: RestaurantOrderPayload) => void;
  "restaurant:order-updated": (payload: RestaurantOrderPayload) => void;
  "notification:new": (payload: NotificationPayload) => void;
  "subscription:error": (payload: SubscriptionErrorPayload) => void;
}

/** Commands the client sends. Each is acknowledged. */
export interface ClientToServerEvents {
  "order:subscribe": (body: { orderId: string }, ack: (result: SubscriptionAck) => void) => void;
  "order:unsubscribe": (body: { orderId: string }, ack: (result: SubscriptionAck) => void) => void;
  "restaurant:subscribe": (
    body: { restaurantId: string },
    ack: (result: SubscriptionAck) => void,
  ) => void;
  "restaurant:unsubscribe": (
    body: { restaurantId: string },
    ack: (result: SubscriptionAck) => void,
  ) => void;
  "rider:location": (
    body: { latitude: number; longitude: number },
    ack: (result: SubscriptionAck) => void,
  ) => void;
  ping: (body: Record<string, never>, ack: (result: { pong: true; at: string }) => void) => void;
}
