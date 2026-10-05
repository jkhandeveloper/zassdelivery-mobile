import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { riderApi } from "@/lib/api/riders";
import { reportRiderLocation } from "@/lib/socket";

/**
 * A rider's position, reported while they are carrying an order.
 *
 * This is the source of the moving dot the customer watches, so the design goal
 * is "keeps reporting even when the rider pockets the phone", not "reports as
 * often as possible".
 *
 * Two transports, because they fail in opposite situations:
 *
 * - **Foreground: the socket.** Lowest latency and no HTTP overhead per fix,
 *   and the gateway resolves which order the position belongs to from the
 *   rider's own accepted run, so nothing here has to name one.
 *
 * - **Background: `PUT /riders/me/location`.** A backgrounded app is frozen by
 *   both OSes and the websocket goes with it, so a socket emit from a
 *   background task is silently dropped. A plain HTTP request from the task is
 *   not — it is the only one of the two that actually survives the screen
 *   turning off, which is most of a delivery.
 *
 * Both write to the same place server-side.
 */

/** Must be defined at module scope, before any `startLocationUpdatesAsync`. */
export const RIDER_LOCATION_TASK = "zass.rider.location";

/**
 * How often to sample.
 *
 * 15s / 50m is a deliberate compromise. Tighter than this and a rider's battery
 * visibly suffers across an eight-hour shift, which is the fastest way to have
 * them disable location entirely and break tracking for every customer they
 * serve. Looser and the customer's marker jumps far enough between fixes that
 * the interpolation in `DeliveryMap` cannot hide it.
 */
const SAMPLE_INTERVAL_MS = 15_000;
const SAMPLE_DISTANCE_M = 50;

interface LocationTaskData {
  locations: Location.LocationObject[];
}

/**
 * The background task.
 *
 * Registered unconditionally at import time: the OS may relaunch the app
 * directly into this task after killing it, and a task defined inside a
 * component or an `if` would not exist yet when that happens.
 */
TaskManager.defineTask(RIDER_LOCATION_TASK, async ({ data, error }) => {
  if (error !== null) {
    // Nothing actionable and nowhere to show it — the app may not even be on
    // screen. Dropping the fix is correct; the next one is seconds away.
    return;
  }

  const { locations } = (data ?? { locations: [] }) as LocationTaskData;

  // The OS batches fixes and may hand over several at once after a gap. Only
  // the newest is worth sending: a position is only interesting while it is
  // current, and posting a backlog would draw the rider retracing their route.
  const latest = locations.at(-1);

  if (latest === undefined) {
    return;
  }

  try {
    await riderApi.updateLocation({
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
    });
  } catch {
    // Offline, or the token needs a refresh the interceptor will handle on the
    // next call. Either way this fix is already stale; do not retry it.
  }
});

export type LocationPermission = "granted" | "foreground-only" | "denied";

/**
 * Asks for location, foreground first and background second.
 *
 * The two-step order is required on both platforms and is also the decent way
 * round: Android refuses a background request that was not preceded by a
 * granted foreground one, and asking for "always" before the rider has seen
 * what the app does with it is how you get a flat refusal you cannot re-ask.
 *
 * `foreground-only` is a genuinely usable state, not a failure — tracking works
 * while the rider has the app open. It is worth telling them what they lose.
 */
export async function requestLocationPermission(): Promise<LocationPermission> {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (!foreground.granted) {
    return "denied";
  }

  const background = await Location.requestBackgroundPermissionsAsync();

  return background.granted ? "granted" : "foreground-only";
}

/**
 * Asks for location while the app is open, and nothing more.
 *
 * What going online needs. Dispatch ranks riders by distance to the restaurant,
 * so a rider it cannot locate is offered a run only after everyone it can —
 * which in practice means never. "All the time" access is a bigger ask and is
 * left until there is a run to track.
 */
export async function requestForegroundLocation(): Promise<boolean> {
  try {
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Where the rider is right now, or null when that cannot be had quickly.
 *
 * Never prompts, and never waits long: this runs on the way to going online and
 * on a timer afterwards, and neither is worth holding up for a GPS fix indoors.
 * A recent last-known position is taken first because it is instant.
 */
export async function currentRiderCoordinates(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) {
      return null;
    }

    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
      ]));

    return position === null
      ? null
      : { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}

/** How often an online rider with no run tells dispatch where they are. */
const PRESENCE_INTERVAL_MS = 60_000;

/**
 * Keeps an online rider's position fresh while they wait for work.
 *
 * Over HTTP on a timer rather than the socket watcher used during a run, for
 * two reasons. A rider waiting outside a restaurant is not moving, so a
 * distance-filtered watcher never fires — and the API treats a position older
 * than a few minutes as unknown. And once a minute is plenty for "which rider
 * is nearest"; it is the customer's map during a run that needs every fix.
 *
 * Returns its own stop function.
 */
export function startPresenceReporting(): () => void {
  let stopped = false;

  const report = async () => {
    const coordinates = await currentRiderCoordinates();

    if (stopped || coordinates === null) {
      return;
    }

    try {
      await riderApi.updateLocation(coordinates);
    } catch {
      // Offline for a moment; the next tick is a minute away.
    }
  };

  void report();
  const timer = setInterval(() => void report(), PRESENCE_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** Whether background reporting is currently running. */
export async function isReportingInBackground(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Starts background reporting.
 *
 * Safe to call when it is already running — the OS treats a second start as a
 * reconfiguration rather than an error, and checking first is still worth it to
 * avoid resetting the sampling schedule mid-delivery.
 */
export async function startBackgroundReporting(): Promise<void> {
  if (await isReportingInBackground()) {
    return;
  }

  await Location.startLocationUpdatesAsync(RIDER_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: SAMPLE_INTERVAL_MS,
    distanceInterval: SAMPLE_DISTANCE_M,
    // Android kills a plain background service within minutes. A foreground
    // service with a visible notification is the only thing that survives a
    // whole delivery, and Android requires the notification to be honest about
    // what is happening — which is also the right thing to show a rider.
    foregroundService: {
      notificationTitle: "ZassDeliver is sharing your location",
      notificationBody: "Your customer can see where their order is.",
      notificationColor: "#0E7490",
    },
    // iOS: without this the OS silently stops updates when the app is
    // suspended, rather than waking it.
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
  });
}

/**
 * Stops background reporting.
 *
 * Called when the run ends or the rider goes offline. Leaving it running is
 * both a battery drain and a privacy problem: a rider who is not carrying
 * anything has not agreed to be followed.
 */
export async function stopBackgroundReporting(): Promise<void> {
  if (!(await isReportingInBackground())) {
    return;
  }

  try {
    await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK);
  } catch {
    // Already stopped, or the task was never registered in this process.
  }
}

/**
 * Foreground watching, over the socket.
 *
 * Returns its own unsubscribe function. Kept separate from the background task
 * so a screen can watch while it is open without the rider having granted
 * background permission at all.
 */
export async function watchInForeground(
  onFix?: (coords: { latitude: number; longitude: number }) => void,
): Promise<() => void> {
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: SAMPLE_INTERVAL_MS,
      distanceInterval: SAMPLE_DISTANCE_M,
    },
    (position) => {
      const { latitude, longitude } = position.coords;

      // Fire-and-forget by design: a position that could not be delivered is
      // worth less than the one arriving fifteen seconds later.
      reportRiderLocation(latitude, longitude);
      onFix?.({ latitude, longitude });
    },
  );

  return () => subscription.remove();
}
