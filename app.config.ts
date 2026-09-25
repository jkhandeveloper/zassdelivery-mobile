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

/**
 * Dev and preview builds talk to an API on the LAN over plain http://, which
 * release builds on both platforms refuse by default — every request fails
 * as a generic network error. Production must only ever use HTTPS, so it
 * keeps the platform default.
 */
const ALLOW_CLEARTEXT = VARIANT !== "production";

/**
 * Not a secret — it identifies the project, not the account. Written by
 * `eas init`; paste it here or into `.env` and the `eas env` environments.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || undefined;

/** Where the bundled typefaces come from; see the expo-font plugin below. */
const FONTS = "./node_modules/@expo-google-fonts";

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
      ...(ALLOW_CLEARTEXT && {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsLocalNetworking: true,
        },
      }),
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
        // Android has no system map; react-native-maps needs a Google key.
        // Without one, mounting a MapView throws and takes the app down, so
        // DeliveryMap checks `extra.googleMapsAndroid` and draws a map-less
        // route card instead.
        apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? "",
      },
    },
  },

  plugins: [
    "./plugins/with-android-build-fixes",
    "expo-router",
    "expo-secure-store",
    [
      // Embedded at build time rather than loaded with useFonts(), so the first
      // frame already has them — no splash delay and no system-font flash.
      // Android gets real weighted families (XML fonts), so `font-semibold` on
      // `font-sans` selects Inter SemiBold instead of a synthesised bold.
      "expo-font",
      {
        android: {
          fonts: [
            {
              fontFamily: "Inter",
              fontDefinitions: [
                {
                  path: `${FONTS}/inter/400Regular/Inter_400Regular.ttf`,
                  weight: 400,
                },
                {
                  path: `${FONTS}/inter/500Medium/Inter_500Medium.ttf`,
                  weight: 500,
                },
                {
                  path: `${FONTS}/inter/600SemiBold/Inter_600SemiBold.ttf`,
                  weight: 600,
                },
                {
                  path: `${FONTS}/inter/700Bold/Inter_700Bold.ttf`,
                  weight: 700,
                },
              ],
            },
            {
              fontFamily: "PlusJakartaSans",
              fontDefinitions: [
                {
                  path: `${FONTS}/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf`,
                  weight: 700,
                },
                {
                  path: `${FONTS}/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf`,
                  weight: 800,
                },
              ],
            },
          ],
        },
        ios: {
          fonts: [
            `${FONTS}/inter/400Regular/Inter_400Regular.ttf`,
            `${FONTS}/inter/500Medium/Inter_500Medium.ttf`,
            `${FONTS}/inter/600SemiBold/Inter_600SemiBold.ttf`,
            `${FONTS}/inter/700Bold/Inter_700Bold.ttf`,
            `${FONTS}/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf`,
            `${FONTS}/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf`,
          ],
        },
      },
    ],
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
          usesCleartextTraffic: ALLOW_CLEARTEXT,
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
    // EAS Update's endpoint is always u.expo.dev/<projectId>.
    url:
      process.env.EXPO_UPDATE_URL ||
      (EAS_PROJECT_ID ? `https://u.expo.dev/${EAS_PROJECT_ID}` : undefined),
  },
  // Every build with the same runtime version can accept the same OTA update.
  // "appVersion" means a native change forces a new binary rather than
  // shipping JS that calls into native code the installed app does not have.
  runtimeVersion: { policy: "appVersion" },

  extra: {
    variant: VARIANT,
    // Read by DeliveryMap. Mounting a Google MapView on Android without a key
    // is not a blank map but a native RuntimeException that kills the app, so
    // the JS has to know at runtime whether one was compiled in.
    googleMapsAndroid: Boolean(process.env.GOOGLE_MAPS_ANDROID_KEY),
    eas: { projectId: EAS_PROJECT_ID },
  },
});
