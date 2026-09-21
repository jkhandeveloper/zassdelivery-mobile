import { useRouter } from "expo-router";
import * as React from "react";
import { Text } from "react-native";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Body, Card, Heading, Screen } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useVendorRestaurant } from "@/hooks/use-vendor-restaurant";
import { hasText } from "@/lib/utils";
import { UserRole } from "@/types/auth";
import { RestaurantStatus } from "@/types/enums";
import type { RestaurantAdminDto } from "@/types/restaurant";

/**
 * The states a listing passes through before it can take orders.
 *
 * Mirrors the web app's vendor gate. Two things about it are load-bearing and
 * easy to get wrong.
 *
 * **`allowSuspended`.** Billing is the one screen that must render for a
 * suspended listing. A vendor closed for non-payment has to reach the page that
 * reopens them — a dead end there leaves the fee uncollected and the vendor with
 * nobody to pay.
 *
 * **Registration is owner-only.** Staff cannot register a restaurant, so
 * offering them the button would send them into a guaranteed 403. A kitchen
 * account with no listing attached is a misconfigured account, and saying so is
 * more use than a form they cannot submit.
 */
export function VendorGate({
  allowSuspended = false,
  children,
}: {
  allowSuspended?: boolean;
  children: (restaurant: RestaurantAdminDto) => React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const vendor = useVendorRestaurant();

  const isOwner = user?.role === UserRole.VENDOR_OWNER;

  if (vendor.isPending) {
    return <LoadingState label="Loading your restaurant…" />;
  }

  if (vendor.needsRegistration) {
    if (!isOwner) {
      return (
        <Screen scroll contentContainerClassName="justify-center gap-4">
          <Heading level={2}>No restaurant attached</Heading>
          <Body muted>
            Your account is a kitchen account, but it is not linked to a restaurant yet. The
            owner needs to add you from their Staff screen.
          </Body>
          <Button variant="outline" fullWidth onPress={() => router.push("/vendor/support")}>
            Contact support
          </Button>
        </Screen>
      );
    }

    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Register your restaurant</Heading>
        <Body muted>
          You have a vendor account but no listing yet. Tell us about your kitchen and an
          administrator will review it before it goes live.
        </Body>
        <Button fullWidth onPress={() => router.push("/vendor/register")}>
          Register a restaurant
        </Button>
      </Screen>
    );
  }

  if (vendor.isError) {
    return <ErrorState error={vendor.error} onRetry={vendor.refetch} />;
  }

  const restaurant = vendor.restaurant;

  if (restaurant === null) {
    return <ErrorState error={new Error("No restaurant was returned.")} onRetry={vendor.refetch} />;
  }

  if (restaurant.status === RestaurantStatus.PENDING_APPROVAL) {
    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Awaiting approval</Heading>
        <Body muted>
          {restaurant.name} has been submitted and is waiting on an administrator. You will be
          notified as soon as a decision is made.
        </Body>
        <Body muted>
          Nothing is needed from you in the meantime — you can set up your menu and opening
          hours now so you are ready to open.
        </Body>
        <Button variant="outline" fullWidth onPress={() => router.push("/vendor/menu")}>
          Set up your menu
        </Button>
      </Screen>
    );
  }

  if (restaurant.status === RestaurantStatus.REJECTED) {
    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Listing not approved</Heading>

        {hasText(restaurant.rejectionReason) ? (
          <Card className="border-danger bg-danger-soft">
            <Text className="font-sans text-[14px] text-danger">
              {restaurant.rejectionReason}
            </Text>
          </Card>
        ) : null}

        <Body muted>Correct what was raised above and submit it again.</Body>
        <Button fullWidth onPress={() => router.push("/vendor/settings")}>
          Update your details
        </Button>
      </Screen>
    );
  }

  if (restaurant.status === RestaurantStatus.SUSPENDED && !allowSuspended) {
    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Your listing is suspended</Heading>
        <Body muted>
          {restaurant.name} is not visible to customers and cannot take orders.
        </Body>
        <Body muted>
          The usual cause is an unpaid platform fee. Settling it on your billing screen reopens
          the listing.
        </Body>
        {/*
          The way out, not a dead end — this is why `allowSuspended` exists on
          the billing screen.
        */}
        <Button fullWidth onPress={() => router.push("/vendor/billing")}>
          Go to billing
        </Button>
        <Button variant="outline" fullWidth onPress={() => router.push("/vendor/support")}>
          Contact support
        </Button>
      </Screen>
    );
  }

  return <>{children(restaurant)}</>;
}
