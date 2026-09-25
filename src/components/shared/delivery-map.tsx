import Constants from "expo-constants";
import { Bike, Crosshair, Home, Store } from "lucide-react-native";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import MapView, {
  AnimatedRegion,
  Marker,
  MarkerAnimated,
  Polyline,
  type MapViewProps,
  type Region,
} from "react-native-maps";

import { usePalette } from "@/lib/palette";
import type { Coordinates } from "@/lib/socket-events";

/**
 * Where the food is, on a map.
 *
 * The web app draws this with Leaflet. Native maps are a different proposition
 * in three ways that shape everything below.
 *
 * **The rider has to move, not teleport.** Position reports arrive every few
 * seconds, so a marker bound straight to the latest fix jumps between distant
 * points and reads as a bug. `AnimatedRegion` interpolates between fixes on the
 * native side, so the dot slides.
 *
 * **The camera must not fight the user.** Auto-fitting the viewport to the
 * markers is right on first paint and wrong the instant someone pans to look
 * ahead down the road — at which point re-fitting every few seconds makes the
 * map unusable. So auto-fit stops for good once the user touches it, and a
 * recentre button gives it back deliberately.
 *
 * **A straight line is not a route.** There is no directions API here, and the
 * `distanceKm` the server reports is straight-line too. The line is drawn
 * dashed and labelled as direct distance rather than dressed up as a road
 * route the rider is not necessarily taking.
 */

interface DeliveryMapProps {
  /** Where the rider collects from. */
  pickup: Coordinates | null;
  /** Null for an address that never resolved to coordinates. */
  destination: Coordinates | null;
  rider: Coordinates | null;
  restaurantName: string;
  /** Straight-line distance left, as reported by the server. */
  distanceKm: number | null;
  height?: number;
}

/** Padding so markers do not sit under the map's edges or the recentre button. */
const FIT_PADDING = { top: 70, right: 60, bottom: 70, left: 60 };

/** Roughly a 1.5 km box — the fallback when there is only one point to show. */
const SINGLE_POINT_DELTA = 0.015;

