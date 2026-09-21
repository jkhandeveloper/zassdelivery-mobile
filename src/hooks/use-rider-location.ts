import * as React from "react";

import { toast } from "@/components/ui/toast";
import {
  isReportingInBackground,
  requestLocationPermission,
  startBackgroundReporting,
  stopBackgroundReporting,
  watchInForeground,
  type LocationPermission,
} from "@/lib/rider-location";

/**
 * Reports the rider's position for exactly as long as they are carrying an
 * order, and not a moment longer.
 *
 * Tying this to an active run rather than to "the rider is online" is the whole
 * design. A rider who is online but empty-handed has agreed to receive offers,
 * not to be followed around, and there is no customer for their position to be
 * shown to. Reporting then would be a battery drain in exchange for tracking
 * nobody is looking at — and riders who notice that turn location off, which
 * breaks tracking for every customer they later serve.
 *
 * Both transports run together while the app is open. That is not redundant:
 * the socket gives the customer's map a fix every fifteen seconds with no HTTP
 * round trip, while the background task's `PUT` is what keeps reporting once
 * the rider pockets the phone — which is most of a delivery.
 */
export function useRiderLocationReporting(isOnRun: boolean): {
  permission: LocationPermission | null;
  /** Ask for permission, e.g. from a button on the dashboard. */
  request: () => Promise<void>;
} {
  const [permission, setPermission] = React.useState<LocationPermission | null>(null);

  /** What to tell the rider about the outcome. Shared by both callers below. */
  const explain = React.useCallback((result: LocationPermission) => {
    if (result === "denied") {
      toast.error("Location is off", {
        description:
          "Customers can't see where their order is, and you won't get offers near you.",
      });
      return;
    }

    if (result === "foreground-only") {
      toast("Background location is off", {
        description:
          "Tracking will pause when you leave the app. Allow location 'all the time' to keep it running.",
      });
    }
  }, []);

  const request = React.useCallback(async () => {
    const result = await requestLocationPermission();
    setPermission(result);
    explain(result);
  }, [explain]);

  /**
   * Ask once, when a run actually starts.
   *
   * Deliberately not on mount: a permission prompt that appears before the
   * rider has accepted anything is the one they reflexively dismiss, and on
   * both platforms a denied prompt cannot simply be asked again.
   *
   * Written as an inline async task rather than a call to `request` above so
   * the state write is unambiguously *after* an await. A `setState` reachable
   * synchronously from an effect body is a cascading render, and here it would
   * also race the OS permission dialog.
   */
  React.useEffect(() => {
    if (!isOnRun || permission !== null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await requestLocationPermission();

      // The run can end, or the screen unmount, while the dialog is still up.
      if (cancelled) {
        return;
      }

      setPermission(result);
      explain(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnRun, permission, explain]);

  // Background reporting: survives the screen turning off.
  React.useEffect(() => {
    if (!isOnRun || permission !== "granted") {
      return;
    }

    let cancelled = false;

    void startBackgroundReporting().catch(() => {
      if (!cancelled) {
        toast.error("Couldn't start location sharing", {
          description: "Your customer may not see where their order is.",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOnRun, permission]);

  /**
   * Stop as soon as the run ends.
   *
   * Separate from the effect above, and not merely its cleanup, because it has
   * to run even when permission was never `granted` — a rider can revoke
   * background access mid-delivery, and a foreground service left running after
   * the run is both a drain and a privacy problem.
   */
  React.useEffect(() => {
    if (isOnRun) {
      return;
    }

    void (async () => {
      if (await isReportingInBackground()) {
        await stopBackgroundReporting();
      }
    })();
  }, [isOnRun]);

  // Foreground reporting over the socket, while a screen is open.
  React.useEffect(() => {
    if (!isOnRun || permission === "denied" || permission === null) {
      return;
    }

    let stop: (() => void) | null = null;
    let cancelled = false;

    void watchInForeground().then((unsubscribe) => {
      // The run can end, or the screen unmount, while `watchPositionAsync` is
      // still resolving. Without this the subscription leaks and the rider
      // keeps being watched after they have stopped.
      if (cancelled) {
        unsubscribe();
        return;
      }

      stop = unsubscribe;
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [isOnRun, permission]);

  return { permission, request };
}
