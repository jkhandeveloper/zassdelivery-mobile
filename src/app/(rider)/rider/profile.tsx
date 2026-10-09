import { useRouter } from "expo-router";
import { ChevronRight, FileText, HandCoins, LifeBuoy } from "lucide-react-native";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountDetailsCard, ChangePasswordCard } from "@/components/shared/account-sections";
import { GateSignOut } from "@/components/shared/hero-sign-out";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge, Body, Card, Divider, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useZones } from "@/hooks/use-geo";
import { useRiderProfile, useUpdateRiderProfile } from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { cn, formatDate, hasText } from "@/lib/utils";
import { DriverDocumentStatus, DriverStatus } from "@/types/enums";
import type { RiderDto } from "@/types/rider";

/**
 * The rider's own account and rider record, in one place.
 *
 * Deliberately not behind `RiderGate`: an applicant waiting on approval, or one
 * who was turned down, still has a name, a password and bank details to keep
 * right — and this is where they check what the review is waiting on.
 */

const VEHICLE_LABELS: Record<string, string> = {
  MOTORCYCLE: "Motorcycle",
  BICYCLE: "Bicycle",
  CAR: "Car",
  RICKSHAW: "Rickshaw",
  ON_FOOT: "On foot",
};

const DOCUMENT_LABELS: Record<string, string> = {
  CNIC_FRONT: "CNIC — front",
  CNIC_BACK: "CNIC — back",
  DRIVING_LICENSE: "Driving licence",
  VEHICLE_REGISTRATION: "Vehicle registration",
  PROFILE_PHOTO: "Profile photo",
};

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  [DriverStatus.ACTIVE]: "success",
  [DriverStatus.PENDING_APPROVAL]: "warning",
  [DriverStatus.REJECTED]: "danger",
  [DriverStatus.SUSPENDED]: "danger",
  [DriverDocumentStatus.VERIFIED]: "success",
  [DriverDocumentStatus.PENDING]: "warning",
};

function statusLabel(status: string): string {
  const text = status.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-input bg-surface-muted px-3 py-2.5">
      <Text className="font-sans text-[12px] font-medium text-muted">{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="mt-0.5 font-display text-[17px] font-extrabold text-primary"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
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

function Summary({ rider }: { rider: RiderDto }) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-display text-[18px] font-extrabold text-primary">
            {rider.fullName}
          </Text>
          <Text className="font-sans text-[13px] text-secondary">
            {rider.zoneName ?? "No home zone set"}
          </Text>
        </View>
        <Badge tone={STATUS_TONES[rider.status] ?? "neutral"}>{statusLabel(rider.status)}</Badge>
      </View>

      {rider.status !== DriverStatus.ACTIVE ? (
        <Body muted className="text-[13px]">
          {hasText(rider.rejectionReason) ? rider.rejectionReason : rider.statusText}
        </Body>
      ) : null}

      <View className="flex-row gap-2">
        <Stat label="Rating" value={rider.rating.toFixed(1)} />
        <Stat label="Deliveries" value={String(rider.totalDeliveries)} />
        <Stat label="Since" value={formatDate(rider.verifiedAt ?? rider.createdAt)} />
      </View>
    </Card>
  );
}

