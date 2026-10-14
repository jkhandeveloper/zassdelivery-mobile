import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { notificationApi } from "@/lib/api/notifications";
import { getRealtimeSnapshot } from "@/lib/socket";
import { DevicePlatform } from "@/types/enums";

/**
 * Push notifications for a backgrounded or closed app.
 *
 * The API sends through Firebase Cloud Messaging, which costs nothing at any
 * volume, and addresses each phone by its *native* FCM registration token — not
 * an Expo push token, which would route every message through Expo's service
 * and is not what the API's sender speaks. So this asks the OS for the device
 * token directly and hands it to `POST /notifications/devices`.
 *
 * Android only for now. On iOS the device token is an APNs token, which FCM
 * cannot deliver to as-is; registering it would only give the API an address
 * that fails on the first send.
 *
 * Nothing here throws. Push is a convenience on top of the in-app record and
 * the socket: a build without Firebase configured, an emulator without Play
 * services or a user who declines the prompt all leave an app that works, just
 * one that is quiet while closed.
 */

/** Must match `channelId` in the API's FCM payload, or Android drops to a default. */
const CHANNEL_ID = "zass_default";

const DEVICE_ID_KEY = "zass.push.device-id";

/** The token this installation last registered, so sign-out can retire it. */
let registeredToken: string | null = null;

/**
 * What the OS does with a push that arrives while the app is open.
 *
 * The socket already delivers the same notification as an in-app toast, so a
 * banner on top of it would announce everything twice. The banner is kept for
 * the moments the socket is down — a rider on a patchy connection must still
 * hear about an offer — and the notification always lands in the tray.
 */
Notifications.setNotificationHandler({
  handleNotification: () => {
    const live = getRealtimeSnapshot().state === "connected";

    return Promise.resolve({
      shouldShowBanner: !live,
      shouldShowList: true,
      shouldPlaySound: !live,
      shouldSetBadge: false,
    });
  },
});

/**
 * A stable id for this installation.
 *
 * Firebase rotates tokens on its own schedule; sending the same id each time
 * lets the API replace the old token rather than keep pushing at a dead one.
 */
async function installationId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (stored !== null) {
    return stored;
  }

  const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);

  return created;
}

async function sendToken(token: string): Promise<void> {
  await notificationApi.registerDevice({
    token,
    platform: DevicePlatform.ANDROID,
    deviceId: await installationId(),
    ...(Device.modelName !== null && { deviceName: Device.modelName }),
    ...(Constants.expoConfig?.version !== undefined && {
      appVersion: Constants.expoConfig.version,
    }),
  });

  registeredToken = token;
}

/**
 * Registers this phone for the signed-in user.
 *
 * Called on every sign-in and every cold start with a session, not once: the
 * token rotates, and the same phone may now belong to a different account.
 * Returns whether the phone ended up registered.
 */
export async function registerForPush(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return false;
  }

  try {
    // The channel has to exist before Android 13 will show the permission
    // prompt at all, and before the first push can be displayed.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Orders and deliveries",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });

    const current = await Notifications.getPermissionsAsync();
    const permission =
      current.granted || !current.canAskAgain
        ? current
        : await Notifications.requestPermissionsAsync();

    if (!permission.granted) {
      return false;
    }

    // Throws when the build carries no google-services.json — a development
    // build made before Firebase was set up, say. That is "push is off", not
    // an error worth showing anyone.
    const token = await Notifications.getDevicePushTokenAsync();

    if (typeof token.data !== "string") {
      return false;
    }

    await sendToken(token.data);

    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("Push registration skipped:", (error as Error).message);
    }

    return false;
  }
}

/** Keeps the API current when Firebase rotates the token mid-session. */
export function watchPushToken(): () => void {
  if (Platform.OS !== "android") {
    return () => {};
  }

  const subscription = Notifications.addPushTokenListener((token) => {
    if (typeof token.data === "string") {
      void sendToken(token.data).catch(() => {});
    }
  });

  return () => subscription.remove();
}

/**
 * Stops pushes to this phone for the account being signed out.
 *
 * Has to run while the session is still valid — the endpoint is authenticated —
 * so sign-out calls it before giving up its tokens. Best-effort: a failure
 * here is repaired the next time anyone signs in on the phone, when the token
 * moves to their account.
 */
export async function unregisterFromPush(): Promise<void> {
  const token = registeredToken;

  if (token === null) {
    return;
  }

  registeredToken = null;

  try {
    await notificationApi.unregisterDevice({ token });
  } catch {
    // See above.
  }
}
