import { useRouter } from "expo-router";
import { ChevronRight, LifeBuoy, ReceiptText, Store } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/providers";
import { AccountDetailsCard, ChangePasswordCard } from "@/components/shared/account-sections";
import { GateSignOut } from "@/components/shared/hero-sign-out";
import { Button } from "@/components/ui/button";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useVendorRestaurant } from "@/hooks/use-vendor-restaurant";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { UserRole } from "@/types/auth";
import { RestaurantStatus } from "@/types/enums";

/**
 * The person behind the business — their own name, photo, email and password.
 *
 * Separate from Settings, which is the *business's* details as customers see
 * them. An owner needs both, and until this screen existed the only way to
 * change their own name or password was to have support do it.
 *
 * Not behind `VendorGate`: the account belongs to the person, so it has to stay
 * reachable while the listing is pending, rejected or suspended — and it works
 * the same for kitchen staff, who have an account but no listing of their own.
 */

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  [RestaurantStatus.ACTIVE]: "success",
  [RestaurantStatus.PENDING_APPROVAL]: "warning",
  [RestaurantStatus.REJECTED]: "danger",
  [RestaurantStatus.SUSPENDED]: "danger",
};

function statusLabel(status: string): string {
  const text = status.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 py-3"
    >
      {icon}
      <Text className="flex-1 font-sans text-[15px] text-primary">{label}</Text>
      <ChevronRight size={18} color="#75909F" />
    </Pressable>
  );
}

/** Which business this account runs. */
function BusinessCard({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const vendor = useVendorRestaurant();

  return (
    <Card className="gap-2">
      <Text className="font-sans text-[15px] font-semibold text-primary">
        {isOwner ? "Your business" : "Where you work"}
      </Text>

      {vendor.isPending ? (
        <LoadingState label="Loading your business…" />
      ) : vendor.needsRegistration && !isOwner ? (
        // On mobile a kitchen account with no restaurant reports this too, and
        // listing a business is not theirs to do.
        <Body muted className="text-[13px]">
          No business is attached to your account yet. Ask the owner to add you again.
        </Body>
      ) : vendor.needsRegistration ? (
        <>
          <Body muted className="text-[13px]">
            No business listed yet. Add your details and we&apos;ll review the listing.
          </Body>
          <Button onPress={() => router.push("/vendor/register")}>List my business</Button>
        </>
      ) : vendor.isError || vendor.restaurant === null ? (
        <ErrorState error={vendor.error} onRetry={vendor.refetch} />
      ) : (
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="font-display text-[17px] font-bold text-primary">
              {vendor.restaurant.name}
            </Text>
            <Text className="font-sans text-[13px] text-secondary">
              {BUSINESS_TYPES[vendor.restaurant.businessType].label} ·{" "}
              {vendor.restaurant.addressLine}
            </Text>
          </View>
          <Badge tone={STATUS_TONES[vendor.restaurant.status] ?? "neutral"}>
            {statusLabel(vendor.restaurant.status)}
          </Badge>
        </View>
      )}
    </Card>
  );
}

export default function Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isOwner = user?.role === UserRole.VENDOR_OWNER;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="gap-4 px-4 pb-8" keyboardShouldPersistTaps="handled">
        <View className="gap-1 pt-2">
          <Heading level={2}>My profile</Heading>
          <Body muted className="text-[13px]">
            {isOwner
              ? "Your own account as the owner. Your business's details are under Settings."
              : "Your own account. The business's details are managed by its owner."}
          </Body>
        </View>

        <AccountDetailsCard />
        <BusinessCard isOwner={isOwner} />
        <ChangePasswordCard />

        <Card>
          <LinkRow
            icon={<Store size={18} color="#75909F" />}
            label="Business settings"
            onPress={() => router.push("/vendor/settings")}
          />
          {/* Billing is owner business; the API refuses it for kitchen staff. */}
          {isOwner ? (
            <>
              <Divider />
              <LinkRow
                icon={<ReceiptText size={18} color="#75909F" />}
                label="Subscription"
                onPress={() => router.push("/vendor/billing")}
              />
            </>
          ) : null}
          <Divider />
          <LinkRow
            icon={<LifeBuoy size={18} color="#75909F" />}
            label="Help & support"
            onPress={() => router.push("/vendor/support")}
          />
        </Card>

        <GateSignOut />
      </ScrollView>
    </View>
  );
}
