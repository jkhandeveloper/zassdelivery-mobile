import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter, type Href } from "expo-router";
import * as React from "react";

import { orderKeys } from "@/hooks/use-orders";
import { riderKeys } from "@/hooks/use-riders";
import { registerForPush, watchPushToken } from "@/lib/push";
import { mobileHomeRouteForRole } from "@/lib/routes";
import { UserRole, type AuthUser } from "@/types/auth";

import { useAuth } from "./auth-provider";

/**
 * Where tapping a notification should land, for this user.
 *
 * Decided from the payload's `kind` *and* the role, because the same order
 * event means different screens to different people: a customer wants the
 * order they are waiting for, the kitchen its queue, the rider their run. A
 * path is never taken from the payload itself — it is input from outside the
 * app, and the worst it can do here is pick between screens this user already
 * has.
 */
function routeFor(data: Record<string, unknown>, user: Pick<AuthUser, "role">): string {
  const home = mobileHomeRouteForRole(user);
  const kind = typeof data.kind === "string" ? data.kind : null;
  const orderId = typeof data.orderId === "string" ? data.orderId : null;

  switch (user.role) {
    case UserRole.RIDER:
      if (kind === "delivery_offer") return "/rider/offers";
      if (kind === "order_update") return "/rider/deliveries";
      return home;

    case UserRole.VENDOR_OWNER:
    case UserRole.VENDOR_STAFF:
      if (kind === "billing") return "/vendor/billing";
      if (kind === "order_update") return "/vendor/orders";
      return home;

    case UserRole.ADMIN:
    case UserRole.SUPER_ADMIN:
      return home;

    default:
      if (orderId !== null) return `/orders/${orderId}`;
      return "/notifications";
  }
}

/**
 * The app's side of push: registering the phone, and answering a tap.
 *
 * Mounted once inside the auth provider. Renders nothing.
 *
 * Registration follows the session rather than app start, because a push is
 * addressed to an account — there is nobody to register a signed-out phone to,
 * and asking a first-time visitor for notification permission before they have
 * ordered anything is the prompt people dismiss for good.
 */
export function PushRegistrar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isReady, isAuthenticated } = useAuth();

  const userId = isReady && isAuthenticated ? (user?.id ?? null) : null;

  React.useEffect(() => {
    if (userId === null) {
      return;
    }

    void registerForPush();

    return watchPushToken();
  }, [userId]);

  /**
   * The tap that opened the app, or brought it forward.
   *
   * The hook covers both: a response received while running, and the one that
   * launched a closed app — which fires before any listener could be attached.
   * It is acted on only once the session is known, so a cold start does not
   * route a signed-in rider as though they were a signed-out customer.
   */
  const response = Notifications.useLastNotificationResponse();
  const handledRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isReady || response === null || response === undefined) {
      return;
    }

    const id = response.notification.request.identifier;

    if (handledRef.current === id) {
      return;
    }

    handledRef.current = id;
    Notifications.clearLastNotificationResponse();

    // Signed out since it was sent: the login screen is the only honest place.
    if (user === null) {
      return;
    }

    // Whatever the notification was about has changed; the screen it opens
    // should not show what was cached before it arrived.
    void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    void queryClient.invalidateQueries({ queryKey: riderKeys.all });

    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;

    router.push(routeFor(data, user) as Href);
  }, [isReady, response, user, queryClient, router]);

  return null;
}
