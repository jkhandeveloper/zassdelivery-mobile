import { useRouter } from "expo-router";
import * as React from "react";
import { Text } from "react-native";

import { Button } from "@/components/ui/button";
import { Body, Card, Heading, Screen } from "@/components/ui/primitives";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useRiderProfile } from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { hasText } from "@/lib/utils";
import { DriverStatus } from "@/types/enums";
import type { RiderDto } from "@/types/rider";

/**
 * The states a rider passes through before they can take a delivery.
 *
 * Mirrors the web app's rider gate. These are not "you may not be here" —
 * `RoleGuard` already handled that — they are this rider's actual situation,
 * and each one has a different next step. Collapsing them into one "not
 * approved" screen is what leaves a rider with a rejected application staring
 * at a page that does not tell them why or what to do.
 *
 * The four cases, and why each needs its own copy:
 *
 * - **No application on file.** They registered as a rider but never filed.
 *   The next step is theirs: file one.
 * - **Awaiting approval.** Nothing for them to do, so the screen says so
 *   plainly rather than implying they are missing something — *unless*
 *   documents are outstanding, in which case they are the blocker and it is
 *   the one thing worth showing.
 * - **Rejected.** They need the reason, which the API supplies, and the
 *   ability to fix it and resubmit.
 * - **Suspended.** An administrator did this deliberately; the only route out
 *   is support.
 */
export function RiderGate({
  children,
}: {
  children: (rider: RiderDto) => React.ReactNode;
}) {
  const router = useRouter();
  const profile = useRiderProfile();

  if (profile.isPending) {
    return <LoadingState label="Checking your rider account…" />;
  }

  if (profile.isError) {
    /**
     * A 404 is not an error here, it is the "never applied" state.
     *
     * The API has no rider record to return for someone who registered with the
     * RIDER role but never filed an application, so it 404s. Rendering an error
     * screen for that would strand exactly the people who still need to apply.
     */
    const notFound = profile.error instanceof ApiError && profile.error.status === 404;

    if (!notFound) {
      return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
    }

    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Become a rider</Heading>
        <Body muted>
          You have a rider account but no application on file yet. Tell us about yourself and
          your vehicle, upload your documents, and an administrator will review it.
        </Body>
        <Button fullWidth onPress={() => router.push("/rider/apply")}>
          Start your application
        </Button>
      </Screen>
    );
  }

  const rider = profile.data;

  if (rider.status === DriverStatus.PENDING_APPROVAL) {
    const missing = rider.missingDocuments;

    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Application under review</Heading>
        <Body muted>{rider.statusText}</Body>

        {missing.length > 0 ? (
          <Card className="gap-2">
            <Text className="font-sans text-[14px] font-semibold text-primary">
              Still needed from you
            </Text>
            {missing.map((document) => (
              <Text key={document} className="font-sans text-[14px] text-secondary">
                • {document.replace(/_/g, " ").toLowerCase()}
              </Text>
            ))}
            <Button className="mt-1" onPress={() => router.push("/rider/apply")}>
              Upload documents
            </Button>
          </Card>
        ) : (
          <Body muted>
            Everything we need is on file. There is nothing for you to do — we will notify you
            as soon as a decision is made.
          </Body>
        )}
      </Screen>
    );
  }

  if (rider.status === DriverStatus.REJECTED) {
    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Application not approved</Heading>

        {hasText(rider.rejectionReason) ? (
          <Card className="border-danger bg-danger-soft">
            <Text className="font-sans text-[14px] text-danger">{rider.rejectionReason}</Text>
          </Card>
        ) : (
          <Body muted>{rider.statusText}</Body>
        )}

        <Body muted>You can correct what was raised above and submit again.</Body>
        <Button fullWidth onPress={() => router.push("/rider/apply")}>
          Update and resubmit
        </Button>
      </Screen>
    );
  }

  if (rider.status === DriverStatus.SUSPENDED) {
    return (
      <Screen scroll contentContainerClassName="justify-center gap-4">
        <Heading level={2}>Your account is suspended</Heading>
        <Body muted>{rider.statusText}</Body>
        <Body muted>
          You cannot take deliveries while suspended. Support can tell you why and what happens
          next.
        </Body>
        <Button variant="outline" fullWidth onPress={() => router.push("/rider/support")}>
          Contact support
        </Button>
      </Screen>
    );
  }

  return <>{children(rider)}</>;
}
