import { UserRole, type AuthUser } from "@/types/auth";

/**
 * Where a role lands after signing in.
 *
 * The web app's `homeRouteForRole` cannot be reused as-is: it sends an
 * administrator to `/admin`, and this app has no admin portal. That is a
 * deliberate scope decision — the admin surface is a sidebar dashboard whose
 * content is almost entirely unbuilt on the web — but it leaves a real case to
 * handle, because an administrator can still sign in here with valid
 * credentials. Routing them to a screen that does not exist would drop them on
 * the router's 404, which reads like a broken app rather than a decision.
 *
 * So administrators get an explicit screen telling them where their tools are.
 */
export const MOBILE_ROUTES = {
  customerHome: "/",
  riderHome: "/rider",
  vendorHome: "/vendor",
  adminUnavailable: "/admin-unavailable",
  login: "/login",
} as const;

export function mobileHomeRouteForRole(user: Pick<AuthUser, "role">): string {
  switch (user.role) {
    case UserRole.RIDER:
      return MOBILE_ROUTES.riderHome;
    case UserRole.VENDOR_OWNER:
    case UserRole.VENDOR_STAFF:
      return MOBILE_ROUTES.vendorHome;
    case UserRole.ADMIN:
    case UserRole.SUPER_ADMIN:
      return MOBILE_ROUTES.adminUnavailable;
    default:
      return MOBILE_ROUTES.customerHome;
  }
}

/**
 * Only in-app paths are honoured for a post-login redirect.
 *
 * Carried over from the web app, where an unchecked `next` is an open redirect.
 * The threat is different here — there is no other origin to be sent to — but
 * the check still earns its place: a `next` value from a deep link or a push
 * notification payload is attacker-influenceable input, and feeding a
 * malformed one to the router throws rather than navigating.
 */
export function safeNextPath(next: string | string[] | undefined): string | null {
  const value = Array.isArray(next) ? next[0] : next;

  if (value === undefined || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}
