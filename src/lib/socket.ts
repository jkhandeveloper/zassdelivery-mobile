import { AppState, type AppStateStatus } from "react-native";
import { io, type Socket } from "socket.io-client";

import {
  ClientEvents,
  ServerEvents,
  type ClientToServerEvents,
  type ReadyPayload,
  type ServerToClientEvents,
} from "@/lib/socket-events";
import { SOCKET_URL } from "@/lib/env";

export type ZassSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

export interface RealtimeSnapshot {
  socket: ZassSocket | null;
  state: ConnectionState;
  /** From `connection:ready` — rooms the server joined us to unasked. */
  autoJoinedRooms: string[];
  /**
   * True when Socket.IO replayed what we missed rather than opening a fresh
   * session. §5.10: do not force a full resync when this is true.
   */
  recovered: boolean;
}

/**
 * Ported from the web app's `src/lib/socket.ts`.
 *
 * One connection per session (§9), modelled as an external store, so React
 * subscribes via `useSyncExternalStore` rather than mirroring status into
 * component state from an effect.
 *
 * The mobile addition is the app-state bridge at the bottom. A backgrounded app
 * is frozen by both OSes: timers stop, so Socket.IO's own reconnect loop never
 * runs, and the TCP connection is usually torn down by the time the user comes
 * back. The client is often left believing it is still connected — the vendor
 * order queue then sits there looking live while silently receiving nothing,
 * which is the worst possible failure for a screen a kitchen works from.
 */

const IDLE: RealtimeSnapshot = {
  socket: null,
  state: "idle",
  autoJoinedRooms: [],
  recovered: false,
};

let snapshot: RealtimeSnapshot = IDLE;
const listeners = new Set<() => void>();

/** Rooms currently being watched, reference-counted across components. */
const orderSubscriptions = new Map<string, number>();
const restaurantSubscriptions = new Map<string, number>();

