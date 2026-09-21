import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "@/components/ui/toast";

import { useRealtimeEvent } from "@/components/providers/realtime-provider";
import { orderKeys } from "@/hooks/use-orders";

/** What the API puts in a notification's `data` for order events. */
interface OrderNotificationData {
  kind?: string;
  orderId?: string;
}

/**
 * Ported from the web app's `notification-listener.tsx`, with `sonner`
 * swapped for the local toast. Push notifications for a *backgrounded* app
 * are a separate path — see `lib/push.ts`; this handles the foreground case,
 * where the OS shows nothing and the socket is the only signal.
 *
 * In-app notifications, shown wherever the user happens to be.
 *
 * Mounted once at the root rather than on the screens that care, because the
 * whole point of these messages is that they arrive when you are not looking at
 * the thing they are about — a customer browsing restaurants is exactly who
 * needs to be told their last order has been accepted.
 *
 * An order notification also invalidates the order caches. The server sends one
 * on every transition the customer is told about, and it reaches the user's own
 * room — which makes it the only status signal available to a screen that is
 * not subscribed to a specific order.
 */
export function NotificationListener() {
  const queryClient = useQueryClient();

  useRealtimeEvent(
    "notification:new",
    React.useCallback(
      (payload) => {
        toast(payload.title, { description: payload.body });

        const data = (payload.data ?? {}) as OrderNotificationData;

        if (data.kind !== "order_update") return;

        void queryClient.invalidateQueries({ queryKey: orderKeys.all });

        if (typeof data.orderId === "string") {
          void queryClient.invalidateQueries({ queryKey: orderKeys.detail(data.orderId) });
        }
      },
      [queryClient],
    ),
  );

  return null;
}
