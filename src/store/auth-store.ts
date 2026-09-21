import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import type { AuthTokens, AuthUser } from "@/types/auth";

/**
 * Ported from the web app's `src/store/auth-store.ts`, with the storage layer
 * rewritten. The state shape and the action names are identical on purpose, so
 * every copied hook and the API client work against it unchanged.
 *
 * Two things genuinely differ on a device:
 *
 * 1. **Tokens go in the keychain, not in a web store.** They are bearer
 *    credentials on a device that can be handed to someone else, so they belong
 *    behind the OS keystore rather than in plaintext app storage.
 *
 * 2. **Rehydration is asynchronous.** The web store reads localStorage
 *    synchronously, so `hydrated` is true by the time anything renders. Here it
 *    is false for the first frames of every cold start, which is exactly why
 *    nothing may route on `user` until `hydrated` flips — see `useIsReady`.
 */

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  /** False until the persisted session has been read back from storage. */
  hydrated: boolean;

  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
}

type AuthPersisted = Pick<AuthState, "user" | "tokens">;

export const AUTH_STORAGE_KEY = "zass.auth";

/**
 * The secrets are split across two keychain entries rather than stored as one
 * JSON blob.
 *
 * iOS rejects large keychain values — historically anything past roughly 2 KB —
 * and an access token and a refresh token serialised together with the user
 * object clears that on its own. One key per token keeps each write comfortably
 * small, and means a corrupt or evicted access token does not take the refresh
 * token with it.
 */
const ACCESS_KEY = "zass.auth.access";
const REFRESH_KEY = "zass.auth.refresh";

/**
 * Everything non-secret. The user object is the app's own copy of a profile the
 * API will re-serve on demand, so the keychain is the wrong place for it —
 * it is both larger than the keychain likes and not a credential.
 */
const META_KEY = "zass.auth.meta";

interface PersistedMeta {
  user: AuthUser | null;
  expiresIn: number;
  tokenType: string;
}

/**
 * Wipes every trace of a session.
 *
 * Deliberately tolerant of each individual failure: a partial clear that threw
 * halfway would leave a refresh token on the device after a sign-out.
 */
async function clearAll(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    AsyncStorage.removeItem(META_KEY),
  ]);
}

const authStorage: PersistStorage<AuthPersisted> = {
  getItem: async (): Promise<StorageValue<AuthPersisted> | null> => {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let rawMeta: string | null = null;

    try {
      [accessToken, refreshToken, rawMeta] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        AsyncStorage.getItem(META_KEY),
      ]);
    } catch {
      // The keychain can refuse a read outright — Android invalidates keys when
      // the device's biometric enrolment changes, for one. There is no session
      // to recover, so report none and let the user sign in again. Anything
      // else leaves `hydrated` false and the app stuck on its splash forever.
      return null;
    }

    // A session needs both halves. One without the other is a partial write or
    // a partial clear, and a refresh token with no access token would send the
    // app into a refresh on its very first request.
    if (accessToken === null || refreshToken === null || rawMeta === null) {
      if (accessToken !== null || refreshToken !== null || rawMeta !== null) {
        void clearAll();
      }

      return null;
    }

    let meta: PersistedMeta;

    try {
      meta = JSON.parse(rawMeta) as PersistedMeta;
    } catch {
      // Unparseable metadata is treated as no session, matching the web store:
      // a trip to the login screen beats an app that cannot start.
      void clearAll();
      return null;
    }

    return {
      state: {
        user: meta.user ?? null,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: meta.expiresIn,
          tokenType: meta.tokenType,
        },
      },
      version: 0,
    };
  },

  setItem: async (_name, value): Promise<void> => {
    const { user, tokens } = value.state;

    if (tokens === null) {
      await clearAll();
      return;
    }

    const meta: PersistedMeta = {
      user,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType,
    };

    try {
      // Sequential, not parallel: the access token is written last so a failure
      // partway through can never leave a *newer* access token paired with an
      // older refresh token. The reader rejects the incomplete pair either way.
      await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
      await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
      await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
    } catch {
      // The session stays live in memory for this launch rather than failing
      // the sign-in that produced it. The user signs in again next cold start.
    }
  },

  removeItem: async (): Promise<void> => {
    await clearAll();
  },
};

/**
 * The session, held outside React so the axios interceptor and the socket
 * singleton can read it without a hook.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      hydrated: false,

      setSession: (user, tokens) => set({ user, tokens }),
      setTokens: (tokens) => set({ tokens }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, tokens: null }),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: authStorage,
      partialize: (state) => ({ user: state.user, tokens: state.tokens }),
      onRehydrateStorage: () => (state, error) => {
        // `hydrated` flips on both paths. It is what every route guard and the
        // splash screen wait on, so leaving it false on an error would hang the
        // app on a blank screen with no way out but a reinstall.
        if (error !== undefined && error !== null) {
          useAuthStore.getState().setHydrated(true);
          return;
        }

        if (state !== undefined) {
          state.setHydrated(true);
          return;
        }

        queueMicrotask(() => {
          useAuthStore.getState().setHydrated(true);
        });
      },
    },
  ),
);

/** Non-reactive reads, for use outside React (api-client, socket). */
export const authSnapshot = {
  accessToken: (): string | null => useAuthStore.getState().tokens?.accessToken ?? null,
  refreshToken: (): string | null => useAuthStore.getState().tokens?.refreshToken ?? null,
  user: (): AuthUser | null => useAuthStore.getState().user,
};
