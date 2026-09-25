import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import * as React from "react";

import { authApi, type LoginPayload, type RegisterPayload } from "@/lib/api/auth";
import { setSessionLostHandler } from "@/lib/api-client";
import { disconnectSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { homeRouteForRole, type AuthUser } from "@/types/auth";

/**
 * Ported from the web app's `auth-provider.tsx`.
 *
 * The session logic is unchanged and deliberately so — the boot revalidation,
 * the `revalidatedFor` id rather than a boolean, and treating a refresh failure
 * as a full logout are all load-bearing. Only navigation differs: `expo-router`
 * in place of `next/navigation`.
 *
 * `isReady` carries more weight here than on the web. There, storage is
 * synchronous, so it is false for one render. Here the keychain read is async,
 * so it is false for the first frames of every cold start — which is exactly
 * why the splash screen is held on it and no guard may route before it flips.
 */

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** False until the persisted session has been read back and revalidated. */
  isReady: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: (options?: { allDevices?: boolean }) => Promise<void>;
  /** Re-reads GET /auth/me — call after anything that can change permissions. */
  refreshUser: () => Promise<AuthUser | null>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const user = useAuthStore((state) => state.user);
  const tokens = useAuthStore((state) => state.tokens);
  const hydrated = useAuthStore((state) => state.hydrated);

  /**
   * The account whose session has been checked against the server.
   *
   * Tracked by id rather than as a flat "have we revalidated yet" boolean:
   * signing in *within* a session has to start its own check, and a boolean
   * set once on boot — when there was no session to check — never flipped
   * again, which left every guarded route on its skeleton.
   */
  const [revalidatedFor, setRevalidatedFor] = React.useState<string | null>(null);

  const hasSession = tokens !== null;
  const userId = user?.id ?? null;

  // Kept in a ref so the session-lost effect below does not re-register on
  // every navigation. Written in an effect rather than during render.
  const pathnameRef = React.useRef(pathname);

  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const clearLocalSession = React.useCallback(() => {
    useAuthStore.getState().clearSession();
    disconnectSocket();
    queryClient.clear();
  }, [queryClient]);

  /**
   * §0: a refresh failure is a full logout. The API client calls this when the
   * refresh token is rejected — reused, expired, or the family was revoked.
   */
  React.useEffect(() => {
    setSessionLostHandler(() => {
      disconnectSocket();
      queryClient.clear();

      const current = pathnameRef.current;
      const isAuthScreen = current.startsWith("/login") || current.startsWith("/register");

      if (!isAuthScreen) {
        // Bring them back where they were once they sign in again.
        router.replace({
          pathname: "/login",
          params: { next: current, reason: "expired" },
        });
      }
    });

    return () => setSessionLostHandler(null);
  }, [queryClient, router]);

  /**
   * A persisted session is a claim, not proof. Revalidate it against
   * GET /auth/me on boot: the account may have been suspended, its role
   * changed, or its permissions revoked since the token was minted.
   *
   * On a phone a token routinely sits unused for days, so this matters more
   * here than on the web — a suspended rider must not get a working app back
   * simply by reopening it.
   */
  React.useEffect(() => {
    // Nothing to check: storage has not been read back yet, there is no
    // session, or this account has already been through the round trip —
    // including the sign-in that just happened, which recorded its own id.
    if (!hydrated || !hasSession || revalidatedFor === userId) {
      return;
    }

    let cancelled = false;

    authApi
      .me()
      .then((fresh) => {
        if (!cancelled) {
          useAuthStore.getState().setUser(fresh);
        }
      })
      .catch(() => {
        // A 401 has already been handled by the interceptor (refresh, then
        // session-lost). Anything else — offline, 500 — leaves the cached user
        // in place rather than signing someone out because the server hiccuped
        // or because they opened the app in a tunnel.
      })
      .finally(() => {
        if (!cancelled) {
          setRevalidatedFor(useAuthStore.getState().user?.id ?? null);
        }
      });

    return () => {
      cancelled = true;
    };
    // Keyed on whether a session exists rather than on the token itself, so a
    // silent refresh — which rotates the token but changes neither flag — does
    // not fire another /auth/me on every rotation.
  }, [hydrated, hasSession, revalidatedFor, userId]);

  // The socket's handshake token is kept current by RealtimeProvider, which
  // reacts to the same access token in the store.

  const login = React.useCallback(
    async (payload: LoginPayload) => {
      const result = await authApi.login(payload);
      useAuthStore.getState().setSession(result.user, result.tokens);
      // This user came straight from the server, so the boot check has nothing
      // left to ask — recording it here is what makes the portal render
      // immediately instead of flashing a loading state.
      setRevalidatedFor(result.user.id);
      queryClient.clear();

      return result.user;
    },
    [queryClient],
  );

  const register = React.useCallback(
    async (payload: RegisterPayload) => {
      const result = await authApi.register(payload);
      useAuthStore.getState().setSession(result.user, result.tokens);
      setRevalidatedFor(result.user.id);
      queryClient.clear();

      return result.user;
    },
    [queryClient],
  );

  const logout = React.useCallback(
    async (options?: { allDevices?: boolean }) => {
      const refreshToken = useAuthStore.getState().tokens?.refreshToken;

      try {
        await authApi.logout({
          ...(refreshToken !== undefined && { refreshToken }),
          ...(options?.allDevices === true && { allDevices: true }),
        });
      } catch {
        // Signing out locally must succeed even if the call does not —
        // otherwise a user on a flaky connection cannot leave a shared device.
      }

      clearLocalSession();

      // MOBILE: a customer lands back on the storefront, which is public, so
      // the tab navigator stays mounted and nothing is torn down mid-update.
      // The portals are role-guarded and have to be left for the login screen.
      const inPortal =
        pathnameRef.current.startsWith("/rider") || pathnameRef.current.startsWith("/vendor");

      router.replace(inPortal ? "/login" : "/");
    },
    [clearLocalSession, router],
  );

  const refreshUser = React.useCallback(async () => {
    if (useAuthStore.getState().tokens === null) {
      return null;
    }

    const fresh = await authApi.me();
    useAuthStore.getState().setUser(fresh);

    return fresh;
  }, []);

  const hasPermission = React.useCallback(
    (code: string) => user?.permissions.includes(code) ?? false,
    [user],
  );

  // Ready once storage has been read and — if there is a session — the server
  // has been asked whether this account is still good.
  const isReady = hydrated && (!hasSession || revalidatedFor === userId);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null && tokens !== null,
      isReady,
      login,
      register,
      logout,
      refreshUser,
      hasPermission,
    }),
    [user, tokens, isReady, login, register, logout, refreshUser, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }

  return context;
}

export { homeRouteForRole };
