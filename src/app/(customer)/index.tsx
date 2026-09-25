import { Link, useRouter } from "expo-router";
import { Bell, ChevronRight, Search, Sparkles, TicketPercent } from "lucide-react-native";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/providers";
import { RestaurantCard } from "@/components/shared/restaurant-card";
import { HeroBackdrop, useLightStatusBar } from "@/components/ui/hero-backdrop";
import { Body, Heading } from "@/components/ui/primitives";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useUnreadCount } from "@/hooks/use-notifications";
import { useRestaurantCategories, useRestaurants } from "@/hooks/use-restaurants";
import { usePalette } from "@/lib/palette";
import type { RestaurantDto } from "@/types/restaurant";

/**
 * The storefront home.
 *
 * Three rails, each answering a different question a hungry person actually
 * has: what is open right now, what is worth trying, and what kind of food do
 * I want. "Open now" leads because a closed restaurant is not an option, and
 * a list that opens with things you cannot order from wastes the first screen.
 */

/** Emoji make a cuisine rail scannable at a glance; unknown names get a plate. */
const CUISINE_EMOJI: [RegExp, string][] = [
  [/biryani|rice/i, "🍚"],
  [/bbq|grill|tikka|kabab|kebab/i, "🔥"],
  [/karahi|curry|handi/i, "🍲"],
  [/desi|pakistani/i, "🍛"],
  [/chai|coffee|tea/i, "☕"],
  [/dessert|sweet|mithai|ice/i, "🍰"],
  [/beverage|drink|juice|shake/i, "🥤"],
  [/pizza/i, "🍕"],
  [/burger/i, "🍔"],
  [/fast/i, "🍟"],
  [/chinese|asian|noodle/i, "🥡"],
  [/continental|pasta|italian/i, "🍝"],
  [/bakery|bread|cake/i, "🥐"],
  [/breakfast|nashta/i, "🍳"],
  [/sea|fish/i, "🐟"],
  [/healthy|salad/i, "🥗"],
];

function cuisineEmoji(name: string): string {
  return CUISINE_EMOJI.find(([pattern]) => pattern.test(name))?.[1] ?? "🍽️";
}

