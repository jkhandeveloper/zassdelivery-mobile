import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Clock, MapPin, Star } from "lucide-react-native";
import * as React from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MenuItemSheet } from "@/components/shared/menu-item-sheet";
import { Badge, Body, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useMenuItems, useRestaurantMenus } from "@/hooks/use-menus";
import { useRestaurant } from "@/hooks/use-restaurants";
import { formatLandmark, formatPrice, hasText } from "@/lib/utils";
import type { MenuItemDto } from "@/types/menu";

/**
 * A restaurant's menu.
 *
 * Built from two calls rather than one: the menu structure gives the categories
 * and their order, and the item list gives the dishes. They are separate
 * endpoints because the public menu deliberately omits nested items — a
 * restaurant with three hundred dishes would otherwise send all of them in the
 * structure call.
 *
 * A `SectionList` rather than a `ScrollView` of mapped categories: it recycles
 * rows and gives sticky category headers for free, which on a long menu is the
 * difference between knowing where you are and not.
 */

function MenuRow({
  item,
  onPress,
}: {
  item: MenuItemDto;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatPrice(item.effectivePrice)}${item.isAvailable ? "" : ", unavailable"}`}
      onPress={onPress}
      className="flex-row gap-3 border-b border-border-subtle bg-surface px-4 py-3"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={
              item.isAvailable
                ? "font-sans text-[15px] font-semibold text-primary"
                : "font-sans text-[15px] font-semibold text-muted"
            }
          >
            {item.name}
          </Text>
          {item.isVegetarian ? <View className="h-2 w-2 rounded-full bg-success" /> : null}
        </View>

        {hasText(item.description) ? (
          <Text numberOfLines={2} className="font-sans text-[13px] text-secondary">
            {item.description}
          </Text>
        ) : null}

        <View className="flex-row items-center gap-2 pt-0.5">
          <Text
            className="font-sans text-[14px] font-semibold text-primary"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatPrice(item.effectivePrice)}
          </Text>
          {item.discountedPrice !== null ? (
            <Text
              className="font-sans text-[12px] text-muted line-through"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(item.basePrice)}
            </Text>
          ) : null}
        </View>

        {!item.isAvailable ? (
          <Text className="font-sans text-[12px] font-medium text-danger">
            {item.availabilityReason === "sold_out" || item.availabilityReason === "out_of_stock"
              ? "Sold out"
              : item.availabilityReason === "outside_window"
                ? "Not served now"
                : "Unavailable"}
          </Text>
        ) : null}
      </View>

      {hasText(item.imageUrl) ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={{
            width: 82,
            height: 82,
            borderRadius: 14,
            backgroundColor: "#E4EEF5",
            // A sold-out dish is dimmed rather than hidden: the customer may
            // have come looking for this exact thing, and removing it answers a
            // question they did not ask.
            opacity: item.isAvailable ? 1 : 0.45,
          }}
          contentFit="cover"
          transition={150}
          accessible={false}
        />
      ) : null}
    </Pressable>
  );
}

export default function RestaurantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const restaurantSlug = typeof slug === "string" ? slug : "";

  const restaurant = useRestaurant(restaurantSlug);
  const restaurantId = restaurant.data?.id;

  const menus = useRestaurantMenus(restaurantId);
  const items = useMenuItems(restaurantId, { limit: 200 });

  const [selected, setSelected] = React.useState<MenuItemDto | null>(null);

  /**
   * Categories in the menu's own order, each with its dishes.
   *
   * Empty categories are dropped: a restaurant that has defined "Desserts" but
   * listed nothing under it should not show an empty heading, and the API
   * returns the structure regardless of whether anything is in it.
   */
  const sections = React.useMemo(() => {
    const all = items.data?.items ?? [];
    const categories = menus.data?.items.flatMap((menu) => menu.categories) ?? [];

    return categories
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((category) => ({
        title: category.name,
        data: all
          .filter((item) => item.menuCategoryId === category.id)
          .sort((left, right) => left.sortOrder - right.sortOrder),
      }))
      .filter((section) => section.data.length > 0);
  }, [menus.data, items.data]);

  if (restaurant.isPending) {
    return <LoadingState label="Loading the menu…" />;
  }

  if (restaurant.isError) {
    return <ErrorState error={restaurant.error} onRetry={() => void restaurant.refetch()} />;
  }

  const data = restaurant.data;

  return (
    <View className="flex-1 bg-canvas">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerClassName="pb-8"
        refreshing={items.isRefetching}
        onRefresh={() => {
          void restaurant.refetch();
          void items.refetch();
        }}
        ListHeaderComponent={
          <View>
            <View className="relative">
              <Image
                source={hasText(data.coverUrl) ? { uri: data.coverUrl } : undefined}
                style={{ width: "100%", height: 190, backgroundColor: "#E4EEF5" }}
                contentFit="cover"
                transition={200}
                accessible={false}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/restaurants"))}
                hitSlop={8}
                className="absolute left-3 h-10 w-10 items-center justify-center rounded-full bg-surface"
                style={{ top: insets.top + 8 }}
              >
                <ChevronLeft size={22} color="#0A1622" />
              </Pressable>
            </View>

            <View className="gap-2 px-4 py-4">
              <View className="flex-row items-start justify-between gap-2">
                <Heading level={1} className="flex-1">
                  {data.name}
                </Heading>
                {data.canOrderNow ? (
                  <Badge tone="success">Open</Badge>
                ) : data.opensInMinutes !== null && data.opensInMinutes > 0 ? (
                  <Badge tone="warning">Opens in {data.opensInMinutes} min</Badge>
                ) : (
                  <Badge tone="neutral">Closed</Badge>
                )}
              </View>

              {hasText(data.description) ? <Body muted>{data.description}</Body> : null}

              <View className="flex-row flex-wrap items-center gap-3">
                {data.ratingCount > 0 ? (
                  <View className="flex-row items-center gap-1">
                    <Star size={14} color="#FBBF24" fill="#FBBF24" />
                    <Text
                      className="font-sans text-[13px] font-semibold text-primary"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {data.rating.toFixed(1)}
                    </Text>
                    <Text className="font-sans text-[12px] text-muted">
                      ({data.ratingCount})
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row items-center gap-1">
                  <Clock size={14} color="#75909F" />
                  <Text className="font-sans text-[13px] text-secondary">
                    {data.avgPreparationMinutes} min
                  </Text>
                </View>

                <Text className="font-sans text-[13px] text-secondary">
                  Min {formatPrice(data.minOrderAmount)}
                </Text>
              </View>

              <View className="flex-row items-start gap-1.5">
                <MapPin size={14} color="#75909F" />
                <Text className="flex-1 font-sans text-[13px] text-secondary">
                  {data.addressLine}
                  {hasText(data.landmark) ? ` · ${formatLandmark(data.landmark)}` : ""}
                </Text>
              </View>

              {/*
                `canOrderNow` is the flag to gate ordering on — it means
                approved, accepting orders *and* open. Saying so up front beats
                letting someone build a cart they cannot check out.
              */}
              {!data.canOrderNow ? (
                <View className="mt-1 rounded-input bg-warning-soft px-3 py-2.5">
                  <Text className="font-sans text-[13px] font-medium text-warning">
                    You can browse the menu, but this kitchen isn&apos;t taking orders right now.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="border-b border-border-subtle bg-canvas px-4 py-2">
            <Text className="font-display text-[15px] font-bold uppercase tracking-wide text-secondary">
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => <MenuRow item={item} onPress={() => setSelected(item)} />}
        ListEmptyComponent={
          items.isPending || menus.isPending ? (
            <LoadingState label="Loading the menu…" />
          ) : items.isError ? (
            <ErrorState error={items.error} onRetry={() => void items.refetch()} />
          ) : (
            <EmptyState
              title="No menu yet"
              description="This restaurant hasn't published its dishes."
            />
          )
        }
      />

      <MenuItemSheet
        item={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}