function MarkerPin({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <View
      className="h-9 w-9 items-center justify-center rounded-full border-2 border-white"
      style={{
        backgroundColor: color,
        shadowColor: "#031220",
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Whether a native map can be mounted at all.
 *
 * iOS always has Apple Maps. Android needs a Google Maps key compiled into the
 * manifest, and without one `MapView` throws "API key not found" on mount —
 * which React Native escalates to tearing down the whole app. A build without a
 * key must still be able to open an order, so it gets `RouteProgress` instead.
 */
const NATIVE_MAP_AVAILABLE =
  Platform.OS !== "android" ||
  (Constants.expoConfig?.extra as { googleMapsAndroid?: boolean } | undefined)
    ?.googleMapsAndroid === true;

export function DeliveryMap(props: DeliveryMapProps) {
  return NATIVE_MAP_AVAILABLE ? <NativeDeliveryMap {...props} /> : <RouteProgress {...props} />;
}

/** Great-circle distance in km. Plenty accurate at delivery scale. */
function haversineKm(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;

  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * The journey without a map: restaurant, rider, door, on one track.
 *
 * The rider's dot sits at how far along the straight line from pickup to
 * destination they have come, from the same live fixes the map would use —
 * so it still moves as they do.
 */
function RouteProgress({
  pickup,
  destination,
  rider,
  restaurantName,
  distanceKm,
}: DeliveryMapProps) {
  const palette = usePalette();

  const remainingKm =
    distanceKm ?? (rider !== null && destination !== null ? haversineKm(rider, destination) : null);

  let progress: number | null = null;

  if (rider !== null && pickup !== null && destination !== null) {
    const total = haversineKm(pickup, destination);
    const left = haversineKm(rider, destination);

    progress = total > 0.01 ? Math.min(1, Math.max(0, 1 - left / total)) : 0.5;
  }

  const stops = [
    { key: "pickup", Icon: Store, label: restaurantName, color: palette.saffron },
    { key: "door", Icon: Home, label: "You", color: palette.success },
  ] as const;

  return (
    <View
      collapsable={false}
      accessibilityLabel={
        rider === null
          ? "Waiting for a rider"
          : `Rider on the way${remainingKm !== null ? `, ${remainingKm.toFixed(1)} km from you` : ""}`
      }
      className="gap-4 rounded-card border border-border-subtle bg-surface p-4"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-[16px] font-bold text-primary">
          {rider === null ? "Waiting for a rider" : "Rider on the way"}
        </Text>
        {remainingKm !== null && rider !== null ? (
          <View collapsable={false} className="rounded-full bg-brand-soft px-3 py-1">
            <Text className="font-sans text-[12px] font-bold text-brand">
              {remainingKm.toFixed(1)} km away
            </Text>
          </View>
        ) : null}
      </View>

      <View collapsable={false} className="h-10 justify-center">
        <View
          collapsable={false}
          className="h-1.5 rounded-full bg-surface-muted"
          style={{ marginHorizontal: 18 }}
        >
          <View
            collapsable={false}
            className="h-1.5 rounded-full bg-brand"
            style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
          />
        </View>

        <View collapsable={false} className="absolute inset-x-0 flex-row justify-between">
          {stops.map(({ key, Icon, color }) => (
            <MarkerPin key={key} color={color}>
              <Icon size={16} color="#FFFFFF" />
            </MarkerPin>
          ))}
        </View>

        {progress !== null ? (
          <View
            collapsable={false}
            className="absolute"
            // Keeps the 36pt pin inside the track at both ends.
            style={{
              left: `${Math.round(progress * 100)}%`,
              marginLeft: -18 * (2 * progress - 1) - 18,
            }}
          >
            <MarkerPin color={palette.brand}>
              <Bike size={16} color="#FFFFFF" />
            </MarkerPin>
          </View>
        ) : null}
      </View>

      <View className="flex-row justify-between">
        {stops.map(({ key, label }) => (
          <Text
            key={key}
            numberOfLines={1}
            className="max-w-[45%] font-sans text-[12px] font-medium text-secondary"
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function NativeDeliveryMap({
  pickup,
  destination,
  rider,
  restaurantName,
  distanceKm,
  height = 260,
}: DeliveryMapProps) {
  const mapRef = React.useRef<MapView>(null);

  /**
   * True once the user has moved the camera themselves.
   *
   * A ref, not state: nothing renders differently because of it, and making it
   * state would re-render the map on the first pan for no reason.
   */
  const userMovedCamera = React.useRef(false);

  const [ready, setReady] = React.useState(false);

  /**
   * The rider's animated position.
   *
   * Created once and mutated thereafter — rebuilding it on each fix would
   * restart the animation from the new value and defeat the point.
   *
   * `useState` with an initialiser rather than `useRef(new …).current`: the ref
   * form constructs a throwaway `AnimatedRegion` on every render and then
   * discards it, and reading `.current` during render is exactly what the React
   * Compiler refuses to compile.
   */
  const [riderPosition] = React.useState(
    () =>
      new AnimatedRegion({
        latitude: rider?.latitude ?? pickup?.latitude ?? 0,
        longitude: rider?.longitude ?? pickup?.longitude ?? 0,
        latitudeDelta: 0,
        longitudeDelta: 0,
      }),
  );

  /** Whether a rider dot has ever had a real position to show. */
  const hasRider = rider !== null;
  const riderSeen = React.useRef(false);

  React.useEffect(() => {
    if (rider === null) {
      return;
    }

    // The first fix is a jump by definition — there is nowhere to slide from —
    // so it is applied instantly and only later ones are animated.
    if (!riderSeen.current) {
      riderSeen.current = true;
      riderPosition.setValue({
        latitude: rider.latitude,
        longitude: rider.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });

      return;
    }

    riderPosition
      .timing({
        latitude: rider.latitude,
        longitude: rider.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        // Slightly under the reporting interval, so each slide finishes just
        // before the next fix arrives rather than being cut short by it.
        duration: 1_200,
        useNativeDriver: false,
        // Required by the inherited `Animated.TimingAnimationConfig` type but
        // never read: `AnimatedRegion.timing` overwrites `toValue` per field
        // with that field's own target. A wart in the library's types, not a
        // value with any meaning here.
        toValue: 0,
      })
      .start();
  }, [rider, riderPosition]);

  /** Every point that should be in frame. */
  const points = React.useMemo(
    () => [pickup, destination, rider].filter((point): point is Coordinates => point !== null),
    [pickup, destination, rider],
  );

  const fitToMarkers = React.useCallback(
    (animated: boolean) => {
      const map = mapRef.current;

      if (map === null || points.length === 0) {
        return;
      }

      if (points.length === 1) {
        map.animateToRegion(
          {
            ...points[0],
            latitudeDelta: SINGLE_POINT_DELTA,
            longitudeDelta: SINGLE_POINT_DELTA,
          },
          animated ? 500 : 0,
        );

        return;
      }

      map.fitToCoordinates(points, { edgePadding: FIT_PADDING, animated });
    },
    [points],
  );

  // Re-fit as points appear — a rider being assigned mid-delivery adds a third
  // marker that would otherwise be off-screen — but never after a manual pan.
  React.useEffect(() => {
    if (!ready || userMovedCamera.current) {
      return;
    }

    fitToMarkers(true);
  }, [ready, fitToMarkers]);

  const initialRegion: Region | undefined =
    points.length > 0
      ? {
          ...points[0],
          latitudeDelta: SINGLE_POINT_DELTA,
          longitudeDelta: SINGLE_POINT_DELTA,
        }
      : undefined;

  /**
   * `onPanDrag` is the honest signal on Android, but it does not fire for a
   * pinch. `onRegionChangeComplete` receives `isGesture` on both platforms in
   * this version, which covers pinch, pan and double-tap alike.
   */
  const onRegionChangeComplete: MapViewProps["onRegionChangeComplete"] = (
    _region,
    details,
  ) => {
    if (details?.isGesture === true) {
      userMovedCamera.current = true;
    }
  };

  if (points.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-card border border-border-subtle bg-surface-muted"
        style={{ height }}
      >
        <Text className="px-6 text-center font-sans text-[13px] text-muted">
          The map appears once the restaurant confirms your order.
        </Text>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-card border border-border-subtle" style={{ height }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        onMapReady={() => setReady(true)}
        onRegionChangeComplete={onRegionChangeComplete}
        // The customer is watching a delivery, not navigating. Every one of
        // these controls is either useless here or a way to get lost.
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        accessibilityLabel="Map showing your order on its way"
      >
        {pickup !== null ? (
          <Marker
            coordinate={pickup}
            title={restaurantName}
            description="Picking up from here"
            // Custom marker views are re-rasterised on every frame on Android
            // unless this is off, which visibly drops the frame rate while the
            // rider marker is animating. These pins never change.
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MarkerPin color="#D9480F">
              <Store size={17} color="#FFFFFF" />
            </MarkerPin>
          </Marker>
        ) : null}

        {destination !== null ? (
          <Marker
            coordinate={destination}
            title="Your address"
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MarkerPin color="#0E7490">
              <Home size={17} color="#FFFFFF" />
            </MarkerPin>
          </Marker>
        ) : null}

        {hasRider ? (
          <MarkerAnimated
            coordinate={riderPosition as unknown as Coordinates}
            title="Your rider"
            {...(distanceKm !== null && { description: `${distanceKm.toFixed(1)} km away` })}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            // Above the static pins, so the moving dot is never hidden behind
            // the restaurant it has just left.
            zIndex={10}
          >
            <MarkerPin color="#5B46D9">
              <Bike size={17} color="#FFFFFF" />
            </MarkerPin>
          </MarkerAnimated>
        ) : null}

        {/* Direct distance, not a road route — dashed to say so. */}
        {rider !== null && destination !== null ? (
          <Polyline
            coordinates={[rider, destination]}
            strokeColor="#5B46D9"
            strokeWidth={3}
            lineDashPattern={[8, 8]}
          />
        ) : null}
      </MapView>

      {/*
        Only offered once the user has taken the camera, because before that the
        map is already framed and the button would do nothing visible.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recentre the map on your delivery"
        onPress={() => {
          userMovedCamera.current = false;
          fitToMarkers(true);
        }}
        className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface"
        style={{
          shadowColor: "#031220",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Crosshair size={18} color="#0E7490" />
      </Pressable>

      {/*
        Android renders nothing but a grey grid when the Maps API key is
        missing, with no error anywhere. Saying so beats letting a developer
        conclude the map is broken.
      */}
      {__DEV__ && Platform.OS === "android" && ready === false ? (
        <View className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1">
          <Text className="font-sans text-[10px] text-white">
            Grey map? Set GOOGLE_MAPS_ANDROID_KEY.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
