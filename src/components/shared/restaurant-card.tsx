import { Image } from "expo-image";
import { Link } from "expo-router";
import { Clock, Star } from "lucide-react-native";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui/primitives";
import { formatPrice, hasText } from "@/lib/utils";
import type { RestaurantDto } from "@/types/restaurant";

/**
 * One restaurant, in a list.
 *
 * The ordering state shown is `canOrderNow`, not `isOpenNow`. They differ, and
 * the difference matters: a place can be inside its opening hours while the
 * owner has orders switched off, or while the listing is suspended. Gating on
 * the wrong flag lets a customer build a cart they cannot check out.
 */

function OrderingState({ restaurant }: { restaurant: RestaurantDto }) {
  if (restaurant.canOrderNow) {
    return <Badge tone="success">Open</Badge>;
  }

  // "Opens in 25 min" is materially more useful than "Closed" — it is the
  // difference between leaving and waiting.
  if (restaurant.opensInMinutes !== null && restaurant.opensInMinutes > 0) {
    return <Badge tone="warning">Opens in {restaurant.opensInMinutes} min</Badge>;
  }

  return <Badge tone="neutral">Closed</Badge>;
}

export function RestaurantCard({ restaurant }: { restaurant: RestaurantDto }) {
  const distanceKm =
    restaurant.distanceMeters !== null && restaurant.distanceMeters !== undefined
      ? (restaurant.distanceMeters / 1000).toFixed(1)
      : null;

  return (
    <Link href={`/restaurants/${restaurant.slug}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${restaurant.name}, ${restaurant.canOrderNow ? "open" : "closed"}`}
        className="overflow-hidden rounded-card border border-border-subtle bg-surface"
        style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
      >
        <View className="relative">
          <Image
            source={hasText(restaurant.coverUrl) ? { uri: restaurant.coverUrl } : undefined}
            // A solid placeholder rather than a spinner: a list of spinners
            // reads as broken, and these images are decorative.
            style={{ width: "100%", height: 140, backgroundColor: "#E4EEF5" }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />

          {/*
            A closed restaurant is dimmed rather than hidden. The customer may
            well have come looking for this specific place, and removing it
            answers a question they did not ask.
          */}
          {!restaurant.canOrderNow ? (
            <View className="absolute inset-0 bg-black/40" pointerEvents="none" />
          ) : null}

          <View className="absolute left-3 top-3">
            <OrderingState restaurant={restaurant} />
          </View>
        </View>

        <View className="gap-1.5 p-3">
          <View className="flex-row items-start justify-between gap-2">
            <Text
              numberOfLines={1}
              className="flex-1 font-display text-[17px] font-bold text-primary"
            >
              {restaurant.name}
            </Text>

            {restaurant.ratingCount > 0 ? (
              <View className="flex-row items-center gap-1">
                <Star size={13} color="#FBBF24" fill="#FBBF24" />
                <Text
                  className="font-sans text-[13px] font-semibold text-primary"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {restaurant.rating.toFixed(1)}
                </Text>
                <Text className="font-sans text-[12px] text-muted">({restaurant.ratingCount})</Text>
              </View>
            ) : (
              <Text className="font-sans text-[12px] text-muted">New</Text>
            )}
          </View>

          {/* What it cooks, falling back to where it is when uncategorised. */}
          <Text numberOfLines={1} className="font-sans text-[13px] text-secondary">
            {restaurant.categories.length > 0
              ? restaurant.categories.map((category) => category.name).join(" · ")
              : restaurant.zone.name}
          </Text>

          <View className="mt-0.5 flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Clock size={13} color="#75909F" />
              <Text className="font-sans text-[12px] text-muted">
                {restaurant.avgPreparationMinutes} min
              </Text>
            </View>

            <Text className="font-sans text-[12px] text-muted">
              Min {formatPrice(restaurant.minOrderAmount)}
            </Text>

            {distanceKm !== null ? (
              <Text className="font-sans text-[12px] text-muted">{distanceKm} km</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
