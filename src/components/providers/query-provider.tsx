import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError } from "@/lib/api-client";

/**
 * Ported from the web app's `query-provider.tsx`.
 *
 * The retry policy is unchanged. What is new is the pair of managers below:
 * TanStack Query's defaults are written against a browser, where `window`
 * focus and `navigator.onLine` exist. On a device neither does, so without
 * these the cache never refetches on resume and never knows it went offline.
 */

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // On a phone this is desirable, unlike on the web: coming back to the
        // app after any real gap should show current prices and order states,
        // not whatever was on screen when it was pocketed.
        refetchOnWindowFocus: true,
        // A dropped connection is the normal case, not an error state. Queries
        // that failed offline are retried once the connection returns.
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // A 4xx will fail again identically; only a network blip or a 5xx
            // is worth another round trip. 401 is handled by the interceptor.
            if (error.status >= 400 && error.status < 500) {
              return false;
            }
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Teach Query what "online" means here.
 *
 * Registered at module scope, once, because these are global singletons inside
 * TanStack Query — re-registering per mount would stack subscriptions.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    // `isInternetReachable` is null while NetInfo is still probing. Treating
    // that as offline would pause every query on a cold start, so only an
    // explicit false counts as offline.
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  }),
);

function onAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === "active");
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(createQueryClient);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);

    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
