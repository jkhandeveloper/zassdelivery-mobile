import { LogOut } from "lucide-react-native";
import * as React from "react";
import { Alert, Pressable } from "react-native";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";

/** The confirm-then-sign-out both buttons below share. */
function useConfirmSignOut(): () => void {
  const { logout } = useAuth();

  return React.useCallback(() => {
    Alert.alert("Sign out?", "You'll need your phone number and password to sign back in.", [
      { text: "Stay signed in", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);
  }, [logout]);
}

/**
 * Sign-out for the rider and vendor portals, sitting in the corner of their
 * hero. Customers sign out from Profile; the portals had no way out at all,
 * which left a shared kitchen tablet or a rider's borrowed phone stuck on one
 * account.
 */
export function HeroSignOut() {
  const confirm = useConfirmSignOut();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      hitSlop={8}
      onPress={confirm}
      className="h-11 w-11 items-center justify-center rounded-full"
      style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
    >
      <LogOut size={20} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * The same, as a plain button for the portal gates — "awaiting approval",
 * "no restaurant attached" and the rest. Those replace the dashboard, so
 * without this an account stuck in one of them had no way to leave it.
 */
export function GateSignOut() {
  const confirm = useConfirmSignOut();

  return (
    <Button variant="ghost" fullWidth onPress={confirm}>
      Sign out
    </Button>
  );
}
