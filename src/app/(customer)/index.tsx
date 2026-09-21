import { Link, useRouter } from "expo-router";
import { ChevronRight, Search } from "lucide-react-native";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/providers";
import { RestaurantCard } from "@/components/shared/restaurant-card";
import { Body, Heading } from "@/components/ui/primitives";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useRestaurantCategories, useRestaurants } from "@/hooks/use-restaurants";

/**
 * The storefront home.
 *
 * Three rails, each answering a different question a hungry person actually
 * has: what is open right now, what is worth trying, and what kind of food do
 * I want. "Open now" leads because a closed restaurant is not an option, and
 * a list that opens with things you cannot order from wastes the first screen.
 */

function SectionHeader({
  title,
  href,
}: {
  title: string;
  href?: string;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Heading level={3}>{title}</Heading>
      {href !== undefined ? (
        <Link href={href} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`See all ${title.toLowerCase()}`}
            hitSlop={8}
            className="flex-row items-center gap-0.5"
          >
            <Text className="font-sans text-[14px] font-semibold text-brand">See all</Text>
            <ChevronRight size={16} color="#0E7490" />
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

function CardSkeletons() {
  return (
    <View className="gap-3">
      {[0, 1].map((key) => (
        <View key={key} className="gap-2">
          <Skeleton className="h-[140px] w-full rounded-card" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // `acceptingOnly` is the server-side equivalent of the card's canOrderNow
  // gate, so this rail never shows a place that cannot take the order.
  const openNow = useRestaurants({ acceptingOnly: true, limit: 6 });
  const featured = useRestaurants({ limit: 6, sortBy: "rating", sortOrder: "desc" });
  const categories = useRestaurantCategories({ activeOnly: true });

  const refreshing = openNow.isRefetching || featured.isRefetching;

  const onRefresh = React.useCallback(() => {
    void openNow.refetch();
    void featured.refetch();
    void categories.refetch();
  }, [openNow, featured, categories]);

  const firstName = user?.fullName.split(" ")[0];

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerClassName="px-4 pb-8 gap-8"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="gap-3 pt-2">
          <Heading>
            {firstName !== undefined ? `Hungry, ${firstName}?` : "What are you hungry for?"}
          </Heading>

          {/*
            A button that navigates, not an input. Typing on the home screen
            would need its own results list and empty states; sending the tap
            to the restaurants screen reuses the one that already exists.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search restaurants and dishes"
            onPress={() => router.push("/restaurants")}
            className="flex-row items-center gap-2 rounded-input border border-border-default bg-surface px-3 py-3.5"
          >
            <Search size={18} color="#75909F" />
            <Text className="font-sans text-[15px] text-muted">
              Search restaurants or dishes
            </Text>
          </Pressable>
        </View>

        {/* Cuisines, as a horizontal rail. */}
        {categories.data !== undefined && categories.data.items.length > 0 ? (
          <View>
            <SectionHeader title="Cuisines" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pr-4"
            >
              {categories.data.items.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/restaurants",
                      params: { category: category.slug ?? category.name },
                    })
                  }
                  className="rounded-full border border-border-default bg-surface px-4 py-2"
                >
                  <Text className="font-sans text-[14px] font-medium text-primary">
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View>
          <SectionHeader title="Open now" href="/restaurants" />
          {openNow.isPending ? (
            <CardSkeletons />
          ) : openNow.isError ? (
            <ErrorState error={openNow.error} onRetry={() => void openNow.refetch()} />
          ) : openNow.data.items.length === 0 ? (
            <Body muted>
              Nothing is open in your area right now. Try again a little later.
            </Body>
          ) : (
            <View className="gap-3">
              {openNow.data.items.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionHeader title="Top rated" href="/restaurants" />
          {featured.isPending ? (
            <CardSkeletons />
          ) : featured.isError ? (
            <ErrorState error={featured.error} onRetry={() => void featured.refetch()} />
          ) : (
            <View className="gap-3">
              {featured.data.items.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
