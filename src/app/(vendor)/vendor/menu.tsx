import { Minus, Plus, Search, X } from "lucide-react-native";
import * as React from "react";
import { FlatList, Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VendorGate } from "@/components/shared/vendor-gate";
import { Button } from "@/components/ui/button";
import { Input, InputAction } from "@/components/ui/input";
import { Badge, Card, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useAdjustStock, useUpdateMenuItem, useVendorMenuItems } from "@/hooks/use-vendor";
import { ApiError } from "@/lib/api-client";
import { cn, formatPrice, hasText } from "@/lib/utils";
import { MenuItemStatus } from "@/types/enums";
import type { MenuItemAdminDto } from "@/types/menu";
import type { RestaurantAdminDto } from "@/types/restaurant";

/**
 * The menu, from the kitchen's side.
 *
 * Built around the two things a vendor does here during service — mark
 * something sold out, and correct a stock count — rather than around editing
 * dishes, which is a rarer, calmer job. The status switch is the primary
 * control on every row for that reason.
 *
 * Status and stock are separate concerns and both are offered, because they
 * answer different questions. Flipping a dish to `OUT_OF_STOCK` takes it off
 * until the vendor puts it back — what a kitchen wants when it has run out for
 * the day. Adjusting stock by a delta is for a kitchen counting portions, where
 * the dish comes back on by itself once there is stock again.
 *
 * Authoring dishes is deliberately not here: variants, add-on groups and images
 * make a long form that belongs on a bigger screen. This screen is for running
 * a menu during service, not writing one.
 */

type StatusFilter = "all" | "available" | "unavailable";

function DishRow({ item }: { item: MenuItemAdminDto }) {
  const updateItem = useUpdateMenuItem();
  const adjustStock = useAdjustStock();

  const busy = updateItem.isPending || adjustStock.isPending;

  const onError = React.useCallback((error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : "Couldn't save that.");
  }, []);

  const setAvailable = (next: boolean) => {
    updateItem.mutate(
      {
        itemId: item.id,
        // OUT_OF_STOCK, not HIDDEN: the customer is told the dish is sold out
        // rather than being shown a menu that silently lost an item they came
        // for. HIDDEN is for something taken off the menu altogether.
        data: { status: next ? MenuItemStatus.AVAILABLE : MenuItemStatus.OUT_OF_STOCK },
      },
      {
        onSuccess: () =>
          toast.success(next ? `${item.name} is back on` : `${item.name} marked sold out`),
        onError,
      },
    );
  };

  /**
   * Stock moves by a delta, not to an absolute count.
   *
   * That is what `PATCH …/stock` takes, and it is the right primitive here: two
   * people in the same kitchen adjusting the same dish both get their change,
   * whereas two absolute writes mean whoever saved second silently overwrites
   * the first. "Sold three" is also what a cook actually knows.
   */
  const adjust = (delta: number) => {
    adjustStock.mutate(
      { itemId: item.id, data: { delta } },
      {
        onSuccess: () => toast.success(delta > 0 ? "Stock added" : "Stock reduced"),
        onError,
      },
    );
  };

  return (
    <Card className="gap-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-sans text-[15px] font-semibold text-primary">{item.name}</Text>
          {hasText(item.description) ? (
            <Text numberOfLines={1} className="font-sans text-[13px] text-secondary">
              {item.description}
            </Text>
          ) : null}

          <View className="mt-1 flex-row items-center gap-2">
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
        </View>

        <View className="items-end gap-1">
          <Switch
            value={item.status === MenuItemStatus.AVAILABLE}
            disabled={busy}
            accessibilityLabel={
              item.status === MenuItemStatus.AVAILABLE
                ? `Mark ${item.name} sold out`
                : `Put ${item.name} back on the menu`
            }
            onValueChange={setAvailable}
            trackColor={{ false: "#CFDFE9", true: "#22D3EE" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          {/*
            `availabilityReason` is the server's own explanation for why a dish
            is not orderable, and it distinguishes cases the vendor can fix
            (sold out, no stock) from ones they cannot (outside its time window).
          */}
          {!item.isAvailable ? (
            <Badge tone="danger">
              {item.availabilityReason === "sold_out"
                ? "Sold out"
                : item.availabilityReason === "out_of_stock"
                  ? "No stock"
                  : item.availabilityReason === "outside_window"
                    ? "Outside hours"
                    : "Hidden"}
            </Badge>
          ) : item.isLowStock ? (
            <Badge tone="warning">Low stock</Badge>
          ) : null}

          {item.trackInventory ? (
            <Text
              className="font-sans text-[12px] text-muted"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {item.stockQuantity} in stock
            </Text>
          ) : null}
        </View>

        {item.trackInventory ? (
          <View className="flex-row items-center rounded-input border border-border-default">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reduce ${item.name} stock by one`}
              onPress={() => adjust(-1)}
              disabled={busy || item.stockQuantity <= 0}
              className="h-9 w-9 items-center justify-center"
            >
              <Minus size={15} color={item.stockQuantity <= 0 ? "#A7C0D1" : "#0A1622"} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ten to ${item.name} stock`}
              onPress={() => adjust(10)}
              disabled={busy}
              className="h-9 items-center justify-center px-2"
            >
              <Text className="font-sans text-[13px] font-semibold text-brand">+10</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add one to ${item.name} stock`}
              onPress={() => adjust(1)}
              disabled={busy}
              className="h-9 w-9 items-center justify-center"
            >
              <Plus size={15} color="#0A1622" />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function VendorMenu({ restaurant }: { restaurant: RestaurantAdminDto }) {
  const insets = useSafeAreaInsets();

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<StatusFilter>("all");

  // Debounced, so typing a dish name is one request rather than several.
  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const items = useVendorMenuItems(restaurant.id, {
    limit: 200,
    ...(search !== "" && { search }),
  });

  const filtered = React.useMemo(() => {
    const all = items.data?.items ?? [];

    if (filter === "available") {
      return all.filter((item) => item.isAvailable);
    }

    if (filter === "unavailable") {
      return all.filter((item) => !item.isAvailable);
    }

    return all;
  }, [items.data, filter]);

  const unavailableCount = (items.data?.items ?? []).filter((item) => !item.isAvailable).length;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="gap-3 px-4 pb-2 pt-2">
        <Heading level={2}>Menu</Heading>

        <Input
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search your dishes"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
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

        <View className="flex-row gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "available", label: "On the menu" },
              {
                key: "unavailable",
                label: unavailableCount > 0 ? `Off (${unavailableCount})` : "Off",
              },
            ] as const
          ).map((option) => {
            const active = filter === option.key;

            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(option.key)}
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
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {items.isPending ? (
        <LoadingState label="Loading your menu…" />
      ) : items.isError ? (
        <ErrorState error={items.error} onRetry={() => void items.refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshing={items.isRefetching}
          onRefresh={() => void items.refetch()}
          renderItem={({ item }) => <DishRow item={item} />}
          ListEmptyComponent={
            <EmptyState
              title={search !== "" ? "No dishes matched" : "No dishes yet"}
              description={
                search !== ""
                  ? "Try a different search."
                  : // Creating a dish needs variants, add-on groups and images —
                    // a long form that belongs on a bigger screen. The app
                    // deliberately covers running the menu, not authoring it.
                    "Add your first dishes on the web dashboard, then run the menu from here."
              }
            />
          }
        />
      )}
    </View>
  );
}

export default function Screen() {
  return <VendorGate>{(restaurant) => <VendorMenu restaurant={restaurant} />}</VendorGate>;
}
