"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useOrderRoom, useRealtime, useRealtimeEvent } from "@/components/providers/realtime-provider";
import { orderKeys } from "@/hooks/use-orders";
import type {
  Coordinates,
  OrderSnapshotPayload,
  RiderLocationPayload,
} from "@/lib/socket-events";
import type { OrderStatus } from "@/types/enums";

export interface OrderTracking {
  /** The server's own read on the order, or null before the first snapshot. */
  status: OrderStatus | null;
  statusText: string | null;
  /** When that status was reached, as reported by the server. */
  statusAt: string | null;
  rider: { id: string; name: string; phone: string } | null;
  riderLocation: RiderLocationPayload | null;
  pickup: Coordinates | null;
  destination: Coordinates | null;
  estimatedDeliveryAt: string | null;
  /** True once a snapshot has arrived, so a map knows it has real data. */
  hasSnapshot: boolean;
  /** The socket's own state, for telling "nothing moved" from "not connected". */
  connection: ReturnType<typeof useRealtime>["state"];
}

const EMPTY: Omit<OrderTracking, "connection"> = {
  status: null,
  statusText: null,
  statusAt: null,
  rider: null,
  riderLocation: null,
  pickup: null,
  destination: null,
  estimatedDeliveryAt: null,
  hasSnapshot: false,
};

/**
 * Everything a tracking screen needs about one live order.
 *
 * The socket is the source of truth here rather than a poll, because the whole
 * point of the screen is a rider dot that moves — a fifteen-second refetch
 * would draw a delivery as a series of teleports. The REST order (items,
 * totals, the full timeline) is still fetched separately and simply
 * invalidated whenever the status moves, which is the only moment its content
 * can have changed.
 *
 * Every event is filtered by order id. One socket can watch several orders at
 * once — the history screen and a tracking screen open together, say — and
 * `order:status` carries no room name, so a client that trusted whatever
 * arrived would happily paint one order's progress onto another.
 */
export function useOrderTracking(orderId: string | null): OrderTracking {
  const { state } = useRealtime();
  const queryClient = useQueryClient();

  const [tracking, setTracking] = React.useState(EMPTY);

  // A new order id means everything held here belongs to the previous one.
  // Adjusted during render rather than in an effect, so the screen never paints
  // one order's rider onto another's map for a frame first.
  const [trackedId, setTrackedId] = React.useState(orderId);

  if (trackedId !== orderId) {
    setTrackedId(orderId);
    setTracking(EMPTY);
  }

  useRealtimeEvent(
    "order:snapshot",
    React.useCallback(
      (payload: OrderSnapshotPayload) => {
        if (payload.orderId !== orderId) return;

        setTracking({
          status: payload.status as OrderStatus,
          statusText: payload.statusText,
          statusAt: payload.at,
          rider: payload.rider,
          riderLocation: payload.riderLocation,
          pickup: payload.pickup,
          destination: payload.destination,
          estimatedDeliveryAt: payload.estimatedDeliveryAt,
          hasSnapshot: true,
        });
      },
      [orderId],
    ),
  );

  useRealtimeEvent(
    "order:status",
    React.useCallback(
      (payload) => {
        if (payload.orderId !== orderId) return;

        setTracking((current) => ({
          ...current,
          status: payload.status as OrderStatus,
          statusText: payload.statusText,
          statusAt: payload.at,
        }));

        // The items and totals never change, but the timeline and the allowed
        // transitions do — and the cancel button is drawn from them.
        void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      },
      [orderId, queryClient],
    ),
  );

  useRealtimeEvent(
    "rider:assigned",
    React.useCallback(
      (payload) => {
        if (payload.orderId !== orderId) return;

        setTracking((current) => ({
          ...current,
          rider: { id: payload.driverId, name: payload.riderName, phone: payload.riderPhone },
        }));

        void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      },
      [orderId, queryClient],
    ),
  );

  useRealtimeEvent(
    "rider:location",
    React.useCallback(
      (payload: RiderLocationPayload) => {
        // Riders report a position whether or not they are carrying anything,
        // and staff watching the dispatch board hear every one of them.
        if (payload.orderId !== orderId) return;

        setTracking((current) => ({ ...current, riderLocation: payload }));
      },
      [orderId],
    ),
  );

  // Joined last on purpose. Effects fire in the order their hooks were called,
  // so subscribing after the listeners above are bound closes the window in
  // which the snapshot this subscribe asks for could arrive with nobody
  // listening for it.
  useOrderRoom(orderId);

  return { ...tracking, connection: state };
}
