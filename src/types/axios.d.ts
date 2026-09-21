import "axios";

/**
 * Two private flags the API client threads through a request's lifetime.
 * Declared here rather than cast at each call site, so the compiler keeps
 * checking them.
 */
declare module "axios" {
  interface AxiosRequestConfig {
    /** Set once a request has been retried after a token refresh. */
    _retried?: boolean;
    /** Skip the Authorization header (login, register, refresh). */
    _anonymous?: boolean;
  }

  interface InternalAxiosRequestConfig {
    _retried?: boolean;
    _anonymous?: boolean;
  }
}
