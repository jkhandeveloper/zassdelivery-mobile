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
import {
  useRegisterRider,
  useResubmitRiderApproval,
  useRiderProfile,
  useUploadRiderDocument,
} from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DriverDocumentType, DriverStatus, VehicleType } from "@/types/enums";

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

/** The documents an administrator needs to see, in the order they are asked for. */
const DOCUMENTS: readonly { type: string; label: string; hint: string }[] = [
  {
    type: DriverDocumentType.CNIC_FRONT,
    label: "CNIC — front",
    hint: "All four corners in frame, no glare.",
  },
  {
    type: DriverDocumentType.CNIC_BACK,
    label: "CNIC — back",
    hint: "The side with your address.",
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
          Optional now — you can add it before your first withdrawal.
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

function Documents({
  missing,
  status,
}: {
  missing: readonly string[];
  status: string;
}) {
  const uploadDocument = useUploadRiderDocument();
  const resubmit = useResubmitRiderApproval();

  /**
   * Uploading a document is two calls: the file goes to `/uploads`, and the URL
   * that comes back is attached to the rider. `ImageUploadField` owns the first
   * and hands over the URL, so this only has to do the second.
   */
  const attach = React.useCallback(
    (type: string, url: string | null) => {
      if (url === null) {
        return;
      }

      uploadDocument.mutate(
        { type: type as never, fileUrl: url },
        {
          onSuccess: () => toast.success("Document added"),
          onError: (error) =>
            toast.error(
              error instanceof ApiError ? error.message : "Couldn't attach that document.",
            ),
        },
      );
    },
    [uploadDocument],
  );

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Heading level={3}>Your documents</Heading>
        <Body muted className="text-[13px]">
          An administrator checks these before you can go online.
        </Body>
      </View>

      {DOCUMENTS.map((document) => {
        const outstanding = missing.includes(document.type);

        return (
          <Card key={document.type} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[14px] font-semibold text-primary">
                {document.label}
              </Text>
              <Badge tone={outstanding ? "warning" : "success"}>
                {outstanding ? "Needed" : "On file"}
              </Badge>
            </View>

            <ImageUploadField
              label={document.label}
              folder="rider-documents"
              // Always null: this field is an uploader, not a viewer. The stored
              // document lives on the rider record and is deliberately not shown
              // back — a CNIC photo on screen in a public place is a hazard, and
              // the badge above already answers "did it arrive".
              value={null}
              onChange={(url) => attach(document.type, url)}
              hint={document.hint}
              aspect="wide"
            />
          </Card>
        );
      })}

      {/*
        Resubmitting is only meaningful for a rejected application — a pending
        one is already in the queue, and pushing it again just resets its place.
      */}
      {status === DriverStatus.REJECTED ? (
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
          <Documents missing={profile.data.missingDocuments} status={profile.data.status} />
        )}
      </ScrollView>
    </View>
  );
}
