import Constants from "expo-constants";

/**
 * Where the API lives, resolved for a device rather than a browser tab.
 *
 * The web app can say `http://localhost:3002` because the browser and the API
 * share a host. A phone cannot: `localhost` on the handset is the handset. So
 * an explicit `EXPO_PUBLIC_API_URL` wins, and when there isn't one we fall back
 * to the machine already serving the JS bundle — which is by definition
 * reachable from the device, because that is how the app got there.
 *
 * That fallback is a development convenience only. Release builds have no dev
 * server, so a missing `EXPO_PUBLIC_API_URL` there is a build error, not
 * something to paper over with a localhost that can never work.
 */

/** The API port on the dev machine. The NestJS server must bind 0.0.0.0. */
const DEV_API_PORT = "3002";

/**
 * The LAN address of the machine running `expo start`, e.g. "192.168.1.20".
 *
 * `hostUri` is "host:port" for the Metro server. Loopback values are rejected
 * rather than returned: a tunnel or a web preview reports localhost, and
 * handing that to a phone produces a connection error with no hint as to why.
 */
function devHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? null;

  if (hostUri === null || hostUri === "") {
    return null;
  }

  const host = hostUri.split(":")[0];

  if (host === undefined || host === "" || host === "localhost" || host === "127.0.0.1") {
    return null;
  }

  return host;
}

function resolveOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL;

  if (explicit !== undefined && explicit !== "") {
    return explicit.replace(/\/+$/, "");
  }

  const host = devHost();

  if (host !== null) {
    return `http://${host}:${DEV_API_PORT}`;
  }

  throw new Error(
    "No API host. Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL in .env " +
      "(see .env.example) — there is no dev server to infer one from.",
  );
}

/** Socket.IO origin. The client appends the /realtime namespace itself. */
export const SOCKET_URL: string = resolveOrigin();

/** Every API route in the app is relative to this. */
export const API_URL: string = (() => {
  const explicit = process.env.EXPO_PUBLIC_API_URL;

  if (explicit !== undefined && explicit !== "") {
    return explicit.replace(/\/+$/, "");
  }

  return `${SOCKET_URL}/api/v1`;
})();

export const IS_DEV: boolean = __DEV__;
