import * as React from "react";

import { Toaster } from "@/components/ui/toast";

import { AuthProvider } from "./auth-provider";
import { NotificationListener } from "./notification-listener";
import { QueryProvider } from "./query-provider";
import { RealtimeProvider } from "./realtime-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * Provider order matters: auth needs the query client to clear caches on
 * sign-out, and realtime needs a token from auth before it will connect.
 *
 * The `Toaster` sits last so it paints above every screen, and inside
 * `RealtimeProvider` because `NotificationListener` pushes to it.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <RealtimeProvider>
            <NotificationListener />
            {children}
            <Toaster />
          </RealtimeProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

export { useAuth, homeRouteForRole } from "./auth-provider";
export { useTheme, loadStoredTheme } from "./theme-provider";
export {
  useRealtime,
  useOrderRoom,
  useRestaurantRoom,
  useRealtimeEvent,
} from "./realtime-provider";
