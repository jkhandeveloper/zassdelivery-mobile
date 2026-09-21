/**
 * Auth types, mirroring the backend's AuthUserDto / AuthTokensDto and the
 * Prisma UserRole / UserStatus enums exactly.
 */

export const UserRole = {
  CUSTOMER: "CUSTOMER",
  RIDER: "RIDER",
  VENDOR_OWNER: "VENDOR_OWNER",
  VENDOR_STAFF: "VENDOR_STAFF",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  /** Account created, phone not yet verified. Cannot authenticate. */
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/** The roles self-service registration accepts (RegisterDto). */
export const SELF_SERVICE_ROLES = [
  UserRole.CUSTOMER,
  UserRole.RIDER,
  UserRole.VENDOR_OWNER,
] as const;

export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export interface AuthUser {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  isPhoneVerified: boolean;
  /** Flattened `resource.action` codes. Gate admin actions on these, not role. */
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  tokenType: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

/** Which route group a role lands in after signing in (§3). */
export function homeRouteForRole(user: Pick<AuthUser, "role" | "permissions">): string {
  switch (user.role) {
    case UserRole.RIDER:
      return "/rider";
    case UserRole.VENDOR_OWNER:
    case UserRole.VENDOR_STAFF:
      return "/vendor";
    case UserRole.ADMIN:
    case UserRole.SUPER_ADMIN:
      return "/admin";
    default:
      return "/";
  }
}

export function isStaffRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export function isVendorRole(role: UserRole): boolean {
  return role === UserRole.VENDOR_OWNER || role === UserRole.VENDOR_STAFF;
}