/** The parts of the rider record a rider owns: licence, home zone, bank details. */
function RiderDetailsCard({ rider }: { rider: RiderDto }) {
  const update = useUpdateRiderProfile();
  const zones = useZones();

  const [licenseNumber, setLicenseNumber] = React.useState(rider.licenseNumber ?? "");
  const [zoneId, setZoneId] = React.useState<string | null>(rider.zoneId);
  const [bankName, setBankName] = React.useState(rider.payout?.bankName ?? "");
  const [accountTitle, setAccountTitle] = React.useState(rider.payout?.accountTitle ?? "");
  // The stored number comes back masked, so it is never put in the field: saving
  // the mask back would overwrite the real number with dots.
  const [accountNumber, setAccountNumber] = React.useState("");

  const onSave = () =>
    update.mutate(
      {
        licenseNumber: licenseNumber.trim(),
        ...(zoneId !== null && { zoneId }),
        payout: {
          bankName: bankName.trim(),
          accountTitle: accountTitle.trim(),
          ...(accountNumber.trim() !== "" && { accountNumber: accountNumber.trim() }),
        },
      },
      {
        onSuccess: () => {
          setAccountNumber("");
          toast.success("Rider details saved");
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : "Couldn't save your rider details.",
          ),
      },
    );

  return (
    <Card className="gap-4">
      <Text className="font-sans text-[15px] font-semibold text-primary">Rider details</Text>

      {/* What the approval was made against, so it is shown and not editable. */}
      <Field label="CNIC" hint="Contact support to change this.">
        <View className="rounded-input border border-border-subtle bg-surface-muted px-3 py-3">
          <Text
            className="font-sans text-[16px] text-secondary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {rider.cnic}
          </Text>
        </View>
      </Field>

      <Field label="Driving licence number">
        <Input
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={40}
          editable={!update.isPending}
        />
      </Field>

      {(zones.data ?? []).length > 0 ? (
        <Field label="Where you're based" hint="You're offered runs in your own area first.">
          <View className="flex-row flex-wrap gap-2">
            {(zones.data ?? []).map((zone) => {
              const active = zoneId === zone.id;

              return (
                <Pressable
                  key={zone.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  disabled={update.isPending}
                  onPress={() => setZoneId(zone.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-2",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Text
                    className={cn(
                      "font-sans text-[13px] font-semibold",
                      active ? "text-brand" : "text-secondary",
                    )}
                  >
                    {zone.name}, {zone.city.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}

      <Divider />

      <View className="gap-1">
        <Text className="font-sans text-[15px] font-semibold text-primary">Bank details</Text>
        <Body muted className="text-[13px]">
          Where a business can send the delivery fees it owes you.
        </Body>
      </View>

      <Field label="Bank or wallet">
        <Input
          value={bankName}
          onChangeText={setBankName}
          placeholder="Meezan Bank, JazzCash…"
          maxLength={120}
          editable={!update.isPending}
        />
      </Field>
      <Field label="Account title" hint="The name the account is held in.">
        <Input
          value={accountTitle}
          onChangeText={setAccountTitle}
          autoCapitalize="words"
          maxLength={120}
          editable={!update.isPending}
        />
      </Field>
      <Field
        label="Account number"
        hint={
          hasText(rider.payout?.accountNumber)
            ? `On file: ${rider.payout.accountNumber}. Leave blank to keep it.`
            : "Account number, IBAN or wallet number."
        }
      >
        <Input
          value={accountNumber}
          onChangeText={setAccountNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={40}
          editable={!update.isPending}
        />
      </Field>

      <Button fullWidth onPress={onSave} loading={update.isPending}>
        Save rider details
      </Button>
    </Card>
  );
}

function VehicleCard({ rider }: { rider: RiderDto }) {
  const vehicles = rider.vehicles.filter((vehicle) => vehicle.isActive);

  return (
    <Card className="gap-2">
      <Text className="font-sans text-[15px] font-semibold text-primary">Vehicle</Text>

      {vehicles.length === 0 ? (
        <Body muted className="text-[13px]">
          No vehicle on file. Contact support to add the one you deliver with.
        </Body>
      ) : (
        vehicles.map((vehicle, index) => {
          const model = [vehicle.make, vehicle.model, vehicle.year, vehicle.color]
            .filter((part) => part !== null && part !== "")
            .join(" · ");

          return (
            <View key={vehicle.id}>
              {index > 0 ? <Divider className="my-1" /> : null}
              <View className="flex-row items-center justify-between gap-2 py-1">
                <View className="flex-1">
                  <Text className="font-sans text-[14px] font-semibold text-primary">
                    {VEHICLE_LABELS[vehicle.type] ?? vehicle.type}
                  </Text>
                  {model !== "" ? (
                    <Text className="font-sans text-[13px] text-secondary">{model}</Text>
                  ) : null}
                </View>
                {hasText(vehicle.plateNumber) ? (
                  <Text
                    className="font-sans text-[14px] font-semibold text-primary"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {vehicle.plateNumber}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

function DocumentsCard({ rider }: { rider: RiderDto }) {
  const router = useRouter();

  return (
    <Card className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-[15px] font-semibold text-primary">Documents</Text>
        <Button
          size="sm"
          variant="outline"
          icon={<FileText size={15} color="#0E7490" />}
          onPress={() => router.push("/rider/apply")}
        >
          Manage
        </Button>
      </View>

      {rider.documents.length === 0 ? (
        <Body muted className="text-[13px]">
          Nothing uploaded yet. Your application can&apos;t be approved until your documents are
          in.
        </Body>
      ) : (
        rider.documents.map((document, index) => (
          <View key={document.id}>
            {index > 0 ? <Divider className="my-1" /> : null}
            <View className="flex-row items-center justify-between gap-2 py-1">
              <View className="flex-1">
                <Text className="font-sans text-[14px] text-primary">
                  {DOCUMENT_LABELS[document.type] ?? document.type}
                </Text>
                {document.expiresAt !== null ? (
                  <Text
                    className={cn(
                      "font-sans text-[12px]",
                      document.isExpired ? "font-semibold text-danger" : "text-muted",
                    )}
                  >
                    {document.isExpired ? "Expired" : "Expires"} {formatDate(document.expiresAt)}
                  </Text>
                ) : null}
                {hasText(document.rejectionReason) ? (
                  <Text className="font-sans text-[12px] text-danger">
                    {document.rejectionReason}
                  </Text>
                ) : null}
              </View>
              <Badge
                tone={
                  document.isExpired ? "danger" : (STATUS_TONES[document.status] ?? "danger")
                }
              >
                {document.isExpired ? "Expired" : statusLabel(document.status)}
              </Badge>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

export default function Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useRiderProfile();

  // A 404 is "signed in as a rider, but never filed the application": the
  // account half of this screen still applies, the rider half does not exist yet.
  const notRegistered =
    profile.isError && profile.error instanceof ApiError && profile.error.status === 404;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={profile.isRefetching}
            onRefresh={() => void profile.refetch()}
          />
        }
      >
        <Heading level={2} className="pt-2">
          My profile
        </Heading>

        {profile.data !== undefined ? <Summary rider={profile.data} /> : null}

        <AccountDetailsCard />

        {profile.isPending ? (
          <LoadingState label="Loading your rider details…" />
        ) : notRegistered ? (
          <Card className="gap-3">
            <Text className="font-sans text-[15px] font-semibold text-primary">
              Finish your rider application
            </Text>
            <Body muted className="text-[13px]">
              Your account is ready, but we still need your CNIC, vehicle and documents before
              you can take deliveries.
            </Body>
            <Button onPress={() => router.push("/rider/apply")}>Start your application</Button>
          </Card>
        ) : profile.isError ? (
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
        ) : (
          <>
            {/* Keyed on the rider, so the fields are seeded once from what
                loaded and a later refetch never overwrites what is being typed. */}
            <RiderDetailsCard key={profile.data.id} rider={profile.data} />
            <VehicleCard rider={profile.data} />
            <DocumentsCard rider={profile.data} />
          </>
        )}

        <ChangePasswordCard />

        <Card>
          <LinkRow
            icon={<HandCoins size={18} color="#75909F" />}
            label="Earnings"
            onPress={() => router.push("/rider/earnings")}
          />
          <Divider />
          <LinkRow
            icon={<LifeBuoy size={18} color="#75909F" />}
            label="Help & support"
            onPress={() => router.push("/rider/support")}
          />
        </Card>

        <GateSignOut />
      </ScrollView>
    </View>
  );
}
