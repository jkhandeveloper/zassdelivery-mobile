import { Check } from "lucide-react-native";
import * as React from "react";
import { Text, View } from "react-native";

import { formatTime } from "@/lib/utils";
import { OrderStatus } from "@/types/enums";
import type { OrderTimelineEntryDto } from "@/types/order";

/**
 * How far along a delivery is.
 *
 * The progression shown is a fixed spine of five stages, not the raw timeline.
 * The timeline is the truth about what happened and is rendered underneath;
 * this answers the different question the customer is actually asking, which is
 * "how much longer". A list that grows an entry at a time cannot answer that,
 * because it never shows what has *not* happened yet.
 *
 * `PICKED_UP` and `ON_THE_WAY` collapse into one stage on purpose. They are a
 * meaningful distinction to dispatch and no distinction at all to someone
 * waiting at home — the food is with the rider either way.
 */

interface Step {
  key: string;
  label: string;
  /** Statuses that mean this stage is done. */
  reachedBy: readonly OrderStatus[];
}

const STEPS: readonly Step[] = [
  {
    key: "placed",
    label: "Order placed",
    reachedBy: [
      OrderStatus.PLACED,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.PICKED_UP,
      OrderStatus.ON_THE_WAY,
      OrderStatus.DELIVERED,
    ],
  },
  {
    key: "confirmed",
    label: "Restaurant confirmed",
    reachedBy: [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.PICKED_UP,
      OrderStatus.ON_THE_WAY,
      OrderStatus.DELIVERED,
    ],
  },
  {
    key: "preparing",
    label: "Being prepared",
    reachedBy: [
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.PICKED_UP,
      OrderStatus.ON_THE_WAY,
      OrderStatus.DELIVERED,
    ],
  },
  {
    key: "on-the-way",
    label: "On the way to you",
    reachedBy: [OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED],
  },
  { key: "delivered", label: "Delivered", reachedBy: [OrderStatus.DELIVERED] },
];

/** The timeline entry that first reached a stage, for its timestamp. */
function timeFor(step: Step, timeline: readonly OrderTimelineEntryDto[]): string | null {
  const entry = timeline.find((item) => step.reachedBy.includes(item.toStatus));

  return entry?.at ?? null;
}

export function OrderStatusSteps({
  status,
  timeline,
}: {
  status: OrderStatus | null;
  timeline: readonly OrderTimelineEntryDto[];
}) {
  /**
   * A cancelled, rejected or failed order has left the happy path, and drawing
   * a five-stage progress bar for one is actively misleading — the stages it
   * still shows as "to come" will never happen.
   */
  const terminated =
    status === OrderStatus.CANCELLED ||
    status === OrderStatus.REJECTED ||
    status === OrderStatus.FAILED;

  if (terminated) {
    const label =
      status === OrderStatus.CANCELLED
        ? "Order cancelled"
        : status === OrderStatus.REJECTED
          ? "Order rejected by the restaurant"
          : "Order failed";

    return (
      <View className="rounded-card border border-danger bg-danger-soft px-4 py-3">
        <Text className="font-sans text-[14px] font-semibold text-danger">{label}</Text>
      </View>
    );
  }

  const currentIndex = STEPS.reduce(
    (highest, step, index) =>
      status !== null && step.reachedBy.includes(status) ? index : highest,
    -1,
  );

  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Order progress">
      {STEPS.map((step, index) => {
        const done = index <= currentIndex;
        // The stage in progress right now, rather than one already finished.
        const active = index === currentIndex + 1 && currentIndex < STEPS.length - 1;
        const last = index === STEPS.length - 1;
        const at = done ? timeFor(step, timeline) : null;

        return (
          <View key={step.key} className="flex-row gap-3">
            {/* The rail: a dot, and a connector down to the next dot. */}
            <View className="items-center">
              <View
                className={
                  done
                    ? "h-6 w-6 items-center justify-center rounded-full bg-success"
                    : active
                      ? "h-6 w-6 items-center justify-center rounded-full border-2 border-brand bg-surface"
                      : "h-6 w-6 items-center justify-center rounded-full border-2 border-border-default bg-surface"
                }
              >
                {done ? <Check size={14} color="#FFFFFF" /> : null}
                {active ? <View className="h-2 w-2 rounded-full bg-brand" /> : null}
              </View>

              {!last ? (
                <View
                  className={done ? "w-0.5 flex-1 bg-success" : "w-0.5 flex-1 bg-border-default"}
                />
              ) : null}
            </View>

            <View className={last ? "flex-1" : "flex-1 pb-5"}>
              <Text
                className={
                  done || active
                    ? "font-sans text-[15px] font-semibold text-primary"
                    : "font-sans text-[15px] text-muted"
                }
              >
                {step.label}
              </Text>
              {at !== null ? (
                <Text
                  className="font-sans text-[12px] text-muted"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatTime(at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