function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 5) return "Late-night cravings";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function SectionHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: "/restaurants";
}) {
  const palette = usePalette();

  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View className="flex-1 gap-0.5">
        <Heading level={3}>{title}</Heading>
        {subtitle !== undefined ? (
          <Text className="font-sans text-[13px] text-muted">{subtitle}</Text>
        ) : null}
      </View>
      {href !== undefined ? (
        <Link href={href} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`See all ${title.toLowerCase()}`}
            hitSlop={8}
            className="flex-row items-center gap-0.5 rounded-full bg-brand-soft py-1.5 pl-3 pr-2"
          >
            <Text className="font-sans text-[13px] font-semibold text-brand">See all</Text>
            <ChevronRight size={15} color={palette.brand} />
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

function CardSkeletons() {
  return (
    <View className="gap-4">
      {[0, 1].map((key) => (
        <View key={key} className="gap-2">
          <Skeleton className="h-[150px] w-full rounded-card" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </View>
      ))}
    </View>
  );
}

function RestaurantList({ items }: { items: RestaurantDto[] }) {
  return (
    <View className="gap-4">
      {items.map((restaurant) => (
        <RestaurantCard key={restaurant.id} restaurant={restaurant} />
      ))}
    </View>
  );
}

function Hero() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const { user, isAuthenticated } = useAuth();
  const unread = useUnreadCount(isAuthenticated);

  const firstName = user?.fullName.split(" ")[0];
  const unreadTotal = unread.data?.total ?? 0;

  return (
    <View
      collapsable={false}
      className="overflow-hidden rounded-b-hero px-5 pb-6"
      style={{ paddingTop: insets.top + 14 }}
    >
      <HeroBackdrop />

      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="font-sans text-[13px] font-medium" style={{ color: "#9CD8E6" }}>
            {greeting()}
            {firstName !== undefined ? `, ${firstName}` : ""} 👋
          </Text>
          <Text
            className="font-display text-[30px] font-extrabold text-white"
            style={{ letterSpacing: -0.8, lineHeight: 36 }}
          >
            What are you{"\n"}craving today?
          </Text>
        </View>

        {isAuthenticated ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadTotal > 0 ? `Notifications, ${unreadTotal} unread` : "Notifications"
            }
            onPress={() => router.push("/notifications")}
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
          >
            <Bell size={22} color="#FFFFFF" />
            {unreadTotal > 0 ? (
              <View
                collapsable={false}
                className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette.saffron }}
              />
            ) : null}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/login")}
            className="rounded-full bg-white px-4 py-2.5"
          >
            <Text className="font-sans text-[13px] font-bold" style={{ color: "#0A1622" }}>
              Sign in
            </Text>
          </Pressable>
        )}
      </View>

      {/*
        A button that navigates, not an input. Typing on the home screen
        would need its own results list and empty states; sending the tap
        to the restaurants screen reuses the one that already exists.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search restaurants and dishes"
        onPress={() => router.push("/restaurants")}
        className="mt-5 flex-row items-center gap-3 rounded-full bg-surface py-2 pl-4 pr-2"
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <Search size={19} color={palette.textMuted} />
        <Text className="flex-1 font-sans text-[15px] text-muted">Biryani, karahi, burgers…</Text>
        <View
          collapsable={false}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand"
        >
          <Sparkles size={18} color={palette.brandContrast} />
        </View>
      </Pressable>
    </View>
  );
}

function OffersBanner() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="See offers and coupons"
      onPress={() => router.push("/offers")}
      className="flex-row items-center gap-4 overflow-hidden rounded-panel bg-accent-warm p-5"
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      <View
        collapsable={false}
        pointerEvents="none"
        className="absolute -right-8 -top-10 h-40 w-40 rounded-full"
        style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
      />
      <View
        collapsable={false}
        className="h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
      >
        <TicketPercent size={28} color="#FFFFFF" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-display text-[18px] font-extrabold text-white">Deals near you</Text>
        <Text className="font-sans text-[13px]" style={{ color: "#FFE3D3" }}>
          Coupons and offers from restaurants you love
        </Text>
      </View>
      <ChevronRight size={22} color="#FFFFFF" />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  useLightStatusBar();

  // `acceptingOnly` only reflects the owner's "taking orders" switch — the API
  // does not apply opening hours to it — so a place outside its hours still
  // comes back. `canOrderNow` is the flag that combines both, and it is what
  // decides which of these belong under "Open now".
  const accepting = useRestaurants({ acceptingOnly: true, limit: 12 });
  const featured = useRestaurants({
    limit: 6,
    sortBy: "rating",
    sortOrder: "desc",
  });
  const categories = useRestaurantCategories({ activeOnly: true });

  const refreshing = accepting.isRefetching || featured.isRefetching;

  const onRefresh = React.useCallback(() => {
    void accepting.refetch();
    void featured.refetch();
    void categories.refetch();
  }, [accepting, featured, categories]);

  const openNow = accepting.data?.items.filter((restaurant) => restaurant.canOrderNow) ?? [];

  // Nothing open is common late at night. Rather than an empty rail, show what
  // opens soonest, so the customer knows whether it is worth waiting.
  const openingSoon =
    accepting.data?.items
      .filter((restaurant) => !restaurant.canOrderNow)
      .sort((a, b) => (a.opensInMinutes ?? Infinity) - (b.opensInMinutes ?? Infinity))
      .slice(0, 4) ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerClassName="pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Hero />

        <View className="gap-8 px-4 pt-6">
          {categories.data !== undefined && categories.data.items.length > 0 ? (
            <View>
              <SectionHeader title="Cuisines" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3 pr-4"
              >
                {categories.data.items.map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityLabel={category.name}
                    onPress={() =>
                      router.push({
                        pathname: "/restaurants",
                        params: { category: category.slug ?? category.name },
                      })
                    }
                    className="w-[78px] items-center gap-2"
                    style={({ pressed }) => ({
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    })}
                  >
                    <View
                      collapsable={false}
                      className="h-[68px] w-[68px] items-center justify-center rounded-[22px] border border-border-subtle bg-surface"
                    >
                      <Text className="text-[30px]">{cuisineEmoji(category.name)}</Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      className="font-sans text-[12px] font-semibold text-secondary"
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <OffersBanner />

          <View>
            {accepting.isPending ? (
              <>
                <SectionHeader title="Open now" />
                <CardSkeletons />
              </>
            ) : accepting.isError ? (
              <>
                <SectionHeader title="Open now" />
                <ErrorState error={accepting.error} onRetry={() => void accepting.refetch()} />
              </>
            ) : openNow.length > 0 ? (
              <>
                <SectionHeader
                  title="Open now"
                  subtitle="Taking orders right this minute"
                  href="/restaurants"
                />
                <RestaurantList items={openNow} />
              </>
            ) : openingSoon.length > 0 ? (
              <>
                <SectionHeader
                  title="Opening soon"
                  subtitle="Nothing is open near you yet — these open first"
                  href="/restaurants"
                />
                <RestaurantList items={openingSoon} />
              </>
            ) : (
              <>
                <SectionHeader title="Open now" />
                <Body muted>Nothing is open in your area right now. Try again a little later.</Body>
              </>
            )}
          </View>

          <View>
            <SectionHeader
              title="Top rated"
              subtitle="Loved by people nearby"
              href="/restaurants"
            />
            {featured.isPending ? (
              <CardSkeletons />
            ) : featured.isError ? (
              <ErrorState error={featured.error} onRetry={() => void featured.refetch()} />
            ) : (
              <RestaurantList items={featured.data.items} />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
