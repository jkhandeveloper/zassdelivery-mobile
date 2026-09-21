import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme, useColorScheme } from "nativewind";
import * as React from "react";

/**
 * Light / dark / follow-the-system, persisted.
 *
 * The web app delegates this to `next-themes`. There is no equivalent on a
 * device, so the same contract is rebuilt on NativeWind's `colorScheme`: a user
 * who picks a theme beats their OS setting, and that choice survives a restart.
 *
 * The stored value is read before the first paint is unblocked (see the root
 * layout), which is what stops the app flashing the light theme for a frame on
 * a dark-theme user's phone.
 */

type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "zass.theme";

interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually on screen once "system" is resolved. */
  resolved: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/**
 * Applies the stored preference.
 *
 * Exported so the root layout can await it before hiding the splash screen,
 * rather than having the provider apply it in an effect after first paint.
 */
export async function loadStoredTheme(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);

    if (stored === "light" || stored === "dark" || stored === "system") {
      colorScheme.set(stored);
    }
  } catch {
    // An unreadable preference just means the system theme, which is the
    // default anyway. Never worth failing a launch over.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme: active } = useColorScheme();
  const [preference, setPreferenceState] = React.useState<ThemePreference>("system");

  React.useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // Keep "system".
      });
  }, []);

  const setPreference = React.useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    colorScheme.set(next);

    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // The theme still changed for this launch; it just will not be
      // remembered. Not worth surfacing to the user.
    });
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ preference, resolved: active ?? "light", setPreference }),
    [preference, active, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);

  if (context === null) {
    throw new Error("useTheme must be used inside <ThemeProvider>.");
  }

  return context;
}
