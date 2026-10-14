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
  /** The six digits from `sendOtp({ purpose: "register" })`, when verification is on. */
  otpCode?: string;
}

export type OtpPurpose = "register" | "login";

/** GET /auth/otp/config — whether this deployment texts verification codes. */
export interface OtpSettings {
  enabled: boolean;
  codeLength: number;
  expiresInSeconds: number;
  /** The wait before another code can be sent to the same number. */
  resendAfterSeconds: number;
}

export interface SendOtpPayload {
  phone: string;
  purpose: OtpPurpose;
}

export interface OtpLoginPayload {
  phone: string;
  code: string;
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

  /** Whether sign-up needs a texted code, and whether SMS sign-in is offered. */
  otpConfig: () => apiGet<OtpSettings>("/auth/otp/config", anonymous),

  /** Texts a six-digit code. One a minute per number, a few a day. */
  sendOtp: (payload: SendOtpPayload) =>
    apiPost<OtpSettings>("/auth/otp/send", payload, anonymous),

  /** Signs in with a texted code instead of a password. */
  loginWithOtp: (payload: OtpLoginPayload) =>
    apiPost<AuthResponse>("/auth/login/otp", payload, anonymous),

  /** The source of truth for role and permissions (§3) — read fresh, not from the token. */
  me: () => apiGet<AuthUser>("/auth/me"),

  logout: (payload: LogoutPayload = {}) =>
    apiPost<{ message: string }>("/auth/logout", payload),

  /** Signs out every *other* session; this one stays active. */
  changePassword: (payload: ChangePasswordPayload) =>
    apiPost<{ message: string }>("/auth/change-password", payload),
};
