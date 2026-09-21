import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic app config.
 *
 * TypeScript rather than `app.json` because three things have to come from the
 * environment: the Google Maps key (a secret that must not be committed), the
 * bundle identifier (so a development build can sit on the same phone as the
 * store build), and the API URL (which differs per build profile).
 *
 * `EAS_BUILD_PROFILE` is set by EAS during a cloud build and is absent locally,
 * which is what makes "development" the right default.
 */

type Variant = "development" | "preview" | "production";

const VARIANT = (process.env.EAS_BUILD_PROFILE ?? "development") as Variant;

/**
 * A separate identifier per variant, so a tester can hold the production app
 * and a preview build at once. Without this, installing a preview replaces the
 * real app on the device — and takes its data with it.
 */
const IDENTIFIERS: Record<Variant, { id: string; name: string }> = {
  development: { id: "com.zassdeliver.app.dev", name: "ZassDeliver (Dev)" },
  preview: { id: "com.zassdeliver.app.preview", name: "ZassDeliver (Preview)" },
  production: { id: "com.zassdeliver.app", name: "ZassDeliver" },
};

const { id: bundleId, name: appName } = IDENTIFIERS[VARIANT];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName,
  slug: "zassdeliver",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  // Deep links: zassdeliver://order/<id>. Kept stable across variants so a
  // link in an SMS or a push notification resolves on any build.
  scheme: "zassdeliver",
  userInterfaceStyle: "automatic",
  // No `newArchEnabled`: from SDK 57 the New Architecture is the only one, so
  // the flag was dropped from the schema rather than defaulted.

  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      // Pakistan-facing app; phone numbers and prices are formatted en-PK.
      CFBundleAllowMixedLocalizations: true,
      // A rider's run has to keep reporting while the screen is off.
      UIBackgroundModes: ["location", "remote-notification"],
    },
  },

  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: "#0A1622",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // No `edgeToEdgeEnabled` here: as of SDK 54 edge-to-edge is always on for
    // Android and the opt-in flag was removed from the config schema.
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "CAMERA",
      "POST_NOTIFICATIONS",
      "VIBRATE",
    ],
    config: {
      googleMaps: {
        // Android has no system map; react-native-maps needs a Google key or
        // the map renders as a blank grey grid with no error.
        apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? "",
      },
    },
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0A1622",
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
      },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "ZassDeliver shares your location with the customer while you are on a delivery.",
        locationWhenInUsePermission:
          "ZassDeliver uses your location to show restaurants that deliver to you.",
        // Riders only. The customer and vendor apps never request this.
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "ZassDeliver uses the camera to scan payment QR codes.",
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "ZassDeliver uses your photos for your profile picture and menu images.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/android-icon-monochrome.png",
        color: "#22D3EE",
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          // Matches the SDK installed in WSL (see ROADMAP Phase 0).
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          minSdkVersion: 24,
        },
        // 16.4 is the floor SDK 57 enforces; anything lower is rejected at
        // config time. It drops iOS 15, which is no longer a meaningful share.
        ios: { deploymentTarget: "16.4" },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  updates: {
    // Set once `eas update:configure` has run.
    url: process.env.EXPO_UPDATE_URL,
  },
  // Every build with the same runtime version can accept the same OTA update.
  // "appVersion" means a native change forces a new binary rather than
  // shipping JS that calls into native code the installed app does not have.
  runtimeVersion: { policy: "appVersion" },

  extra: {
    variant: VARIANT,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
