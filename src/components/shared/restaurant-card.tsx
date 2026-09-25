import { Image } from "expo-image";
import { Link } from "expo-router";
import { Clock, MapPin, ShoppingBag, Star } from "lucide-react-native";
import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Badge } from "@/components/ui/primitives";
import { tileColors, usePalette } from "@/lib/palette";
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

/** "25 min" under an hour, "3h 47m" beyond it — "227 min" makes people do sums. */
function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function OrderingState({ restaurant }: { restaurant: RestaurantDto }) {
  if (restaurant.canOrderNow) {
    return <Badge tone="success">Open</Badge>;
  }

  // "Opens in 25 min" is materially more useful than "Closed" — it is the
  // difference between leaving and waiting.
  if (restaurant.opensInMinutes !== null && restaurant.opensInMinutes > 0) {
    return <Badge tone="warning">Opens in {formatWait(restaurant.opensInMinutes)}</Badge>;
  }

  return <Badge tone="neutral">Closed</Badge>;
}

/**
 * What a restaurant looks like before (or without) a photo: a gradient tile in
 * a colour derived from its name, with its initials. Many listings have no
 * cover yet, and a wall of identical grey boxes makes the whole storefront read
 * as broken; distinct tiles make the list scannable even with no images.
 */
export function RestaurantTile({ name, height }: { name: string; height: number }) {
  const [from, to] = tileColors(name);
  const id = React.useId().replace(/:/g, "");

  const initials = name
    .split(/\s+/)
    .filter((word) => /[A-Za-z]/.test(word[0] ?? ""))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

  return (
    <View collapsable={false} style={{ height, width: "100%" }}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`tile-${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#tile-${id})`} />
        <Circle cx="85%" cy="20%" r="70" fill="#FFFFFF" fillOpacity="0.12" />
        <Circle cx="10%" cy="110%" r="90" fill="#000000" fillOpacity="0.08" />
      </Svg>
      <View collapsable={false} className="flex-1 items-center justify-center">
        <Text
          className="font-display text-[44px] font-extrabold text-white"
          style={{ letterSpacing: -1, opacity: 0.95 }}
        >
          {initials || "Z"}
        </Text>
      </View>
    </View>
  );
}

const IMAGE_HEIGHT = 150;

export function RestaurantCard({ restaurant }: { restaurant: RestaurantDto }) {
  const palette = usePalette();

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
        style={{
          shadowColor: "#031220",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <View collapsable={false} className="relative">
          <RestaurantTile name={restaurant.name} height={IMAGE_HEIGHT} />

          {hasText(restaurant.coverUrl) ? (
            <Image
              source={{ uri: restaurant.coverUrl }}
              style={{
                position: "absolute",
                width: "100%",
                height: IMAGE_HEIGHT,
              }}
              contentFit="cover"
              transition={200}
              accessible={false}
            />
          ) : null}

          {/*
            A closed restaurant is dimmed rather than hidden. The customer may
            well have come looking for this specific place, and removing it
            answers a question they did not ask.
          */}
          {!restaurant.canOrderNow ? (
            <View
              collapsable={false}
              className="absolute inset-0 bg-black/25"
              pointerEvents="none"
            />
          ) : null}

          <View collapsable={false} className="absolute left-3 top-3">
            <OrderingState restaurant={restaurant} />
          </View>

          <View
            collapsable={false}
            className="absolute right-3 top-3 flex-row items-center gap-1 rounded-full bg-surface px-2.5 py-1"
          >
            {restaurant.ratingCount > 0 ? (
              <>
                <Star size={12} color={palette.gold} fill={palette.gold} />
                <Text
                  className="font-sans text-[12px] font-bold text-primary"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {restaurant.rating.toFixed(1)}
                </Text>
                <Text className="font-sans text-[11px] text-muted">({restaurant.ratingCount})</Text>
              </>
            ) : (
              <Text className="font-sans text-[12px] font-bold text-accent-warm">New</Text>
            )}
          </View>
        </View>

        <View className="gap-1 px-4 pb-4 pt-3">
          <Text numberOfLines={1} className="font-display text-[18px] font-bold text-primary">
            {restaurant.name}
          </Text>

          {/* What it cooks, falling back to where it is when uncategorised. */}
          <Text numberOfLines={1} className="font-sans text-[13px] text-secondary">
            {restaurant.categories.length > 0
              ? restaurant.categories.map((category) => category.name).join(" · ")
              : restaurant.zone.name}
          </Text>

          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <MetaChip>
              <Clock size={12} color={palette.textSecondary} />
              <Text className="font-sans text-[12px] font-medium text-secondary">
                {restaurant.avgPreparationMinutes} min
              </Text>
            </MetaChip>

            <MetaChip>
              <ShoppingBag size={12} color={palette.textSecondary} />
              <Text className="font-sans text-[12px] font-medium text-secondary">
                Min {formatPrice(restaurant.minOrderAmount)}
              </Text>
            </MetaChip>

            {distanceKm !== null ? (
              <MetaChip>
                <MapPin size={12} color={palette.textSecondary} />
                <Text className="font-sans text-[12px] font-medium text-secondary">
                  {distanceKm} km
                </Text>
              </MetaChip>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <View
      collapsable={false}
      className="flex-row items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1"
    >
      {children}
    </View>
  );
}
