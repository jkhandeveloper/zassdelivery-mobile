import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { API_URL } from "@/lib/env";
import { useAuthStore } from "@/store/auth-store";
import type { ApiErrorBody, ApiErrorCode, ApiSuccess, Paginated } from "@/types/api";
import type { AuthResponse } from "@/types/auth";

/**
 * Ported from the web app's `src/lib/api-client.ts`.
 *
 * Kept deliberately line-for-line with the original so the two can be diffed
 * when the API changes. Only three things differ, each marked MOBILE below:
 * where the base URL comes from, the timeouts, and the offline message.
 */

const BASE_URL = API_URL;

/**
 * A failed API call, normalised.
 *
 * Every rejection from this module is an ApiError, so callers never have to
 * decide whether they are holding an AxiosError, a network failure or a parsed
 * envelope. Branch on `code` (§0), never on `message`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: string[];
  readonly requestId: string | null;
  readonly path: string | null;

  constructor(init: {
    message: string;
    status: number;
    code: ApiErrorCode;
    details?: string[];
    requestId?: string | null;
    path?: string | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.path = init.path ?? null;
  }

  /** The request never reached the API — offline, DNS, server down. */
  get isNetworkError(): boolean {
    return this.code === "NETWORK_ERROR";
  }

  get isValidationError(): boolean {
    return this.code === "VALIDATION_FAILED";
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiErrorBody> | undefined;

    if (error.response === undefined || body === undefined) {
      return new ApiError({
        // MOBILE: a phone drops off the network constantly, so this copy is
        // read far more often here than on the web. It names the two things the
        // user can actually check.
        message: "No connection to ZassDelivery. Check your mobile data or Wi-Fi.",
        status: 0,
        code: "NETWORK_ERROR",
      });
    }

    return new ApiError({
      message: body.message ?? "Something went wrong. Please try again.",
      status: error.response.status,
      // A bare HttpException carries no errorCode; fall back to the status so
      // callers always have something stable to branch on.
      code: body.errorCode ?? `HTTP_${error.response.status}`,
      details: body.details,
      requestId: body.requestId ?? null,
      path: body.path ?? null,
    });
  }

  return new ApiError({
    message: error instanceof Error ? error.message : "An unexpected error occurred.",
    status: 0,
    code: "INTERNAL_ERROR",
  });
}

/** Requests that must never trigger the refresh dance. */
const AUTH_FREE_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

/**
 * MOBILE: 30s rather than the web's 20s. A request on a congested cell network
 * routinely takes longer than one on a desktop connection, and a timeout the
 * user reads as "it failed" when the order in fact went through is the single
 * worst outcome in this app.
 */
const REQUEST_TIMEOUT = 30_000;

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  if (config._anonymous === true) {
    return config;
  }

  const token = useAuthStore.getState().tokens?.accessToken;

  if (token !== undefined && token !== null && token !== "") {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

/**
 * The single in-flight refresh.
 *
 * Serialising matters more here than in a typical app: the backend rotates
 * refresh tokens on every use and treats a *replayed* one as theft, revoking
 * the whole session family. Two concurrent 401s each posting the same refresh
 * token would therefore log the user out rather than renew them. Everyone
 * waits on one promise instead.
 *
 * MOBILE: and it matters more again here. Returning to the foreground after an
 * hour wakes every mounted screen's queries at once, so the burst of parallel
 * 401s this guards against is the *normal* case on a phone, not an edge one.
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().tokens?.refreshToken;

  if (refreshToken === undefined || refreshToken === null || refreshToken === "") {
    throw new ApiError({
      message: "Your session has expired. Please sign in again.",
      status: 401,
      code: "SESSION_EXPIRED",
    });
  }

  const response = await axios.post<ApiSuccess<AuthResponse>>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" }, timeout: REQUEST_TIMEOUT },
  );

  const { user, tokens } = response.data.data;
  useAuthStore.getState().setSession(user, tokens);

  return tokens.accessToken;
}

/** Called when the session is unrecoverable. Wired up by the auth provider. */
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

function loseSession(): void {
  useAuthStore.getState().clearSession();
  refreshInFlight = null;
  onSessionLost?.();
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    const status = error.response?.status;

    const isRefreshable =
      status === 401 &&
      config !== undefined &&
      config._retried !== true &&
      config._anonymous !== true &&
      !AUTH_FREE_PATHS.some((path) => (config.url ?? "").includes(path));

    if (!isRefreshable) {
      return Promise.reject(toApiError(error));
    }

    config._retried = true;

    try {
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });

      const accessToken = await refreshInFlight;
      config.headers.set("Authorization", `Bearer ${accessToken}`);

      return await apiClient.request(config);
    } catch {
      // §0: a refresh failure is a full logout, never a silent retry loop.
      loseSession();

      return Promise.reject(
        new ApiError({
          message: "Your session has expired. Please sign in again.",
          status: 401,
          code: "SESSION_EXPIRED",
        }),
      );
    }
  },
);

// ── Typed helpers ────────────────────────────────────────────
// These unwrap the envelope so callers deal in domain data, not `data.data`.

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.get<ApiSuccess<T>>(url, config);
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/** For list endpoints: keeps `meta` alongside the items instead of dropping it. */
export async function apiGetPaginated<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<Paginated<T>> {
  try {
    const response = await apiClient.get<ApiSuccess<T[]>>(url, config);
    const { data, meta } = response.data;

    return {
      items: data,
      meta: meta ?? {
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    };
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const response = await apiClient.post<ApiSuccess<T>>(url, body, config);
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const response = await apiClient.patch<ApiSuccess<T>>(url, body, config);
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPut<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const response = await apiClient.put<ApiSuccess<T>>(url, body, config);
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/**
 * A multipart upload.
 *
 * Kept apart from `apiPost` because the JSON content type has to be dropped so
 * the platform can set the multipart boundary itself, the default timeout is
 * far too short for a photo on a mobile connection, and a progress callback is
 * worth having when the wait is measured in seconds.
 *
 * MOBILE: React Native's `FormData` takes `{ uri, name, type }` for a file
 * rather than a `Blob` — see `lib/upload.ts` for the helper that builds one
 * from an image picker result.
 */
export async function apiUpload<T>(
  url: string,
  form: FormData,
  options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
): Promise<T> {
  try {
    const response = await apiClient.post<ApiSuccess<T>>(url, form, {
      // Undefined, not deleted: the platform networking layer then sets
      // `multipart/form-data` along with the boundary. A hand-written value
      // would have no boundary at all and the upload would fail server-side.
      headers: { "Content-Type": undefined },
      timeout: 120_000,
      signal: options?.signal,
      onUploadProgress: (event) => {
        if (options?.onProgress === undefined || event.total === undefined) return;
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });

    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.delete<ApiSuccess<T>>(url, config);
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/** Requests made before sign-in (login, register, refresh). */
export const anonymous: AxiosRequestConfig = { _anonymous: true };

export { toApiError };
