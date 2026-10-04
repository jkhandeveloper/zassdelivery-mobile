import { useRouter } from "expo-router";
import * as React from "react";
import { Text, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/providers";
import { GateSignOut } from "@/components/shared/hero-sign-out";
import { Button } from "@/components/ui/button";
import { Body, Card, Heading, Screen } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useResubmitRestaurant } from "@/hooks/use-vendor";
import { useVendorRestaurant } from "@/hooks/use-vendor-restaurant";
import { ApiError } from "@/lib/api-client";
import { cn, hasText } from "@/lib/utils";
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
  allowUnapproved = false,
  allowSuspended = false,
  children,
}: {
  /**
   * Lets a pending or rejected listing through, behind a banner. Set by the
   * screens an owner needs *before* approval — settings and the menu. Without
   * it the "set up your menu" and "update your details" buttons below lead
   * straight back to the screen they were pressed on.
   */
  allowUnapproved?: boolean;
  allowSuspended?: boolean;
  children: (restaurant: RestaurantAdminDto) => React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const vendor = useVendorRestaurant();
  const resubmit = useResubmitRestaurant();

  const isOwner = user?.role === UserRole.VENDOR_OWNER;

  if (vendor.isPending) {
    return <LoadingState label="Loading your business…" />;
  }

  if (vendor.needsRegistration) {
    if (!isOwner) {
      return (
        <Screen scroll contentContainerClassName="justify-center gap-4">
          <Heading level={2}>No business attached</Heading>
          <Body muted>
            Your account is a kitchen account, but it is not linked to a business yet. The
            owner needs to add you from their Staff screen.
          </Body>
          <Button variant="outline" fullWidth onPress={() => router.push("/vendor/support")}>
            Contact support
          </Button>
          <GateSignOut />
        </Screen>
      );
    }

    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Register your business</Heading>
        <Body muted>
          You have a vendor account but no listing yet. Tell us about your kitchen and an
          administrator will review it before it goes live.
        </Body>
        <Button fullWidth onPress={() => router.push("/vendor/register")}>
          Register a business
        </Button>
        <GateSignOut />
      </Screen>
    );
  }

  if (vendor.isError) {
    return <ErrorState error={vendor.error} onRetry={vendor.refetch} />;
  }

  const restaurant = vendor.restaurant;

  if (restaurant === null) {
    return <ErrorState error={new Error("No business was returned.")} onRetry={vendor.refetch} />;
  }

  const resubmitButton = (
    <Button
      fullWidth
      loading={resubmit.isPending}
      onPress={() =>
        resubmit.mutate(restaurant.id, {
          onSuccess: () => toast.success("Sent back for review"),
          onError: (error) =>
            toast.error(
              error instanceof ApiError ? error.message : "Couldn't resubmit your listing.",
            ),
        })
      }
    >
      Resubmit for review
    </Button>
  );

  if (restaurant.status === RestaurantStatus.PENDING_APPROVAL && !allowUnapproved) {
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
        <Button variant="outline" fullWidth onPress={() => router.push("/vendor/settings")}>
          Business details and hours
        </Button>
        <GateSignOut />
      </Screen>
    );
  }

  if (restaurant.status === RestaurantStatus.REJECTED && !allowUnapproved) {
    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Listing not approved</Heading>

        <Card className="border-danger bg-danger-soft">
          <Text className="font-sans text-[14px] text-danger">
            {hasText(restaurant.rejectionReason)
              ? restaurant.rejectionReason
              : "No reason was recorded. Support can tell you what needs changing."}
          </Text>
        </Card>

        <Body muted>Correct what was raised above, then send it back for review.</Body>
        <Button variant="outline" fullWidth onPress={() => router.push("/vendor/settings")}>
          Update your details
        </Button>
        {isOwner ? resubmitButton : null}
        <GateSignOut />
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
        <GateSignOut />
      </Screen>
    );
  }

  if (
    restaurant.status === RestaurantStatus.PENDING_APPROVAL ||
    restaurant.status === RestaurantStatus.REJECTED
  ) {
    const rejected = restaurant.status === RestaurantStatus.REJECTED;

    return (
      <View className="flex-1 bg-canvas">
        <View
          className={cn("gap-2 px-4 pb-3", rejected ? "bg-danger-soft" : "bg-warning-soft")}
          style={{ paddingTop: insets.top + 8 }}
        >
          <Text
            className={cn(
              "font-sans text-[13px] font-medium",
              rejected ? "text-danger" : "text-warning",
            )}
          >
            {rejected
              ? hasText(restaurant.rejectionReason)
                ? `Not approved: ${restaurant.rejectionReason}`
                : "This listing was not approved. Fix your details, then resubmit."
              : "Awaiting approval — not visible to customers yet. What you set up here is saved and goes live once approved."}
          </Text>
          {rejected && isOwner ? resubmitButton : null}
        </View>
        {/* The banner has already cleared the status bar; the screen must not pad for it again. */}
        <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
          {children(restaurant)}
        </SafeAreaInsetsContext.Provider>
      </View>
    );
  }

  return <>{children(restaurant)}</>;
}
