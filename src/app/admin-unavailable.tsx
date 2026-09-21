import { useRouter } from "expo-router";
import { Monitor } from "lucide-react-native";
import * as React from "react";
import { Linking, View } from "react-native";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Body, Heading, Screen } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

/**
 * Where an administrator lands after signing in.
 *
 * Not a placeholder — a decision. The admin surface is a sidebar dashboard
 * built for a wide screen (dispatch boards, tables of riders, reports), and on
 * the web itself most of it is still unbuilt. Shrinking that onto a phone would
 * be worse than not having it.
 *
 * But an administrator can still sign in here with valid credentials, and
 * `mobileHomeRouteForRole` sends them to this route rather than to a screen
 * that does not exist — a router 404 reads like a broken app instead of a
 * choice. So this screen says plainly where their tools are, and gives them a
 * way out that is not force-quitting.
 */
export default function AdminUnavailableScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const firstName = user?.fullName.split(" ")[0];

  return (
    <Screen scroll contentContainerClassName="justify-center gap-4">
      <View className="items-center">
        <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
          <Monitor size={26} color="#0E7490" />
        </View>
      </View>

      <Heading level={2} className="text-center">
        {firstName !== undefined ? `Hello, ${firstName}` : "Admin tools are on the web"}
      </Heading>

      <Body muted className="text-center">
        The admin dashboard — dispatch, restaurants, riders, payments and billing — runs on the
        web, where there is room for it. Sign in at the ZassDelivery dashboard on a computer.
      </Body>

      <Button
        fullWidth
        onPress={() => {
          void Linking.openURL("https://zassdeliver.com/admin").catch(() =>
            toast.error("Couldn't open the dashboard", {
              description: "Go to zassdeliver.com/admin in a browser.",
            }),
          );
        }}
      >
        Open the web dashboard
      </Button>

      {/*
        An administrator is very often also a customer. Letting them browse the
        storefront beats leaving them on a dead end — and the customer screens
        are public, so nothing here is a privilege escalation.
      */}
      <Button variant="outline" fullWidth onPress={() => router.replace("/")}>
        Browse as a customer
      </Button>

      <Button variant="ghost" fullWidth onPress={() => void logout()}>
        Sign out
      </Button>
    </Screen>
  );
}
