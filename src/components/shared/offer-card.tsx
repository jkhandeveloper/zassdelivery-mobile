import { MapPin, Store } from "lucide-react-native";
import * as React from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useAcceptOffer, useRejectOffer } from "@/hooks/use-riders";
import { ApiError } from "@/lib/api-client";
import { formatCountdown, formatPrice, hasText, secondsUntil } from "@/lib/utils";
import type { AssignmentDto } from "@/types/rider";

/**
 * A delivery offer, with the clock running.
 *
 * The countdown is the point. An offer lapses on a server-side timer, so a card
 * that showed a static "expires at 19:42" would leave a rider tapping Accept on
 * something that died two minutes ago and reading the resulting error as a bug.
 *
 * When it reaches zero the card does not vanish. It goes to an explicit
 * "expired" state instead, because a row disappearing out from under a thumb
 * mid-tap is how a rider accidentally accepts the offer that shuffled up into
 * its place.
 */

/**
 * Seconds remaining, ticking.
 *
 * Derived from the expiry timestamp on every tick rather than decremented from
 * a starting value: a decremented counter drifts, and worse, stops entirely
 * while the app is backgrounded — so a rider returning to the app would see
 * thirty seconds left on an offer that expired while their phone was in their
 * pocket.
 */
function useCountdown(expiresAt: string): number {
  // The first value comes from the initialiser, not from a write inside the
  // effect below. Setting state synchronously in an effect body triggers a
  // second render pass before paint, which for a list of offers each running
  // their own clock is a cascade the React Compiler rightly rejects.
  const [remaining, setRemaining] = React.useState(() => secondsUntil(expiresAt));

  React.useEffect(() => {
    const timer = setInterval(() => {
      const next = secondsUntil(expiresAt);
      setRemaining(next);

      if (next <= 0) {
        clearInterval(timer);
      }
    }, 1_000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return remaining;
}

export function OfferCard({ offer }: { offer: AssignmentDto }) {
  const remaining = useCountdown(offer.expiresAt);
  const acceptOffer = useAcceptOffer();
  const rejectOffer = useRejectOffer();

  const expired = remaining <= 0;
  // Under fifteen seconds the countdown turns red: at that point the decision
  // is effectively made, and the rider should know before they commit.
  const urgent = remaining > 0 && remaining <= 15;

  const busy = acceptOffer.isPending || rejectOffer.isPending;

  const onAccept = React.useCallback(() => {
    acceptOffer.mutate(offer.id, {
      onSuccess: () => toast.success("Offer accepted", { description: "Head to the restaurant." }),
      onError: (error) =>
        toast.error(
          error instanceof ApiError
            ? // 409 is the race this whole screen lives with: another rider
              // took it, or it expired between render and tap.
              error.status === 409
              ? "That one's gone — another rider took it."
              : error.message
            : "Couldn't accept that offer.",
        ),
    });
  }, [acceptOffer, offer.id]);

  const onDecline = React.useCallback(() => {
    rejectOffer.mutate(
      { id: offer.id, data: {} },
      {
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : "Couldn't decline that offer.",
          ),
      },
    );
  }, [rejectOffer, offer.id]);

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text
            className="font-display text-[20px] font-extrabold text-primary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatPrice(offer.estimatedEarning)}
          </Text>
          <Text className="font-sans text-[12px] text-muted">Estimated, before tip</Text>
        </View>

        <View
          className={
            expired
              ? "rounded-full bg-surface-muted px-3 py-1.5"
              : urgent
                ? "rounded-full bg-danger-soft px-3 py-1.5"
                : "rounded-full bg-brand-soft px-3 py-1.5"
          }
        >
          <Text
            accessibilityLiveRegion={urgent ? "polite" : "none"}
            className={
              expired
                ? "font-sans text-[13px] font-bold text-muted"
                : urgent
                  ? "font-sans text-[13px] font-bold text-danger"
                  : "font-sans text-[13px] font-bold text-brand"
            }
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {expired ? "Expired" : formatCountdown(remaining)}
          </Text>
        </View>
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-center gap-2">
          <Store size={15} color="#D9480F" />
          <Text numberOfLines={1} className="flex-1 font-sans text-[14px] text-primary">
            {offer.order.restaurantName}
          </Text>
          {offer.pickupDistanceKm !== null ? (
            <Text
              className="font-sans text-[12px] text-muted"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {offer.pickupDistanceKm.toFixed(1)} km away
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <MapPin size={15} color="#0E7490" />
          <Text numberOfLines={2} className="flex-1 font-sans text-[14px] text-secondary">
            {offer.order.deliveryAddress}
          </Text>
        </View>

        {offer.order.distanceKm !== null ? (
          <Text
            className="font-sans text-[12px] text-muted"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {offer.order.distanceKm.toFixed(1)} km to the door
          </Text>
        ) : null}

        {/*
          Cash to collect changes the job: the rider needs change on them, and
          it is the single most common cause of a doorstep dispute. It belongs
          on the card they decide from, not on the screen after they accept.
        */}
        {offer.order.cashToCollect > 0 ? (
          <View className="mt-1 rounded-input bg-warning-soft px-3 py-2">
            <Text className="font-sans text-[13px] font-semibold text-warning">
              Collect {formatPrice(offer.order.cashToCollect)} in cash
            </Text>
          </View>
        ) : null}

        {hasText(offer.order.deliveryLandmark) ? (
          <Text className="font-sans text-[12px] text-muted">
            {offer.order.deliveryLandmark}
          </Text>
        ) : null}
      </View>

      {expired ? (
        <Text className="font-sans text-[13px] text-muted">
          This offer has lapsed. It will disappear shortly.
        </Text>
      ) : (
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onPress={onDecline}
            loading={rejectOffer.isPending}
            disabled={busy}
          >
            Decline
          </Button>
          <Button
            className="flex-1"
            onPress={onAccept}
            loading={acceptOffer.isPending}
            disabled={busy}
          >
            Accept
          </Button>
        </View>
      )}
    </Card>
  );
}
