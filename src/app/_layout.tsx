import "@/global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProviders, loadStoredTheme, useAuth, useTheme } from "@/components/providers";
import { useSceneStyle } from "@/lib/palette";

// Held until the session has been read back from the keychain. See SplashGate.
void SplashScreen.preventAutoHideAsync();

/**
 * Keeps the splash screen up until the app knows who the user is.
 *
 * This is the piece the web app has no equivalent of. There, `localStorage` is
 * read synchronously, so the first render already knows whether someone is
 * signed in. Here the keychain read is asynchronous, so for the first frames
 * `user` is null for a signed-in user exactly as it is for a signed-out one.
 *
 * Rendering during that window is what causes the classic bug: the route guard
 * sees no user, sends a signed-in rider to the login screen, and the session
 * arrives a moment later. Holding the splash until `isReady` means no guard
 * ever runs on an unknown session.
 */
function SplashGate({ children }: { children: React.ReactNode }) {
  const { isReady } = useAuth();
  const [themeLoaded, setThemeLoaded] = React.useState(false);

  React.useEffect(() => {
    void loadStoredTheme().finally(() => setThemeLoaded(true));
  }, []);

  React.useEffect(() => {
    if (isReady && themeLoaded) {
      // Failure here is not actionable — the splash either went away or it did
      // not, and throwing would take the app down over cosmetics.
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady, themeLoaded]);

  if (!isReady || !themeLoaded) {
    return null;
  }

  return <>{children}</>;
}

/** Inside the providers, so the scene background follows the resolved theme. */
function RootStack() {
  const sceneStyle = useSceneStyle();

  return (
    // Headers are off globally: each portal's layout draws its own, so a
    // default header would stack a second bar above every screen.
    <Stack screenOptions={{ headerShown: false, contentStyle: sceneStyle }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(rider)" />
      <Stack.Screen name="(vendor)" />
    </Stack>
  );
}

/** Inside the providers, so the bar follows the resolved theme. */
function ThemedStatusBar() {
  const { resolved } = useTheme();

  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <ThemedStatusBar />
          <SplashGate>
            <RootStack />
          </SplashGate>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
