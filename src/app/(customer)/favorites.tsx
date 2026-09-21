import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ChevronLeft, Heart } from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RequireAuth } from "@/components/shared/role-guard";
import { Card } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useFavorites, useToggleFavoriteRestaurant } from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import { hasText } from "@/lib/utils";

/**
 * Saved restaurants and dishes.
 *
 * `target` distinguishes the two, and only a restaurant favourite is navigable
 * — a saved dish has no screen of its own, so it links to nothing and says so
 * by simply not being pressable. Linking it to the restaurant would be a guess,
 * since the favourite carries the item's id, not its kitchen's.
 */
function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const favorites = useFavorites({ limit: 50 });
  const toggle = useToggleFavoriteRestaurant();

  const onRemove = React.useCallback(
    (restaurantId: string) => {
      toggle.mutate(
        { restaurantId, saved: true },
        {
          onSuccess: () => toast.success("Removed from favourites"),
          onError: (error) =>
            toast.error(error instanceof ApiError ? error.message : "Couldn't remove that."),
        },
      );
    },
    [toggle],
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Favourites</Text>
      </View>

      {favorites.isPending ? (
        <LoadingState />
      ) : favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />
      ) : (
        <FlatList
          data={favorites.data.items}
          keyExtractor={(favorite) => favorite.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={favorites.isRefetching}
          onRefresh={() => void favorites.refetch()}
          renderItem={({ item }) => {
            const isRestaurant = item.target === "restaurant";

            return (
              <Card className="flex-row items-center gap-3">
                <Image
                  source={hasText(item.item.imageUrl) ? { uri: item.item.imageUrl } : undefined}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 12,
                    backgroundColor: "#E4EEF5",
                  }}
                  contentFit="cover"
                  accessible={false}
                />

                <View className="flex-1">
                  <Text numberOfLines={1} className="font-sans text-[15px] font-semibold text-primary">
                    {item.item.name}
                  </Text>
                  <Text className="font-sans text-[12px] text-muted">
                    {isRestaurant ? "Restaurant" : "Dish"}
                  </Text>
                </View>

                {isRestaurant ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.item.name} from favourites`}
                    hitSlop={8}
                    disabled={toggle.isPending}
                    onPress={() => onRemove(item.item.id)}
                    className="h-10 w-10 items-center justify-center"
                  >
                    <Heart size={20} color="#DC2626" fill="#DC2626" />
                  </Pressable>
                ) : null}
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title="Nothing saved yet"
              description="Tap the heart on a restaurant to keep it here."
              action={{ label: "Browse restaurants", onPress: () => router.push("/restaurants") }}
            />
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return (
    <RequireAuth>
      <FavoritesScreen />
    </RequireAuth>
  );
}
