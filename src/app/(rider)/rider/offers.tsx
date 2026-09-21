import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRealtimeEvent } from "@/components/providers";
import { OfferCard } from "@/components/shared/offer-card";
import { RiderGate } from "@/components/shared/rider-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useRiderOffers } from "@/hooks/use-riders";
import { DriverAvailability } from "@/types/enums";
import type { RiderDto } from "@/types/rider";

/**
 * Every open offer.
 *
 * The list is kept honest by two mechanisms at once, because either alone
 * fails: the socket delivers a new offer instantly, and the twenty-second poll
 * inside `useRiderOffers` catches the ones a dropped connection missed and
 * retires the ones that lapsed server-side. A rider staring at an offer that
 * expired two minutes ago is worse than one that took a moment to appear.
 */
function RiderOffers({ rider }: { rider: RiderDto }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isOnline = rider.availability !== DriverAvailability.OFFLINE;
  const offers = useRiderOffers({ liveOnly: true }, isOnline);

  useRealtimeEvent(
    "delivery:offered",
    React.useCallback(() => {
      void offers.refetch();
    }, [offers]),
  );

  // `isLive` is the server's own call on whether an offer is still answerable.
  // Filtering on it rather than on the expiry timestamp avoids the client and
  // the server disagreeing over a second of clock skew.
  const live = offers.data?.items.filter((offer) => offer.isLive) ?? [];

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/rider"))}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E7490" />
        </Pressable>
        <Text className="font-display text-[19px] font-bold text-primary">Offers</Text>
      </View>

      {!isOnline ? (
        <EmptyState
          title="You're offline"
          description="Go online from your dashboard to start receiving offers."
          action={{ label: "Go to dashboard", onPress: () => router.replace("/rider") }}
        />
      ) : offers.isPending ? (
        <LoadingState label="Looking for offers…" />
      ) : offers.isError ? (
        <ErrorState error={offers.error} onRetry={() => void offers.refetch()} />
      ) : (
        <FlatList
          data={live}
          keyExtractor={(offer) => offer.id}
          renderItem={({ item }) => <OfferCard offer={item} />}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={offers.isRefetching}
          onRefresh={() => void offers.refetch()}
          ListEmptyComponent={
            <EmptyState
              title="Nothing right now"
              description="You'll be alerted the moment an offer lands near you."
            />
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return <RiderGate>{(rider) => <RiderOffers rider={rider} />}</RiderGate>;
}
