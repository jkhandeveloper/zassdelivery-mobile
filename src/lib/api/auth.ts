import { anonymous, apiGet, apiPost } from "@/lib/api-client";
import type { AuthResponse, AuthUser, SelfServiceRole } from "@/types/auth";

/**
 * POST /auth/*, matching the backend DTOs exactly.
 *
 * Note the phone field: the API normalises 03XXXXXXXXX, 92XXXXXXXXXX and
 * +923XXXXXXXXX into E.164 itself, so the form may accept any of them.
 */

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  phone: string;
  fullName: string;
  /** At least 8 characters, with one letter and one digit. */
  password: string;
  email?: string;
  /** Defaults to CUSTOMER server-side. */
  role?: SelfServiceRole;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface LogoutPayload {
  refreshToken?: string;
  allDevices?: boolean;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiPost<AuthResponse>("/auth/login", payload, anonymous),

  register: (payload: RegisterPayload) =>
    apiPost<AuthResponse>("/auth/register", payload, anonymous),

  /** The source of truth for role and permissions (§3) — read fresh, not from the token. */
  me: () => apiGet<AuthUser>("/auth/me"),

  logout: (payload: LogoutPayload = {}) =>
    apiPost<{ message: string }>("/auth/logout", payload),

  /** Signs out every *other* session; this one stays active. */
  changePassword: (payload: ChangePasswordPayload) =>
    apiPost<{ message: string }>("/auth/change-password", payload),
};
