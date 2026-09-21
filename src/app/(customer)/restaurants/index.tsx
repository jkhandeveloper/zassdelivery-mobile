import { useLocalSearchParams } from "expo-router";
import { Search, X } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RestaurantCard } from "@/components/shared/restaurant-card";
import { Input, InputAction } from "@/components/ui/input";
import { Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useInfiniteRestaurants } from "@/hooks/use-restaurants-infinite";
import { cn } from "@/lib/utils";

/**
 * The restaurant list: search, cuisine, price, open-now.
 *
 * Same filters as the web app's `/restaurants`, but paged by scrolling rather
 * than by numbered pages.
 */

const PRICE_FILTERS = [
  { value: "BUDGET", label: "₨" },
  { value: "MODERATE", label: "₨₨" },
  { value: "PREMIUM", label: "₨₨₨" },
] as const;

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cn(
        "rounded-full border px-3.5 py-2",
        active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
      )}
    >
      <Text
        className={cn(
          "font-sans text-[13px] font-semibold",
          active ? "text-brand" : "text-secondary",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function RestaurantsScreen() {
  const insets = useSafeAreaInsets();
  // Set when arriving from a cuisine chip on the home screen.
  const params = useLocalSearchParams<{ category?: string }>();

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [openOnly, setOpenOnly] = React.useState(false);
  const [priceRange, setPriceRange] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<string | null>(params.category ?? null);

  /**
   * Debounced, so typing "biryani" is one request rather than seven.
   *
   * 350ms is chosen to sit just past a normal typing cadence: short enough that
   * the list feels reactive, long enough that mid-word keystrokes do not each
   * cost a round trip on a mobile connection.
   */
  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useInfiniteRestaurants({
    limit: 10,
    ...(search !== "" && { search }),
    ...(openOnly && { acceptingOnly: true }),
    ...(priceRange !== null && { priceRange }),
    ...(category !== null && { category }),
  });

  const restaurants = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const hasFilters = openOnly || priceRange !== null || category !== null || search !== "";

  const clearFilters = React.useCallback(() => {
    setOpenOnly(false);
    setPriceRange(null);
    setCategory(null);
    setSearchInput("");
    setSearch("");
  }, []);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="gap-3 px-4 pb-3 pt-2">
        <Heading level={2}>Restaurants</Heading>

        <Input
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search restaurants or dishes"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          // `search` on iOS clears the field with the built-in control, which
          // users expect from a search box.
          clearButtonMode="never"
          trailing={
            searchInput === "" ? (
              <View className="h-10 w-10 items-center justify-center">
                <Search size={18} color="#75909F" />
              </View>
            ) : (
              <InputAction label="Clear search" onPress={() => setSearchInput("")}>
                <X size={18} color="#75909F" />
              </InputAction>
            )
          }
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["open", ...PRICE_FILTERS.map((price) => price.value)]}
          keyExtractor={(item) => item}
          contentContainerClassName="gap-2"
          renderItem={({ item }) => {
            if (item === "open") {
              return (
                <FilterChip
                  label="Open now"
                  active={openOnly}
                  onPress={() => setOpenOnly((previous) => !previous)}
                />
              );
            }

            const price = PRICE_FILTERS.find((entry) => entry.value === item);

            if (price === undefined) return null;

            return (
              <FilterChip
                label={price.label}
                active={priceRange === price.value}
                onPress={() =>
                  setPriceRange((previous) => (previous === price.value ? null : price.value))
                }
              />
            );
          }}
          ListFooterComponent={
            hasFilters ? (
              <FilterChip label="Clear" active={false} onPress={clearFilters} />
            ) : null
          }
          ListFooterComponentStyle={{ marginLeft: 8 }}
        />
      </View>

      {query.isPending ? (
        <LoadingState label="Finding restaurants…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(restaurant) => restaurant.id}
          renderItem={({ item }) => <RestaurantCard restaurant={item} />}
          contentContainerClassName="gap-3 px-4 pb-8"
          // Fetch the next page before the user reaches the end, so the list
          // does not visibly stall at the bottom.
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={
            <EmptyState
              title="Nothing matched"
              description={
                hasFilters
                  ? "Try removing a filter, or search for something else."
                  : "There are no restaurants listed in your area yet."
              }
              {...(hasFilters && {
                action: { label: "Clear filters", onPress: clearFilters },
              })}
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#0E7490" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
