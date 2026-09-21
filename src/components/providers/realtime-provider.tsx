import * as React from "react";

import {
  connectSocket,
  disconnectSocket,
  getRealtimeSnapshot,
  joinOrderRoom,
  joinRestaurantRoom,
  leaveOrderRoom,
  leaveRestaurantRoom,
  subscribeToRealtime,
  type ConnectionState,
  type RealtimeSnapshot,
} from "@/lib/socket";
import type { ServerToClientEvents } from "@/lib/socket-events";
import { useAuthStore } from "@/store/auth-store";

export type { ConnectionState };

/**
 * Ported from the web app's `realtime-provider.tsx`.
 *
 * Bridges the socket store into React (§9).
 *
 * The provider owns the connection's lifecycle — open it when there is a
 * token, close it when there is not — and nothing else. Status is read
 * straight from the store, so a component that mounts after the handshake sees
 * the current state rather than whatever was true when it rendered.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((store) => store.tokens?.accessToken ?? null);

  React.useEffect(() => {
    if (accessToken === null) {
      disconnectSocket();
      return;
    }

    connectSocket(accessToken);
  }, [accessToken]);

  React.useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return <>{children}</>;
}

/** The live connection and its status. */
export function useRealtime(): RealtimeSnapshot & {
  subscribeToOrder: (orderId: string) => void;
  unsubscribeFromOrder: (orderId: string) => void;
  subscribeToRestaurant: (restaurantId: string) => void;
  unsubscribeFromRestaurant: (restaurantId: string) => void;
} {
  const snapshot = React.useSyncExternalStore(
    subscribeToRealtime,
    getRealtimeSnapshot,
    );

  return {
    ...snapshot,
    subscribeToOrder: joinOrderRoom,
    unsubscribeFromOrder: leaveOrderRoom,
    subscribeToRestaurant: joinRestaurantRoom,
    unsubscribeFromRestaurant: leaveRestaurantRoom,
  };
}

/**
 * Watch one order for as long as the component is mounted.
 *
 * The room is reference-counted in the store, so two panels on the same order
 * cooperate instead of one unmount cutting the other off.
 */
export function useOrderRoom(orderId: string | null): void {
  const { state } = useRealtime();

  React.useEffect(() => {
    if (orderId === null || state !== "connected") {
      return;
    }

    joinOrderRoom(orderId);

    return () => leaveOrderRoom(orderId);
  }, [orderId, state]);
}

/** Watch a kitchen's incoming tickets for as long as the component is mounted. */
export function useRestaurantRoom(restaurantId: string | null): void {
  const { state } = useRealtime();

  React.useEffect(() => {
    if (restaurantId === null || state !== "connected") {
      return;
    }

    joinRestaurantRoom(restaurantId);

    return () => leaveRestaurantRoom(restaurantId);
  }, [restaurantId, state]);
}

/** Subscribe to a typed server event for as long as the component is mounted. */
export function useRealtimeEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: ServerToClientEvents[E],
): void {
  const { socket } = useRealtime();
  const handlerRef = React.useRef(handler);

  // Assigned in an effect, not during render: the listener below reads through
  // the ref so an inline handler does not re-bind on every render.
  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    if (socket === null) {
      return;
    }

    const listener = ((...args: unknown[]) => {
      (handlerRef.current as (...rest: unknown[]) => void)(...args);
    }) as never;

    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
