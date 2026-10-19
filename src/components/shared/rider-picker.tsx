import {
  Bike,
  Check,
  RefreshCw,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { Body } from "@/components/ui/primitives";
import { LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useCartRiders, useSetCartRider } from "@/hooks/use-cart";
import { ApiError } from "@/lib/api-client";
import { cn, formatPrice, hasText } from "@/lib/utils";
import type { CartDto, CartRiderOptionDto } from "@/types/cart";

const VEHICLE_LABELS: Record<string, string> = {
  MOTORCYCLE: "Motorcycle",
  BICYCLE: "Bicycle",
  CAR: "Car",
  RICKSHAW: "Rickshaw",
  ON_FOOT: "On foot",
};

function RiderRow({
  rider,
  active,
  disabled,
  onPress,
}: {
  rider: CartRiderOptionDto;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 rounded-input border px-3 py-3",
        active
          ? "border-brand bg-brand-soft"
          : "border-border-default bg-surface",
      )}
    >
      <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-muted">
        {hasText(rider.avatarUrl) ? (
          <Image source={{ uri: rider.avatarUrl }} className="h-10 w-10" />
        ) : (
          <UserRound size={18} color="#75909F" />
        )}
      </View>

      <View className="flex-1 gap-0.5">
        <Text
          className="font-sans text-[14px] font-semibold text-primary"
          numberOfLines={1}
        >
          {rider.fullName}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-2">
          {rider.ratingCount > 0 ? (
            <View className="flex-row items-center gap-0.5">
              <Star size={11} color="#D97706" fill="#D97706" />
              <Text className="font-sans text-[12px] text-muted">
                {rider.rating.toFixed(1)}
              </Text>
            </View>
          ) : (
            <Text className="font-sans text-[12px] text-muted">New rider</Text>
          )}
          {rider.vehicleType !== null ? (
            <View className="flex-row items-center gap-0.5">
              <Bike size={11} color="#75909F" />
              <Text className="font-sans text-[12px] text-muted">
                {VEHICLE_LABELS[rider.vehicleType] ?? rider.vehicleType}
              </Text>
            </View>
          ) : null}
          <Text
            className="font-sans text-[12px] text-muted"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {rider.distanceToPickupKm.toFixed(1)} km away
          </Text>
        </View>
      </View>

      <View className="items-end">
        <Text
          className="font-sans text-[14px] font-bold text-primary"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {rider.deliveryFee === null ? "—" : formatPrice(rider.deliveryFee)}
        </Text>
        <Text
          className="font-sans text-[11px] text-muted"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {rider.perKmRate === null
            ? "Standard rate"
            : `${formatPrice(rider.perKmRate)}/km`}
        </Text>
      </View>
      {active ? <Check size={16} color="#0E7490" /> : null}
    </Pressable>
  );
}

/**
 * "Choose your rider": every rider free to take the order, cheap or dear.
 * Nothing is hidden on price — the customer picks whoever they like, or leaves
 * it to dispatch at the standard rate.
 */
export function RiderPicker({ cart }: { cart: CartDto }) {
  const riders = useCartRiders(cart.delivery.addressId, true);
  const setRider = useSetCartRider();

  const chosenId = cart.rider?.id ?? null;
  const list = riders.data ?? [];

  const choose = (driverId: string | null) => {
    if (driverId === chosenId) return;

    setRider.mutate(
      { driverId },
      {
        onError: (error) =>
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Couldn't choose that rider.",
          ),
      },
    );
  };

  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-[15px] font-semibold text-primary">
          Choose your rider
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh riders"
          onPress={() => void riders.refetch()}
          disabled={riders.isFetching}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center"
        >
          {riders.isFetching ? (
            <ActivityIndicator size="small" color="#0E7490" />
          ) : (
            <RefreshCw size={16} color="#0E7490" />
          )}
        </Pressable>
      </View>
      <Body muted className="text-[12px]">
        Each rider sets their own price per km. Pick any rider you like —
        cheaper or dearer. The delivery fee follows your choice.
      </Body>

      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: chosenId === null }}
        disabled={setRider.isPending}
        onPress={() => choose(null)}
        className={cn(
          "flex-row items-center gap-3 rounded-input border px-3 py-3",
          chosenId === null
            ? "border-brand bg-brand-soft"
            : "border-border-default bg-surface",
        )}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
          <Sparkles size={18} color="#0E7490" />
        </View>
        <View className="flex-1">
          <Text className="font-sans text-[14px] font-semibold text-primary">
            Any available rider
          </Text>
          <Text className="font-sans text-[12px] text-muted">
            The nearest free rider, at the standard rate
          </Text>
        </View>
        {chosenId === null ? <Check size={16} color="#0E7490" /> : null}
      </Pressable>

      {riders.isPending ? (
        <LoadingState />
      ) : riders.isError ? (
        <Body className="text-[13px] text-danger">
          Couldn&apos;t load the riders nearby. Tap refresh to try again.
        </Body>
      ) : list.length === 0 ? (
        <Body muted className="text-[13px]">
          No rider is online near this business right now. We&apos;ll find you
          one as soon as the order is accepted.
        </Body>
      ) : (
        list.map((rider) => (
          <RiderRow
            key={rider.id}
            rider={rider}
            active={chosenId === rider.id}
            disabled={setRider.isPending}
            onPress={() => choose(rider.id)}
          />
        ))
      )}
    </View>
  );
}