function publish(next: Partial<RealtimeSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToRealtime(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getRealtimeSnapshot(): RealtimeSnapshot {
  return snapshot;
}

/**
 * Opens the connection, or re-points an existing one at a new token.
 *
 * The gateway checks the access token against its revocation list on every
 * handshake, so a socket still holding a rotated token would be closed on its
 * next reconnect — updating `auth` here is what keeps it alive across refreshes.
 */
export function connectSocket(token: string): void {
  if (snapshot.socket !== null) {
    snapshot.socket.auth = { token };
    return;
  }

  const socket: ZassSocket = io(`${SOCKET_URL}/realtime`, {
    auth: { token },
    // MOBILE: websocket only, no polling fallback. Long-polling on a phone
    // burns battery and data for a transport that a backgrounded app cannot
    // keep alive anyway, and every network this app runs on passes websockets.
    transports: ["websocket"],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8_000,
    reconnectionAttempts: Infinity,
  });

  socket.on(ServerEvents.ready, (payload: ReadyPayload) => {
    serverDisconnects = 0;
    publish({
      state: "connected",
      autoJoinedRooms: payload.rooms,
      recovered: payload.recovered,
    });

    // A fresh session lost its rooms; rejoin everything still being watched.
    // A recovered one kept them, and re-subscribing would be pure noise.
    if (!payload.recovered) {
      for (const orderId of orderSubscriptions.keys()) {
        socket.emit(ClientEvents.orderSubscribe, { orderId }, () => {});
      }
      for (const restaurantId of restaurantSubscriptions.keys()) {
        socket.emit(ClientEvents.restaurantSubscribe, { restaurantId }, () => {});
      }
    }
  });

  // `connect` fires before the server's ready handshake; treat it as still
  // connecting so the UI does not claim to be live a beat early.
  socket.on("connect", () => publish({ state: "connecting" }));
  socket.on("disconnect", (reason) => {
    publish({ state: "reconnecting" });

    // MOBILE: see recoverFromServerDisconnect.
    if (reason === "io server disconnect") {
      void recoverFromServerDisconnect(socket);
    }
  });
  socket.on("connect_error", () => publish({ state: "offline" }));

  publish({ socket, state: "connecting" });
  socket.connect();
}

/**
 * MOBILE: getting back in after the server closed the connection.
 *
 * Socket.IO deliberately never auto-reconnects a disconnect the *server*
 * initiated, and the gateway initiates one whenever a handshake's token is
 * rejected. Access tokens live fifteen minutes, so any drop after that — a
 * network blip, an API deploy — reconnects with an expired token, is refused,
 * and the socket then stays dead until the app is backgrounded: an order
 * screen that looks live and receives nothing.
 *
 * So: make one authenticated request, which refreshes the token through the
 * API client's single-flight refresh (RealtimeProvider copies the new token
 * onto `socket.auth`), then connect again. Backed off, so an account the server
 * refuses for other reasons does not spin; a failed refresh is a sign-out, which
 * disconnectSocket() handles.
 */
let reauthenticate: (() => Promise<string | null>) | null = null;
let serverDisconnects = 0;

/** `handler` resolves to a currently valid access token, refreshing if it must. */
export function setSocketReauthenticator(handler: (() => Promise<string | null>) | null): void {
  reauthenticate = handler;
}

async function recoverFromServerDisconnect(socket: ZassSocket): Promise<void> {
  serverDisconnects += 1;
  const delay = Math.min(30_000, 1_000 * 2 ** (serverDisconnects - 1));

  await new Promise((resolve) => setTimeout(resolve, delay));

  let token: string | null = null;

  try {
    token = (await reauthenticate?.()) ?? null;
  } catch {
    publish({ state: "offline" });
    return;
  }

  // Signed out, or replaced by a new session, while we waited.
  if (token !== null && snapshot.socket === socket && !socket.connected) {
    // Set here rather than left to RealtimeProvider's effect, which runs after
    // the next render — too late for the connect() on the line below.
    socket.auth = { token };
    publish({ state: "connecting" });
    socket.connect();
  }
}

export function disconnectSocket(): void {
  const current = snapshot.socket;

  if (current !== null) {
    current.removeAllListeners();
    current.disconnect();
  }

  orderSubscriptions.clear();
  restaurantSubscriptions.clear();
  snapshot = IDLE;

  for (const listener of listeners) {
    listener();
  }
}

// ── Reference-counted room subscriptions ─────────────────────
// Two components watching the same order share one room, and the room is only
// left when the last of them unmounts. Without this, closing one of two open
// order panels would silently stop updates for the other.

function acquire(counts: Map<string, number>, id: string): boolean {
  const next = (counts.get(id) ?? 0) + 1;
  counts.set(id, next);

  return next === 1;
}

function release(counts: Map<string, number>, id: string): boolean {
  const next = (counts.get(id) ?? 1) - 1;

  if (next > 0) {
    counts.set(id, next);
    return false;
  }

  counts.delete(id);
  return true;
}

export function joinOrderRoom(orderId: string): void {
  acquire(orderSubscriptions, orderId);
  snapshot.socket?.emit(ClientEvents.orderSubscribe, { orderId }, () => {});
}

export function leaveOrderRoom(orderId: string): void {
  if (release(orderSubscriptions, orderId)) {
    snapshot.socket?.emit(ClientEvents.orderUnsubscribe, { orderId }, () => {});
  }
}

/**
 * A rider reporting where they are.
 *
 * Fire-and-forget by design: the position is only interesting while it is
 * current, so a report that could not be delivered is worth less than the one
 * arriving a second later, and blocking on an acknowledgement would only queue
 * stale fixes behind a bad connection. The order it belongs to is resolved
 * server-side from the rider's own accepted run — nothing here names one.
 */
export function reportRiderLocation(latitude: number, longitude: number): void {
  snapshot.socket?.emit(ClientEvents.riderLocation, { latitude, longitude }, () => {});
}

export function joinRestaurantRoom(restaurantId: string): void {
  acquire(restaurantSubscriptions, restaurantId);
  snapshot.socket?.emit(ClientEvents.restaurantSubscribe, { restaurantId }, () => {});
}

export function leaveRestaurantRoom(restaurantId: string): void {
  if (release(restaurantSubscriptions, restaurantId)) {
    snapshot.socket?.emit(ClientEvents.restaurantUnsubscribe, { restaurantId }, () => {});
  }
}

// ── App-state bridge (mobile only) ───────────────────────────

/**
 * Re-establish the connection when the user comes back to the app.
 *
 * `socket.connected` is not trusted here. A frozen app misses the TCP teardown
 * entirely, so the flag can still read true over a socket that is long dead —
 * the condition this exists to fix. `disconnect()` before `connect()` forces
 * Socket.IO to discard whatever it thinks it has and perform a real handshake,
 * which is also what re-runs the token check and the room rejoin above.
 *
 * Registered once at module scope, since the connection is a singleton too.
 */
let lastAppState: AppStateStatus = AppState.currentState;

AppState.addEventListener("change", (next) => {
  const cameToForeground = lastAppState !== "active" && next === "active";
  lastAppState = next;

  if (!cameToForeground) {
    return;
  }

  const socket = snapshot.socket;

  if (socket === null) {
    return;
  }

  publish({ state: "connecting" });
  socket.disconnect();
  socket.connect();
});
