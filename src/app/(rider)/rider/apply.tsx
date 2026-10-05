import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { ImageUploadField } from "@/components/shared/image-upload-field";
import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { Field } from "@/components/ui/input";
import { Badge, Body, Card, Heading } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useZones } from "@/hooks/use-geo";
import {
  useRegisterRider,
  useResubmitRiderApproval,
  useRiderProfile,
  useUploadRiderDocument,
} from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { cn, hasText } from "@/lib/utils";
import {
  DriverDocumentStatus,
  DriverDocumentType,
  DriverStatus,
  VehicleType,
} from "@/types/enums";
import type { RiderDto } from "@/types/rider";

/**
 * The rider's own application.
 *
 * Self-registration, matching the web app: a rider files this themselves and an
 * administrator only approves or rejects it. There is no path where staff
 * register a rider on someone's behalf.
 *
 * Two phases, because they genuinely are two: the form creates the rider
 * record, and documents can only be attached to a record that exists. Showing
 * both at once would mean holding photographs in memory while the first request
 * decides whether there is anything to attach them to.
 */

const VEHICLE_LABELS: Record<string, string> = {
  [VehicleType.MOTORCYCLE]: "Motorcycle",
  [VehicleType.BICYCLE]: "Bicycle",
  [VehicleType.CAR]: "Car",
  [VehicleType.RICKSHAW]: "Rickshaw",
  [VehicleType.ON_FOOT]: "On foot",
};

/**
 * Every document the API can ask for, in the order they are asked for.
 *
 * All five, not just the CNIC: which ones a rider owes depends on their vehicle
 * and is the API's call (`missingDocuments`). A list shorter than the API's
 * leaves a rider with nothing left to upload and an application that can never
 * be approved.
 */
const DOCUMENTS: readonly {
  type: DriverDocumentType;
  label: string;
  hint: string;
  aspect: "square" | "wide";
}[] = [
  {
    type: DriverDocumentType.CNIC_FRONT,
    label: "CNIC — front",
    hint: "The photo side. All four corners in frame, no glare.",
    aspect: "wide",
  },
  {
    type: DriverDocumentType.CNIC_BACK,
    label: "CNIC — back",
    hint: "The side with your address.",
    aspect: "wide",
  },
  {
    type: DriverDocumentType.DRIVING_LICENSE,
    label: "Driving licence",
    hint: "Needed for a motorcycle, car or rickshaw.",
    aspect: "wide",
  },
  {
    type: DriverDocumentType.VEHICLE_REGISTRATION,
    label: "Vehicle registration",
    hint: "The registration book for your vehicle.",
    aspect: "wide",
  },
  {
    type: DriverDocumentType.PROFILE_PHOTO,
    label: "Profile photo",
    hint: "A clear head shot — customers see this at the door.",
    aspect: "square",
  },
];

const applySchema = z.object({
  // 13 digits. The API accepts dashes and strips them, so the form does too
  // rather than fighting the way people actually write a CNIC.
  cnic: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{13}$/.test(value.replace(/[\s-]/g, "")),
      "A CNIC is 13 digits, like 17301-1234567-1",
    ),
  licenseNumber: z.string().trim().optional(),
  vehicleType: z.enum([
    VehicleType.MOTORCYCLE,
    VehicleType.BICYCLE,
    VehicleType.CAR,
    VehicleType.RICKSHAW,
    VehicleType.ON_FOOT,
  ]),
  plateNumber: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  accountTitle: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
});

type ApplyValues = z.infer<typeof applySchema>;

