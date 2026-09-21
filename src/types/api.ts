/**
 * The API's wire envelope.
 *
 * Verified against the backend's ResponseInterceptor and AllExceptionsFilter
 * rather than transcribed from prose — in particular `errorCode` is optional,
 * because a plain Nest HttpException (a bare 401 from login, say) is rendered
 * without one. Code that assumes it is always present will read `undefined`
 * exactly where it matters most.
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  /** Present only on paginated list endpoints. */
  meta?: PaginationMeta;
  requestId: string;
  timestamp: string;
}

export interface ApiErrorBody {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  /** Absent for errors that never passed through a DomainException. */
  errorCode?: string;
  /** Every failed constraint, on a validation failure. */
  details?: string[];
  path: string;
  requestId: string;
  timestamp: string;
}

/** A list response with its pagination block kept alongside the items. */
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Error codes the API actually emits, collected from the source.
 *
 * §0: branch on these, never on `message` text. `(string & {})` keeps the
 * union open so an unrecognised code from a newer API version still type-checks
 * while these stay autocompletable.
 */
export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_CONFLICT"
  | "BUSINESS_RULE_VIOLATION"
  | "FORBIDDEN_OPERATION"
  | "RECORD_NOT_FOUND"
  | "UNIQUE_CONSTRAINT_VIOLATION"
  | "FOREIGN_KEY_VIOLATION"
  | "NULL_CONSTRAINT_VIOLATION"
  | "VALUE_TOO_LONG"
  | "DATABASE_VALIDATION_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  // Synthesised client-side when the request never reached the API.
  | "NETWORK_ERROR"
  | (string & {});

/** Shared query shape for every list endpoint (PaginationQueryDto). */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}
