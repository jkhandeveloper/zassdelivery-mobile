import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as React from "react";

import { geoApi } from "@/lib/api/geo";
import type { Coordinates } from "@/types/geo";

/**
 * MOBILE: rewritten from the web app's `hooks/use-geo.ts`.
 *
 * `useZones` is identical — it is a plain query. `useGeolocation` could not be:
 * the web version wraps `navigator.geolocation`, whose callback-style API,
 * `PositionError` codes and per-browser quirks have no counterpart here. The
 * contract is deliberately kept the same shape so a copied component that
 * branches on `status` still works.
 */

export const geoKeys = {
  all: ["geo"] as const,
  zones: () => [...geoKeys.all, "zones"] as const,
};

/**
 * The service area.
 *
 * Geography changes when the company opens a town, so this is cached for the
 * session rather than refetched per screen.
 */
export function useZones() {
  return useQuery({
    queryKey: geoKeys.zones(),
    queryFn: () => geoApi.listZones(),
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export type GeolocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; coordinates: Coordinates; accuracyMetres: number | null }
  | { status: "error"; message: string };

/**
 * The device's position, on request.
 *
 * Deliberately never asked for on mount: a permission prompt that appears
 * before the customer has asked for anything is the one they reflexively
 * dismiss, and on both platforms a denied prompt cannot simply be re-asked.
 *
 * Note this is the *customer's* one-shot lookup, for "find restaurants near
 * me" and for pinning a delivery address. Continuous rider tracking is a
 * different problem with different battery and permission trade-offs — see
 * `lib/rider-location.ts`.
 */
export function useGeolocation(): GeolocationState & {
  locate: () => void;
  reset: () => void;
} {
  const [state, setState] = React.useState<GeolocationState>({ status: "idle" });

  const locate = React.useCallback(() => {
    setState({ status: "locating" });

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!permission.granted) {
          setState({
            status: "error",
            message: permission.canAskAgain
              ? "Location access was declined. Pick your area below instead."
              : // Once it can no longer be asked, the only route is Settings,
                // so say that rather than inviting another futile tap.
                "Location is blocked for ZassDeliver. Turn it on in Settings, or pick your area below.",
          });

          return;
        }

        /**
         * `Balanced` rather than `High`.
         *
         * High accuracy spins up GPS and can take fifteen seconds outdoors and
         * never resolve indoors — which is where someone ordering food usually
         * is. Balanced answers from wifi and cell in about a second, and a
         * hundred metres is well inside the delivery zone this is used to pick.
         */
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setState({
          status: "ready",
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracyMetres: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy ?? 0)
            : null,
        });
      } catch {
        // Location services off at the OS level, or no fix available at all.
        setState({
          status: "error",
          message: "Your device couldn't work out where it is. Pick your area below instead.",
        });
      }
    })();
  }, []);

  const reset = React.useCallback(() => setState({ status: "idle" }), []);

  return { ...state, locate, reset };
}