function ApplicationForm({ onFiled }: { onFiled: () => void }) {
  const registerRider = useRegisterRider();
  const zones = useZones();

  // Outside the form schema: it is a tap on a chip, not text to validate.
  const [zoneId, setZoneId] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      cnic: "",
      licenseNumber: "",
      vehicleType: VehicleType.MOTORCYCLE,
      plateNumber: "",
      bankName: "",
      accountTitle: "",
      accountNumber: "",
    },
    mode: "onTouched",
  });

  const vehicleType = watch("vehicleType");

  // Nothing to plate on a bicycle or a pair of legs, so the field is not shown.
  const needsPlate =
    vehicleType === VehicleType.MOTORCYCLE ||
    vehicleType === VehicleType.CAR ||
    vehicleType === VehicleType.RICKSHAW;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerRider.mutateAsync({
        cnic: values.cnic.replace(/[\s-]/g, ""),
        ...(values.licenseNumber !== "" && { licenseNumber: values.licenseNumber }),
        ...(zoneId !== null && { zoneId }),
        vehicle: {
          type: values.vehicleType,
          ...(needsPlate && values.plateNumber !== "" && { plateNumber: values.plateNumber }),
        },
        ...((values.bankName !== "" ||
          values.accountTitle !== "" ||
          values.accountNumber !== "") && {
          payout: {
            ...(values.bankName !== "" && { bankName: values.bankName }),
            ...(values.accountTitle !== "" && { accountTitle: values.accountTitle }),
            ...(values.accountNumber !== "" && { accountNumber: values.accountNumber }),
          },
        }),
      });

      toast.success("Application filed", { description: "Now add your documents." });
      onFiled();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.status === 409
            ? "You already have an application on file."
            : error.message
          : "Couldn't file that. Please try again.",
      );
    }
  });

  return (
    <View className="gap-4">
      <ControlledInput
        control={control}
        name="cnic"
        label="CNIC number"
        required
        placeholder="17301-1234567-1"
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        editable={!isSubmitting}
      />

      {/*
        Not required, but not decoration either: dispatch prefers a rider based
        in the order's own zone, so one with no zone is offered runs after the
        riders who have one.
      */}
      {(zones.data ?? []).length > 0 ? (
        <Field label="Where will you be based?" hint="You're offered runs in your own area first.">
          <View className="flex-row flex-wrap gap-2">
            {(zones.data ?? []).map((zone) => {
              const active = zoneId === zone.id;

              return (
                <Pressable
                  key={zone.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setZoneId(active ? null : zone.id)}
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

      <Field label="What do you deliver on?" required>
        <View className="gap-2">
          {Object.entries(VEHICLE_LABELS).map(([value, label]) => {
            const active = vehicleType === value;

            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() =>
                  setValue("vehicleType", value as ApplyValues["vehicleType"], {
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "rounded-input border px-3 py-2.5",
                  active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                )}
              >
                <Text
                  className={cn(
                    "font-sans text-[14px]",
                    active ? "font-semibold text-brand" : "text-primary",
                  )}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {needsPlate ? (
        <ControlledInput
          control={control}
          name="plateNumber"
          label="Registration plate"
          placeholder="ABC-123"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isSubmitting}
        />
      ) : null}

      <ControlledInput
        control={control}
        name="licenseNumber"
        label="Driving licence number"
        hint="Optional, but approval is faster with it."
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!isSubmitting}
      />

      <View className="gap-1">
        <Heading level={3}>Where we pay you</Heading>
        <Body muted className="text-[13px]">
          Optional. Businesses can pay your delivery fees here.
        </Body>
      </View>

      <ControlledInput
        control={control}
        name="bankName"
        label="Bank or wallet"
        placeholder="Meezan Bank, JazzCash…"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="accountTitle"
        label="Account title"
        placeholder="The name on the account"
        autoCapitalize="words"
        editable={!isSubmitting}
      />
      <ControlledInput
        control={control}
        name="accountNumber"
        label="Account or IBAN"
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!isSubmitting}
      />

      <Button fullWidth size="lg" onPress={() => void onSubmit()} loading={isSubmitting}>
        File my application
      </Button>
    </View>
  );
}

function Documents({ rider }: { rider: RiderDto }) {
  const uploadDocument = useUploadRiderDocument();
  const resubmit = useResubmitRiderApproval();

  /**
   * Uploading a document is two calls: the file goes to `/uploads`, and the URL
   * that comes back is attached to the rider. `ImageUploadField` owns the first
   * and hands over the URL, so this only has to do the second.
   */
  const attach = React.useCallback(
    (type: DriverDocumentType, label: string, url: string | null) => {
      if (url === null) {
        return;
      }

      uploadDocument.mutate(
        { type, fileUrl: url },
        {
          onSuccess: () => toast.success(`${label} uploaded`),
          onError: (error) =>
            toast.error(
              error instanceof ApiError ? error.message : "Couldn't attach that document.",
            ),
        },
      );
    },
    [uploadDocument],
  );

  const byType = new Map(rider.documents.map((entry) => [entry.type, entry]));

  // Only what the API says is still outstanding, plus anything already
  // uploaded — a bicycle rider is never asked for a licence.
  const shown = DOCUMENTS.filter(
    (document) => rider.missingDocuments.includes(document.type) || byType.has(document.type),
  );

  // `missingDocuments` counts *verified* documents, so one that is uploaded and
  // waiting on an administrator is still in it. Those are not the rider's to
  // fix; only these are.
  const toUpload = shown.filter((document) => {
    const existing = byType.get(document.type);

    return existing === undefined || existing.status === DriverDocumentStatus.REJECTED;
  });

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Heading level={3}>Your documents</Heading>
        <Body muted className="text-[13px]">
          {toUpload.length > 0
            ? `Still needed from you: ${toUpload.map((document) => document.label).join(", ")}.`
            : rider.missingDocuments.length > 0
              ? "Everything is uploaded. An administrator is checking it — there is nothing more for you to do."
              : "All your documents are verified."}
        </Body>
      </View>

      {shown.map((document) => {
        const existing = byType.get(document.type);

        return (
          <Card key={document.type} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[14px] font-semibold text-primary">
                {document.label}
              </Text>
              {existing === undefined ? (
                <Badge tone="warning">Needed</Badge>
              ) : existing.status === DriverDocumentStatus.VERIFIED ? (
                <Badge tone="success">Verified</Badge>
              ) : existing.status === DriverDocumentStatus.REJECTED ? (
                <Badge tone="danger">Rejected</Badge>
              ) : (
                <Badge tone="brand">Under review</Badge>
              )}
            </View>

            {existing !== undefined && hasText(existing.rejectionReason) ? (
              <Text className="rounded-input bg-danger-soft px-3 py-2 font-sans text-[13px] text-danger">
                {existing.rejectionReason}
              </Text>
            ) : null}

            <ImageUploadField
              label={existing === undefined ? "Add a photo" : "Replace the photo"}
              folder="rider-documents"
              // Always null: this field is an uploader, not a viewer. The stored
              // document lives on the rider record and is deliberately not shown
              // back — a CNIC photo on screen in a public place is a hazard, and
              // the badge above already answers "did it arrive".
              value={null}
              onChange={(url) => attach(document.type, document.label, url)}
              hint={document.hint}
              aspect={document.aspect}
            />
          </Card>
        );
      })}

      {/*
        Resubmitting is only meaningful for a rejected application — a pending
        one is already in the queue, and pushing it again just resets its place.
      */}
      {rider.status === DriverStatus.REJECTED ? (
        <Button
          fullWidth
          loading={resubmit.isPending}
          onPress={() =>
            resubmit.mutate(undefined, {
              onSuccess: () => toast.success("Sent for review again"),
              onError: (error) =>
                toast.error(error instanceof ApiError ? error.message : "Couldn't resubmit."),
            })
          }
        >
          Submit for review again
        </Button>
      ) : null}
    </View>
  );
}

export default function RiderApplyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useRiderProfile();

  const notFiled = profile.isError && profile.error instanceof ApiError && profile.error.status === 404;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/rider"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Rider application</Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {profile.isPending ? (
          <LoadingState />
        ) : notFiled ? (
          <ApplicationForm onFiled={() => void profile.refetch()} />
        ) : profile.isError ? (
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
        ) : (
          <Documents rider={profile.data} />
        )}
      </ScrollView>
    </View>
  );
}
